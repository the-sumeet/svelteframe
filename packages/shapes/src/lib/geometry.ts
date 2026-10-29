/** A position in a shape's own coordinates, or on a `<Canvas>` (composition pixels, origin top-left). */
export type Point = readonly [x: number, y: number];

/** A point of a shape's box: where `x`/`y` put it, or what it rotates and scales around. */
export type Anchor =
	| 'top-left'
	| 'top'
	| 'top-right'
	| 'left'
	| 'center'
	| 'right'
	| 'bottom-left'
	| 'bottom'
	| 'bottom-right';

/** Round away floating point noise, so the same input always prints the same attribute. */
export const round = (value: number): number => Math.round(value * 1e4) / 1e4;

const FRACTIONS: Record<Anchor, readonly [number, number]> = {
	'top-left': [0, 0],
	top: [0.5, 0],
	'top-right': [1, 0],
	left: [0, 0.5],
	center: [0.5, 0.5],
	right: [1, 0.5],
	'bottom-left': [0, 1],
	bottom: [0.5, 1],
	'bottom-right': [1, 1]
};

/** Where `anchor` is in a box of this size, measured from the box's top-left corner. */
export function anchorPoint(anchor: Anchor | Point, width: number, height: number): Point {
	if (typeof anchor !== 'string') return anchor;
	const fraction = FRACTIONS[anchor];
	if (!fraction) throw new Error(`Unknown anchor "${anchor}"`);
	return [width * fraction[0], height * fraction[1]];
}

export interface TransformOptions {
	/** Where the anchor point goes. */
	x?: number;
	y?: number;
	width: number;
	height: number;
	/** Which point of the box goes to `x`/`y`. */
	anchor?: Anchor | Point;
	/** Degrees, clockwise. */
	rotate?: number;
	/** One factor, or one for each direction. */
	scale?: number | readonly [x: number, y: number];
	/** What `rotate` and `scale` are around. */
	origin?: Anchor | Point;
}

/**
 * The SVG `transform` that puts a shape's box where it belongs: the `anchor` point at `x`/`y`,
 * then rotated and scaled around `origin`. Empty when the shape is where it is drawn.
 */
export function shapeTransform({
	x = 0,
	y = 0,
	width,
	height,
	anchor = 'top-left',
	rotate = 0,
	scale = 1,
	origin = 'center'
}: TransformOptions): string {
	for (const [name, value] of [['x', x], ['y', y], ['rotate', rotate]] as const) {
		if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number, got ${value}`);
	}
	const [sx, sy] = typeof scale === 'number' ? [scale, scale] : scale;
	if (!Number.isFinite(sx) || !Number.isFinite(sy)) throw new Error(`scale must be finite, got ${scale}`);

	const [ax, ay] = anchorPoint(anchor, width, height);
	const [ox, oy] = anchorPoint(origin, width, height);
	const parts: string[] = [];

	const tx = x - ax;
	const ty = y - ay;
	if (tx !== 0 || ty !== 0) parts.push(`translate(${round(tx)} ${round(ty)})`);
	if (rotate !== 0 || sx !== 1 || sy !== 1) {
		parts.push(`translate(${round(ox)} ${round(oy)})`);
		if (rotate !== 0) parts.push(`rotate(${round(rotate)})`);
		if (sx !== 1 || sy !== 1) parts.push(`scale(${round(sx)} ${round(sy)})`);
		parts.push(`translate(${round(-ox)} ${round(-oy)})`);
	}
	return parts.join(' ');
}

/** The vertices as an SVG `points` attribute. */
export const pointsAttribute = (points: readonly Point[]): string =>
	points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');

/**
 * A regular polygon with a vertex pointing up, in a `2 * radius` box centred at `(radius, radius)`,
 * so the box's centre is the polygon's centre.
 */
export function regularPolygon(sides: number, radius: number): Point[] {
	if (!Number.isInteger(sides) || sides < 3) throw new Error(`A polygon needs 3 or more sides, got ${sides}`);
	assertSize('radius', radius);
	return Array.from({ length: sides }, (_, i) => {
		const angle = (-90 + (360 * i) / sides) * (Math.PI / 180);
		return [radius + radius * Math.cos(angle), radius + radius * Math.sin(angle)] as const;
	});
}

/** A star with a point up, in a `2 * outerRadius` box centred at `(outerRadius, outerRadius)`. */
export function star(points: number, outerRadius: number, innerRadius: number): Point[] {
	if (!Number.isInteger(points) || points < 3) throw new Error(`A star needs 3 or more points, got ${points}`);
	assertSize('outerRadius', outerRadius);
	assertSize('innerRadius', innerRadius);
	return Array.from({ length: points * 2 }, (_, i) => {
		const radius = i % 2 === 0 ? outerRadius : innerRadius;
		const angle = (-90 + (180 * i) / points) * (Math.PI / 180);
		return [outerRadius + radius * Math.cos(angle), outerRadius + radius * Math.sin(angle)] as const;
	});
}

export function assertSize(name: string, value: number): void {
	if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be 0 or more, got ${value}`);
}

