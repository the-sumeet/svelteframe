<script lang="ts">
	import type { Snippet } from 'svelte';
	import AbsoluteFill from './AbsoluteFill.svelte';
	import { setVideo, useVideo, type VideoContext } from './video.svelte.js';

	interface Props {
		from?: number;
		durationInFrames?: number;
		children: Snippet;
	}

	let { from = 0, durationInFrames = Infinity, children }: Props = $props();

	const parent = useVideo();

	// Children see a frame relative to this sequence's start.
	const local: VideoContext = {
		get frame() {
			return parent.frame - from;
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
			return Number.isFinite(durationInFrames)
				? durationInFrames
				: Math.max(0, parent.durationInFrames - from);
		}
	};
	setVideo(local);

	const active = $derived(parent.frame >= from && parent.frame < from + durationInFrames);
</script>

{#if active}
	<AbsoluteFill>
		{@render children()}
	</AbsoluteFill>
{/if}
