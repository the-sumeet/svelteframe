<script lang="ts">
	import { Easing, interpolate, useVideo } from '@svelteframe/core';
	import { Arrow, Canvas, Circle, Line, Rect, Star } from '@svelteframe/shapes';
	import Stage from './Stage.svelte';

	const video = useVideo();
	const progress = $derived(interpolate(video.frame, [10, 70], [0, 1], { easing: Easing.inOut(Easing.cubic) }));
</script>

<Stage>
	<Canvas>
		<Rect x={80} y={90} width={220} height={140} radius={16} stroke="#ff3e00" strokeWidth={6} fill="none" {progress} />
		<Circle x={480} y={160} radius={70} anchor="center" stroke="#8ab4ff" strokeWidth={6} fill="none" {progress} />
		<Star x={760} y={160} outerRadius={80} anchor="center" stroke="#ffd166" strokeWidth={6} fill="none" {progress} />
		<Line from={[80, 340]} to={[450, 440]} stroke="#06d6a0" strokeWidth={8} strokeLinecap="round" {progress} />
		<Arrow from={[520, 440]} to={[880, 340]} stroke="#ef476f" strokeWidth={8} {progress} />
	</Canvas>
</Stage>
