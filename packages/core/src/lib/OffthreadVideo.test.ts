// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitUntilReady } from './delay-render.js';
import { getAudioManifest, resetAudioManifest } from './audio.js';
import OffthreadVideoHarness from './OffthreadVideoHarness.test.svelte';
import { VideoState } from './video.svelte.js';

const makeVideo = (durationInFrames = 100) =>
	new VideoState({ fps: 30, width: 320, height: 180, durationInFrames });

/** Move to `frame` and wait the way a renderer does. */
async function draw(video: VideoState, frame: number) {
	video.frame = frame;
	flushSync();
	await waitUntilReady();
}

const pending = async (promise: Promise<unknown>) => {
	let settled = false;
	promise.then(
		() => (settled = true),
		() => (settled = true)
	);
	await new Promise((resolve) => setTimeout(resolve, 0));
	return !settled;
};

const parse = (url: string) => {
	const u = new URL(url, 'http://localhost');
	return { path: u.pathname, src: u.searchParams.get('src'), time: Number(u.searchParams.get('time')) };
};

// jsdom does not play media. Not restored between tests: elements are removed after each one.
HTMLMediaElement.prototype.pause = () => {};
HTMLMediaElement.prototype.play = () => Promise.resolve();

let fetchMock: ReturnType<typeof vi.fn>;
let created: string[];
let revoked: string[];

beforeEach(() => {
	resetAudioManifest();
	created = [];
	revoked = [];
	let count = 0;
	fetchMock = vi.fn(async () => new Response(new Blob(['frame']), { status: 200 }));
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('URL', Object.assign(URL, {
		createObjectURL: () => {
			const url = `blob:frame-${count++}`;
			created.push(url);
			return url;
		},
		revokeObjectURL: (url: string) => revoked.push(url)
	}));
	// jsdom has no image decoding.
	Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: () => Promise.resolve() });
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
});

