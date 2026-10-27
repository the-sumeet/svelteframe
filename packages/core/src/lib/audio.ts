/**
 * One continuous stretch of a sound to place in the final video. In render mode every
 * `<Audio>` records the stretches it plays; the renderer reads them from
 * `window.__Svelteframe.audio` and mixes them with ffmpeg.
 */
export interface AudioSegment {
	/** Absolute URL of the audio file. */
	src: string;
	/** Video frame at which this stretch starts. */
	startFrame: number;
	/** How many video frames it lasts. */
	durationInFrames: number;
	/** Where in the source file this stretch starts, in seconds. */
	sourceStartSeconds: number;
	/** 1 is normal speed. */
	playbackRate: number;
	/** Gain: constant, or one value per video frame of the segment. May exceed 1. */
	volume: number | number[];
}

export interface AudioRecorderOptions {
	src: string;
	/** Trim: where in the source the sound starts, in seconds. */
	startFromSeconds: number;
	playbackRate: number;
	fps: number;
}

export interface Observation {
	/** Frame on the audio's own timeline (what `useVideo().frame` returns beside it). */
	localFrame: number;
	/** Frame of the composition. */
	absoluteFrame: number;
	/** False when the sound is not due to play, e.g. past its `endAt`. */
	active: boolean;
	volume: number;
}

interface Track {
	startFrame: number;
	localStart: number;
	volume: number[];
}

/**
 * Watches one `<Audio>` frame by frame and groups the frames where it advances in step
 * with the composition into segments. A jump back (a `Loop` wrapping) starts a new
 * segment; a frame where the local time stands still (a `Freeze`) ends it.
 */
export class AudioRecorder {
	readonly #options: AudioRecorderOptions;
	readonly #tracks: Track[] = [];
	#current: Track | undefined;
	#lastLocal: number | undefined;
	#lastAbsolute = -Infinity;

	constructor(options: AudioRecorderOptions) {
		this.#options = options;
	}

	observe({ localFrame, absoluteFrame, active, volume }: Observation): void {
		// Each composition frame is recorded once, however often it is revisited.
		if (absoluteFrame <= this.#lastAbsolute) return;
		this.#lastAbsolute = absoluteFrame;

		const previousLocal = this.#lastLocal;
		this.#lastLocal = localFrame;

		if (!active) {
			this.#current = undefined;
			return;
		}

		const current = this.#current;
		if (
			current &&
			localFrame === current.localStart + current.volume.length &&
			absoluteFrame === current.startFrame + current.volume.length
		) {
			current.volume.push(volume);
			return;
		}

		// Local time did not move although the composition did: the sound is paused.
		if (localFrame === previousLocal) {
			this.#current = undefined;
			return;
		}

		const track: Track = { startFrame: absoluteFrame, localStart: localFrame, volume: [volume] };
		this.#tracks.push(track);
		this.#current = track;
	}

	segments(): AudioSegment[] {
		const { src, startFromSeconds, playbackRate, fps } = this.#options;
		return this.#tracks.map((track) => ({
			src,
			startFrame: track.startFrame,
			durationInFrames: track.volume.length,
			sourceStartSeconds: startFromSeconds + (track.localStart * playbackRate) / fps,
			playbackRate,
			volume: track.volume.every((v) => v === track.volume[0]) ? track.volume[0] : [...track.volume]
		}));
	}
}

const recorders = new Set<AudioRecorder>();

/**
 * Create a recorder whose segments appear in `getAudioManifest()`. Recorders are kept after
 * their component unmounts, because a `<Sequence>` removes its sound from the page as soon
 * as it ends but the renderer reads the manifest only after the last frame.
 */
export function createAudioRecorder(options: AudioRecorderOptions): AudioRecorder {
	const recorder = new AudioRecorder(options);
	recorders.add(recorder);
	return recorder;
}

/** Every segment recorded on this page, ordered by start frame. */
export function getAudioManifest(): AudioSegment[] {
	return [...recorders]
		.flatMap((recorder) => recorder.segments())
		.sort((a, b) => a.startFrame - b.startFrame);
}

/** Forget everything recorded so far. */
export function resetAudioManifest(): void {
	recorders.clear();
}
