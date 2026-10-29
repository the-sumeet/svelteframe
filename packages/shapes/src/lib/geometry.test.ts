import { describe, expect, it } from 'vitest';
import {
	anchorPoint,
	arrowGeometry,
	boundsOf,
	clampProgress,
	needsPathLength,
	paintAttributes,
	pointsAttribute,
	regularPolygon,
	shapeTransform,
	star,
	type Point
} from './geometry.js';

/** Apply an SVG transform list to a point: the last transform in the list is applied first. */
function apply(transform: string, point: Point): Point {
	let [x, y] = point;
	const steps = [...transform.matchAll(/(translate|rotate|scale)\(([^)]*)\)/g)].reverse();
	for (const [, name, args] of steps) {
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

const near = (a: Point, b: Point) => {
	expect(a[0]).toBeCloseTo(b[0], 6);
	expect(a[1]).toBeCloseTo(b[1], 6);
};

describe('anchorPoint', () => {
	it('finds the named points of a box', () => {
		expect(anchorPoint('top-left', 200, 100)).toEqual([0, 0]);
		expect(anchorPoint('center', 200, 100)).toEqual([100, 50]);
		expect(anchorPoint('bottom-right', 200, 100)).toEqual([200, 100]);
		expect(anchorPoint('top', 200, 100)).toEqual([100, 0]);
		expect(anchorPoint('left', 200, 100)).toEqual([0, 50]);
	});

	it('passes an explicit point through, and rejects an unknown name', () => {
		expect(anchorPoint([12, 34], 200, 100)).toEqual([12, 34]);
		expect(() => anchorPoint('middle' as never, 1, 1)).toThrow('Unknown anchor "middle"');
	});
});

describe('shapeTransform', () => {
	const box = { width: 200, height: 100 };

	it('is empty for a shape that is where it is drawn', () => {
		expect(shapeTransform(box)).toBe('');
		expect(shapeTransform({ ...box, x: 0, y: 0 })).toBe('');
	});

	it('puts the top-left corner at x, y by default', () => {
		expect(shapeTransform({ ...box, x: 30, y: 40 })).toBe('translate(30 40)');
	});

	it('puts the anchor point at x, y', () => {
		// The centre of a 200x100 box at (500, 300): the corner is at (400, 250).
		expect(shapeTransform({ ...box, x: 500, y: 300, anchor: 'center' })).toBe('translate(400 250)');
		expect(shapeTransform({ ...box, x: 500, y: 300, anchor: [10, 20] })).toBe('translate(490 280)');
		// An anchor on the position needs no move.
		expect(shapeTransform({ ...box, x: 0, y: 0, anchor: 'top-left' })).toBe('');
	});

	it('rotates and scales around the centre unless told otherwise', () => {
		expect(shapeTransform({ ...box, rotate: 45 })).toBe('translate(100 50) rotate(45) translate(-100 -50)');
		expect(shapeTransform({ ...box, scale: 2 })).toBe('translate(100 50) scale(2 2) translate(-100 -50)');
		expect(shapeTransform({ ...box, scale: [2, 0.5] })).toBe('translate(100 50) scale(2 0.5) translate(-100 -50)');
		expect(shapeTransform({ ...box, rotate: 90, origin: 'top-left' })).toBe('translate(0 0) rotate(90) translate(0 0)');
		expect(shapeTransform({ ...box, rotate: 90, origin: [5, 6] })).toBe('translate(5 6) rotate(90) translate(-5 -6)');
	});

	it('moves first and rotates around the moved shape', () => {
		expect(shapeTransform({ ...box, x: 10, y: 20, rotate: 30, scale: 2 })).toBe(
			'translate(10 20) translate(100 50) rotate(30) scale(2 2) translate(-100 -50)'
		);
	});

	it('moves points where the transform says it does', () => {
		// Rotating 90 degrees clockwise around the centre of a 200x100 box sends its top-left
		// corner to (150, -50), and the centre stays where it is.
		const rotated = shapeTransform({ ...box, rotate: 90 });
		near(apply(rotated, [0, 0]), [150, -50]);
		near(apply(rotated, [100, 50]), [100, 50]);

		// Doubling around the centre sends the corner to (-100, -50).
		near(apply(shapeTransform({ ...box, scale: 2 }), [0, 0]), [-100, -50]);

		// The centre goes to x, y when it is the anchor, whatever the rotation.
		const placed = shapeTransform({ ...box, x: 500, y: 300, anchor: 'center', rotate: 33, scale: 1.5 });
		near(apply(placed, [100, 50]), [500, 300]);
	});

	it('rejects values that are not numbers', () => {
		expect(() => shapeTransform({ ...box, x: Number.NaN })).toThrow('x must be a finite number');
		expect(() => shapeTransform({ ...box, rotate: Infinity })).toThrow('rotate must be a finite number');
		expect(() => shapeTransform({ ...box, scale: Number.NaN })).toThrow('scale must be finite');
	});
});

describe('regularPolygon', () => {
	it('puts a corner straight up, in a box centred on (radius, radius)', () => {
		const [top, ...rest] = regularPolygon(3, 100);
		near(top, [100, 0]);
		near(rest[0], [100 + 100 * Math.cos(Math.PI / 6), 100 + 50]);
		near(rest[1], [100 - 100 * Math.cos(Math.PI / 6), 100 + 50]);
	});

	it('keeps every corner on the circle', () => {
		for (const sides of [3, 4, 5, 6, 12]) {
			const corners = regularPolygon(sides, 50);
			expect(corners).toHaveLength(sides);
			for (const [x, y] of corners) expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(50, 6);
		}
	});

	it('makes a square a diamond: corners at the middle of each side of the box', () => {
		const [a, b, c, d] = regularPolygon(4, 10);
		near(a, [10, 0]);
		near(b, [20, 10]);
		near(c, [10, 20]);
		near(d, [0, 10]);
	});

	it('rejects fewer than 3 sides and bad radii', () => {
		expect(() => regularPolygon(2, 10)).toThrow('3 or more sides');
		expect(() => regularPolygon(3.5, 10)).toThrow('3 or more sides');
		expect(() => regularPolygon(3, -1)).toThrow('radius must be 0 or more');
	});
});

describe('star', () => {
	it('alternates tips and notches, starting with a tip straight up', () => {
		const vertices = star(5, 100, 40);
		expect(vertices).toHaveLength(10);
		near(vertices[0], [100, 0]);
		vertices.forEach(([x, y], i) => expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(i % 2 === 0 ? 100 : 40, 6));
	});

	it('rejects fewer than 3 points', () => {
		expect(() => star(2, 10, 5)).toThrow('3 or more points');
	});
});

describe('pointsAttribute and boundsOf', () => {
	it('prints rounded points', () => {
		expect(pointsAttribute([[1, 2], [3.123456789, 4]])).toBe('1,2 3.1235,4');
	});

	it('finds the box around points in any order', () => {
		expect(boundsOf([[10, 50], [30, 20], [0, 40]])).toEqual({ x: 0, y: 20, width: 30, height: 30 });
	});
});

describe('arrowGeometry', () => {
	const from: Point = [0, 0];
	const to: Point = [100, 0];

	it('draws a shaft that ends where the head begins, and a head on the tip', () => {
		const { shaft, heads } = arrowGeometry(from, to, { strokeWidth: 5 });
		// A head 20 long (4 times the stroke), 16 wide (0.8 of its length).
		near(shaft![0], [0, 0]);
		near(shaft![1], [80, 0]);
		expect(heads).toHaveLength(1);
		near(heads[0][0], [100, 0]);
		near(heads[0][1], [80, 8]);
		near(heads[0][2], [80, -8]);
	});

	it('points the head along the line, whatever its direction', () => {
		const { shaft, heads } = arrowGeometry([0, 0], [0, 100], { strokeWidth: 5, headLength: 30, headWidth: 20 });
		near(shaft![1], [0, 70]);
		near(heads[0][0], [0, 100]);
		// Perpendicular to a downward line is horizontal.
		expect(heads[0][1][1]).toBeCloseTo(70);
		expect(Math.abs(heads[0][1][0] - heads[0][2][0])).toBeCloseTo(20);
	});

	it('can have a head at the start, or at both ends, or none', () => {
		const start = arrowGeometry(from, to, { strokeWidth: 5, heads: 'start' });
		near(start.heads[0][0], [0, 0]);
		near(start.shaft![0], [20, 0]);
		near(start.shaft![1], [100, 0]);

		const both = arrowGeometry(from, to, { strokeWidth: 5, heads: 'both' });
		expect(both.heads).toHaveLength(2);
		near(both.shaft![0], [20, 0]);
		near(both.shaft![1], [80, 0]);

		const none = arrowGeometry(from, to, { strokeWidth: 5, heads: 'none' });
		expect(none.heads).toEqual([]);
		near(none.shaft![1], [100, 0]);
	});

	it('grows from nothing: the head stays on the tip and shrinks to fit', () => {
		expect(arrowGeometry(from, to, { strokeWidth: 5, progress: 0 })).toEqual({ heads: [] });

		const early = arrowGeometry(from, to, { strokeWidth: 5, progress: 0.1 });
		// 10 long so far, so the head (20 wanted) is 10 long and 8 wide, and there is no shaft yet.
		expect(early.shaft).toBeUndefined();
		near(early.heads[0][0], [10, 0]);
		near(early.heads[0][1], [0, 4]);

		const half = arrowGeometry(from, to, { strokeWidth: 5, progress: 0.5 });
		near(half.heads[0][0], [50, 0]);
		near(half.shaft![1], [30, 0]);
	});

	it('keeps two heads from overlapping on a short arrow', () => {
		const short = arrowGeometry(from, [30, 0], { strokeWidth: 5, heads: 'both' });
		// 20 wanted each, 30 available: 15 each.
		expect(short.shaft).toBeUndefined();
		near(short.heads[1][1], [15, 6]);
	});

	it('handles an arrow of no length and rejects bad sizes', () => {
		expect(arrowGeometry([5, 5], [5, 5], { strokeWidth: 5 })).toEqual({ heads: [] });
		expect(() => arrowGeometry(from, to, { strokeWidth: -1 })).toThrow('strokeWidth must be 0 or more');
		expect(() => arrowGeometry(from, to, { strokeWidth: 1, headLength: -2 })).toThrow('headLength');
		expect(() => arrowGeometry(from, to, { strokeWidth: 1, progress: Number.NaN })).toThrow('progress must be a number');
	});

	it('clamps progress to the line', () => {
		near(arrowGeometry(from, to, { strokeWidth: 5, progress: 3 }).heads[0][0], [100, 0]);
		expect(arrowGeometry(from, to, { strokeWidth: 5, progress: -1 })).toEqual({ heads: [] });
	});
});

describe('paintAttributes', () => {
	it('gives only what was set, so SVG defaults apply to the rest', () => {
		expect(paintAttributes({})).toEqual({});
		expect(paintAttributes({ fill: 'red', strokeWidth: 0, opacity: 0.5 })).toEqual({ fill: 'red', 'stroke-width': 0, opacity: 0.5 });
		expect(paintAttributes({ stroke: '#fff', strokeLinecap: 'round', strokeLinejoin: 'bevel' })).toEqual({
			stroke: '#fff',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'bevel'
		});
	});

	it('draws only the first part of the outline for a progress below 1', () => {
		expect(paintAttributes({ progress: 0.25 })).toEqual({ 'stroke-dasharray': '0.25 1' });
		expect(paintAttributes({ progress: 1 })).toEqual({});
		expect(paintAttributes({ progress: 7 })).toEqual({});
	});

	it('draws nothing at 0, without a dot from a round cap', () => {
		expect(paintAttributes({ progress: 0, strokeLinecap: 'round' })).toEqual({
			'stroke-dasharray': '0 1',
			'stroke-linecap': 'butt'
		});
		expect(paintAttributes({ progress: -3 })['stroke-dasharray']).toBe('0 1');
	});

	it('knows when the outline must be measured as 1', () => {
		expect(needsPathLength(undefined)).toBe(false);
		expect(needsPathLength(1)).toBe(false);
		expect(needsPathLength(0.99)).toBe(true);
		expect(needsPathLength(0)).toBe(true);
		expect(clampProgress(2)).toBe(1);
	});
});
