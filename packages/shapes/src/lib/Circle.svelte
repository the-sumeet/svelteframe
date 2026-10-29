<script lang="ts">
	import { assertSize, needsPathLength, paintAttributes } from './geometry.js';
	import Shape from './Shape.svelte';
	import type { ShapeProps } from './types.js';

	interface Props extends ShapeProps {
		radius: number;
	}

	let { radius, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress, ...placement }: Props = $props();

	const paint = $derived(paintAttributes({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress }));
	const size = $derived.by(() => {
		assertSize('radius', radius);
		return radius * 2;
	});
</script>

<!-- The box is the circle's bounding square, so `anchor="center"` is its centre. -->
<Shape width={size} height={size} outline={{ kind: 'ellipse' }} {...placement}>
	<circle cx={radius} cy={radius} r={radius} pathLength={needsPathLength(progress) ? 1 : undefined} {...paint} />
</Shape>