/** The point `t` of the way from `a` to `b`. */
export const lerpPoint = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The smallest box around the points: its top-left corner and its size. */
export function boundsOf(points: readonly Point[]) {
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** `progress` limited to 0..1; anything that is not a number is an error. */
export function clampProgress(progress: number): number {
	if (Number.isNaN(progress)) throw new Error('progress must be a number');
	return Math.min(1, Math.max(0, progress));
}

export type ArrowHeads = 'end' | 'start' | 'both' | 'none';

export interface ArrowOptions {
	/** How much of the arrow is drawn, from `from` towards `to`. */
	progress?: number;
	strokeWidth: number;
	/** Length of a head along the line. Defaults to 4 times the stroke width. */
	headLength?: number;
	/** Width of a head across the line. Defaults to 0.8 times its length. */
	headWidth?: number;
	heads?: ArrowHeads;
}

export interface ArrowGeometry {
	/** The visible part of the shaft, ending where its heads begin. `undefined` when nothing is drawn. */
	shaft?: readonly [Point, Point];
	/** Each head as a triangle: tip first. */
	heads: Point[][];
}

/**
 * The parts of an arrow from `from` to `to`. A head sits on the end of what is drawn so far, and is
 * shortened to fit while the arrow is still short, so an arrow can grow from nothing.
 */
export function arrowGeometry(from: Point, to: Point, options: ArrowOptions): ArrowGeometry {
	const { progress = 1, strokeWidth, heads: which = 'end' } = options;
	assertSize('strokeWidth', strokeWidth);
	const tip = lerpPoint(from, to, clampProgress(progress));
	const dx = tip[0] - from[0];
	const dy = tip[1] - from[1];
	const length = Math.hypot(dx, dy);
	if (length === 0) return { heads: [] };

	const wanted = options.headLength ?? strokeWidth * 4;
	const wantedWidth = options.headWidth ?? wanted * 0.8;
	assertSize('headLength', wanted);
	assertSize('headWidth', wantedWidth);

	const ux = dx / length;
	const uy = dy / length;
	const atStart = which === 'start' || which === 'both';
	const atEnd = which === 'end' || which === 'both';
	// Two heads may not be longer than the line between them.
	const headLength = Math.min(wanted, length / (atStart && atEnd ? 2 : 1));
	const headWidth = wanted === 0 ? 0 : wantedWidth * (headLength / wanted);

	/** A head whose tip is `at`, pointing along `(dirX, dirY)`. */
	const head = (at: Point, dirX: number, dirY: number): Point[] => {
		const base: Point = [at[0] - dirX * headLength, at[1] - dirY * headLength];
		const nx = -dirY * (headWidth / 2);
		const ny = dirX * (headWidth / 2);
		return [at, [base[0] + nx, base[1] + ny], [base[0] - nx, base[1] - ny]];
	};

	const heads: Point[][] = [];
	let start: Point = from;
	let end: Point = tip;
	if (atStart) {
		heads.push(head(from, -ux, -uy));
		start = [from[0] + ux * headLength, from[1] + uy * headLength];
	}
	if (atEnd) {
		heads.push(head(tip, ux, uy));
		end = [tip[0] - ux * headLength, tip[1] - uy * headLength];
	}
	const shaftLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
	return { shaft: shaftLength > 1e-9 ? [start, end] : undefined, heads };
}

export interface PaintOptions {
	fill?: string;
	stroke?: string;
	strokeWidth?: number;
	strokeLinecap?: 'butt' | 'round' | 'square';
	strokeLinejoin?: 'miter' | 'round' | 'bevel';
	opacity?: number;
	/** How much of the outline is drawn, 0 to 1, from where it starts. */
	progress?: number;
}

/**
 * The presentation attributes for a shape's element. Left out when not given, so SVG's own
 * defaults apply. `progress` draws only the first part of the outline: the element must then have
 * `pathLength="1"`, which `needsPathLength` tells.
 */
export function paintAttributes({ progress, ...paint }: PaintOptions): Record<string, string | number> {
	const attributes: Record<string, string | number> = {};
	const set = (name: string, value: string | number | undefined) => {
		if (value !== undefined) attributes[name] = value;
	};
	set('fill', paint.fill);
	set('stroke', paint.stroke);
	set('stroke-width', paint.strokeWidth);
	set('stroke-linecap', paint.strokeLinecap);
	set('stroke-linejoin', paint.strokeLinejoin);
	set('opacity', paint.opacity);

	if (progress !== undefined) {
		const p = clampProgress(progress);
		if (p <= 0) {
			// Nothing drawn yet; a round or square cap would still leave a dot.
			attributes['stroke-dasharray'] = '0 1';
			attributes['stroke-linecap'] = 'butt';
		}
		else if (p < 1) attributes['stroke-dasharray'] = `${round(p)} 1`;
	}
	return attributes;
}

/** Whether `paintAttributes` drew only part of the outline, which needs `pathLength="1"`. */
export const needsPathLength = (progress: number | undefined): boolean => progress !== undefined && clampProgress(progress) < 1;

/** An affine transform `[a, b, c, d, e, f]`, as in SVG's `matrix(a b c d e f)`. */
export type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** The transform that does `second` first and then `first`. */
function multiply(first: Matrix, second: Matrix): Matrix {
	const [a1, b1, c1, d1, e1, f1] = first;
	const [a2, b2, c2, d2, e2, f2] = second;
	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1
	];
}

