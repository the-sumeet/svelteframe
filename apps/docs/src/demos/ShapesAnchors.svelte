<script lang="ts">
	import { Canvas, Circle, Rect } from '@svelteframe/shapes';
	import Stage from './Stage.svelte';

	// The same x and y three times; only the anchor differs.
	const placements = [
		{ x: 160, anchor: 'top-left', color: '#ff3e00' },
		{ x: 480, anchor: 'center', color: '#8ab4ff' },
		{ x: 800, anchor: 'bottom-right', color: '#06d6a0' }
	] as const;
</script>

<Stage>
	<Canvas>
		{#each placements as p}
			<Rect x={p.x} y={250} width={150} height={90} radius={10} anchor={p.anchor} fill={p.color} opacity={0.85} />
			<Circle x={p.x} y={250} radius={7} anchor="center" fill="#fff" />
			<text x={p.x} y={420} text-anchor="middle" fill="#fff" font-size="24" font-family="system-ui,sans-serif">anchor="{p.anchor}"</text>
		{/each}
	</Canvas>
</Stage>
