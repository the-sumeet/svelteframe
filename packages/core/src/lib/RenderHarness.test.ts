// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RenderHarness from './RenderHarness.svelte';
import PlayerProbe from './PlayerProbe.test.svelte';

describe('RenderHarness', () => {
	it('mounts component in render mode and attaches bridge', () => {
		const metadata = { fps: 30, width: 640, height: 360, durationInFrames: 60 };
		render(RenderHarness, {
			props: {
				component: PlayerProbe,
				props: {},
				metadata
			}
		});

		expect(window.__Svelteframe).toBeDefined();
		expect(window.__Svelteframe?.config.width).toBe(640);
	});
});
