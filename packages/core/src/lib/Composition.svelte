<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setVideo, type VideoState } from './video.svelte.js';

	interface Props {
		video: VideoState;
		children: Snippet;
	}

	let { video, children }: Props = $props();

	// svelte-ignore state_referenced_locally
	setVideo(video);
</script>

<div
	style="position:relative;overflow:hidden;width:{video.width}px;height:{video.height}px"
>
	{@render children()}
</div>
