<script lang="ts">
	import { assertSize, needsPathLength, paintAttributes } from './geometry.js';
	import Shape from './Shape.svelte';
	import type { ShapeProps } from './types.js';

	interface Props extends ShapeProps {
		/** Horizontal radius. */
		rx: number;
		/** Vertical radius. */
		ry: number;
	}

	let { rx, ry, fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress, ...placement }: Props = $props();

	const paint = $derived(paintAttributes({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity, progress }));
	const size = $derived.by(() => {
		assertSize('rx', rx);
		assertSize('ry', ry);
		return [rx * 2, ry * 2] as const;
	});
</script>

<Shape width={size[0]} height={size[1]} outline={{ kind: 'ellipse' }} {...placement}>
	<ellipse cx={rx} cy={ry} {rx} {ry} pathLength={needsPathLength(progress) ? 1 : undefined} {...paint} />
</Shape>
