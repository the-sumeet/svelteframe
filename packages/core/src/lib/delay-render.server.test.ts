// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { continueRender, delayRender, waitUntilReady } from './delay-render.js';

describe('on the server', () => {
	it('does not register handles, so nothing can leak or time out', async () => {
		vi.useFakeTimers();
		const handle = delayRender('ssr');
		expect(vi.getTimerCount()).toBe(0);
		expect(() => continueRender(handle)).not.toThrow();
		vi.useRealTimers();
	});

	it('waitUntilReady resolves immediately', async () => {
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});
});
