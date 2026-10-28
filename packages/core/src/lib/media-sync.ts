/** Position of the media beyond which it drifts and is re-synced, in seconds. */
export const DRIFT_SECONDS = 0.2;

/**
 * Frames of the timeline during which a trimmed, speed-adjusted piece of media is due to play
 * (`Infinity` with no `endAt`). Throws on values that can't describe one.
 */
export function activeFramesOf(name: string, startFrom: number, endAt: number | undefined, playbackRate: number): number {
	if (!(startFrom >= 0)) throw new Error(`<${name}> startFrom must be 0 or more`);
	if (!(playbackRate > 0)) throw new Error(`<${name}> playbackRate must be greater than 0`);
	if (endAt === undefined) return Infinity;
	if (!(endAt > startFrom)) throw new Error(`<${name}> endAt must be greater than startFrom`);
	return (endAt - startFrom) / playbackRate;
}

/** A gain given as a number or as a function of the frame; never negative, never NaN. */
export function gainOf(name: string, volume: number | ((frame: number) => number), frame: number): number {
	const gain = typeof volume === 'function' ? volume(frame) : volume;
	if (!Number.isFinite(gain)) throw new Error(`<${name}> volume must be finite, got ${gain}`);
	return Math.max(0, gain);
}

export interface MediaSync {
	/** Frame of the enclosing timeline. */
	frame: number;
	fps: number;
	startFrom: number;
	playbackRate: number;
	/** From `activeFramesOf`. */
	activeFrames: number;
	/** 0..1; the element can't be louder than that. */
	volume: number;
	playing: boolean;
}

/** Bring an `<audio>` or `<video>` element to where the timeline says it should be. */
export function syncMedia(element: HTMLMediaElement, { frame, fps, startFrom, playbackRate, activeFrames, volume, playing }: MediaSync): void {
	const target = (startFrom + frame * playbackRate) / fps;

	if (!(frame >= 0 && frame < activeFrames)) {
		element.pause();
		return;
	}

	element.playbackRate = playbackRate;
	element.volume = Math.min(1, volume);

	if (!playing) {
		// Paused or scrubbing: stay silent but keep the position, so playing resumes in place.
		element.pause();
		if (Math.abs(element.currentTime - target) > 0.04) element.currentTime = target;
		return;
	}

	if (Math.abs(element.currentTime - target) > DRIFT_SECONDS) element.currentTime = target;
	if (element.paused) {
		element.play().catch((error: unknown) => {
			// Autoplay can be blocked until the viewer interacts, and a pause cancels a pending play.
			const name = (error as { name?: string })?.name;
			if (name !== 'NotAllowedError' && name !== 'AbortError') console.warn(error);
		});
	}
}
