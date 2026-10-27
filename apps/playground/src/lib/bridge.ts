import { getAudioManifest, waitUntilReady, type VideoState } from '@svelteframe/core';
import { tick } from 'svelte';

/**
 * Expose `window.__Svelteframe` for the renderer. `setFrame` resolves only once the DOM
 * shows `frame`, every `delayRender` handle is released and fonts have loaded.
 * Returns a cleanup function.
 */
export function exposeBridge(video: VideoState, config: SvelteframeBridge['config']): () => void {
	const initial = Number(new URLSearchParams(location.search).get('frame'));
	if (Number.isInteger(initial) && initial >= 0) video.frame = initial;

	window.__Svelteframe = {
		config,
		ready: true,
		async setFrame(n) {
			video.frame = n;
			await tick();
			await waitUntilReady();
		},
		// What <Audio> recorded; the renderer reads it after the last frame and mixes the sound.
		get audio() {
			return getAudioManifest();
		}
	};

	return () => {
		delete window.__Svelteframe;
	};
}
