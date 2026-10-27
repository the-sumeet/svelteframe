// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudioHarness from './AudioHarness.test.svelte';
import AudioScene from './AudioScene.test.svelte';
import { getAudioManifest, resetAudioManifest } from './audio.js';
import Player from './Player.svelte';
import { VideoState } from './video.svelte.js';

class FakeAudio {
	static instances: FakeAudio[] = [];
	src = '';
	preload = '';
	currentTime = 0;
	volume = 1;
	playbackRate = 1;
	paused = true;
	play = vi.fn(() => {
		this.paused = false;
		return Promise.resolve();
	});
	pause = vi.fn(() => {
		this.paused = true;
	});
	removeAttribute = vi.fn((name: string) => {
		if (name === 'src') this.src = '';
	});
	load = vi.fn();
	constructor() {
		FakeAudio.instances.push(this);
	}
}

const makeVideo = (durationInFrames = 100) =>
	new VideoState({ fps: 30, width: 320, height: 180, durationInFrames });

/** Step through frames one at a time, as a renderer does. */
function renderFrames(video: VideoState, from: number, to: number) {
	for (let frame = from; frame <= to; frame++) {
		video.frame = frame;
		flushSync();
	}
}

beforeEach(() => {
	FakeAudio.instances = [];
	vi.stubGlobal('Audio', FakeAudio);
	resetAudioManifest();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('<Audio> while rendering', () => {
	const mount = (video: VideoState, props: Record<string, unknown> = {}) =>
		render(AudioHarness, { video, mode: 'render', ...props });

	it('does not play anything, it only records', () => {
		const video = makeVideo();
		mount(video);
		renderFrames(video, 0, 5);
		expect(FakeAudio.instances).toHaveLength(0);
	});

	it('records a sound that plays from the start, with an absolute url', () => {
		const video = makeVideo();
		mount(video);
		renderFrames(video, 0, 9);

		const [segment, ...rest] = getAudioManifest();
		expect(rest).toEqual([]);
		expect(segment.src).toMatch(/^https?:\/\/[^/]+\/a\.wav$/);
		expect(segment).toMatchObject({ startFrame: 0, durationInFrames: 10, sourceStartSeconds: 0 });
	});

	it('uses the absolute start frame of the enclosing Sequence, and keeps it after the Sequence ends', () => {
		const video = makeVideo();
		mount(video, { from: 5, durationInFrames: 5 });
		renderFrames(video, 0, 14); // the Sequence unmounts at frame 10

		expect(getAudioManifest()).toMatchObject([{ startFrame: 5, durationInFrames: 5 }]);
	});

	it('applies startFrom and endAt as a trim', () => {
		const video = makeVideo();
		mount(video, { startFrom: 30, endAt: 36 });
		renderFrames(video, 0, 19);

		expect(getAudioManifest()).toMatchObject([
			{ startFrame: 0, durationInFrames: 6, sourceStartSeconds: 1 }
		]);
	});

	it('plays a trimmed sound for fewer frames when it is sped up', () => {
		const video = makeVideo();
		mount(video, { endAt: 10, playbackRate: 2 });
		renderFrames(video, 0, 19);

		expect(getAudioManifest()).toMatchObject([{ durationInFrames: 5, playbackRate: 2 }]);
	});

	it('samples a volume function every frame, relative to the Sequence', () => {
		const video = makeVideo();
		mount(video, { from: 10, durationInFrames: 5, volume: (frame: number) => frame / 10 });
		renderFrames(video, 0, 20);

		const [segment] = getAudioManifest();
		expect((segment.volume as number[]).map((v) => Math.round(v * 10) / 10)).toEqual([
			0, 0.1, 0.2, 0.3, 0.4
		]);
	});

	it('keeps a constant volume as a number, allows boosting above 1, and clamps below 0', () => {
		const video = makeVideo();
		mount(video, { volume: 2.5 });
		renderFrames(video, 0, 3);
		expect(getAudioManifest()[0].volume).toBe(2.5);

		resetAudioManifest();
		const other = makeVideo();
		render(AudioHarness, { video: other, mode: 'render', volume: -1 });
		renderFrames(other, 0, 3);
		expect(getAudioManifest()[0].volume).toBe(0);
	});

	it('records several sounds in start order', () => {
		const video = makeVideo();
		render(AudioHarness, { video, mode: 'render', from: 40, src: '/late.wav' });
		render(AudioHarness, { video, mode: 'render', from: 0, src: '/early.wav' });
		renderFrames(video, 0, 45);

		expect(getAudioManifest().map((s) => [s.src.split('/').pop(), s.startFrame])).toEqual([
			['early.wav', 0],
			['late.wav', 40]
		]);
	});

	it('rejects invalid props', () => {
		const video = makeVideo();
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => render(AudioHarness, { video, mode: 'render', endAt: 5, startFrom: 5 })).toThrow(
			/endAt must be greater than startFrom/
		);
		expect(() => render(AudioHarness, { video, mode: 'render', playbackRate: 0 })).toThrow(
			/playbackRate/
		);
		expect(() => render(AudioHarness, { video, mode: 'render', startFrom: -1 })).toThrow(/startFrom/);
		errors.mockRestore();
	});

	it('fails on a non-finite volume', () => {
		const video = makeVideo();
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => render(AudioHarness, { video, mode: 'render', volume: () => NaN })).toThrow(
			/volume must be finite/
		);
		errors.mockRestore();
	});
});

