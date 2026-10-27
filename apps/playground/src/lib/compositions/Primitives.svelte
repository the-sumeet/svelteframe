<script lang="ts">
	import { Freeze, Loop, Series, SeriesItem } from '@svelteframe/core';
	import Dots from '#lib/demo/Dots.svelte';
	import FrozenBadge from '#lib/demo/FrozenBadge.svelte';
	import LoopSpinner from '#lib/demo/LoopSpinner.svelte';
	import SeriesCard from '#lib/demo/SeriesCard.svelte';
</script>

<!-- Series: three back-to-back scenes, each with a spring-driven ball. -->
<Series>
	<SeriesItem durationInFrames={60}>
		<SeriesCard label="Series 1: spring" background="#0f1115" color="#ff3e00" />
	</SeriesItem>
	<SeriesItem durationInFrames={60}>
		<SeriesCard label="Series 2: no manual from" background="#1d2a44" color="#f7b32b" />
	</SeriesItem>
	<SeriesItem durationInFrames={60}>
		<SeriesCard label="Series 3: random dots" background="#2b1d44" color="#4cc9f0" />
	</SeriesItem>
</Series>

<!-- random(seed): the same dots in the same places on every render. -->
<Dots />

<!-- Loop: a 30-frame spinner that repeats for the whole video. -->
<Loop durationInFrames={30}>
	<LoopSpinner />
</Loop>

<!-- Freeze: reads the clock, but always sees frame 20. -->
<Freeze frame={20}>
	<FrozenBadge />
</Freeze>
