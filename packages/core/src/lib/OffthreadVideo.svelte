<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Audio from './Audio.svelte';
	import { continueRender, delayRender, failRender, type RenderHandle } from './delay-render.js';
	import { usePlayback, useRenderMode } from './environment.js';
	import { activeFramesOf, gainOf, syncMedia } from './media-sync.js';
	import { useVideo } from './video.svelte.js';

	interface Props {
		/** The video file. */
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
		/** Leave the video's sound out. */
		muted?: boolean;
		/** How the picture fills the box, like CSS `object-fit`. */
		fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
		class?: string;
		style?: string;
	}

	let {
		src,
		startFrom = 0,
		endAt,
		volume = 1,
		playbackRate = 1,
		muted = false,
		fit = 'contain',
		class: className,
		style
	}: Props = $props();

	const video = useVideo();
	const mode = useRenderMode();
	const playback = usePlayback();

	const url = $derived(
		typeof document === 'undefined' ? src : new URL(src, document.baseURI).href
	);

	// Frames of this timeline during which the video is shown.
	const activeFrames = $derived(activeFramesOf('OffthreadVideo', startFrom, endAt, playbackRate));
	const shown = $derived(video.frame >= 0 && video.frame < activeFrames);
	// Where in the source the picture comes from, in seconds.
	const time = $derived((startFrom + video.frame * playbackRate) / video.fps);
	const gainAt = (frame: number) => gainOf('OffthreadVideo', volume, frame);

	const box = $derived(
		`display:${shown ? 'block' : 'none'};width:100%;height:100%;object-fit:${fit};${style ?? ''}`
	);

	let img = $state<HTMLImageElement>();
	let element = $state<HTMLVideoElement>();

	// svelte-ignore state_referenced_locally
	if (mode === 'render') {
		// The renderer answers this path itself (see `@svelteframe/renderer`), decoding the frame
		// with ffmpeg so it is exact, whatever the browser would have made of the video.
		const FRAME_PATH = '/__svelteframe/video-frame';

		let objectUrl: string | undefined;

		$effect(() => {
			if (!img || !shown) return;
			const target = img;
			const frameUrl = `${FRAME_PATH}?src=${encodeURIComponent(url)}&time=${time}`;
			const label = `<OffthreadVideo src="${src}"> at ${time.toFixed(3)}s`;

			let handle: RenderHandle | undefined = delayRender(label);
			const abort = new AbortController();

			(async () => {
				try {
					const response = await fetch(frameUrl, { signal: abort.signal });
					if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
					const blob = await response.blob();
					abort.signal.throwIfAborted();
					const next = URL.createObjectURL(blob);
					target.src = next;
					if (objectUrl) URL.revokeObjectURL(objectUrl);
					objectUrl = next;
					// Decoded, so the first screenshot has the picture.
					await target.decode?.().catch(() => {});
					if (handle !== undefined) continueRender(handle);
					handle = undefined;
				} catch (error) {
					// Aborted because the frame changed again: the new frame has its own handle.
					if (abort.signal.aborted || handle === undefined) return;
					const failing = handle;
					handle = undefined;
					const reason = error instanceof Error ? error.message : String(error);
					failRender(failing, new Error(`<OffthreadVideo> could not show ${label}: ${reason}`));
				}
			})();

			return () => {
				abort.abort();
				if (handle !== undefined) continueRender(handle);
				handle = undefined;
			};
		});

		onDestroy(() => {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		});
	} else {
		onMount(() => () => element?.pause());

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

		$effect(() => {
			if (element) element.muted = muted;
		});
	}
</script>

{#if mode === 'render'}
	<!-- The picture is set from the effect above; `alt` is empty because it is a frame of a video. -->
	<img bind:this={img} alt="" class={className} style={box} />
	{#if !muted}
		<Audio {src} {startFrom} {endAt} {volume} {playbackRate} />
	{/if}
{:else}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video bind:this={element} {src} class={className} style={box} preload="auto" playsinline></video>
{/if}
