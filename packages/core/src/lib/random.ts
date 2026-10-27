/** FNV-1a, 32 bit. */
function hash(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** mulberry32: one output of a small, well-mixed 32-bit generator. */
function mix(seed: number): number {
	let a = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Deterministic pseudo-random number in [0, 1) for a seed. The same seed always
 * gives the same value, so renders are reproducible. Numbers and their string
 * form are equivalent: `random(1) === random('1')`.
 */
export function random(seed: number | string): number {
	if (typeof seed === 'number' && !Number.isFinite(seed)) {
		throw new Error('random: seed must be a finite number or a string');
	}
	return mix(hash(String(seed)));
}
