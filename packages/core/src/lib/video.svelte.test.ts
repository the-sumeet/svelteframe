import { describe, expect, it } from 'vitest';
import { VideoState } from './video.svelte.js';

describe('VideoState', () => {
	it('copies config and starts at frame 0', () => {
		const v = new VideoState({ fps: 30, width: 1920, height: 1080, durationInFrames: 150 });
		expect(v.fps).toBe(30);
		expect(v.width).toBe(1920);
		expect(v.height).toBe(1080);
		expect(v.durationInFrames).toBe(150);
		expect(v.frame).toBe(0);
	});

	it('frame is writable', () => {
		const v = new VideoState({ fps: 30, width: 10, height: 10, durationInFrames: 10 });
		v.frame = 7;
		expect(v.frame).toBe(7);
	});
});
