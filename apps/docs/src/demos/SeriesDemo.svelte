<script lang="ts">
	import { Series, SeriesItem } from '@svelteframe/core';
	import Stage from './Stage.svelte';
	import Slide from './SeriesSlide.svelte';
</script>

<Stage>
	<Series>
		<SeriesItem durationInFrames={40}><Slide title="One" color="#ff3e00" /></SeriesItem>
		<SeriesItem durationInFrames={40}><Slide title="Two" color="#8ab4ff" /></SeriesItem>
		<!-- A negative offset overlaps the previous item by 10 frames. -->
		<SeriesItem durationInFrames={50} offset={-10}><Slide title="Three" color="#06d6a0" /></SeriesItem>
	</Series>
</Stage>
