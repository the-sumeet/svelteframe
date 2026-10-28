import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultConcurrency, resolveConcurrency, splitFrames } from './frames.js';

describe('splitFrames', () => {
	it('returns one range for one part', () => {
		assert.deepEqual(splitFrames(150, 1), [{ start: 0, end: 150 }]);
	});

	it('splits evenly when the frames divide', () => {
		assert.deepEqual(splitFrames(150, 3), [
			{ start: 0, end: 50 },
			{ start: 50, end: 100 },
			{ start: 100, end: 150 }
		]);
	});

	it('gives the extra frames to the earlier ranges', () => {
		assert.deepEqual(splitFrames(10, 3), [
			{ start: 0, end: 4 },
			{ start: 4, end: 7 },
			{ start: 7, end: 10 }
		]);
	});

	it('never produces more ranges than frames', () => {
		assert.deepEqual(splitFrames(3, 10), [
			{ start: 0, end: 1 },
			{ start: 1, end: 2 },
			{ start: 2, end: 3 }
		]);
		assert.deepEqual(splitFrames(1, 4), [{ start: 0, end: 1 }]);
	});

	it('covers every frame exactly once, in order, with sizes within one of each other', () => {
		for (const total of [1, 2, 7, 30, 99, 150, 901]) {
			for (const parts of [1, 2, 3, 4, 5, 8, 13, 64]) {
				const ranges = splitFrames(total, parts);
				assert.equal(ranges[0].start, 0);
				assert.equal(ranges.at(-1)!.end, total);
				ranges.forEach((range, i) => {
					assert.ok(range.end > range.start, `${total}/${parts}: empty range`);
					if (i > 0) assert.equal(range.start, ranges[i - 1].end);
				});
				const sizes = ranges.map((r) => r.end - r.start);
				assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${total}/${parts}: ${sizes}`);
				assert.equal(ranges.length, Math.min(parts, total));
			}
		}
	});

	it('rejects invalid input', () => {
		assert.throws(() => splitFrames(0, 2), /total frames/);
		assert.throws(() => splitFrames(10.5, 2), /total frames/);
		assert.throws(() => splitFrames(10, 0), /parts/);
		assert.throws(() => splitFrames(10, 1.5), /parts/);
	});
});

describe('defaultConcurrency', () => {
	it('is half the cores, and at least one', () => {
		assert.equal(defaultConcurrency(10), 5);
		assert.equal(defaultConcurrency(8), 4);
		assert.equal(defaultConcurrency(3), 1);
		assert.equal(defaultConcurrency(1), 1);
	});
});

describe('resolveConcurrency', () => {
	it('uses the request when given', () => {
		assert.equal(resolveConcurrency(4, 150, 16), 4);
	});

	it('falls back to the default', () => {
		assert.equal(resolveConcurrency(undefined, 150, 8), 4);
	});

	it('never exceeds the number of frames', () => {
		assert.equal(resolveConcurrency(10, 3), 3);
		assert.equal(resolveConcurrency(undefined, 2, 64), 2);
	});

	it('rejects anything but a positive integer', () => {
		for (const bad of [0, -1, 1.5, NaN]) {
			assert.throws(() => resolveConcurrency(bad, 100), /positive integer/);
		}
	});
});
