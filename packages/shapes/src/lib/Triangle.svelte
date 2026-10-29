<script lang="ts">
	import { assertSize, needsPathLength, paintAttributes, pointsAttribute, type Point } from './geometry.js';
	import Shape from './Shape.svelte';
	import type { ShapeProps } from './types.js';

	interface Props extends ShapeProps {
		width: number;
		height: number;
	}

	let { width, height, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin = 'round', opacity, progress, ...placement }: Props = $props();

	const paint = $derived(paintAttributes({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress }));
	// Pointing up, with its base along the bottom of the box.
	const corners = $derived.by((): Point[] => {
		assertSize('width', width);
		assertSize('height', height);
		return [[width / 2, 0], [width, height], [0, height]];
	});
	const points = $derived(pointsAttribute(corners));
</script>

<Shape {width} {height} outline={{ kind: 'polygon', points: corners }} {...placement}>
	<polygon {points} pathLength={needsPathLength(progress) ? 1 : undefined} {...paint} />
</Shape>
