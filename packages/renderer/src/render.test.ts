import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright';
import { renderVideo } from './render.js';

/**
 * These render a small page served from here, not the playground: every frame is a different gray,
 * so the decoded video shows exactly which frame is where. They need ffmpeg and Chromium.
 */
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const hasChromium = existsSync(chromium.executablePath());
const skip = (!hasFfmpeg && 'ffmpeg is not installed') || (!hasChromium && 'Chromium is not installed');

const FPS = 30;
const FRAMES = 60;
const RATE = 48000;

/** One frame is gray `4 * frame`. A page reports what it rendered the way `<Audio>` would. */
const PAGE = `<!doctype html><meta charset="utf-8">
<body style="margin:0"><div id="a" style="width:100vw;height:100vh"></div>
<script>
const q = new URLSearchParams(location.search);
const total = Number(q.get('frames') ?? ${FRAMES});
const failAt = q.has('fail') ? Number(q.get('fail')) : -1;
// Models what <Audio> records: stretches of consecutive frames. A page shows frame 0 as soon as it
// loads, before the renderer has said which frames it wants, and that is recorded too.
const segments = [];
let lastFrame = -1;
function observe(n) {
	if (n <= lastFrame) return; // each frame is recorded once
	lastFrame = n;
	const last = segments[segments.length - 1];
	const gain = (n + 1) / total;
	if (last && n === last.startFrame + last.volume.length) last.volume.push(gain);
	else segments.push({ startFrame: n, volume: [gain] });
}
observe(0);
if (q.has('broken')) {
	window.__SvelteframeError = 'the page is broken';
} else {
	window.__Svelteframe = {
		config: { fps: ${FPS}, width: 160, height: 90, durationInFrames: total },
		ready: true,
		async setFrame(n) {
			if (n === failAt) throw new Error('boom at frame ' + n);
			const g = n * 4;
			document.getElementById('a').style.background = 'rgb(' + g + ',' + g + ',' + g + ')';
			observe(n);
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		},
		// A sound that plays for the whole video, with a volume that rises with the frame.
		get audio() {
			if (!q.has('audio')) return [];
			return segments.map((s) => ({
				src: location.origin + '/tone.wav',
				startFrame: s.startFrame,
				durationInFrames: s.volume.length,
				sourceStartSeconds: s.startFrame / ${FPS},
				playbackRate: 1,
				volume: s.volume
			}));
		}
	};
}
</script>`;

let dir: string;
let server: Server;
let base: string;

const ffmpeg = (...args: string[]) => {
	const result = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]);
	assert.equal(result.status, 0, result.stderr.toString());
};
const page = (query = '') => `${base}/?${query}`;
const outputOf = (name: string) => join(dir, `${name}.mp4`);
const chunkDirs = () => readdirSync(tmpdir()).filter((name) => name.startsWith('svelteframe-chunks-'));
const leftoverFfmpeg = () => spawnSync('pgrep', ['-f', 'svelteframe-chunks']).stdout.toString().trim();

/** Mean gray of every frame, as ffmpeg decodes it. */
function lumaPerFrame(file: string): number[] {
	const { stdout } = spawnSync(
		'ffmpeg',
		['-v', 'error', '-i', file, '-vf', 'scale=1:1,format=gray', '-f', 'rawvideo', '-'],
		{ maxBuffer: 1 << 24 }
	);
	return [...stdout];
}

/** Whether the video stores full-range luma (`yuvj420p`) rather than the usual 16-235. */
function isFullRange(file: string): boolean {
	const { stdout } = spawnSync('ffprobe', [
		'-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt,color_range', '-of', 'csv=p=0', file
	]);
	const [pixFmt, colorRange] = stdout.toString().trim().split(',');
	return pixFmt.startsWith('yuvj') || colorRange === 'pc';
}

/** Presentation times of the video frames, in order. */
function presentationTimes(file: string): number[] {
	const { stdout } = spawnSync('ffprobe', [
		'-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file
	]);
	return stdout.toString().trim().split('\n').map(Number).sort((a, b) => a - b);
}

function decodeAudio(file: string): Int16Array {
	const { stdout } = spawnSync(
		'ffmpeg',
		['-v', 'error', '-i', file, '-vn', '-f', 's16le', '-ac', '1', '-ar', String(RATE), '-'],
		{ maxBuffer: 1 << 28 }
	);
	return Int16Array.from({ length: stdout.length / 2 }, (_, i) => stdout.readInt16LE(i * 2));
}

