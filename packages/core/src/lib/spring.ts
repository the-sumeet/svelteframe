export interface SpringConfig {
	damping: number;
	mass: number;
	stiffness: number;
}

export const defaultSpringConfig: SpringConfig = { damping: 10, mass: 1, stiffness: 100 };

export interface SpringOptions {
	frame: number;
	fps: number;
	config?: Partial<SpringConfig>;
	from?: number;
	to?: number;
	/** Stretch the motion so it settles on `to` exactly at this frame. */
	durationInFrames?: number;
}

const SETTLE_THRESHOLD = 0.005;
const MAX_SETTLE_SECONDS = 60;

function resolve(config: Partial<SpringConfig> | undefined): SpringConfig {
	const c = { ...defaultSpringConfig, ...config };
	if (!(c.mass > 0) || !(c.stiffness > 0) || !(c.damping >= 0)) {
		throw new Error('spring: mass and stiffness must be > 0 and damping must be >= 0');
	}
	return c;
}

/**
 * Progress (0 -> 1) of a damped spring released from rest at time `t` seconds,
 * from the closed-form solution of m*x'' + c*x' + k*(x - 1) = 0 with x(0) = 0, x'(0) = 0.
 * It is a pure function of its inputs, so any frame can be evaluated on its own.
 */
function progress(t: number, { damping, mass, stiffness }: SpringConfig): number {
	const w0 = Math.sqrt(stiffness / mass);
	const zeta = damping / (2 * Math.sqrt(stiffness * mass));

	if (Math.abs(zeta - 1) < 1e-9) {
		return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
	}
	if (zeta < 1) {
		const wd = w0 * Math.sqrt(1 - zeta * zeta);
		return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
	}
	const s = Math.sqrt(zeta * zeta - 1);
	const r1 = -w0 / (zeta + s); // equals -w0 * (zeta - s), without cancellation
	const r2 = -w0 * (zeta + s);
	return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
}

/**
 * Number of frames after which the spring stays within a small threshold of its target.
 * Capped at 60 seconds for springs that never settle (e.g. `damping: 0`).
 */
export function measureSpring({
	fps,
	config
}: {
	fps: number;
	config?: Partial<SpringConfig>;
}): number {
	if (!(fps > 0)) throw new Error('spring: fps must be > 0');
	const c = resolve(config);
	const max = Math.ceil(MAX_SETTLE_SECONDS * fps);
	let lastOutside = -1;
	for (let f = 0; f <= max; f++) {
		if (Math.abs(progress(f / fps, c) - 1) > SETTLE_THRESHOLD) lastOutside = f;
	}
	return lastOutside + 1;
}

/** Deterministic spring animation: `from` at frame 0, settling on `to`. */
export function spring({
	frame,
	fps,
	config,
	from = 0,
	to = 1,
	durationInFrames
}: SpringOptions): number {
	if (Number.isNaN(frame)) throw new Error('spring: frame must not be NaN');
	if (!(fps > 0)) throw new Error('spring: fps must be > 0');
	if (durationInFrames !== undefined && !(durationInFrames > 0)) {
		throw new Error('spring: durationInFrames must be > 0');
	}
	const c = resolve(config);

	if (frame <= 0) return from;

	let t = frame / fps;
	if (durationInFrames !== undefined) {
		if (frame >= durationInFrames) return to;
		t = (frame / durationInFrames) * (measureSpring({ fps, config: c }) / fps);
	}
	return from + (to - from) * progress(t, c);
}
