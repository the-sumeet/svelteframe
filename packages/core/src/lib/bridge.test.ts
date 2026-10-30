// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exposeBridge } from './bridge.js';
import { VideoState } from './video.svelte.js';

describe('exposeBridge', () => {
	it('attaches window.__Svelteframe and cleans up', async () => {
		const video = new VideoState({ fps: 30, width: 1920, height: 1080, durationInFrames: 60 });
		const cleanup = exposeBridge(video, { fps: 30, width: 1920, height: 1080, durationInFrames: 60 });

		expect(window.__Svelteframe).toBeDefined();
		expect(window.__Svelteframe?.ready).toBe(true);
		expect(window.__Svelteframe?.config.fps).toBe(30);

		await window.__Svelteframe?.setFrame(15);
		expect(video.frame).toBe(15);

		cleanup();
		expect(window.__Svelteframe).toBeUndefined();
	});
});
