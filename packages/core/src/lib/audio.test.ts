import { beforeEach, describe, expect, it } from 'vitest';
import {
	AudioRecorder,
	createAudioRecorder,
	getAudioManifest,
	resetAudioManifest,
	type AudioRecorderOptions
} from './audio.js';

const options: AudioRecorderOptions = {
	src: 'http://host/a.wav',
	startFromSeconds: 0,
	playbackRate: 1,
	fps: 30
};

type Step = { local: number; absolute: number; active?: boolean; volume?: number };

function record(recorder: AudioRecorder, steps: Step[]) {
	for (const { local, absolute, active = true, volume = 1 } of steps) {
		recorder.observe({ localFrame: local, absoluteFrame: absolute, active, volume });
	}
	return recorder.segments();
}

/** Frames `absoluteFrom..absoluteFrom+count-1` where the local frame is `absolute - offset`. */
const run = (absoluteFrom: number, count: number, offset = 0): Step[] =>
	Array.from({ length: count }, (_, i) => ({
		local: absoluteFrom + i - offset,
		absolute: absoluteFrom + i
	}));

describe('AudioRecorder', () => {
	it('records nothing until observed', () => {
		expect(new AudioRecorder(options).segments()).toEqual([]);
	});

	it('records a sound that plays from the first frame as one segment', () => {
		const [segment, ...rest] = record(new AudioRecorder(options), run(0, 10));
		expect(rest).toEqual([]);
		expect(segment).toMatchObject({
			src: 'http://host/a.wav',
			startFrame: 0,
			durationInFrames: 10,
			sourceStartSeconds: 0,
			playbackRate: 1,
			volume: 1
		});
	});

	it('starts where the enclosing Sequence starts', () => {
		// Frames 0-59 are not observed (the Sequence is not mounted yet); local = absolute - 60.
		const [segment] = record(new AudioRecorder(options), run(60, 15, 60));
		expect(segment).toMatchObject({ startFrame: 60, durationInFrames: 15, sourceStartSeconds: 0 });
	});

	it('offsets the source by the trim and by how far into the timeline it was first seen', () => {
		const recorder = new AudioRecorder({ ...options, startFromSeconds: 1 });
		// First observed at local frame 15 (mounted late): the sound is already half a second in.
		const [segment] = record(recorder, run(15, 5));
		expect(segment.startFrame).toBe(15);
		expect(segment.sourceStartSeconds).toBeCloseTo(1 + 15 / 30);
	});

	it('scales the source offset by the playback rate', () => {
		const recorder = new AudioRecorder({ ...options, playbackRate: 2 });
		const [segment] = record(recorder, run(30, 3));
		expect(segment.sourceStartSeconds).toBeCloseTo((30 * 2) / 30);
		expect(segment.playbackRate).toBe(2);
	});

	it('starts a new segment when the local frame jumps back (a Loop wrapping)', () => {
		const wraps: Step[] = [
			...Array.from({ length: 10 }, (_, i) => ({ local: i, absolute: i })),
			...Array.from({ length: 10 }, (_, i) => ({ local: i, absolute: 10 + i }))
		];
		const segments = record(new AudioRecorder(options), wraps);
		expect(segments.map((s) => [s.startFrame, s.durationInFrames, s.sourceStartSeconds])).toEqual([
			[0, 10, 0],
			[10, 10, 0]
		]);
	});

	it('stops while local time stands still (a Freeze) and resumes where it left off', () => {
		const steps: Step[] = [
			...run(0, 5), // local 0..4
			...Array.from({ length: 5 }, (_, i) => ({ local: 4, absolute: 5 + i })), // frozen at 4
			...Array.from({ length: 3 }, (_, i) => ({ local: 5 + i, absolute: 10 + i })) // resumes
		];
		const segments = record(new AudioRecorder(options), steps);
		expect(segments.map((s) => [s.startFrame, s.durationInFrames])).toEqual([
			[0, 5],
			[10, 3]
		]);
		expect(segments[1].sourceStartSeconds).toBeCloseTo(5 / 30);
	});

	it('ends a segment when the sound is no longer due to play (endAt reached)', () => {
		const steps = run(0, 10).map((s) => ({ ...s, active: s.local < 6 }));
		const [segment, ...rest] = record(new AudioRecorder(options), steps);
		expect(rest).toEqual([]);
		expect(segment.durationInFrames).toBe(6);
	});

	it('starts again if the sound becomes due to play again', () => {
		const steps = run(0, 12).map((s) => ({ ...s, active: s.local < 3 || s.local >= 8 }));
		const segments = record(new AudioRecorder(options), steps);
		expect(segments.map((s) => [s.startFrame, s.durationInFrames])).toEqual([
			[0, 3],
			[8, 4]
		]);
	});

	it('records each composition frame once, however often it is revisited', () => {
		const steps = [...run(0, 6), ...run(2, 3), ...run(0, 1)];
		const segments = record(new AudioRecorder(options), steps);
		expect(segments).toHaveLength(1);
		expect(segments[0].durationInFrames).toBe(6);
	});

	describe('volume', () => {
		it('collapses a constant volume to a number', () => {
			const [segment] = record(
				new AudioRecorder(options),
				run(0, 5).map((s) => ({ ...s, volume: 0.5 }))
			);
			expect(segment.volume).toBe(0.5);
		});

		it('keeps one value per frame when it changes', () => {
			const [segment] = record(
				new AudioRecorder(options),
				run(0, 5).map((s) => ({ ...s, volume: s.local / 4 }))
			);
			expect(segment.volume).toEqual([0, 0.25, 0.5, 0.75, 1]);
		});

		it('returns copies, so later frames do not change an exported manifest', () => {
			const recorder = new AudioRecorder(options);
			record(recorder, run(0, 3).map((s) => ({ ...s, volume: s.local })));
			const before = recorder.segments()[0];
			record(recorder, run(3, 2).map((s) => ({ ...s, volume: s.local })));
			expect(before.volume).toEqual([0, 1, 2]);
			expect(recorder.segments()[0].volume).toEqual([0, 1, 2, 3, 4]);
		});
	});
});

describe('audio manifest', () => {
	beforeEach(() => resetAudioManifest());

	it('is empty by default', () => {
		expect(getAudioManifest()).toEqual([]);
	});

	it('collects segments from every recorder, ordered by start frame', () => {
		const late = createAudioRecorder({ ...options, src: 'http://host/late.wav' });
		const early = createAudioRecorder({ ...options, src: 'http://host/early.wav' });
		record(late, run(50, 5, 50));
		record(early, run(0, 5));

		expect(getAudioManifest().map((s) => [s.src, s.startFrame])).toEqual([
			['http://host/early.wav', 0],
			['http://host/late.wav', 50]
		]);
	});

	it('can be reset', () => {
		record(createAudioRecorder(options), run(0, 3));
		expect(getAudioManifest()).toHaveLength(1);
		resetAudioManifest();
		expect(getAudioManifest()).toEqual([]);
	});

	it('keeps segments after the component that made them is gone', () => {
		// Recorders hold no reference to a component, so there is nothing to clean up on unmount.
		record(createAudioRecorder(options), run(0, 3));
		expect(getAudioManifest()).toHaveLength(1);
	});
});
