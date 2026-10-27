import { tick } from 'svelte';

/** Identifies one pending piece of async work, returned by `delayRender`. */
export type RenderHandle = number;

export interface DelayRenderOptions {
	/** How long the handle may stay pending before the render fails. Default 30 000. */
	timeoutInMilliseconds?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
/** Handed out on the server, where there is nothing to wait for. */
const SERVER_HANDLE: RenderHandle = -1;

const pending = new Map<RenderHandle, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let nextHandle = 1;
let waiters = 0;
let failure: Error | undefined;

const notify = () => {
	for (const listener of [...listeners]) listener();
};

/** Resolves on the next `continueRender` or failure. */
const nextChange = () =>
	new Promise<void>((resolve) => {
		const listener = () => {
			listeners.delete(listener);
			resolve();
		};
		listeners.add(listener);
	});

/** Returns whether `handle` was still pending. */
function settle(handle: RenderHandle): boolean {
	const timer = pending.get(handle);
	if (timer === undefined) return false;
	clearTimeout(timer);
	pending.delete(handle);
	return true;
}

/**
 * Hold the render until `continueRender(handle)` is called, e.g. while fetching data.
 * Call it synchronously while the component initialises, so the handle exists before
 * the frame is considered drawn. If it is never continued, the render fails after the
 * timeout with an error naming `label`.
 */
export function delayRender(
	label = 'unnamed',
	{ timeoutInMilliseconds = DEFAULT_TIMEOUT_MS }: DelayRenderOptions = {}
): RenderHandle {
	if (typeof window === 'undefined') return SERVER_HANDLE;

	const handle = nextHandle++;
	const timer = setTimeout(
		() =>
			failRender(
				handle,
				new Error(
					`delayRender("${label}") was not continued within ${timeoutInMilliseconds}ms. ` +
						'Call continueRender() with its handle, or raise timeoutInMilliseconds.'
				)
			),
		timeoutInMilliseconds
	);
	pending.set(handle, timer);
	return handle;
}

/** Release a handle from `delayRender`. Releasing twice, or after a failure, does nothing. */
export function continueRender(handle: RenderHandle): void {
	if (settle(handle)) notify();
}

/**
 * Release a handle and fail the render with `error`. The error is thrown from the next
 * (or current) `waitUntilReady()`, so a renderer sees it; it is also logged when nothing is waiting.
 */
export function failRender(handle: RenderHandle, error: Error): void {
	if (!settle(handle)) return;
	failure ??= error;
	if (waiters === 0) console.error(error);
	notify();
}

function throwIfFailed() {
	if (!failure) return;
	const error = failure;
	failure = undefined;
	throw error;
}

/**
 * Resolves once the DOM is up to date, every `delayRender` handle has been continued and
 * web fonts have loaded. Rejects if a handle times out or is failed.
 */
export async function waitUntilReady(): Promise<void> {
	if (typeof document === 'undefined') return;

	waiters++;
	try {
		for (;;) {
			await tick();
			throwIfFailed();
			if (pending.size > 0) {
				await nextChange();
				continue;
			}

			// Layout is what starts font loads, so force it before waiting on them.
			void document.body?.offsetHeight;
			await document.fonts?.ready;
			await tick();
			throwIfFailed();
			// Work started by the update above (e.g. a newly mounted <Img>) keeps us waiting.
			if (pending.size === 0) return;
		}
	} finally {
		waiters--;
	}
}
