// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncHarness from './AsyncHarness.test.svelte';
import { waitUntilReady } from './delay-render.js';
import Img from './Img.svelte';
import { VideoState } from './video.svelte.js';

async function isPending(promise: Promise<unknown>): Promise<boolean> {
	let settled = false;
	promise.then(
		() => (settled = true),
		() => (settled = true)
	);
	await new Promise((resolve) => setTimeout(resolve, 0));
	return !settled;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe('Img', () => {
	it('renders an image and passes attributes through', () => {
		render(Img, { src: 'a.png', alt: 'A', class: 'hero', style: 'width:10px' });
		const img = screen.getByAltText('A') as HTMLImageElement;
		expect(img.getAttribute('src')).toBe('a.png');
		expect(img.className).toBe('hero');
		expect(img.style.width).toBe('10px');
	});

	it('holds the render until the image has loaded', async () => {
		render(Img, { src: 'a.png', alt: 'A' });
		const ready = waitUntilReady();
		expect(await isPending(ready)).toBe(true);

		await fireEvent.load(screen.getByAltText('A'));
		await expect(ready).resolves.toBeUndefined();
	});

	it('fails the render, naming the source, when the image cannot load', async () => {
		render(Img, { src: 'missing.png', alt: 'A' });
		const ready = waitUntilReady();
		const failed = expect(ready).rejects.toThrow('<Img> failed to load "missing.png"');

		await fireEvent.error(screen.getByAltText('A'));
		await failed;
	});

	it('does not wait for an image that finished loading before hydration', async () => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
		vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(640);

		render(Img, { src: 'cached.png', alt: 'A' });
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});

	it('fails when it was already complete but broken', async () => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
		vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);

		render(Img, { src: 'broken.png', alt: 'A' });
		await expect(waitUntilReady()).rejects.toThrow('failed to load "broken.png"');
	});

	it('waits again when the source changes', async () => {
		const { rerender } = render(Img, { src: 'a.png', alt: 'A' });
		await fireEvent.load(screen.getByAltText('A'));
		await expect(waitUntilReady()).resolves.toBeUndefined();

		await rerender({ src: 'b.png', alt: 'A' });
		const ready = waitUntilReady();
		expect(await isPending(ready)).toBe(true);
		expect(screen.getByAltText('A').getAttribute('src')).toBe('b.png');

		await fireEvent.load(screen.getByAltText('A'));
		await expect(ready).resolves.toBeUndefined();
	});

	it('does not leave the render hanging if removed while loading', async () => {
		const { unmount } = render(Img, { src: 'a.png', alt: 'A' });
		const ready = waitUntilReady();
		expect(await isPending(ready)).toBe(true);

		unmount();
		await expect(ready).resolves.toBeUndefined();
	});
});

describe('Img inside a frame change', () => {
	it('is already pending when the frame that mounts it is flushed', async () => {
		const video = new VideoState({ fps: 30, width: 320, height: 180, durationInFrames: 20 });
		render(AsyncHarness, { video });
		expect(screen.queryByTestId('img')).toBeNull();

		// What a renderer does: set the frame, then wait.
		video.frame = 5;
		await tick();
		const ready = waitUntilReady();
		expect(screen.getByTestId('img')).toBeTruthy();
		expect(await isPending(ready)).toBe(true);

		await fireEvent.load(screen.getByTestId('img'));
		await expect(ready).resolves.toBeUndefined();
	});

	it('also catches an image mounted by the frame change itself', async () => {
		const video = new VideoState({ fps: 30, width: 320, height: 180, durationInFrames: 20 });
		render(AsyncHarness, { video });

		video.frame = 5;
		const ready = waitUntilReady(); // no tick in between
		expect(await isPending(ready)).toBe(true);

		await fireEvent.load(screen.getByTestId('img'));
		await expect(ready).resolves.toBeUndefined();
	});
});
