import { describe, expect, it } from 'vitest';
import { Easing, type EasingFunction } from './easing.js';

const curves: Record<string, EasingFunction> = {
	linear: Easing.linear,
	ease: Easing.ease,
	quad: Easing.quad,
	cubic: Easing.cubic,
	'in(quad)': Easing.in(Easing.quad),
	'out(quad)': Easing.out(Easing.quad),
	'inOut(quad)': Easing.inOut(Easing.quad),
	'inOut(cubic)': Easing.inOut(Easing.cubic),
	bezier: Easing.bezier(0.42, 0, 0.58, 1)
};

describe('Easing', () => {
	for (const [name, fn] of Object.entries(curves)) {
		it(`${name}: f(0) = 0 and f(1) = 1`, () => {
			expect(fn(0)).toBeCloseTo(0, 10);
			expect(fn(1)).toBeCloseTo(1, 10);
		});
	}

	it('out mirrors in', () => {
		expect(Easing.out(Easing.quad)(0.25)).toBeCloseTo(1 - 0.75 * 0.75);
	});

	it('inOut is symmetric around the midpoint', () => {
		const f = Easing.inOut(Easing.cubic);
		expect(f(0.5)).toBeCloseTo(0.5);
		expect(f(0.25) + f(0.75)).toBeCloseTo(1);
	});

	it('bezier(0,0,1,1) is linear', () => {
		const f = Easing.bezier(0, 0, 1, 1);
		expect(f(0.3)).toBeCloseTo(0.3);
	});

	it('bezier matches known CSS ease-in-out value at the midpoint', () => {
		expect(Easing.bezier(0.42, 0, 0.58, 1)(0.5)).toBeCloseTo(0.5, 5);
	});

	it('bezier rejects x control points outside [0, 1]', () => {
		expect(() => Easing.bezier(-0.1, 0, 0.5, 1)).toThrow(RangeError);
		expect(() => Easing.bezier(0.5, 0, 1.1, 1)).toThrow(RangeError);
	});

	it('bezier is monotonic for a monotonic curve', () => {
		const f = Easing.ease;
		let prev = -Infinity;
		for (let i = 0; i <= 100; i++) {
			const v = f(i / 100);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});
});
