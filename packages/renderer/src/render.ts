import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import {
	clipAudioSegments,
	mergeAudioSegments,
	muxAudio,
	parseAudioManifest,
	type AudioSegment
} from './audio.js';
import { concatChunks } from './chunks.js';
import { resolveConcurrency, splitFrames, type FrameRange } from './frames.js';
import { openPage, type BridgeGlobal, type PageHandle } from './page.js';

export interface RenderProgress {
	/** Frames written so far, across all workers. */
	frame: number;
	total: number;
	/** Time spent rendering frames, from the first frame to the last (or to now). */
	elapsedMs: number;
	/** Average rendered frames per second so far. */
	fps: number;
}

export interface RenderResult extends RenderProgress {
	/** Stretches of sound mixed into the video. */
	audioSegments: number;
	/** How many pages rendered frames at once. */
	concurrency: number;
	/** Everything, from launching the browser to the finished file. */
	wallMs: number;
}

export interface RenderOptions {
	/** Page exposing `window.__Svelteframe` (e.g. the playground's `/render/<id>` route). */
	url: string;
	output: string;
	onProgress?: (progress: RenderProgress) => void;
	imageFormat?: 'jpeg' | 'png';
	/** JPEG quality, 0-100. Ignored for PNG. */
	quality?: number;
	/** Chromium executable to use instead of Playwright's bundled one. */
	chromiumPath?: string;
	/** Pages rendering frames at the same time. Defaults to half the CPU cores. */
	concurrency?: number;
	/** Aborting stops rendering and cleans up the browser and ffmpeg. */
	signal?: AbortSignal;
}

const STDERR_LIMIT = 16 * 1024;

interface RangeJob {
	worker: PageHandle;
	range: FrameRange;
	/** Where this worker's ffmpeg writes. */
	output: string;
	fps: number;
	imageFormat: 'jpeg' | 'png';
	quality: number;
	signal: AbortSignal;
	onFrame: () => void;
}

/** Render `range` in one page and encode it into `output` with its own ffmpeg. */
async function renderRange(job: RangeJob): Promise<void> {
	const { worker, range, output, fps, imageFormat, quality, signal, onFrame } = job;

	const ffmpeg = spawn(
		'ffmpeg',
		[
			'-hide_banner',
			'-loglevel',
			'error',
			'-y',
			'-f',
			'image2pipe',
			'-c:v',
			imageFormat === 'png' ? 'png' : 'mjpeg',
			'-framerate',
			String(fps),
			'-i',
			'-',
			// Screenshots are full-range sRGB. Left untagged, ffmpeg writes full-range BT.601
			// (`yuvj420p`), which players show with different contrast and colours. Convert to the
			// standard limited-range BT.709 and say so in the stream.
			'-vf',
			'scale=out_range=tv:out_color_matrix=bt709,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv',
			'-c:v',
			'libx264',
			'-pix_fmt',
			'yuv420p',
			output
		],
		{ stdio: ['pipe', 'ignore', 'pipe'] }
	);

	let stderr = '';
	ffmpeg.stderr.on('data', (chunk: Buffer) => {
		stderr = (stderr + chunk).slice(-STDERR_LIMIT);
	});
	// EPIPE after ffmpeg dies is reported through `exit` below.
	ffmpeg.stdin.on('error', () => {});

	const exit = new Promise<void>((resolve, reject) => {
		ffmpeg.once('error', reject);
		ffmpeg.once('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`))
		);
	});
	let ffmpegError: Error | undefined;
	exit.catch((e: Error) => (ffmpegError = e));

	try {
		for (let frame = range.start; frame < range.end; frame++) {
			signal.throwIfAborted();
			if (ffmpegError) throw ffmpegError;
			const pageError = worker.pageError();
			if (pageError) throw pageError;

			await worker.page.evaluate((n) => (globalThis as BridgeGlobal).__Svelteframe!.setFrame(n), frame);
			const image = await worker.page.screenshot(
				imageFormat === 'png' ? { type: 'png' } : { type: 'jpeg', quality }
			);

			if (!ffmpeg.stdin.write(image)) await Promise.race([once(ffmpeg.stdin, 'drain'), exit]);
			onFrame();
		}

		ffmpeg.stdin.end();
		await exit;
	} catch (err) {
		ffmpeg.kill('SIGKILL');
		await exit.catch(() => {});
		throw err;
	}
}

