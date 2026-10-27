<script lang="ts">
	import type { Snippet } from 'svelte';
	import AbsoluteFill from './AbsoluteFill.svelte';
	import { createChildVideo, setVideo, useVideo } from './video.svelte.js';

	interface Props {
		from?: number;
		durationInFrames?: number;
		children: Snippet;
	}

	let { from = 0, durationInFrames = Infinity, children }: Props = $props();

	const parent = useVideo();

	// Children see a frame relative to this sequence's start.
	setVideo(createChildVideo(parent, () => parent.frame - from));

	const active = $derived(parent.frame >= from && parent.frame < from + durationInFrames);
</script>

{#if active}
	<AbsoluteFill>
		{@render children()}
	</AbsoluteFill>
{/if}