const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

/**
 * What `shapeTransform` stands for, as a matrix: it takes a point of the shape, in the shape's own
 * coordinates, to its place on the canvas.
 */
export function shapeMatrix(options: TransformOptions): Matrix {
	const { x = 0, y = 0, width, height, anchor = 'top-left', rotate = 0, scale = 1, origin = 'center' } = options;
	// The same checks as the string version.
	shapeTransform(options);
	const [sx, sy] = typeof scale === 'number' ? [scale, scale] : scale;
	const [ax, ay] = anchorPoint(anchor, width, height);
	const [ox, oy] = anchorPoint(origin, width, height);
	const angle = (rotate * Math.PI) / 180;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	let matrix = translation(x - ax, y - ay);
	matrix = multiply(matrix, translation(ox, oy));
	matrix = multiply(matrix, [cos, sin, -sin, cos, 0, 0]);
	matrix = multiply(matrix, [sx, 0, 0, sy, 0, 0]);
	return multiply(matrix, translation(-ox, -oy));
}

export const identity = (): Matrix => IDENTITY;

export const transformPoint = ([a, b, c, d, e, f]: Matrix, [x, y]: Point): Point => [a * x + c * y + e, b * x + d * y + f];

/** Apply only the rotation and scale: for directions, which have no position. */
export const transformVector = ([a, b, c, d]: Matrix, [x, y]: Point): Point => [a * x + c * y, b * x + d * y];

/** The matrix that undoes `matrix`, or `undefined` when it squashes the plane flat (a scale of 0). */
export function invertMatrix([a, b, c, d, e, f]: Matrix): Matrix | undefined {
	const determinant = a * d - b * c;
	if (Math.abs(determinant) < 1e-12) return undefined;
	return [
		d / determinant,
		-b / determinant,
		-c / determinant,
		a / determinant,
		(c * f - d * e) / determinant,
		(b * e - a * f) / determinant
	];
}
