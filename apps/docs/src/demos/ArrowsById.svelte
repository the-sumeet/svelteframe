<script lang="ts">
	import { Easing, interpolate, useVideo } from '@svelteframe/core';
	import { Arrow, Canvas, Circle, Rect } from '@svelteframe/shapes';
	import Stage from './Stage.svelte';

	const video = useVideo();
	// The circle moves; the arrows follow it.
	const y = $derived(interpolate(video.frame, [0, 45, 90], [140, 400, 140], { easing: Easing.inOut(Easing.cubic) }));
</script>

<Stage>
	<Canvas>
		<Rect id="card" x={90} y={190} width={220} height={160} radius={18} fill="#1a2535" stroke="#8ab4ff" strokeWidth={4} />
		<Circle id="dot" x={700} y={y} radius={60} anchor="center" fill="#ff3e00" />

		<!-- The edges facing each other, with a gap. -->
		<Arrow from="card" to="dot" gap={12} stroke="#fff" strokeWidth={6} />
		<!-- A chosen point of each shape. -->
		<Arrow from="card.bottom" to="dot.bottom" stroke="#06d6a0" strokeWidth={4} heads="none" strokeLinecap="round" />
	</Canvas>
</Stage>
