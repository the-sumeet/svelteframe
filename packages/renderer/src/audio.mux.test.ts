import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { muxAudio, type AudioSegment } from './audio.js';

/** These run the real ffmpeg: what a filter graph does with timestamps is not visible in its text. */
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const RATE = 48000;
const FPS = 30;
const FRAMES = 90; // a 3 second video
/** AAC encodes in 1024-sample frames, so decoded length can exceed the exact length by one. */
const AAC_FRAME_SECONDS = 1024 / RATE;

let dir: string;
const ffmpeg = (...args: string[]) => {
	const result = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]);
	assert.equal(result.status, 0, result.stderr.toString());
};
const source = (name: string) => pathToFileURL(join(dir, name)).href;

function decode(file: string): Int16Array {
	const { stdout } = spawnSync(
		'ffmpeg',
		['-v', 'error', '-i', file, '-vn', '-f', 's16le', '-ac', '1', '-ar', String(RATE), '-'],
		{ maxBuffer: 1 << 28 }
	);
	return Int16Array.from({ length: stdout.length / 2 }, (_, i) => stdout.readInt16LE(i * 2));
}

const rms = (x: Int16Array, from: number, length: number) => {
	const a = Math.floor(from * RATE);
	const b = Math.min(x.length, Math.floor((from + length) * RATE));
	let sum = 0;
	for (let i = a; i < b; i++) sum += x[i] * x[i];
	return Math.sqrt(sum / Math.max(1, b - a));
};

/** Time of the first 2 ms window louder than `threshold`, or -1. */
function onset(x: Int16Array, threshold = 500): number {
	for (let t = 0; t < x.length / RATE; t += 0.002) if (rms(x, t, 0.002) > threshold) return t;
	return -1;
}

async function mux(name: string, segments: AudioSegment[]): Promise<Int16Array> {
	const output = join(dir, `${name}.mp4`);
	await muxAudio({ videoPath: join(dir, 'video.mp4'), output, segments, fps: FPS, totalFrames: FRAMES });
	return decode(output);
}

const segment = (overrides: Partial<AudioSegment>): AudioSegment => ({
	src: source('tone.wav'),
	startFrame: 0,
	durationInFrames: 30,
	sourceStartSeconds: 0,
	playbackRate: 1,
	volume: 1,
	...overrides
});

