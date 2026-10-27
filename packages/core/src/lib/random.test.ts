import { describe, expect, it } from 'vitest';
import { random } from './random.js';

describe('random', () => {
	it('is deterministic for a given seed', () => {
		expect(random('a')).toBe(random('a'));
		expect(random(42)).toBe(random(42));
	});

	it('is stable across versions (regression anchors)', () => {
		expect(random('a')).toBeCloseTo(0.621685681398958, 12);
		expect(random(1)).toBeCloseTo(0.8317172497045249, 12);
		expect(random('svelteframe')).toBeCloseTo(0.2504986235871911, 12);
	});

	it('treats a number and its string form as the same seed', () => {
		expect(random(1)).toBe(random('1'));
	});

	it('gives different values for different seeds', () => {
		expect(random(1)).not.toBe(random(2));
		expect(random('a')).not.toBe(random('b'));
		expect(random(1.5)).not.toBe(random(1.6));
	});

	it('stays within [0, 1)', () => {
		for (let i = 0; i < 5000; i++) {
			const v = random(i);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('is roughly uniformly distributed', () => {
		const n = 10000;
		let sum = 0;
		let sumSq = 0;
		for (let i = 0; i < n; i++) {
			const v = random(`seed-${i}`);
			sum += v;
			sumSq += v * v;
		}
		const mean = sum / n;
		const std = Math.sqrt(sumSq / n - mean * mean);
		expect(mean).toBeCloseTo(0.5, 1);
		expect(std).toBeCloseTo(Math.sqrt(1 / 12), 1);
	});

	it('rejects non-finite seeds', () => {
		expect(() => random(NaN)).toThrow(/finite/);
		expect(() => random(Infinity)).toThrow(/finite/);
	});
});
