<script lang="ts">
	import { onMount } from 'svelte';
	import { createAudioRecorder } from './audio.js';
	import { usePlayback, useRenderMode } from './environment.js';
	import { useVideo } from './video.svelte.js';

	interface Props {
		src: string;
		/** Trim the start: frames of the source to skip. */
		startFrom?: number;
		/** Trim the end: frame of the source at which to stop. */
		endAt?: number;
		/**
		 * A gain, or a function of the frame (relative to the enclosing `<Sequence>`) so it can
		 * change over time. The preview clamps it to 0..1; a render also allows boosting above 1.
		 */
		volume?: number | ((frame: number) => number);
		/** 1 is normal speed; pitch is preserved. */
		playbackRate?: number;
	}

	let { src, startFrom = 0, endAt, volume = 1, playbackRate = 1 }: Props = $props();

	const video = useVideo();
	const mode = useRenderMode();
	const playback = usePlayback();

	/** Position of the audio beyond which it drifts and is re-synced, in seconds. */
	const DRIFT_SECONDS = 0.2;

	const url = $derived(
		typeof document === 'undefined' ? src : new URL(src, document.baseURI).href
	);

	// Frames of this timeline during which the sound is due to play.
	const activeFrames = $derived.by(() => {
		if (!(startFrom >= 0)) throw new Error('<Audio> startFrom must be 0 or more');
		if (!(playbackRate > 0)) throw new Error('<Audio> playbackRate must be greater than 0');
		if (endAt === undefined) return Infinity;
		if (!(endAt > startFrom)) throw new Error('<Audio> endAt must be greater than startFrom');
		return (endAt - startFrom) / playbackRate;
	});

	function gainAt(frame: number): number {
		const gain = typeof volume === 'function' ? volume(frame) : volume;
		if (!Number.isFinite(gain)) throw new Error(`<Audio> volume must be finite, got ${gain}`);
		return Math.max(0, gain);
	}

	if (mode === 'render') {
		// Nothing plays while rendering. The sound is described for the renderer to mix, as it
		// was when mounted, so `src`, `startFrom` and `playbackRate` are read once.
		// svelte-ignore state_referenced_locally
		const recorder = createAudioRecorder({
			src: url,
			startFromSeconds: startFrom / video.fps,
			playbackRate,
			fps: video.fps
		});

		$effect(() => {
			const localFrame = video.frame;
			recorder.observe({
				localFrame,
				absoluteFrame: video.absoluteFrame,
				active: localFrame >= 0 && localFrame < activeFrames,
				volume: gainAt(localFrame)
			});
		});
	} else {
		let element = $state<HTMLAudioElement>();

		onMount(() => {
			const audio = new Audio();
			audio.preload = 'auto';
			audio.src = url;
			element = audio;
			return () => {
				audio.pause();
				audio.removeAttribute('src');
				audio.load();
				element = undefined;
			};
		});

		$effect(() => {
			if (element && element.src !== url) element.src = url;
		});

		$effect(() => {
			const audio = element;
			if (!audio) return;

			const frame = video.frame;
			const target = (startFrom + frame * playbackRate) / video.fps;

			if (!(frame >= 0 && frame < activeFrames)) {
				audio.pause();
				return;
			}

			audio.playbackRate = playbackRate;
			audio.volume = Math.min(1, gainAt(frame));

			if (!playback.playing) {
				// Paused or scrubbing: stay silent but keep the position, so playing resumes in place.
				audio.pause();
				if (Math.abs(audio.currentTime - target) > 0.04) audio.currentTime = target;
				return;
			}

			if (Math.abs(audio.currentTime - target) > DRIFT_SECONDS) audio.currentTime = target;
			if (audio.paused) {
				audio.play().catch((error: unknown) => {
					// Autoplay can be blocked until the viewer interacts, and a pause cancels a pending play.
					const name = (error as { name?: string })?.name;
					if (name !== 'NotAllowedError' && name !== 'AbortError') console.warn(error);
				});
			}
		});
	}
</script>
