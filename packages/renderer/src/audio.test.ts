import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	buildAudioFilter,
	parseAudioManifest,
	tempoFilters,
	volumeFilters,
	type AudioSegment
} from './audio.js';

const segment = (overrides: Partial<AudioSegment> = {}): AudioSegment => ({
	src: 'http://host/a.wav',
	startFrame: 0,
	durationInFrames: 30,
	sourceStartSeconds: 0,
	playbackRate: 1,
	volume: 1,
	...overrides
});

/** Evaluate a volume expression the way ffmpeg would at time `t`. */
function evaluate(filters: string[], t: number): number {
	const expression = /volume='(.+)':eval=frame/.exec(filters.join(','))![1];
	return new Function('max', 't', `return ${expression}`)(Math.max, t) as number;
}

describe('tempoFilters', () => {
	it('adds nothing at normal speed', () => {
		assert.deepEqual(tempoFilters(1), []);
	});

	it('uses a single stage within 0.5 to 2', () => {
		assert.deepEqual(tempoFilters(1.5), ['atempo=1.5']);
		assert.deepEqual(tempoFilters(0.5), ['atempo=0.5']);
		assert.deepEqual(tempoFilters(2), ['atempo=2']);
	});

	it('chains stages beyond that range so they multiply to the rate', () => {
		for (const rate of [3, 4, 5.5, 0.25, 0.1, 8]) {
			const stages = tempoFilters(rate).map((f) => Number(f.replace('atempo=', '')));
			assert.ok(stages.every((s) => s >= 0.5 && s <= 2), `${rate}: ${stages}`);
			assert.ok(Math.abs(stages.reduce((a, b) => a * b, 1) - rate) < 1e-4, `${rate}: ${stages}`);
		}
	});

	it('rejects invalid rates', () => {
		assert.throws(() => tempoFilters(0), /greater than 0/);
		assert.throws(() => tempoFilters(-1), /greater than 0/);
	});
});

describe('volumeFilters', () => {
	it('adds nothing for full volume', () => {
		assert.deepEqual(volumeFilters(1, 30), []);
		assert.deepEqual(volumeFilters([1, 1, 1], 30), []);
	});

	it('uses a plain volume for a constant gain, including a boost', () => {
		assert.deepEqual(volumeFilters(0.5, 30), ['volume=0.5']);
		assert.deepEqual(volumeFilters([2.5, 2.5], 30), ['volume=2.5']);
		assert.deepEqual(volumeFilters(0, 30), ['volume=0']);
	});

	it('follows a per-frame curve exactly at the frames and linearly between them', () => {
		const fps = 30;
		const curve = [0, 0.2, 0.4, 0.4, 0.4, 0.1, 0.1, 0.9, 0.5];
		const filters = volumeFilters(curve, fps);
		curve.forEach((gain, i) => {
			assert.ok(Math.abs(evaluate(filters, i / fps) - gain) < 1e-4, `frame ${i}`);
		});
		// Halfway between frames 4 and 5, and 7 and 8.
		assert.ok(Math.abs(evaluate(filters, 4.5 / fps) - 0.25) < 1e-4);
		assert.ok(Math.abs(evaluate(filters, 7.5 / fps) - 0.7) < 1e-4);
		// The last value is held.
		assert.ok(Math.abs(evaluate(filters, 5) - 0.5) < 1e-4);
	});

	it('keeps the expression short for a smooth fade, whatever the number of frames', () => {
		const frames = 900;
		const fade = Array.from({ length: frames }, (_, i) =>
			Math.min(1, i / 30, (frames - 1 - i) / 30)
		);
		const filters = volumeFilters(fade, 30);
		assert.ok(filters.join(',').length < 400, `${filters.join(',').length} characters`);
		assert.ok(Math.abs(evaluate(filters, 15 / 30) - 0.5) < 1e-3);
		assert.ok(Math.abs(evaluate(filters, 450 / 30) - 1) < 1e-3);
	});

	it('quotes the expression, which contains commas', () => {
		assert.match(volumeFilters([0, 1], 30).join(','), /volume='[^']*max\(0,t-0\)[^']*':eval=frame/);
	});

	it('rejects invalid gains', () => {
		assert.throws(() => volumeFilters(-1, 30), /not negative/);
		assert.throws(() => volumeFilters([0, NaN], 30), /finite/);
	});
});

