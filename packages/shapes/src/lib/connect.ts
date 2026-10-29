import {
	anchorPoint,
	invertMatrix,
	shapeMatrix,
	transformPoint,
	transformVector,
	type Anchor,
	type Matrix,
	type Point,
	type TransformOptions
} from './geometry.js';

/** The names an anchor can have, as written after the dot in `"card.bottom"`. */
export const ANCHORS: readonly Anchor[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

/** The shape of a shape's edge, in the shape's own coordinates. */
export type Outline =
	/** The box. Also what shapes with no better outline fall back to; rounded corners are ignored. */
	| { kind: 'box' }
	/** The ellipse that fills the box. */
	| { kind: 'ellipse' }
	| { kind: 'polygon'; points: readonly Point[] };

/** What the `<Canvas>` knows about a shape that has an `id`. */
export interface ShapeGeometry {
	/** The size of the shape's box, before it is scaled. */
	width: number;
	height: number;
	outline: Outline;
	/** Where the shape is on the canvas. */
	placement: Omit<TransformOptions, 'width' | 'height'>;
}

/** What `from` and `to` of a line or arrow accept. */
export type End =
	/** A point on the canvas. */
	| Point
	/** `"id"`: the edge of the shape facing the other end. `"id.anchor"`: that point of its box. */
	| string
	| { id: string; anchor?: Anchor; /** Moves the end, in canvas pixels. */ dx?: number; dy?: number };

interface ShapeEnd {
	kind: 'shape';
	id: string;
	anchor?: Anchor;
	dx: number;
	dy: number;
}
type ParsedEnd = { kind: 'point'; point: Point } | ShapeEnd;

function checkAnchor(anchor: string, where: string): Anchor {
	if (!(ANCHORS as readonly string[]).includes(anchor)) {
		throw new Error(`Unknown anchor "${anchor}" in ${where}. Anchors are: ${ANCHORS.join(', ')}`);
	}
	return anchor as Anchor;
}

/** Read what `from` or `to` was given as. */
export function parseEnd(end: End): ParsedEnd {
	if (Array.isArray(end)) {
		const [x, y] = end as Point;
		if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`A point must be two finite numbers, got [${x}, ${y}]`);
		return { kind: 'point', point: [x, y] };
	}
	if (typeof end === 'string') {
		const dot = end.indexOf('.');
		const id = dot < 0 ? end : end.slice(0, dot);
		if (id === '') throw new Error(`"${end}" does not name a shape`);
		return { kind: 'shape', id, anchor: dot < 0 ? undefined : checkAnchor(end.slice(dot + 1), `"${end}"`), dx: 0, dy: 0 };
	}
	if (typeof end === 'object' && end !== null && typeof (end as { id?: unknown }).id === 'string') {
		const { id, anchor, dx = 0, dy = 0 } = end as { id: string; anchor?: Anchor; dx?: number; dy?: number };
		if (id === '' || id.includes('.')) throw new Error(`"${id}" is not a shape id`);
		if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('dx and dy must be finite numbers');
		return { kind: 'shape', id, anchor: anchor === undefined ? undefined : checkAnchor(anchor, `the end of "${id}"`), dx, dy };
	}
	throw new Error('An end must be a point [x, y], an id like "card" or "card.bottom", or { id, anchor?, dx?, dy? }');
}

/** The ids a shape can be found by must not contain a dot, which separates the anchor. */
export function assertShapeId(id: string): void {
	if (id === '' || /[.\s]/.test(id)) throw new Error(`Invalid shape id "${id}": it must not be empty or contain dots or spaces`);
}

const matrixOf = (shape: ShapeGeometry): Matrix => shapeMatrix({ ...shape.placement, width: shape.width, height: shape.height });

/** A point of the shape's box, on the canvas. */
export function shapeAnchorPoint(shape: ShapeGeometry, anchor: Anchor): Point {
	return transformPoint(matrixOf(shape), anchorPoint(anchor, shape.width, shape.height));
}

/**
 * How far along `direction` (from the centre) the outline is, as a multiple of `direction`.
 * `direction` is in the shape's own coordinates, which are centred on `(width / 2, height / 2)`.
 */
