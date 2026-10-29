<script lang="ts">
	import { interpolate, random, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	const video = useVideo();
	// The same seed always gives the same number, on every frame and in every render.
	const dots = Array.from({ length: 36 }, (_, i) => ({
		x: random(`x${i}`) * 900 + 30,
		y: random(`y${i}`) * 480 + 30,
		size: 14 + random(`size${i}`) * 30,
		delay: random(`delay${i}`) * 40
	}));
</script>

<Stage>
	{#each dots as dot}
		<div
			style="position:absolute;left:{dot.x}px;top:{dot.y}px;width:{dot.size}px;height:{dot.size}px;border-radius:50%;background:#ff3e00;opacity:{interpolate(
				video.frame,
				[dot.delay, dot.delay + 20],
				[0, 0.9]
			)}"
		></div>
	{/each}
</Stage>
