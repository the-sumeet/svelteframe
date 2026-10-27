<script lang="ts">
	import type { Snippet } from 'svelte';
	import Sequence from './Sequence.svelte';
	import { useSeries } from './series.svelte.js';

	interface Props {
		durationInFrames: number;
		/** Frames to skip (or, if negative, overlap) relative to the end of the previous item. */
		offset?: number;
		children: Snippet;
	}

	let { durationInFrames, offset = 0, children }: Props = $props();

	const series = useSeries();
	const entry = {
		get durationInFrames() {
			return durationInFrames;
		},
		get offset() {
			return offset;
		}
	};

	// Order follows initialisation order, so items must be rendered front to back.
	series.register(entry);
	$effect(() => () => series.unregister(entry));

	const from = $derived(series.startOf(entry));
</script>

<Sequence {from} {durationInFrames}>
	{@render children()}
</Sequence>
