<script lang="ts">
	import { random, useVideo } from '@svelteframe/core';

	const video = useVideo();

	// Positions and speeds come from `random(seed)`, so every render is identical.
	const dots = Array.from({ length: 36 }, (_, i) => ({
		x: random(`x-${i}`) * video.width,
		y: random(`y-${i}`) * video.height,
		size: 10 + random(`size-${i}`) * 26,
		speed: 2 + random(`speed-${i}`) * 6
	}));
</script>

{#each dots as dot}
	<div
		style="position:absolute;left:{dot.x}px;top:{(dot.y + video.frame * dot.speed) %
			video.height}px;width:{dot.size}px;height:{dot.size}px;border-radius:50%;background:#fff;opacity:0.25"
	></div>
{/each}
