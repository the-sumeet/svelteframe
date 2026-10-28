import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	buildAudioFilter,
	clipAudioSegments,
	mergeAudioSegments,
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

describe('mergeAudioSegments', () => {
	const fps = 30;
	// Frames 0-9 and 10-19 of one sound played at normal speed: the second piece starts 10 frames in.
	const first = segment({ startFrame: 0, durationInFrames: 10 });
	const second = segment({ startFrame: 10, durationInFrames: 10, sourceStartSeconds: 10 / fps });

	it('joins a sound that was split where two pages met', () => {
		assert.deepEqual(mergeAudioSegments([first, second], fps), [segment({ startFrame: 0, durationInFrames: 20 })]);
	});

	it('does not depend on the order it is given', () => {
		assert.deepEqual(mergeAudioSegments([second, first], fps), mergeAudioSegments([first, second], fps));
	});

	it('joins a chain of any length', () => {
		const pieces = [0, 1, 2, 3].map((i) =>
			segment({ startFrame: i * 10, durationInFrames: 10, sourceStartSeconds: (i * 10) / fps })
		);
		assert.deepEqual(mergeAudioSegments(pieces, fps), [segment({ startFrame: 0, durationInFrames: 40 })]);
	});

	it('takes the playback rate into account when checking the source position', () => {
		const rate = 2;
		const a = segment({ startFrame: 0, durationInFrames: 10, playbackRate: rate });
		const b = segment({ startFrame: 10, durationInFrames: 10, playbackRate: rate, sourceStartSeconds: (10 * rate) / fps });
		assert.deepEqual(mergeAudioSegments([a, b], fps), [
			segment({ startFrame: 0, durationInFrames: 20, playbackRate: rate })
		]);
	});

	it('keeps a constant volume constant when both pieces share it', () => {
		const [merged] = mergeAudioSegments([{ ...first, volume: 0.5 }, { ...second, volume: 0.5 }], fps);
		assert.equal(merged.volume, 0.5);
	});

	it('turns differing volumes into one value per frame, in order', () => {
		const [merged] = mergeAudioSegments(
			[
				{ ...first, durationInFrames: 3, volume: [0, 0.1, 0.2] },
				{ ...second, startFrame: 3, durationInFrames: 2, sourceStartSeconds: 3 / fps, volume: 1 }
			],
			fps
		);
		assert.deepEqual(merged.volume, [0, 0.1, 0.2, 1, 1]);
		assert.equal(merged.durationInFrames, 5);
	});

	it('leaves segments that do not continue each other', () => {
		// A gap in the video.
		const gap = segment({ startFrame: 12, durationInFrames: 10, sourceStartSeconds: 12 / fps });
		// A loop starting over: contiguous in the video, but back at the start of the source.
		const loop = segment({ startFrame: 10, durationInFrames: 10, sourceStartSeconds: 0 });
		// Another file, and another speed.
		const other = segment({ src: 'http://host/b.wav', startFrame: 10, durationInFrames: 10, sourceStartSeconds: 10 / fps });
		const faster = segment({ startFrame: 10, durationInFrames: 10, sourceStartSeconds: 10 / fps, playbackRate: 2 });

		for (const next of [gap, loop, other, faster]) {
			assert.equal(mergeAudioSegments([first, next], fps).length, 2);
		}
	});

	it('keeps concurrent sounds apart', () => {
		const music = segment({ src: 'http://host/music.wav', startFrame: 0, durationInFrames: 10 });
		const effect = segment({ src: 'http://host/ding.wav', startFrame: 5, durationInFrames: 10 });
		const musicRest = segment({ src: 'http://host/music.wav', startFrame: 10, durationInFrames: 10, sourceStartSeconds: 10 / fps });

		const result = mergeAudioSegments([music, effect, musicRest], fps);
		assert.equal(result.length, 2);
		assert.deepEqual(
			result.map((s) => [s.src.split('/').pop(), s.startFrame, s.durationInFrames]),
			[
				['music.wav', 0, 20],
				['ding.wav', 5, 10]
			]
		);
	});

	it('does not change what it is given', () => {
		const a = { ...first, volume: [1, 1] };
		const b = { ...second, volume: [0, 0] };
		mergeAudioSegments([a, b], fps);
		assert.deepEqual(a.volume, [1, 1]);
		assert.equal(a.durationInFrames, 10);
		assert.deepEqual(b.volume, [0, 0]);
	});

	it('returns an empty list for no segments', () => {
		assert.deepEqual(mergeAudioSegments([], fps), []);
	});
});

