<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createChildVideo, setVideo, useVideo } from './video.svelte.js';

	interface Props {
		/** The frame children always see. */
		frame: number;
		children: Snippet;
	}

	let { frame, children }: Props = $props();

	setVideo(createChildVideo(useVideo(), () => frame));
</script>

{@render children()}
