<script lang="ts">
	import Composition from './Composition.svelte';
	import FrameProbe from './FrameProbe.test.svelte';
	import Freeze from './Freeze.svelte';
	import Loop from './Loop.svelte';
	import Sequence from './Sequence.svelte';
	import Series from './Series.svelte';
	import SeriesItem from './SeriesItem.svelte';
	import type { VideoState } from './video.svelte.js';

	interface Props {
		video: VideoState;
		kind: 'series' | 'loop' | 'freeze';
		/** series: show the middle item. */
		showMiddle?: boolean;
		/** series: offset applied to the last item. */
		lastOffset?: number;
	}

	let { video, kind, showMiddle = true, lastOffset = 0 }: Props = $props();
</script>

<Composition {video}>
	{#if kind === 'series'}
		<Series>
			<SeriesItem durationInFrames={10}><FrameProbe id="a" /></SeriesItem>
			{#if showMiddle}
				<SeriesItem durationInFrames={20}><FrameProbe id="b" /></SeriesItem>
			{/if}
			<SeriesItem durationInFrames={5} offset={lastOffset}><FrameProbe id="c" /></SeriesItem>
		</Series>
	{:else if kind === 'loop'}
		<FrameProbe id="outside" />
		<Sequence from={5}>
			<Loop durationInFrames={10}><FrameProbe id="loop" /></Loop>
		</Sequence>
	{:else}
		<Freeze frame={20}><FrameProbe id="frozen" /></Freeze>
	{/if}
</Composition>
