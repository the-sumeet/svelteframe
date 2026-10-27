<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setRenderMode, type RenderMode } from './environment.js';
	import { setVideo, type VideoState } from './video.svelte.js';

	interface Props {
		video: VideoState;
		/** `render` when frames are being captured; `preview` (default) for interactive playback. */
		mode?: RenderMode;
		children: Snippet;
	}

	let { video, mode = 'preview', children }: Props = $props();

	// The composition's identity is fixed for its lifetime, so both are read once.
	// svelte-ignore state_referenced_locally
	setVideo(video);
	// svelte-ignore state_referenced_locally
	setRenderMode(mode);
</script>

<div
	style="position:relative;overflow:hidden;width:{video.width}px;height:{video.height}px"
>
	{@render children()}
</div>
