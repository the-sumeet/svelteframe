import { describe, expect, it } from 'vitest';
import { ANCHORS, assertShapeId, boundaryToward, parseEnd, resolveEnds, shapeAnchorPoint, type ShapeGeometry } from './connect.js';
import { invertMatrix, regularPolygon, shapeMatrix, shapeTransform, transformPoint, type Point } from './geometry.js';

const near = (a: Point, b: Point, digits = 6) => {
	expect(a[0]).toBeCloseTo(b[0], digits);
	expect(a[1]).toBeCloseTo(b[1], digits);
};

/** Apply an SVG transform list to a point: the last transform in the list is applied first. */
function apply(transform: string, point: Point): Point {
	let [x, y] = point;
	for (const [, name, args] of [...transform.matchAll(/(translate|rotate|scale)\(([^)]*)\)/g)].reverse()) {
		const [a, b = a] = args.split(' ').map(Number);
		if (name === 'translate') [x, y] = [x + a, y + b];
		else if (name === 'scale') [x, y] = [x * a, y * b];
		else {
			const r = (a * Math.PI) / 180;
			[x, y] = [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
		}
	}
	return [x, y];
}

const rect = (x: number, y: number, width: number, height: number, extra: Partial<ShapeGeometry['placement']> = {}): ShapeGeometry => ({
	width,
	height,
	outline: { kind: 'box' },
	placement: { x, y, ...extra }
});
const circle = (cx: number, cy: number, r: number): ShapeGeometry => ({
	width: 2 * r,
	height: 2 * r,
	outline: { kind: 'ellipse' },
	placement: { x: cx, y: cy, anchor: 'center' }
});

describe('shapeMatrix', () => {
	it('does what the transform string says', () => {
		const options = { x: 120, y: 80, width: 200, height: 100, anchor: 'bottom-right', rotate: 37, scale: [1.5, 0.75], origin: [30, 10] } as const;
		const matrix = shapeMatrix(options);
		for (const point of [[0, 0], [200, 100], [13, 77], [100, 50]] as Point[]) {
			near(transformPoint(matrix, point), apply(shapeTransform(options), point));
		}
	});

	it('inverts', () => {
		const matrix = shapeMatrix({ x: 5, y: 9, width: 40, height: 20, rotate: 20, scale: 2 });
		near(transformPoint(invertMatrix(matrix)!, transformPoint(matrix, [7, 3])), [7, 3]);
		expect(invertMatrix(shapeMatrix({ width: 10, height: 10, scale: 0 }))).toBeUndefined();
	});
});

describe('parseEnd', () => {
	it('reads a point, an id, an id with an anchor, and an object', () => {
		expect(parseEnd([3, 4])).toEqual({ kind: 'point', point: [3, 4] });
		expect(parseEnd('card')).toEqual({ kind: 'shape', id: 'card', anchor: undefined, dx: 0, dy: 0 });
		expect(parseEnd('card.bottom-right')).toEqual({ kind: 'shape', id: 'card', anchor: 'bottom-right', dx: 0, dy: 0 });
		expect(parseEnd({ id: 'card', anchor: 'top', dy: -20 })).toEqual({ kind: 'shape', id: 'card', anchor: 'top', dx: 0, dy: -20 });
		expect(parseEnd({ id: 'card' })).toMatchObject({ id: 'card', anchor: undefined });
	});

	it('accepts every anchor', () => {
		for (const anchor of ANCHORS) expect(parseEnd(`a.${anchor}`)).toMatchObject({ anchor });
	});

	it('names the valid anchors when one is wrong', () => {
		expect(() => parseEnd('card.botom')).toThrow(/Unknown anchor "botom" in "card.botom". Anchors are: top-left, top,/);
		expect(() => parseEnd({ id: 'card', anchor: 'middle' as never })).toThrow('Unknown anchor "middle"');
	});

	it('rejects what is not an end', () => {
		expect(() => parseEnd('')).toThrow('does not name a shape');
		expect(() => parseEnd('.top')).toThrow('does not name a shape');
		expect(() => parseEnd([Number.NaN, 1])).toThrow('two finite numbers');
		expect(() => parseEnd(42 as never)).toThrow('An end must be');
		expect(() => parseEnd({ id: 'a.b' })).toThrow('not a shape id');
		expect(() => parseEnd({ id: 'a', dx: Number.NaN })).toThrow('dx and dy');
	});

	it('only allows ids that can be told from an anchor', () => {
		expect(() => assertShapeId('card-1')).not.toThrow();
		for (const bad of ['', 'a.b', 'a b']) expect(() => assertShapeId(bad)).toThrow('Invalid shape id');
	});
});

