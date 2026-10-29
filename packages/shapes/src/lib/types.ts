import type { Anchor, Point } from './geometry.js';

/** What every shape takes. */
export interface ShapeProps {
	/**
	 * A name that lines and arrows in the same `<Canvas>` can attach to, as `from="id"` or
	 * `from="id.bottom"`. Unique, without dots or spaces; read once.
	 */
	id?: string;
	/**
	 * In a `<Canvas>`, where the `anchor` of the shape goes, in composition pixels. Elsewhere the
	 * shape is an ordinary element and CSS places it, so these are ignored.
	 */
	x?: number;
	y?: number;
	/** The point of the shape's box that `x`/`y` position. Defaults to the top-left corner. */
	anchor?: Anchor | Point;
	/** Degrees, clockwise. */
	rotate?: number;
	/** One factor, or one for each direction. */
	scale?: number | readonly [x: number, y: number];
	/** What `rotate` and `scale` are around. Defaults to the centre of the shape. */
	origin?: Anchor | Point;
	fill?: string;
	stroke?: string;
	strokeWidth?: number;
	strokeLinecap?: 'butt' | 'round' | 'square';
	strokeLinejoin?: 'miter' | 'round' | 'bevel';
	opacity?: number;
	/** Draw only this much of the outline, 0 to 1, as when a line draws itself. The fill is unaffected. */
	progress?: number;
	class?: string;
	style?: string;
}
