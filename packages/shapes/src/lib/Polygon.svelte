<script lang="ts">
	import { needsPathLength, paintAttributes, pointsAttribute, regularPolygon } from './geometry.js';
	import Shape from './Shape.svelte';
	import type { ShapeProps } from './types.js';

	interface Props extends ShapeProps {
		/** 3 for a triangle, 5 for a pentagon, and so on. */
		sides: number;
		/** Distance from the centre to a corner. One corner points up. */
		radius: number;
	}

	let { sides, radius, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin = 'round', opacity, progress, ...placement }: Props = $props();

	const paint = $derived(paintAttributes({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress }));
	const vertices = $derived(regularPolygon(sides, radius));
	const points = $derived(pointsAttribute(vertices));
</script>

<!-- The box is the circle the corners lie on, so `anchor="center"` is the polygon's centre. -->
<Shape width={radius * 2} height={radius * 2} outline={{ kind: 'polygon', points: vertices }} {...placement}>
	<polygon {points} pathLength={needsPathLength(progress) ? 1 : undefined} {...paint} />
</Shape>