describe('shapeAnchorPoint', () => {
	it('finds the points of the box where the shape is', () => {
		const card = rect(160, 160, 520, 300);
		near(shapeAnchorPoint(card, 'top-left'), [160, 160]);
		near(shapeAnchorPoint(card, 'center'), [420, 310]);
		near(shapeAnchorPoint(card, 'bottom'), [420, 460]);
		near(shapeAnchorPoint(card, 'right'), [680, 310]);
	});

	it('goes by the anchor the shape is placed by', () => {
		near(shapeAnchorPoint(circle(900, 300, 50), 'center'), [900, 300]);
		near(shapeAnchorPoint(circle(900, 300, 50), 'top'), [900, 250]);
	});

	it('follows rotation and scale', () => {
		// A 200x100 box turned a quarter around its centre (100, 50): its right edge faces down.
		near(shapeAnchorPoint(rect(0, 0, 200, 100, { rotate: 90 }), 'right'), [100, 150]);
		// Doubled around the centre, its right edge is 200 away from it.
		near(shapeAnchorPoint(rect(0, 0, 200, 100, { scale: 2 }), 'right'), [300, 50]);
	});
});

describe('boundaryToward', () => {
	it('leaves a box through the side that faces the target', () => {
		const box = rect(0, 0, 200, 100);
		near(boundaryToward(box, [500, 50]), [200, 50]);
		near(boundaryToward(box, [-300, 50]), [0, 50]);
		near(boundaryToward(box, [100, 400]), [100, 100]);
		near(boundaryToward(box, [100, -400]), [100, 0]);
	});

	it('leaves a box through a side at the angle of the target', () => {
		// Centre (100, 50) towards (400, 300): the bottom edge is met first.
		near(boundaryToward(rect(0, 0, 200, 100), [400, 300]), [160, 100]);
		// Towards (400, 100): the right edge, at the point on the line.
		near(boundaryToward(rect(0, 0, 200, 100), [400, 100]), [200, 50 + (50 * 100) / 300]);
	});

	it('leaves a circle and an ellipse at their radius', () => {
		near(boundaryToward(circle(100, 100, 50), [400, 100]), [150, 100]);
		const diagonal = boundaryToward(circle(0, 0, 50), [100, 100]);
		near(diagonal, [50 * Math.SQRT1_2, 50 * Math.SQRT1_2]);

		const ellipse: ShapeGeometry = { width: 200, height: 100, outline: { kind: 'ellipse' }, placement: { x: 0, y: 0 } };
		near(boundaryToward(ellipse, [500, 50]), [200, 50]);
		near(boundaryToward(ellipse, [100, 500]), [100, 100]);
	});

	it('leaves a polygon through its edge', () => {
		// A diamond: corners at the middle of each side of its 100x100 box.
		const diamond: ShapeGeometry = { width: 100, height: 100, outline: { kind: 'polygon', points: regularPolygon(4, 50) }, placement: { x: 0, y: 0 } };
		near(boundaryToward(diamond, [500, 50]), [100, 50]);
		near(boundaryToward(diamond, [50, 500]), [50, 100]);
		// Diagonally it is the middle of an edge: (75, 75).
		near(boundaryToward(diamond, [500, 500]), [75, 75]);
	});

	it('goes by the shape as it is turned and scaled', () => {
		// 200x100 turned a quarter: now 100 wide and 200 tall around (100, 50).
		near(boundaryToward(rect(0, 0, 200, 100, { rotate: 90 }), [600, 50]), [150, 50]);
		near(boundaryToward(rect(0, 0, 200, 100, { rotate: 90 }), [100, 600]), [100, 150]);
		// Doubled: 400 wide.
		near(boundaryToward(rect(0, 0, 200, 100, { scale: 2 }), [900, 50]), [300, 50]);
	});

	it('returns the centre when there is no edge to meet', () => {
		const box = rect(0, 0, 200, 100);
		near(boundaryToward(box, [100, 50]), [100, 50]); // on the centre
		near(boundaryToward(box, [120, 60]), [100, 50]); // inside
		near(boundaryToward(rect(0, 0, 200, 100, { scale: 0 }), [900, 50]), [100, 50]); // squashed flat
	});
});

