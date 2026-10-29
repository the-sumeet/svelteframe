<script lang="ts">
	import { needsPathLength, paintAttributes, pointsAttribute, star } from './geometry.js';
	import Shape from './Shape.svelte';
	import type { ShapeProps } from './types.js';

	interface Props extends ShapeProps {
		/** Number of points. */
		points?: number;
		/** Distance from the centre to the tips. One tip points up. */
		outerRadius: number;
		/** Distance from the centre to the notches. Defaults to 0.4 times the outer radius. */
		innerRadius?: number;
	}

	let { points = 5, outerRadius, innerRadius, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin = 'round', opacity, progress, ...placement }: Props = $props();

	const paint = $derived(paintAttributes({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress }));
	const corners = $derived(star(points, outerRadius, innerRadius ?? outerRadius * 0.4));
	const vertices = $derived(pointsAttribute(corners));
</script>

<Shape width={outerRadius * 2} height={outerRadius * 2} outline={{ kind: 'polygon', points: corners }} {...placement}>
	<polygon points={vertices} pathLength={needsPathLength(progress) ? 1 : undefined} {...paint} />
</Shape>