describe('<Audio> in the preview', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
		// jsdom has no ResizeObserver, which Player's `bind:clientWidth` relies on.
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			}
		);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	const base = { fps: 30, width: 320, height: 180, durationInFrames: 100 };
	const mount = (inputProps: Record<string, unknown> = {}) =>
		render(Player, { ...base, component: AudioScene, inputProps });
	const player = () => screen.getByRole('application');
	const key = (name: string, init: KeyboardEventInit = {}) =>
		fireEvent.keyDown(player(), { key: name, ...init });
	const audio = () => FakeAudio.instances[0];

	it('creates one audio element with the resolved source and stays silent while paused', () => {
		mount();
		expect(FakeAudio.instances).toHaveLength(1);
		expect(audio().src).toMatch(/^https?:\/\/[^/]+\/a\.wav$/);
		expect(audio().play).not.toHaveBeenCalled();
	});

	it('plays when the player plays, and pauses when it pauses', async () => {
		mount();
		await key(' ');
		expect(audio().play).toHaveBeenCalledOnce();
		expect(audio().paused).toBe(false);

		await key(' ');
		expect(audio().paused).toBe(true);
	});

	it('follows the frame when scrubbed while paused, without making sound', async () => {
		mount({ startFrom: 30 });
		await fireEvent.input(screen.getByRole('slider'), { target: { value: '45' } });

		expect(audio().currentTime).toBeCloseTo((30 + 45) / 30);
		expect(audio().play).not.toHaveBeenCalled();
	});

	it('re-syncs when scrubbed while playing', async () => {
		mount();
		await key(' ');
		await fireEvent.input(screen.getByRole('slider'), { target: { value: '60' } });

		expect(audio().currentTime).toBeCloseTo(2);
		expect(audio().paused).toBe(false);
	});

	it('takes the playback rate into account', async () => {
		mount({ playbackRate: 2 });
		await fireEvent.input(screen.getByRole('slider'), { target: { value: '30' } });

		expect(audio().playbackRate).toBe(2);
		expect(audio().currentTime).toBeCloseTo(2); // 30 frames at 2x = 2 seconds of source
	});

	it('applies the volume, clamped to what an audio element allows', async () => {
		mount({ volume: (frame: number) => (frame < 10 ? 0.25 : 5) });
		expect(audio().volume).toBe(0.25);

		await fireEvent.input(screen.getByRole('slider'), { target: { value: '20' } });
		expect(audio().volume).toBe(1);
	});

	it('is silent once endAt has been passed', async () => {
		mount({ endAt: 30 });
		await key(' ');
		expect(audio().paused).toBe(false);

		await fireEvent.input(screen.getByRole('slider'), { target: { value: '40' } });
		expect(audio().paused).toBe(true);
	});

	it('only exists while its Sequence is active', async () => {
		mount({ from: 20, durationInFrames: 10 });
		expect(FakeAudio.instances).toHaveLength(0);

		await fireEvent.input(screen.getByRole('slider'), { target: { value: '25' } });
		expect(FakeAudio.instances).toHaveLength(1);

		await fireEvent.input(screen.getByRole('slider'), { target: { value: '50' } });
		expect(audio().pause).toHaveBeenCalled();
		expect(audio().src).toBe('');
	});

	it('releases the element when unmounted', () => {
		const { unmount } = mount();
		unmount();
		expect(audio().pause).toHaveBeenCalled();
		expect(audio().removeAttribute).toHaveBeenCalledWith('src');
	});

	it('does not report playback that the browser blocks', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		mount();
		audio().play.mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
		await key(' ');
		await vi.advanceTimersByTimeAsync(0);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('does not record anything for the renderer', async () => {
		mount();
		await key(' ');
		expect(getAudioManifest()).toEqual([]);
	});
});
