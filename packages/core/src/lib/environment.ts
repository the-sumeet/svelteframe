import { getContext, setContext } from 'svelte';

/** `render` while a renderer captures frames; `preview` for everything interactive. */
export type RenderMode = 'preview' | 'render';

const MODE_KEY = Symbol('svelteframe.mode');

export function setRenderMode(mode: RenderMode): void {
	setContext(MODE_KEY, mode);
}

export function useRenderMode(): RenderMode {
	return getContext<RenderMode | undefined>(MODE_KEY) ?? 'preview';
}

export interface Playback {
	readonly playing: boolean;
}

const PLAYBACK_KEY = Symbol('svelteframe.playback');
const NOT_PLAYING: Playback = { playing: false };

/** Provided by the Player so media can follow play/pause. */
export function setPlayback(playback: Playback): void {
	setContext(PLAYBACK_KEY, playback);
}

export function usePlayback(): Playback {
	return getContext<Playback | undefined>(PLAYBACK_KEY) ?? NOT_PLAYING;
}