describe('resolveEnds', () => {
	const shapes: Record<string, ShapeGeometry> = {
		card: rect(100, 100, 200, 100), // centre (200, 150)
		dot: circle(600, 150, 50)
	};
	const find = (id: string) => shapes[id];

	it('meets the edges of two shapes on the line between their centres', () => {
		const { points, missing } = resolveEnds('card', 'dot', { find });
		expect(missing).toEqual([]);
		near(points![0], [300, 150]);
		near(points![1], [550, 150]);
	});

	it('uses the anchors it is given', () => {
		const { points } = resolveEnds('card.bottom', 'dot.top', { find });
		near(points![0], [200, 200]);
		near(points![1], [600, 100]);
	});

	it('uses an anchor on one end and the edge on the other, facing the anchor', () => {
		const { points } = resolveEnds('card.bottom', 'dot', { find });
		near(points![0], [200, 200]);
		// From the circle's centre (600, 150) towards (200, 200): 50 along that direction.
		const length = Math.hypot(400, 50);
		near(points![1], [600 - (400 / length) * 50, 150 + (50 / length) * 50]);
	});

	it('mixes shapes with plain points', () => {
		const { points } = resolveEnds('card', [900, 150], { find });
		near(points![0], [300, 150]);
		near(points![1], [900, 150]);
		near(resolveEnds([0, 0], 'dot.left', { find }).points![1], [550, 150]);
	});

	it('moves an end by dx and dy', () => {
		const { points } = resolveEnds({ id: 'card', anchor: 'bottom', dy: 20 }, { id: 'dot', anchor: 'top', dx: -5, dy: -20 }, { find });
		near(points![0], [200, 220]);
		near(points![1], [595, 80]);
	});

	it('leaves a gap at the ends attached to a shape, and only there', () => {
		near(resolveEnds('card', 'dot', { find, gap: 10 }).points![0], [310, 150]);
		near(resolveEnds('card', 'dot', { find, gap: 10 }).points![1], [540, 150]);

		const half = resolveEnds('card', [900, 150], { find, gap: 10 }).points!;
		near(half[0], [310, 150]);
		near(half[1], [900, 150]);
	});

	it('never lets the gaps cross over: the ends meet in the middle', () => {
		const close: Record<string, ShapeGeometry> = { a: rect(0, 0, 100, 100), b: rect(120, 0, 100, 100) }; // 20 apart
		const { points } = resolveEnds('a', 'b', { find: (id) => close[id], gap: 50 });
		near(points![0], [110, 50]);
		near(points![1], [110, 50]);
	});

	it('says which ids are missing, without points', () => {
		expect(resolveEnds('card', 'nope', { find })).toEqual({ missing: ['nope'] });
		expect(resolveEnds('x.top', 'x.bottom', { find })).toEqual({ missing: ['x'] });
		expect(resolveEnds('a', 'b', { find: () => undefined }).missing).toEqual(['a', 'b']);
		expect(resolveEnds([0, 0], [1, 1], { find: () => undefined })).toEqual({ points: [[0, 0], [1, 1]], missing: [] });
	});

	it('follows a shape that has moved', () => {
		let x = 100;
		const moving = { card: { ...rect(0, 0, 200, 100), get placement() { return { x, y: 100 }; } } };
		const first = resolveEnds('card.right', [900, 0], { find: (id) => (moving as Record<string, ShapeGeometry>)[id] }).points!;
		x = 400;
		const second = resolveEnds('card.right', [900, 0], { find: (id) => (moving as Record<string, ShapeGeometry>)[id] }).points!;
		near(first[0], [300, 150]);
		near(second[0], [600, 150]);
	});

	it('rejects a bad gap', () => {
		expect(() => resolveEnds('card', 'dot', { find, gap: -1 })).toThrow('gap must be 0 or more');
	});

	it('keeps an arrow of no length when two shapes share a centre', () => {
		const same: Record<string, ShapeGeometry> = { a: circle(100, 100, 30), b: circle(100, 100, 60) };
		const { points } = resolveEnds('a', 'b', { find: (id) => same[id] });
		near(points![0], [100, 100]);
		near(points![1], [100, 100]);
	});
});
