<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createChildVideo, setVideo, useVideo } from './video.svelte.js';

	interface Props {
		/** Length of one iteration, in frames. */
		durationInFrames: number;
		children: Snippet;
	}

	let { durationInFrames, children }: Props = $props();

	const parent = useVideo();

	// Children see a frame that wraps every `durationInFrames`.
	setVideo(
		createChildVideo(
			parent,
			() => {
				if (!(durationInFrames > 0) || !Number.isFinite(durationInFrames)) {
					throw new Error('<Loop> durationInFrames must be a positive, finite number');
				}
				return ((parent.frame % durationInFrames) + durationInFrames) % durationInFrames;
			},
			() => durationInFrames
		)
	);
</script>

{@render children()}
