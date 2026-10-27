// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { continueRender, delayRender, failRender, waitUntilReady } from './delay-render.js';

/** True while `promise` has not settled (after letting microtasks run). */
async function isPending(promise: Promise<unknown>): Promise<boolean> {
	let settled = false;
	promise.then(
		() => (settled = true),
		() => (settled = true)
	);
	await vi.advanceTimersByTimeAsync(0);
	return !settled;
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	Reflect.deleteProperty(document, 'fonts');
});

describe('waitUntilReady', () => {
	it('resolves immediately when nothing is pending', async () => {
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});

	it('waits until the handle is continued', async () => {
		const handle = delayRender('data');
		const ready = waitUntilReady();
		expect(await isPending(ready)).toBe(true);

		continueRender(handle);
		await expect(ready).resolves.toBeUndefined();
	});

	it('waits for every outstanding handle', async () => {
		const a = delayRender('a');
		const b = delayRender('b');
		const ready = waitUntilReady();

		continueRender(a);
		expect(await isPending(ready)).toBe(true);
		continueRender(b);
		await expect(ready).resolves.toBeUndefined();
	});

	it('keeps waiting for handles created while it is waiting', async () => {
		const first = delayRender('first');
		const ready = waitUntilReady();
		await vi.advanceTimersByTimeAsync(0);

		const second = delayRender('second');
		continueRender(first);
		expect(await isPending(ready)).toBe(true);

		continueRender(second);
		await expect(ready).resolves.toBeUndefined();
	});

	it('waits for web fonts', async () => {
		let loadFonts!: () => void;
		Object.defineProperty(document, 'fonts', {
			configurable: true,
			value: { ready: new Promise<void>((resolve) => (loadFonts = resolve)) }
		});

		const ready = waitUntilReady();
		expect(await isPending(ready)).toBe(true);
		loadFonts();
		await expect(ready).resolves.toBeUndefined();
	});
});

describe('continueRender', () => {
	it('ignores unknown and already-continued handles', () => {
		const handle = delayRender('x');
		continueRender(handle);
		expect(() => continueRender(handle)).not.toThrow();
		expect(() => continueRender(99999)).not.toThrow();
	});
});

describe('timeouts', () => {
	it('fails after 30 seconds by default, naming the label', async () => {
		delayRender('slow fetch');
		const ready = waitUntilReady();
		const failed = expect(ready).rejects.toThrow(/delayRender\("slow fetch"\).*30000ms/);

		await vi.advanceTimersByTimeAsync(29_999);
		expect(await isPending(ready)).toBe(true);
		await vi.advanceTimersByTimeAsync(1);
		await failed;
	});

	it('honours a custom timeout', async () => {
		delayRender('quick', { timeoutInMilliseconds: 200 });
		const ready = waitUntilReady();
		const failed = expect(ready).rejects.toThrow(/delayRender\("quick"\).*200ms/);
		await vi.advanceTimersByTimeAsync(200);
		await failed;
	});

	it('does not fail a handle that was continued in time', async () => {
		const handle = delayRender('ok', { timeoutInMilliseconds: 100 });
		continueRender(handle);
		await vi.advanceTimersByTimeAsync(1000);
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});

	it('does not leave the render hanging after a timeout', async () => {
		delayRender('stuck', { timeoutInMilliseconds: 50 });
		const first = expect(waitUntilReady()).rejects.toThrow(/stuck/);
		await vi.advanceTimersByTimeAsync(50);
		await first;
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});
});

describe('failRender', () => {
	it('rejects the waiter with the given error and releases the handle', async () => {
		const handle = delayRender('image');
		const ready = waitUntilReady();
		const failed = expect(ready).rejects.toThrow('boom');

		failRender(handle, new Error('boom'));
		await failed;
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});

	it('keeps the first error when several fail together', async () => {
		const a = delayRender('a');
		const b = delayRender('b');
		const failed = expect(waitUntilReady()).rejects.toThrow('first');
		failRender(a, new Error('first'));
		failRender(b, new Error('second'));
		await failed;
	});

	it('logs when nothing is waiting, and surfaces the error on the next wait', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const handle = delayRender('late');
		failRender(handle, new Error('nobody listening'));

		expect(log).toHaveBeenCalledOnce();
		await expect(waitUntilReady()).rejects.toThrow('nobody listening');
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});

	it('ignores handles that were already continued', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const handle = delayRender('done');
		continueRender(handle);
		failRender(handle, new Error('too late'));

		expect(log).not.toHaveBeenCalled();
		await expect(waitUntilReady()).resolves.toBeUndefined();
	});
});