describe('<OffthreadVideo> while rendering', () => {
	const mount = (video: VideoState, props: Record<string, unknown> = {}) =>
		render(OffthreadVideoHarness, { video, mode: 'render', ...props });

	/** Mounted and showing frame 0, as a renderer finds it; the requests so far are forgotten. */
	async function mountReady(video: VideoState, props: Record<string, unknown> = {}) {
		const view = mount(video, props);
		await waitUntilReady();
		const initial = created.slice();
		fetchMock.mockClear();
		created.length = 0;
		revoked.length = 0;
		return { ...view, initial };
	}

	it('asks the renderer for the frame at the time the video is at', async () => {
		const video = makeVideo();
		await mountReady(video);
		await draw(video, 45);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = parse(fetchMock.mock.calls[0][0]);
		expect(request.path).toBe('/__svelteframe/video-frame');
		expect(request.src).toMatch(/^https?:\/\/[^/]+\/clip\.mp4$/);
		expect(request.time).toBeCloseTo(1.5);
	});

	it('shows the frame it received', async () => {
		const video = makeVideo();
		const { container } = await mountReady(video);
		await draw(video, 3);
		const img = container.querySelector('img')!;
		expect(img.getAttribute('src')).toBe(created[0]);
		expect(img.style.objectFit).toBe('contain');
		expect(container.querySelector('video')).toBeNull();
	});

	it('holds the render until the frame has arrived', async () => {
		let answer!: (response: Response) => void;
		const video = makeVideo();
		await mountReady(video);
		fetchMock.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
		video.frame = 1;
		flushSync();

		const ready = waitUntilReady();
		expect(await pending(ready)).toBe(true);
		answer(new Response(new Blob(['x'])));
		await expect(ready).resolves.toBeUndefined();
	});

	it('offsets the time by startFrom, in the Sequence, and scales it by playbackRate', async () => {
		const video = makeVideo();
		await mountReady(video, { from: 10, startFrom: 60, playbackRate: 2 });
		await draw(video, 10);
		await draw(video, 20); // 10 frames into the Sequence

		const times = fetchMock.mock.calls.map(([url]) => parse(url).time);
		expect(times[0]).toBeCloseTo(2); // 60 frames of 30 fps
		expect(times[1]).toBeCloseTo((60 + 10 * 2) / 30);
	});

	it('requests a frame each time the frame changes, and not when it does not', async () => {
		const video = makeVideo();
		const { initial } = await mountReady(video);
		await draw(video, 1);
		await draw(video, 2);
		await draw(video, 2);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(created).toHaveLength(2);
		// Each picture replaces the one before, which is let go.
		expect(revoked).toEqual([...initial, created[0]]);
	});

	it('shows nothing, and asks for nothing, outside the trimmed range', async () => {
		const video = makeVideo();
		const { container } = await mountReady(video, { from: 10, durationInFrames: 5 });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(container.querySelector('img')).toBeNull(); // the Sequence has not started

		for (let frame = 10; frame < 15; frame++) await draw(video, frame);
		expect(fetchMock).toHaveBeenCalledTimes(5);
		await draw(video, 15);
		expect(fetchMock).toHaveBeenCalledTimes(5);
		expect(container.querySelector('img')).toBeNull(); // unmounted
	});

	it('hides the picture when the trim is over but the Sequence goes on', async () => {
		const video = makeVideo();
		const { container } = await mountReady(video, { endAt: 5 });
		await draw(video, 4);
		expect(container.querySelector('img')!.style.display).toBe('block');
		await draw(video, 5);
		expect(container.querySelector('img')!.style.display).toBe('none');
		expect(fetchMock).toHaveBeenCalledTimes(1); // frame 4; frame 5 is past the trim
	});

	it('fails the render with the renderer\'s reason when the frame cannot be made', async () => {
		const video = makeVideo();
		await mountReady(video);
		fetchMock.mockResolvedValueOnce(new Response('"clip.mp4" has no video stream', { status: 500 }));
		video.frame = 7;
		flushSync();
		await expect(waitUntilReady()).rejects.toThrow(
			/<OffthreadVideo> could not show <OffthreadVideo src="\/clip\.mp4"> at 0\.233s: "clip\.mp4" has no video stream/
		);
	});

	it('fails with the status when there is no explanation, or no renderer to ask', async () => {
		const video = makeVideo();
		await mountReady(video);
		fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
		video.frame = 1;
		flushSync();
		await expect(waitUntilReady()).rejects.toThrow(/HTTP 404/);
	});

	it('does not fail the render over a frame that was replaced before it arrived', async () => {
		let answerFirst!: (response: Response) => void;
		const video = makeVideo();
		const { container } = await mountReady(video);
		fetchMock.mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)));
		video.frame = 1;
		flushSync();
		await draw(video, 2); // the first request is abandoned
		answerFirst(new Response(new Blob(['late'])));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(created).toHaveLength(1);
		expect(container.querySelector('img')!.getAttribute('src')).toBe(created[0]);
	});

	it('records the sound for the renderer to mix, unless muted', async () => {
		const video = makeVideo();
		await mountReady(video, { startFrom: 30, volume: 0.5 });
		for (let f = 1; f < 5; f++) await draw(video, f);
		expect(getAudioManifest()).toMatchObject([
			{ startFrame: 0, durationInFrames: 5, sourceStartSeconds: 1, volume: 0.5 }
		]);

		resetAudioManifest();
		const other = makeVideo();
		await mountReady(other, { muted: true });
		for (let f = 1; f < 5; f++) await draw(other, f);
		expect(getAudioManifest()).toEqual([]);
	});

	it('rejects props that cannot describe a video', () => {
		for (const [props, message] of [
			[{ startFrom: -1 }, /<OffthreadVideo> startFrom must be 0 or more/],
			[{ playbackRate: 0 }, /<OffthreadVideo> playbackRate must be greater than 0/],
			[{ startFrom: 10, endAt: 10 }, /<OffthreadVideo> endAt must be greater than startFrom/]
		] as const) {
			expect(() => mount(makeVideo(), props)).toThrow(message);
		}
	});
});

describe('<OffthreadVideo> in the preview', () => {
	it('plays the video itself, with no request to a renderer', async () => {
		const video = makeVideo();
		const { container } = render(OffthreadVideoHarness, { video });
		video.frame = 10;
		flushSync();

		const element = container.querySelector('video')!;
		expect(element.getAttribute('src')).toBe('/clip.mp4');
		expect(element.style.objectFit).toBe('contain');
		expect(container.querySelector('img')).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});

	it('keeps the video at the time of the frame while scrubbing, trimmed and sped up', () => {
		const video = makeVideo();
		const { container } = render(OffthreadVideoHarness, { video, startFrom: 30, playbackRate: 2 });
		const element = container.querySelector('video')!;
		video.frame = 15;
		flushSync();
		expect(element.currentTime).toBeCloseTo((30 + 15 * 2) / 30);
		expect(element.playbackRate).toBe(2);
	});

	it('follows the muted prop', () => {
		const video = makeVideo();
		const { container, rerender } = render(OffthreadVideoHarness, { video, muted: true });
		const element = container.querySelector('video')!;
		expect(element.muted).toBe(true);
		rerender({ video, muted: false });
		flushSync();
		expect(element.muted).toBe(false);
	});

	it('is hidden outside its trim', () => {
		const video = makeVideo();
		const { container } = render(OffthreadVideoHarness, { video, endAt: 5 });
		const element = container.querySelector('video')!;
		expect(element.style.display).toBe('block');
		video.frame = 6;
		flushSync();
		expect(element.style.display).toBe('none');
	});
});