describe('buildAudioFilter', () => {
	const options = { fps: 30, totalFrames: 150 };

	it('builds one chain for a single segment, delayed to its start frame', () => {
		const graph = buildAudioFilter([segment({ startFrame: 60, durationInFrames: 15 })], options);
		assert.equal(
			graph,
			'[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
				'atrim=start=0:duration=0.5,asetpts=PTS-STARTPTS,adelay=2000:all=1[a0];' +
				'[a0]apad=whole_dur=5,atrim=end_sample=240000[aout]'
		);
	});

	it('does not delay a sound that starts with the video', () => {
		assert.ok(!buildAudioFilter([segment()], options).includes('adelay'));
	});

	it('trims the source from its offset, for as long as the segment lasts at its speed', () => {
		const graph = buildAudioFilter(
			[segment({ sourceStartSeconds: 1.5, durationInFrames: 30, playbackRate: 2 })],
			options
		);
		// 30 video frames at 2x consume 2 seconds of source, then atempo squeezes it into 1 second.
		assert.match(graph, /atrim=start=1\.5:duration=2,asetpts=PTS-STARTPTS,atempo=2/);
	});

	it('orders the steps: trim, then tempo, then volume, then delay', () => {
		const graph = buildAudioFilter(
			[segment({ startFrame: 30, playbackRate: 1.5, volume: 0.5 })],
			options
		);
		const order = ['atrim=', 'atempo=', 'volume=', 'adelay='].map((f) => graph.indexOf(f));
		assert.deepEqual(order, [...order].sort((a, b) => a - b));
		assert.ok(order.every((i) => i >= 0));
	});

	it('mixes several segments without normalising their volume', () => {
		const graph = buildAudioFilter(
			[segment(), segment({ src: 'http://host/b.wav', startFrame: 60 })],
			options
		);
		assert.match(graph, /\[1:a\].*\[a0\];\[2:a\].*\[a1\];\[a0\]\[a1\]amix=inputs=2:normalize=0:duration=longest,apad/);
	});

	it('reads segment i from input firstInput + i', () => {
		const graph = buildAudioFilter([segment(), segment()], { ...options, firstInput: 3 });
		assert.ok(graph.includes('[3:a]') && graph.includes('[4:a]'));
	});

	it('refuses an empty list', () => {
		assert.throws(() => buildAudioFilter([], options), /at least one/);
	});
});

describe('parseAudioManifest', () => {
	it('treats a missing manifest as empty', () => {
		assert.deepEqual(parseAudioManifest(undefined), []);
		assert.deepEqual(parseAudioManifest(null), []);
	});

	it('returns valid entries', () => {
		const entries = [segment(), segment({ volume: [0, 0.5, 1] })];
		assert.deepEqual(parseAudioManifest(entries), entries);
	});

	it('rejects anything malformed, saying which entry and field', () => {
		assert.throws(() => parseAudioManifest({}), /must be an array/);
		assert.throws(() => parseAudioManifest([null]), /entry 0 is not an object/);
		assert.throws(() => parseAudioManifest([{ ...segment(), src: '' }]), /entry 0: src/);
		assert.throws(
			() => parseAudioManifest([segment(), { ...segment(), startFrame: 'x' }]),
			/entry 1: startFrame/
		);
		assert.throws(() => parseAudioManifest([{ ...segment(), volume: [1, -1] }]), /volume/);
		assert.throws(() => parseAudioManifest([{ ...segment(), volume: 'loud' }]), /volume/);
	});
});