describe('clipAudioSegments', () => {
	const fps = 30;
	const range = { start: 20, end: 40 };
	const sound = (overrides: Partial<AudioSegment>) =>
		segment({ startFrame: 20, durationInFrames: 20, sourceStartSeconds: 20 / fps, ...overrides });

	it('keeps a segment that lies inside the range, untouched', () => {
		const inside = sound({ startFrame: 25, durationInFrames: 5, sourceStartSeconds: 25 / fps });
		assert.deepEqual(clipAudioSegments([inside], range, fps), [inside]);
	});

	it('drops what was recorded outside the range, such as the frame a page shows on load', () => {
		const onLoad = segment({ startFrame: 0, durationInFrames: 1 });
		const later = segment({ startFrame: 50, durationInFrames: 10 });
		assert.deepEqual(clipAudioSegments([onLoad, later], range, fps), []);
		// A segment that merely touches the range does not overlap it.
		assert.deepEqual(clipAudioSegments([segment({ startFrame: 10, durationInFrames: 10 })], range, fps), []);
		assert.deepEqual(clipAudioSegments([segment({ startFrame: 40, durationInFrames: 5 })], range, fps), []);
	});

	it('cuts the front, moving the start in the video and in the source', () => {
		const [clipped] = clipAudioSegments([segment({ startFrame: 10, durationInFrames: 20, playbackRate: 2 })], range, fps);
		assert.equal(clipped.startFrame, 20);
		assert.equal(clipped.durationInFrames, 10);
		// 10 frames skipped at double speed: 20 frames of source.
		assert.ok(Math.abs(clipped.sourceStartSeconds - 20 / fps) < 1e-9);
	});

	it('cuts the end', () => {
		const [clipped] = clipAudioSegments([sound({ durationInFrames: 30 })], range, fps);
		assert.equal(clipped.startFrame, 20);
		assert.equal(clipped.durationInFrames, 20);
		assert.equal(clipped.sourceStartSeconds, 20 / fps);
	});

	it('cuts a per-frame volume to match', () => {
		const volume = Array.from({ length: 30 }, (_, i) => i); // frames 10..39
		const [clipped] = clipAudioSegments([segment({ startFrame: 10, durationInFrames: 30, volume })], range, fps);
		assert.deepEqual(clipped.volume, volume.slice(10, 30));
		assert.equal((clipped.volume as number[]).length, clipped.durationInFrames);
	});

	it('leaves a constant volume alone', () => {
		const [clipped] = clipAudioSegments([segment({ startFrame: 10, durationInFrames: 20, volume: 0.5 })], range, fps);
		assert.equal(clipped.volume, 0.5);
	});

	it('does not change what it is given', () => {
		const original = segment({ startFrame: 10, durationInFrames: 30, volume: [1, 2, 3] });
		clipAudioSegments([original], range, fps);
		assert.equal(original.startFrame, 10);
		assert.deepEqual(original.volume, [1, 2, 3]);
	});

	it('followed by a merge, gives back what one page would have recorded', () => {
		// The same sound seen by two pages that each also recorded frame 0 on load.
		const pageA = [segment({ startFrame: 0, durationInFrames: 20, volume: Array(20).fill(0.5) })];
		const pageB = [
			segment({ startFrame: 0, durationInFrames: 1, volume: [0.5] }),
			segment({ startFrame: 20, durationInFrames: 20, sourceStartSeconds: 20 / fps, volume: Array(20).fill(0.5) })
		];
		const all = [
			...clipAudioSegments(pageA, { start: 0, end: 20 }, fps),
			...clipAudioSegments(pageB, { start: 20, end: 40 }, fps)
		];
		assert.deepEqual(mergeAudioSegments(all, fps), [
			segment({ startFrame: 0, durationInFrames: 40, volume: Array(40).fill(0.5) })
		]);
	});
});
