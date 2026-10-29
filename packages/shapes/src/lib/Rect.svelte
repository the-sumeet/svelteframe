<script lang="ts">
	import { assertSize, needsPathLength, paintAttributes } from './geometry.js';
	import Shape from './Shape.svelte';
	import type { ShapeProps } from './types.js';

	interface Props extends ShapeProps {
		width: number;
		height: number;
		/** Corner radius; limited to half the shorter side. */
		radius?: number;
	}

	let { width, height, radius = 0, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress, ...placement }: Props = $props();

	const paint = $derived(paintAttributes({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress }));
	const corner = $derived.by(() => {
		assertSize('width', width);
		assertSize('height', height);
		assertSize('radius', radius);
		return Math.min(radius, width / 2, height / 2);
	});
</script>

<Shape {width} {height} {...placement}>
	<rect {width} {height} rx={corner || undefined} pathLength={needsPathLength(progress) ? 1 : undefined} {...paint} />
</Shape>
