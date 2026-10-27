import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { chromium, type Browser } from 'playwright';

export interface RenderProgress {
	/** Frames written so far. */
	frame: number;
	total: number;
	elapsedMs: number;
	/** Average rendered frames per second so far. */
	fps: number;
}

export interface RenderOptions {
	/** Page exposing `window.__Svelteframe` (e.g. the playground's `/render` route). */
	url: string;
	output: string;
	onProgress?: (progress: RenderProgress) => void;
	imageFormat?: 'jpeg' | 'png';
	/** JPEG quality, 0-100. Ignored for PNG. */
	quality?: number;
	/** Chromium executable to use instead of Playwright's bundled one. */
	chromiumPath?: string;
	/** Aborting stops rendering and cleans up the browser and ffmpeg. */
	signal?: AbortSignal;
}

interface Bridge {
	config: { fps: number; width: number; height: number; durationInFrames: number };
	ready: boolean;
	setFrame(n: number): Promise<void>;
}

type BridgeGlobal = { __Svelteframe?: Bridge };

const STDERR_LIMIT = 16 * 1024;

export async function renderVideo(opts: RenderOptions): Promise<RenderProgress> {
	const { url, output, onProgress, imageFormat = 'jpeg', quality = 90, chromiumPath, signal } = opts;

	let browser: Browser | undefined;
	let ffmpeg: ReturnType<typeof spawn> | undefined;

	try {
		signal?.throwIfAborted();
		browser = await chromium.launch({ executablePath: chromiumPath });
		const page = await browser.newPage();

		let pageError: Error | undefined;
		page.on('pageerror', (e) => (pageError ??= e));

		await page.goto(url);
		await page.waitForFunction(() => (globalThis as BridgeGlobal).__Svelteframe?.ready === true);

		const { fps, width, height, durationInFrames: total } = await page.evaluate(
			() => (globalThis as BridgeGlobal).__Svelteframe!.config
		);
		await page.setViewportSize({ width, height });

		ffmpeg = spawn(
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
				'-c:v',
				'libx264',
				'-pix_fmt',
				'yuv420p',
				output
			],
			{ stdio: ['pipe', 'ignore', 'pipe'] }
		);

		let stderr = '';
		ffmpeg.stderr!.on('data', (chunk: Buffer) => {
			stderr = (stderr + chunk).slice(-STDERR_LIMIT);
		});
		// EPIPE after ffmpeg dies is reported through `exit` below.
		ffmpeg.stdin!.on('error', () => {});

		const exit = new Promise<void>((resolve, reject) => {
			ffmpeg!.once('error', reject);
			ffmpeg!.once('close', (code) =>
				code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`))
			);
		});
		let ffmpegError: Error | undefined;
		exit.catch((e: Error) => (ffmpegError = e));

		const stdin = ffmpeg.stdin!;
		const started = performance.now();
		let done = 0;

		const progress = (): RenderProgress => {
			const elapsedMs = performance.now() - started;
			return { frame: done, total, elapsedMs, fps: done / (elapsedMs / 1000) };
		};

		for (let f = 0; f < total; f++) {
			signal?.throwIfAborted();
			if (ffmpegError) throw ffmpegError;
			if (pageError) throw pageError;

			await page.evaluate((n) => (globalThis as BridgeGlobal).__Svelteframe!.setFrame(n), f);
			const image = await page.screenshot(
				imageFormat === 'png' ? { type: 'png' } : { type: 'jpeg', quality }
			);

			if (!stdin.write(image)) await Promise.race([once(stdin, 'drain'), exit]);
			done++;
			onProgress?.(progress());
		}

		stdin.end();
		await exit;
		return progress();
	} catch (err) {
		if (ffmpeg) {
			ffmpeg.kill('SIGKILL');
			await unlink(output).catch(() => {});
		}
		throw err;
	} finally {
		await browser?.close().catch(() => {});
	}
}
