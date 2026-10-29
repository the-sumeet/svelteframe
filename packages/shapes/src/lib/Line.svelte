<script lang="ts">
	import type { End } from './connect.js';
	import { useEnds } from './ends.svelte.js';
	import { boundsOf, clampProgress, lerpPoint, paintAttributes, round } from './geometry.js';
	import Shape from './Shape.svelte';
	import type { ShapeProps } from './types.js';

	interface Props extends Omit<ShapeProps, 'x' | 'y' | 'anchor' | 'fill'> {
		/**
		 * The ends: a point `[x, y]`, or a shape in the same `<Canvas>` by its id: `"card"` for the
		 * edge facing the other end, `"card.bottom"` for a point of its box, or
		 * `{ id, anchor, dx, dy }` to move the end.
		 */
		from: End;
		to: End;
		/** Space between an end and the shape it is attached to. */
		gap?: number;
	}

	let { from, to, gap, stroke = 'currentColor', strokeWidth = 4, strokeLinecap, strokeLinejoin, opacity, progress = 1, ...placement }: Props = $props();

	const ends = useEnds('Line', () => from, () => to, () => gap);
	const paint = $derived(paintAttributes({ stroke, strokeWidth, strokeLinecap, strokeLinejoin, opacity }));

	// `progress` draws the line from the first end towards the second.
	const line = $derived.by(() => {
		if (!ends.points) return undefined;
		const [start, finish] = ends.points;
		const end = lerpPoint(start, finish, clampProgress(progress));
		return { start, end, box: boundsOf([start, finish]), visible: end[0] !== start[0] || end[1] !== start[1] };
	});
</script>

<!-- Drawn relative to the box, which a <Canvas> places where the line is. -->
{#if line}
	<Shape x={line.box.x} y={line.box.y} width={line.box.width} height={line.box.height} {...placement}>
		{#if line.visible}
			<line
				x1={round(line.start[0] - line.box.x)}
				y1={round(line.start[1] - line.box.y)}
				x2={round(line.end[0] - line.box.x)}
				y2={round(line.end[1] - line.box.y)}
				{...paint}
			/>
		{/if}
	</Shape>
{/if}
