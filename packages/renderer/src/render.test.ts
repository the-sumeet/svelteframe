import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { FPS, FRAMES, skip, startFixture, VIDEO_FPS, VIDEO_FRAMES, type Fixture } from '../test/fixture.js';
import { renderVideo } from './render.js';

/** These render the fixture page, not the playground. They need ffmpeg and Chromium. */
const RATE = 48000;

let fixture: Fixture;
const page = (query = '') => fixture.page(query);
const outputOf = (name: string) => join(fixture.dir, `${name}.mp4`);
const chunkDirs = () => readdirSync(tmpdir()).filter((name) => name.startsWith('svelteframe-chunks-'));
const leftoverFfmpeg = () => spawnSync('pgrep', ['-f', 'svelteframe-chunks']).stdout.toString().trim();

/** Brightness of each frame (0-255), after the decoder has expanded limited range to full. */
function lumaPerFrame(file: string): number[] {
	const { stdout } = spawnSync(
		'ffmpeg',
		['-v', 'error', '-i', file, '-vf', 'scale=1:1,format=gray', '-f', 'rawvideo', '-'],
		{ maxBuffer: 1 << 24 }
	);
	return [...stdout];
}

/** How the video says its colours are stored. */
function colorInfo(file: string) {
	const { stdout } = spawnSync('ffprobe', [
		'-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt,color_range,color_space,color_primaries,color_transfer', '-of', 'default=noprint_wrappers=1', file
	]);
	return Object.fromEntries(
		stdout.toString().trim().split('\n').map((line) => line.split('=') as [string, string])
	);
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
		fixture = await startFixture();
	});
	after(() => fixture.close());

	for (const concurrency of [1, 3, 7]) {
		it(`puts every frame in the right place with ${concurrency} worker(s), with no gaps`, async () => {
			const output = outputOf(`order-${concurrency}`);
			const result = await renderVideo({ url: page(), output, concurrency });
			assert.equal(result.concurrency, concurrency);
			assert.equal(result.frame, FRAMES);

			const luma = lumaPerFrame(output);
			assert.equal(luma.length, FRAMES, 'frame count');
			luma.forEach((y, frame) => {
				const gray = 4 * frame;
				const expected = gray;
				assert.ok(Math.abs(y - expected) <= 3, `frame ${frame}: luma ${y}, expected ${expected.toFixed(1)}`);
			});

			const times = presentationTimes(output);
			assert.equal(times.length, FRAMES);
			times.slice(1).forEach((t, i) => {
				assert.ok(Math.abs(t - times[i] - 1 / FPS) < 0.001, `gap before frame ${i + 1}: ${t - times[i]}`);
			});
		});
	}

	it('writes standard limited-range BT.709, tagged as such', async () => {
		const output = outputOf('color');
		await renderVideo({ url: page(), output, concurrency: 2 });
		// The stored values, not decoded: the first frame is black, which limited range stores as 16.
		const { stdout } = spawnSync('ffmpeg', ['-v', 'error', '-i', output, '-frames:v', '1', '-pix_fmt', 'yuv420p', '-f', 'rawvideo', '-']);
		assert.ok(Math.abs(stdout[0] - 16) <= 1, `stored luma ${stdout[0]}`);
		assert.deepEqual(colorInfo(output), {
			pix_fmt: 'yuv420p',
			color_range: 'tv',
			color_space: 'bt709',
			color_transfer: 'bt709',
			color_primaries: 'bt709'
		});
	});

	it('creates the folders the output is in', async () => {
		for (const concurrency of [1, 3]) {
			const output = join(fixture.dir, `nested-${concurrency}`, 'a', 'b', 'video.mp4');
			await renderVideo({ url: page('frames=6'), output, concurrency });
			assert.equal(lumaPerFrame(output).length, 6, `concurrency ${concurrency}`);
		}
	});

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

	describe('with video from <OffthreadVideo>', () => {
		const hasAudioStream = (file: string) =>
			spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file]).stdout.toString().includes('audio');

		for (const concurrency of [1, 3]) {
			it(`puts the right frame of the video in each frame, with ${concurrency} worker(s)`, async () => {
				const output = outputOf(`video-${concurrency}`);
				await renderVideo({ url: page('video=frames.mp4'), output, concurrency });
				const luma = lumaPerFrame(output);
				assert.equal(luma.length, FRAMES);
				luma.forEach((y, n) => {
					// A 30 fps composition over a 24 fps video: frame k of the video is gray 3k scaled to full range.
					const k = Math.min(Math.floor((n * VIDEO_FPS) / FPS + 1e-6), VIDEO_FRAMES - 1);
					const expected = (3 * k * 255) / 219;
					assert.ok(Math.abs(y - expected) <= 2.5, `frame ${n} should show video frame ${k}: luma ${y}, expected ${expected.toFixed(1)}`);
				});
			});
		}

		it('mixes the sound of the video', async () => {
			const output = outputOf('video-sound');
			const result = await renderVideo({ url: page('video=frames-audio.mp4&audio=frames-audio.mp4'), output, concurrency: 2 });
			assert.equal(result.audioSegments, 1);
			assert.ok(hasAudioStream(output));
		});

		it('renders a video with no sound without trying to mix it', async () => {
			const output = outputOf('video-silent');
			const result = await renderVideo({ url: page('video=frames.mp4&audio=frames.mp4'), output, concurrency: 2 });
			assert.equal(result.audioSegments, 0);
			assert.equal(hasAudioStream(output), false);
			assert.equal(lumaPerFrame(output).length, FRAMES);
		});

		it('fails with the reason when the video cannot be used, and cleans up', async () => {
			const output = outputOf('video-missing');
			await assert.rejects(() => renderVideo({ url: page('video=tone.wav'), output, concurrency: 2 }), /tone\.wav" has no video stream/);
			assert.equal(existsSync(output), false);
			assert.equal(leftoverFfmpeg(), '');
			assert.deepEqual(readdirSync(tmpdir()).filter((n) => n.startsWith('svelteframe-video-')), []);
		});
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
