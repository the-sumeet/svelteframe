export type EasingFunction = (t: number) => number;

const linear: EasingFunction = (t) => t;

/**
 * Cubic bezier easing, same parametrisation as CSS `cubic-bezier()`.
 * Inputs outside [0, 1] are clamped. `x1` and `x2` must lie in [0, 1].
 */
function bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
	if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
		throw new RangeError('bezier: x1 and x2 must be between 0 and 1');
	}
	if (x1 === y1 && x2 === y2) return linear;

	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;

	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;

	return (x) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		// x(t) is monotonic for x1, x2 in [0, 1], so bisection always converges.
		let lo = 0;
		let hi = 1;
		let t = x;
		for (let i = 0; i < 60; i++) {
			const dx = sampleX(t) - x;
			if (Math.abs(dx) < 1e-7) break;
			if (dx > 0) hi = t;
			else lo = t;
			t = (lo + hi) / 2;
		}
		return sampleY(t);
	};
}

/** Apply `fn` as-is (ease in). */
const easeIn = (fn: EasingFunction): EasingFunction => fn;

/** Mirror `fn` so it eases out. */
const easeOut =
	(fn: EasingFunction): EasingFunction =>
	(t) =>
		1 - fn(1 - t);

/** Ease in for the first half, ease out for the second half. */
const easeInOut =
	(fn: EasingFunction): EasingFunction =>
	(t) =>
		t < 0.5 ? fn(t * 2) / 2 : 1 - fn((1 - t) * 2) / 2;

export const Easing = {
	linear,
	/** CSS `ease`. */
	ease: bezier(0.25, 0.1, 0.25, 1),
	quad: (t: number) => t * t,
	cubic: (t: number) => t * t * t,
	bezier,
	in: easeIn,
	out: easeOut,
	inOut: easeInOut
} as const;