describe('renderVideo with several pages', { skip }, () => {
	before(async () => {
		dir = await mkdtemp(join(tmpdir(), 'svelteframe-render-test-'));
		ffmpeg('-f', 'lavfi', '-i', 'sine=f=440:d=3:r=44100', join(dir, 'tone.wav'));
		server = createServer(async (req, res) => {
			if (req.url?.startsWith('/tone.wav')) {
				res.writeHead(200, { 'content-type': 'audio/wav' }).end(await readFile(join(dir, 'tone.wav')));
			} else {
				res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
			}
		}).listen(0, '127.0.0.1');
		await new Promise((resolve) => server.once('listening', resolve));
		const address = server.address();
		base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
	});
	after(async () => {
		server.close();
		await rm(dir, { recursive: true, force: true });
	});

	for (const concurrency of [1, 3, 7]) {
		it(`puts every frame in the right place with ${concurrency} worker(s), with no gaps`, async () => {
			const output = outputOf(`order-${concurrency}`);
			const result = await renderVideo({ url: page(), output, concurrency });
			assert.equal(result.concurrency, concurrency);
			assert.equal(result.frame, FRAMES);

			const luma = lumaPerFrame(output);
			assert.equal(luma.length, FRAMES, 'frame count');
			const fullRange = isFullRange(output);
			luma.forEach((y, frame) => {
				const gray = 4 * frame;
				const expected = fullRange ? gray : 16 + (219 * gray) / 255;
				assert.ok(Math.abs(y - expected) <= 3, `frame ${frame}: luma ${y}, expected ${expected.toFixed(1)}`);
			});

			const times = presentationTimes(output);
			assert.equal(times.length, FRAMES);
			times.slice(1).forEach((t, i) => {
				assert.ok(Math.abs(t - times[i] - 1 / FPS) < 0.001, `gap before frame ${i + 1}: ${t - times[i]}`);
			});
		});
	}

	it('reports progress for every frame, counting up to the total', async () => {
		const seen: number[] = [];
		await renderVideo({
			url: page(),
			output: outputOf('progress'),
			concurrency: 3,
			onProgress: (p) => seen.push(p.frame)
		});
		assert.deepEqual(seen, Array.from({ length: FRAMES }, (_, i) => i + 1));
	});

	it('never uses more pages than there are frames', async () => {
		const result = await renderVideo({ url: page('frames=3'), output: outputOf('few'), concurrency: 10 });
		assert.equal(result.concurrency, 3);
		assert.equal(lumaPerFrame(outputOf('few')).length, 3);
	});

	it('joins a sound that spans several pages into exactly what one page produces', async () => {
		const serial = await renderVideo({ url: page('audio=1'), output: outputOf('audio-1'), concurrency: 1 });
		// 7 pages put several boundaries through the sound.
		const parallel = await renderVideo({ url: page('audio=1'), output: outputOf('audio-7'), concurrency: 7 });
		assert.equal(serial.audioSegments, 1);
		assert.equal(parallel.audioSegments, 1, 'segments from the pages are merged back into one');

		const a = decodeAudio(outputOf('audio-1'));
		const b = decodeAudio(outputOf('audio-7'));
		assert.equal(a.length, b.length);
		let differing = 0;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differing++;
		assert.equal(differing, 0, `${differing} samples differ`);
	});

	describe('when something goes wrong', () => {
		it('fails with the error of the worker that failed, and leaves nothing behind', async () => {
			const before = chunkDirs().length;
			const output = outputOf('fails');
			await assert.rejects(
				() => renderVideo({ url: page('fail=45'), output, concurrency: 3 }),
				/boom at frame 45/
			);
			assert.equal(existsSync(output), false, 'no output file');
			assert.equal(chunkDirs().length, before, 'no temporary chunk directory');
			assert.equal(leftoverFfmpeg(), '', 'no ffmpeg left running');
		});

		it('leaves no output file when a single worker fails', async () => {
			const output = outputOf('fails-single');
			await assert.rejects(
				() => renderVideo({ url: page('fail=10'), output, concurrency: 1 }),
				/boom at frame 10/
			);
			assert.equal(existsSync(output), false);
		});

		it('stops all workers and cleans up when aborted', async () => {
			const before = chunkDirs().length;
			const output = outputOf('aborted');
			const controller = new AbortController();
			await assert.rejects(
				() =>
					renderVideo({
						url: page('frames=300'),
						output,
						concurrency: 3,
						signal: controller.signal,
						onProgress: (p) => p.frame >= 10 && controller.abort()
					}),
				{ name: 'AbortError' }
			);
			assert.equal(existsSync(output), false);
			assert.equal(chunkDirs().length, before);
			assert.equal(leftoverFfmpeg(), '');
		});

		it('fails fast, with the reason, when the page cannot load', async () => {
			const started = Date.now();
			await assert.rejects(
				() => renderVideo({ url: page('broken=1'), output: outputOf('broken'), concurrency: 3 }),
				/failed to load: the page is broken/
			);
			assert.ok(Date.now() - started < 10_000, 'did not wait for a timeout');
		});

		it('rejects an invalid concurrency', async () => {
			await assert.rejects(
				() => renderVideo({ url: page(), output: outputOf('bad'), concurrency: 0 }),
				/positive integer/
			);
		});
	});
});
