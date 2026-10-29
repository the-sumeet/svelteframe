<script lang="ts">
	import type { End } from './connect.js';
	import { useEnds } from './ends.svelte.js';
	import { arrowGeometry, boundsOf, paintAttributes, pointsAttribute, round, type ArrowHeads, type Point } from './geometry.js';
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
		/** Which ends get a head. */
		heads?: ArrowHeads;
		/** Length of a head along the line. Defaults to 4 times the stroke width. */
		headLength?: number;
		/** Width of a head across the line. Defaults to 0.8 times its length. */
		headWidth?: number;
	}

	let {
		from,
		to,
		gap,
		heads = 'end',
		headLength,
		headWidth,
		stroke = 'currentColor',
		strokeWidth = 4,
		strokeLinecap,
		strokeLinejoin = 'round',
		opacity,
		progress = 1,
		...placement
	}: Props = $props();

	const ends = useEnds('Arrow', () => from, () => to, () => gap);
	const paint = $derived(paintAttributes({ stroke, strokeWidth, strokeLinecap, opacity }));
	const headPaint = $derived(paintAttributes({ fill: stroke, stroke, strokeWidth: 0, strokeLinejoin, opacity }));

	// `progress` grows the arrow from the first end to the second, its head going along with the tip.
	const arrow = $derived.by(() => {
		if (!ends.points) return undefined;
		const [start, finish] = ends.points;
		const box = boundsOf([start, finish]);
		const local = (p: Point): Point => [p[0] - box.x, p[1] - box.y];
		const geometry = arrowGeometry(start, finish, { progress, strokeWidth, headLength, headWidth, heads });
		return {
			box,
			shaft: geometry.shaft?.map(local),
			heads: geometry.heads.map((head) => head.map(local))
		};
	});
</script>

{#if arrow}
	<Shape x={arrow.box.x} y={arrow.box.y} width={arrow.box.width} height={arrow.box.height} {...placement}>
		{#if arrow.shaft}
			<line
				x1={round(arrow.shaft[0][0])}
				y1={round(arrow.shaft[0][1])}
				x2={round(arrow.shaft[1][0])}
				y2={round(arrow.shaft[1][1])}
				{...paint}
			/>
		{/if}
		{#each arrow.heads as head}
			<polygon points={pointsAttribute(head)} {...headPaint} />
		{/each}
	</Shape>
{/if}
