<script lang="ts">
	import Composition from './Composition.svelte';
	import FrameProbe from './FrameProbe.test.svelte';
	import Sequence from './Sequence.svelte';
	import type { VideoState } from './video.svelte.js';

	interface Props {
		video: VideoState;
		from?: number;
		durationInFrames?: number;
		/** When set, nests a second Sequence starting at this offset. */
		nestedFrom?: number;
	}

	let { video, from, durationInFrames, nestedFrom }: Props = $props();
</script>

<Composition {video}>
	<FrameProbe id="root" />
	<Sequence {from} {durationInFrames}>
		<FrameProbe id="seq" />
		{#if nestedFrom !== undefined}
			<Sequence from={nestedFrom}>
				<FrameProbe id="nested" />
			</Sequence>
		{/if}
	</Sequence>
</Composition>
