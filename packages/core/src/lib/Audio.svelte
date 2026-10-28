<script lang="ts">
	import { onMount } from 'svelte';
	import { createAudioRecorder } from './audio.js';
	import { usePlayback, useRenderMode } from './environment.js';
	import { activeFramesOf, gainOf, syncMedia } from './media-sync.js';
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

	const url = $derived(
		typeof document === 'undefined' ? src : new URL(src, document.baseURI).href
	);

	// Frames of this timeline during which the sound is due to play.
	const activeFrames = $derived(activeFramesOf('Audio', startFrom, endAt, playbackRate));

	const gainAt = (frame: number) => gainOf('Audio', volume, frame);

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
			if (!element) return;
			syncMedia(element, {
				frame: video.frame,
				fps: video.fps,
				startFrom,
				playbackRate,
				activeFrames,
				volume: gainAt(video.frame),
				playing: playback.playing
			});
		});
	}
</script>