function distanceToOutline(shape: ShapeGeometry, direction: Point): number {
	const [dx, dy] = direction;
	const halfWidth = shape.width / 2;
	const halfHeight = shape.height / 2;
	switch (shape.outline.kind) {
		case 'box': {
			const tx = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
			const ty = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
			return Math.min(tx, ty);
		}
		case 'ellipse': {
			const k = Math.hypot(dx / halfWidth, dy / halfHeight);
			return k === 0 ? Infinity : 1 / k;
		}
		case 'polygon': {
			const { points } = shape.outline;
			const centre: Point = [halfWidth, halfHeight];
			let best = Infinity;
			for (let i = 0; i < points.length; i++) {
				const a = points[i];
				const b = points[(i + 1) % points.length];
				// Where the ray centre + t * direction meets the edge a + u * (b - a).
				const ex = b[0] - a[0];
				const ey = b[1] - a[1];
				const denominator = dx * ey - dy * ex;
				if (Math.abs(denominator) < 1e-12) continue;
				const qx = a[0] - centre[0];
				const qy = a[1] - centre[1];
				const t = (qx * ey - qy * ex) / denominator;
				const u = (qx * dy - qy * dx) / denominator;
				if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
			}
			return best;
		}
	}
}

/**
 * Where the line from the centre of `shape` towards `target` leaves its outline. When the target
 * is inside the shape there is no edge to meet, and the centre is returned.
 */
export function boundaryToward(shape: ShapeGeometry, target: Point): Point {
	const matrix = matrixOf(shape);
	const centre = transformPoint(matrix, [shape.width / 2, shape.height / 2]);
	const inverse = invertMatrix(matrix);
	if (!inverse) return centre;

	const direction = transformVector(inverse, [target[0] - centre[0], target[1] - centre[1]]);
	if (direction[0] === 0 && direction[1] === 0) return centre;
	const t = distanceToOutline(shape, direction);
	// Past the target (it is inside the shape), or no edge found.
	if (!Number.isFinite(t) || t >= 1) return centre;
	return transformPoint(matrix, [shape.width / 2 + direction[0] * t, shape.height / 2 + direction[1] * t]);
}

export interface ResolveOptions {
	/** Finds a shape by id; `undefined` while there is none (yet). */
	find: (id: string) => ShapeGeometry | undefined;
	/** Space to leave between an end and the shape it is attached to, in canvas pixels. */
	gap?: number;
}

export interface ResolvedEnds {
	/** The two ends on the canvas, or `undefined` while a shape is missing. */
	points?: readonly [Point, Point];
	/** The ids that no shape has. */
	missing: string[];
}

/** Turn the `from` and `to` of a line into points on the canvas. */
export function resolveEnds(from: End, to: End, { find, gap = 0 }: ResolveOptions): ResolvedEnds {
	if (!Number.isFinite(gap) || gap < 0) throw new Error(`gap must be 0 or more, got ${gap}`);
	const ends = [parseEnd(from), parseEnd(to)] as const;
	const shapes = ends.map((end) => (end.kind === 'shape' ? find(end.id) : undefined));
	const missing = ends.flatMap((end, i) => (end.kind === 'shape' && !shapes[i] ? [end.id] : []));
	if (missing.length > 0) return { missing: [...new Set(missing)] };

	// Where each end points to when the other end looks for its edge: the point itself, the
	// chosen anchor of a shape, or the centre of one.
	const reference = ends.map((end, i): Point =>
		end.kind === 'point' ? end.point : shapeAnchorPoint(shapes[i]!, end.anchor ?? 'center')
	);

	const resolved = ends.map((end, i): Point => {
		if (end.kind === 'point') return end.point;
		const point = end.anchor === undefined ? boundaryToward(shapes[i]!, reference[1 - i]) : reference[i];
		return [point[0] + end.dx, point[1] + end.dy];
	}) as [Point, Point];

	if (gap > 0) {
		const length = Math.hypot(resolved[1][0] - resolved[0][0], resolved[1][1] - resolved[0][1]);
		if (length > 0) {
			const ux = (resolved[1][0] - resolved[0][0]) / length;
			const uy = (resolved[1][1] - resolved[0][1]) / length;
			const attached = ends.map((end) => end.kind === 'shape');
			const startGap = attached[0] ? gap : 0;
			const endGap = attached[1] ? gap : 0;
			// Never let the ends pass each other.
			const room = Math.min(1, length / (startGap + endGap || 1));
			resolved[0] = [resolved[0][0] + ux * startGap * room, resolved[0][1] + uy * startGap * room];
			resolved[1] = [resolved[1][0] - ux * endGap * room, resolved[1][1] - uy * endGap * room];
		}
	}
	return { points: resolved, missing: [] };
}
