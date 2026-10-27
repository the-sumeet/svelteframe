import { describe, expect, it } from 'vitest';
import { measureSpring, spring, type SpringConfig } from './spring.js';

const fps = 30;
const at = (frame: number, config?: Partial<SpringConfig>, extra = {}) =>
	spring({ frame, fps, config, ...extra });

/** Reference: integrate m*x'' + c*x' + k*(x - 1) = 0 with tiny semi-implicit Euler steps. */
function simulate(seconds: number, { damping, mass, stiffness }: SpringConfig): number {
	const dt = 1e-5;
	let x = 0;
	let v = 0;
	for (let t = 0; t < seconds; t += dt) {
		v += ((-stiffness * (x - 1) - damping * v) / mass) * dt;
		x += v * dt;
	}
	return x;
}

const regimes: Record<string, SpringConfig> = {
	underdamped: { damping: 10, mass: 1, stiffness: 100 },
	'very bouncy': { damping: 2, mass: 1, stiffness: 100 },
	'critically damped': { damping: 20, mass: 1, stiffness: 100 },
	overdamped: { damping: 40, mass: 1, stiffness: 100 },
	'heavy and soft': { damping: 5, mass: 3, stiffness: 40 }
};

describe('spring', () => {
	it('starts at `from` and settles at `to`', () => {
		expect(at(0)).toBe(0);
		expect(at(300)).toBeCloseTo(1, 6);
		expect(at(0, undefined, { from: 10, to: 50 })).toBe(10);
		expect(at(300, undefined, { from: 10, to: 50 })).toBeCloseTo(50, 4);
	});

	it('returns `from` for negative frames', () => {
		expect(at(-5, undefined, { from: 3 })).toBe(3);
	});

	it('supports animating downwards', () => {
		expect(at(300, undefined, { from: 1, to: 0 })).toBeCloseTo(0, 6);
	});

	it('is deterministic and independent of call order', () => {
		const a = [10, 3, 25, 3].map((f) => at(f));
		const b = [10, 3, 25, 3].map((f) => at(f));
		expect(a).toEqual(b);
		expect(a[1]).toBe(a[3]);
	});

	for (const [name, config] of Object.entries(regimes)) {
		it(`matches a numerical simulation (${name})`, () => {
			for (const frame of [1, 5, 12, 30, 60]) {
				expect(at(frame, config)).toBeCloseTo(simulate(frame / fps, config), 3);
			}
		});
	}

	it('overshoots when underdamped', () => {
		const peak = Math.max(...Array.from({ length: 90 }, (_, f) => at(f)));
		expect(peak).toBeGreaterThan(1.05);
	});

	it('never overshoots when critically damped or overdamped', () => {
		for (const config of [regimes['critically damped'], regimes.overdamped]) {
			let prev = 0;
			for (let f = 0; f < 200; f++) {
				const v = at(f, config);
				expect(v).toBeLessThanOrEqual(1 + 1e-9);
				expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
				prev = v;
			}
		}
	});

	it('oscillates forever without damping', () => {
		const values = Array.from({ length: 300 }, (_, f) => at(f, { damping: 0 }));
		expect(Math.max(...values)).toBeCloseTo(2, 1);
		expect(values.slice(250).some((v) => Math.abs(v - 1) > 0.5)).toBe(true);
	});

	it('uses config defaults for unspecified fields', () => {
		expect(at(10, { damping: 10 })).toBe(at(10));
	});

	describe('durationInFrames', () => {
		it('reaches `to` exactly at the duration and stays there', () => {
			expect(at(60, undefined, { durationInFrames: 60 })).toBe(1);
			expect(at(500, undefined, { durationInFrames: 60 })).toBe(1);
		});

		it('is already near `to` just before the duration', () => {
			expect(at(59, undefined, { durationInFrames: 60 })).toBeCloseTo(1, 1);
		});

		it('stretches the motion to fit', () => {
			const fast = at(15, undefined, { durationInFrames: 30 });
			const slow = at(15, undefined, { durationInFrames: 120 });
			expect(fast).toBeGreaterThan(0.9);
			expect(slow).toBeLessThan(0.5);
		});
	});

	it('validates its inputs', () => {
		expect(() => spring({ frame: NaN, fps })).toThrow(/NaN/);
		expect(() => spring({ frame: 1, fps: 0 })).toThrow(/fps/);
		expect(() => spring({ frame: 1, fps, config: { mass: 0 } })).toThrow(/mass/);
		expect(() => spring({ frame: 1, fps, config: { stiffness: -1 } })).toThrow(/stiffness/);
		expect(() => spring({ frame: 1, fps, config: { damping: -1 } })).toThrow(/damping/);
		expect(() => spring({ frame: 1, fps, durationInFrames: 0 })).toThrow(/durationInFrames/);
	});
});

describe('measureSpring', () => {
	it('returns the frame after which the spring stays settled', () => {
		const n = measureSpring({ fps });
		expect(n).toBeGreaterThan(10);
		expect(n).toBeLessThan(120);
		for (let f = n; f < n + 200; f++) expect(Math.abs(at(f) - 1)).toBeLessThanOrEqual(0.005);
		expect(Math.abs(at(n - 1) - 1)).toBeGreaterThan(0.005);
	});

	it('settles later for softer springs', () => {
		expect(measureSpring({ fps, config: { damping: 4 } })).toBeGreaterThan(measureSpring({ fps }));
	});

	it('is capped for springs that never settle', () => {
		expect(measureSpring({ fps, config: { damping: 0 } })).toBe(60 * fps + 1);
	});
});
