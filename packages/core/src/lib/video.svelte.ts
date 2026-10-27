import { getContext, setContext } from 'svelte';

export interface VideoConfig {
	fps: number;
	width: number;
	height: number;
	durationInFrames: number;
}

export interface VideoContext extends VideoConfig {
	readonly frame: number;
}

export class VideoState implements VideoContext {
	frame = $state(0);
	readonly fps: number;
	readonly width: number;
	readonly height: number;
	readonly durationInFrames: number;

	constructor(config: VideoConfig) {
		this.fps = config.fps;
		this.width = config.width;
		this.height = config.height;
		this.durationInFrames = config.durationInFrames;
	}
}

/**
 * A view of `parent` with its own timeline. Used by Sequence, Loop and Freeze,
 * which remap `frame` (and optionally the duration) for their children.
 */
export function createChildVideo(
	parent: VideoContext,
	frame: () => number,
	durationInFrames: () => number = () => parent.durationInFrames
): VideoContext {
	return {
		get frame() {
			return frame();
		},
		get fps() {
			return parent.fps;
		},
		get width() {
			return parent.width;
		},
		get height() {
			return parent.height;
		},
		get durationInFrames() {
			return durationInFrames();
		}
	};
}

const VIDEO_KEY = Symbol('svelteframe.video');

export function setVideo(ctx: VideoContext): void {
	setContext(VIDEO_KEY, ctx);
}

export function useVideo(): VideoContext {
	const ctx = getContext<VideoContext | undefined>(VIDEO_KEY);
	if (!ctx) {
		throw new Error('useVideo() must be called inside a <Composition>');
	}
	return ctx;
}