describe('muxAudio with ffmpeg', { skip: !hasFfmpeg && 'ffmpeg is not installed' }, () => {
	before(async () => {
		dir = await mkdtemp(join(tmpdir(), 'svelteframe-mux-test-'));
		// 3s of 440Hz.
		ffmpeg('-f', 'lavfi', '-i', 'sine=f=440:d=3:r=44100', join(dir, 'tone.wav'));
		// 2s: 0.5s of silence, a 0.5s tone, then silence. The tone begins at exactly 0.5s.
		ffmpeg(
			'-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
			'-f', 'lavfi', '-i', 'sine=f=440:d=0.5:r=44100',
			'-filter_complex', '[0:a]atrim=duration=0.5[a];[1:a]anull[b];[0:a]atrim=duration=1[c];[a][b][c]concat=n=3:v=0:a=1',
			join(dir, 'late-tone.wav')
		);
		ffmpeg('-f', 'lavfi', '-i', 'testsrc=s=160x90:r=30:d=3', '-pix_fmt', 'yuv420p', join(dir, 'video.mp4'));
	});
	after(() => rm(dir, { recursive: true, force: true }));

	it('adds an audio track exactly as long as the video, keeping the picture', async () => {
		const audio = await mux('plain', [segment({})]);
		assert.ok(Math.abs(audio.length / RATE - 3) <= AAC_FRAME_SECONDS + 0.001, `${audio.length / RATE}s`);
		const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', join(dir, 'plain.mp4')]);
		assert.deepEqual(probe.stdout.toString().trim().split('\n').sort(), ['aac', 'h264']);
	});

	it('starts a segment on its start frame, also when that is a fraction of a millisecond', async () => {
		for (const startFrame of [15, 7]) {
			const audio = await mux(`start-${startFrame}`, [segment({ startFrame })]);
			assert.ok(Math.abs(onset(audio) - startFrame / FPS) < 0.01, `frame ${startFrame}: ${onset(audio)}`);
		}
	});

	it('keeps all of a delayed segment that also skips into its source (timestamp regression)', async () => {
		// Trimming the start of the source and delaying it used to lose most of the delay.
		const audio = await mux('trim-delay', [
			segment({ src: source('late-tone.wav'), startFrame: 10, sourceStartSeconds: 0.25, durationInFrames: 60 })
		]);
		assert.ok(Math.abs(audio.length / RATE - 3) <= AAC_FRAME_SECONDS + 0.001, `${audio.length / RATE}s`);
		// The tone is 0.25s into the trimmed source, and the segment starts 10 frames in.
		assert.ok(Math.abs(onset(audio) - (10 / FPS + 0.25)) < 0.01, `onset ${onset(audio)}`);
	});

	it('plays faster without changing pitch, and trims the source', async () => {
		const audio = await mux('rate', [
			segment({ src: source('late-tone.wav'), sourceStartSeconds: 0.25, playbackRate: 2, durationInFrames: 30 })
		]);
		// The tone starts 0.25s into the trimmed source: 0.125s at double speed (atempo adds ~10ms of latency).
		assert.ok(Math.abs(onset(audio) - 0.125) < 0.02, `onset ${onset(audio)}`);
		// And lasts 0.25s instead of 0.5s.
		let end = onset(audio);
		while (rms(audio, end, 0.002) > 100) end += 0.002;
		assert.ok(Math.abs(end - onset(audio) - 0.25) < 0.03, `length ${end - onset(audio)}`);
	});

	it('follows a volume curve', async () => {
		const audio = await mux('curve', [
			segment({ startFrame: 30, volume: Array.from({ length: 30 }, (_, i) => i / 29) })
		]);
		const full = rms(audio, 1.9, 0.05);
		for (const t of [1.2, 1.5, 1.8]) {
			const expectedGain = ((t + 0.025) * FPS - 30) / 29;
			assert.ok(Math.abs(rms(audio, t, 0.05) / full - expectedGain) < 0.08, `t=${t}`);
		}
	});

	it('mixes segments without losing either, and the result is as long as the video', async () => {
		const audio = await mux('mix', [
			segment({ src: source('late-tone.wav'), startFrame: 7, sourceStartSeconds: 0.25, playbackRate: 2 }),
			segment({ startFrame: 45, volume: Array.from({ length: 30 }, (_, i) => i / 29) })
		]);
		assert.ok(Math.abs(audio.length / RATE - 3) <= AAC_FRAME_SECONDS + 0.001, `${audio.length / RATE}s`);
		assert.ok(rms(audio, 0.4, 0.1) > 500, 'first segment is audible');
		assert.ok(rms(audio, 2.3, 0.1) > 500, 'second segment is audible');
		assert.ok(rms(audio, 1.2, 0.2) < 50, 'and silence is silent');
	});

	it('cuts a segment that runs past the end of the video', async () => {
		const audio = await mux('past-end', [segment({ startFrame: 80, durationInFrames: 30 })]);
		assert.ok(Math.abs(audio.length / RATE - 3) <= AAC_FRAME_SECONDS + 0.001, `${audio.length / RATE}s`);
		assert.ok(rms(audio, 2.75, 0.2) > 500);
	});

	it('replaces the output in place and leaves no temporary files behind', async () => {
		const output = join(dir, 'in-place.mp4');
		ffmpeg('-i', join(dir, 'video.mp4'), '-c', 'copy', output);
		await muxAudio({ videoPath: output, output, segments: [segment({})], fps: FPS, totalFrames: FRAMES });
		assert.ok(decode(output).length > 0);
		const { readdirSync } = await import('node:fs');
		assert.deepEqual(readdirSync(dir).filter((f) => f.startsWith('.svelteframe-')), []);
	});

	it('fails clearly when a source cannot be fetched', async () => {
		await assert.rejects(
			() => mux('missing', [segment({ src: 'http://127.0.0.1:9/nope.wav' })]),
			/fetch|ECONNREFUSED/i
		);
	});
});
