import { describe, expect, it } from 'vitest';
import { Easing } from './easing.js';
import { interpolate } from './interpolate.js';

describe('interpolate', () => {
	it('maps linearly between two points', () => {
		expect(interpolate(5, [0, 10], [0, 100])).toBe(50);
		expect(interpolate(0, [0, 10], [0, 100])).toBe(0);
		expect(interpolate(10, [0, 10], [0, 100])).toBe(100);
	});

	it('supports multi-point ranges', () => {
		const f = (x: number) => interpolate(x, [0, 10, 20], [0, 1, 0]);
		expect(f(5)).toBe(0.5);
		expect(f(10)).toBe(1);
		expect(f(15)).toBe(0.5);
		expect(f(20)).toBe(0);
	});

	it('supports decreasing output ranges', () => {
		expect(interpolate(5, [0, 10], [10, 0])).toBe(5);
	});

	it('clamps by default', () => {
		expect(interpolate(-5, [0, 10], [0, 100])).toBe(0);
		expect(interpolate(15, [0, 10], [0, 100])).toBe(100);
		expect(interpolate(Infinity, [0, 10], [0, 100])).toBe(100);
	});

	it('extends using the edge segment', () => {
		const opts = { extrapolateLeft: 'extend', extrapolateRight: 'extend' } as const;
		expect(interpolate(-5, [0, 10], [0, 100], opts)).toBe(-50);
		expect(interpolate(15, [0, 10], [0, 100], opts)).toBe(150);
		expect(interpolate(30, [0, 10, 20], [0, 1, 0], opts)).toBe(-1);
	});

	it('returns the input for identity extrapolation', () => {
		const opts = { extrapolateLeft: 'identity', extrapolateRight: 'identity' } as const;
		expect(interpolate(-5, [0, 10], [0, 100], opts)).toBe(-5);
		expect(interpolate(15, [0, 10], [0, 100], opts)).toBe(15);
	});

	it('applies extrapolation per side', () => {
		const opts = { extrapolateLeft: 'extend' } as const;
		expect(interpolate(-5, [0, 10], [0, 100], opts)).toBe(-50);
		expect(interpolate(15, [0, 10], [0, 100], opts)).toBe(100);
	});

	it('applies easing to segment progress', () => {
		expect(interpolate(5, [0, 10], [0, 100], { easing: Easing.quad })).toBe(25);
		expect(interpolate(0, [0, 10], [0, 100], { easing: Easing.quad })).toBe(0);
		expect(interpolate(10, [0, 10], [0, 100], { easing: Easing.quad })).toBe(100);
	});

	it('throws on invalid ranges', () => {
		expect(() => interpolate(0, [0, 1], [0])).toThrow(/same length/);
		expect(() => interpolate(0, [0], [0])).toThrow(/at least 2/);
		expect(() => interpolate(0, [0, 0], [0, 1])).toThrow(/strictly increasing/);
		expect(() => interpolate(0, [1, 0], [0, 1])).toThrow(/strictly increasing/);
		expect(() => interpolate(0, [0, NaN], [0, 1])).toThrow(/finite/);
	});

	it('throws on NaN input', () => {
		expect(() => interpolate(NaN, [0, 1], [0, 1])).toThrow(/NaN/);
	});
});