export async function renderVideo(opts: RenderOptions): Promise<RenderResult> {
	const { url, output, onProgress, imageFormat = 'jpeg', quality = 90, chromiumPath, signal } = opts;
	const wallStart = performance.now();

	// Stops every worker: when the caller aborts, or as soon as one worker fails.
	const abort = new AbortController();
	const forwardAbort = () => abort.abort(signal!.reason);
	if (signal?.aborted) abort.abort(signal.reason);
	else signal?.addEventListener('abort', forwardAbort, { once: true });

	let browser: Browser | undefined;
	let workDir: string | undefined;
	let touchedOutput = false;

	try {
		abort.signal.throwIfAborted();
		// ffmpeg does not create folders.
		await mkdir(dirname(output), { recursive: true });
		browser = await chromium.launch({ executablePath: chromiumPath });

		const first = await openPage(browser, url);
		const { fps, width, height, durationInFrames: total } = await first.page.evaluate(
			() => (globalThis as BridgeGlobal).__Svelteframe!.config
		);

		const ranges = splitFrames(total, resolveConcurrency(opts.concurrency, total));
		const workers = [
			first,
			...(await Promise.all(ranges.slice(1).map(() => openPage(browser!, url))))
		];
		await Promise.all(workers.map((worker) => worker.page.setViewportSize({ width, height })));

		// One worker writes the output directly; several each write a chunk, joined afterwards.
		const parallel = ranges.length > 1;
		if (parallel) workDir = await mkdtemp(join(tmpdir(), 'svelteframe-chunks-'));
		const chunkPath = (i: number) => (parallel ? join(workDir!, `chunk-${i}.mp4`) : output);
		if (!parallel) touchedOutput = true;

		const started = performance.now();
		let finished: number | undefined;
		let done = 0;
		const progress = (): RenderProgress => {
			const elapsedMs = (finished ?? performance.now()) - started;
			return { frame: done, total, elapsedMs, fps: done / (elapsedMs / 1000) };
		};

		let firstError: unknown;
		await Promise.allSettled(
			ranges.map(async (range, i) => {
				try {
					await renderRange({
						worker: workers[i],
						range,
						output: chunkPath(i),
						fps,
						imageFormat,
						quality,
						signal: abort.signal,
						onFrame: () => {
							done++;
							onProgress?.(progress());
						}
					});
				} catch (err) {
					firstError ??= err;
					abort.abort(err);
					throw err;
				}
			})
		);
		if (firstError !== undefined) throw firstError;
		finished = performance.now();

		if (parallel) {
			touchedOutput = true;
			await concatChunks(ranges.map((_, i) => chunkPath(i)), output, workDir!);
		}

		// Sound is added after the picture: `<Audio>` only records what it would play. Each page's
		// recording is cut to the frames that page rendered, and a sound spanning two pages is then
		// stitched back together.
		const recorded: AudioSegment[] = [];
		for (const [i, { page }] of workers.entries()) {
			const manifest = parseAudioManifest(
				await page.evaluate(() => (globalThis as BridgeGlobal).__Svelteframe?.audio)
			);
			recorded.push(...clipAudioSegments(manifest, ranges[i], fps));
		}
		const segments = mergeAudioSegments(recorded, fps);
		if (segments.length > 0) {
			await muxAudio({ videoPath: output, output, segments, fps, totalFrames: total });
		}

		return {
			...progress(),
			audioSegments: segments.length,
			concurrency: ranges.length,
			wallMs: performance.now() - wallStart
		};
	} catch (err) {
		if (touchedOutput) await unlink(output).catch(() => {});
		throw err;
	} finally {
		signal?.removeEventListener('abort', forwardAbort);
		await browser?.close().catch(() => {});
		if (workDir) await rm(workDir, { recursive: true, force: true });
	}
}
