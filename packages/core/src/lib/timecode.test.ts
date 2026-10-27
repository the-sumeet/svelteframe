import { describe, expect, it } from 'vitest';
import { formatTimecode } from './timecode.js';

describe('formatTimecode', () => {
	it('formats frames as m:ss.ff', () => {
		expect(formatTimecode(0, 30)).toBe('0:00.00');
		expect(formatTimecode(45, 30)).toBe('0:01.15');
		expect(formatTimecode(149, 30)).toBe('0:04.29');
		expect(formatTimecode(150, 30)).toBe('0:05.00');
		expect(formatTimecode(30 * 61 + 3, 30)).toBe('1:01.03');
	});

	it('clamps negatives and rounds fractional frames', () => {
		expect(formatTimecode(-4, 30)).toBe('0:00.00');
		expect(formatTimecode(14.6, 30)).toBe('0:00.15');
	});
});
