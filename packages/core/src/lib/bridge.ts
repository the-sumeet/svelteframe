import { getAudioManifest } from './audio.js';
import { waitUntilReady } from './delay-render.js';
import type { CompositionMetadata } from './composition.js';
import type { VideoState } from './video.svelte.js';
import { tick } from 'svelte';

export interface SvelteframeBridge {
	config: CompositionMetadata;
	ready: boolean;
	setFrame(n: number): Promise<void>;
	readonly audio?: readonly unknown[];
}

declare global {
	interface Window {
		__Svelteframe?: SvelteframeBridge;
		__SvelteframeError?: string;
	}
}

/**
 * Expose `window.__Svelteframe` for the renderer. `setFrame` resolves only once the DOM
 * shows `frame`, every `delayRender` handle is released, and fonts have loaded.
 * Returns a cleanup function.
 */
export function exposeBridge(video: VideoState, config: CompositionMetadata): () => void {
	if (typeof location !== 'undefined') {
		const initial = Number(new URLSearchParams(location.search).get('frame'));
		if (Number.isInteger(initial) && initial >= 0) video.frame = initial;
	}

	const bridge: SvelteframeBridge = {
		config,
		ready: true,
		async setFrame(n) {
			video.frame = n;
			await tick();
			await waitUntilReady();
		},
		get audio() {
			return getAudioManifest();
		}
	};

	if (typeof window !== 'undefined') {
		window.__Svelteframe = bridge;
	} else if (typeof globalThis !== 'undefined') {
		(globalThis as unknown as { __Svelteframe?: SvelteframeBridge }).__Svelteframe = bridge;
	}

	return () => {
		if (typeof window !== 'undefined') {
			delete window.__Svelteframe;
		} else if (typeof globalThis !== 'undefined') {
			delete (globalThis as unknown as { __Svelteframe?: SvelteframeBridge }).__Svelteframe;
		}
	};
}
