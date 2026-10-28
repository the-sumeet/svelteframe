import type { Browser, Page } from 'playwright';
import type { VideoFrames } from './video-frames.js';

/** What a render page exposes on `window.__Svelteframe` (see the playground's bridge). */
export interface Bridge {
	config: { fps: number; width: number; height: number; durationInFrames: number };
	ready: boolean;
	setFrame(n: number): Promise<void>;
	/** What `<Audio>` recorded while frames were rendered. */
	audio?: unknown;
}

export type BridgeGlobal = { __Svelteframe?: Bridge; __SvelteframeError?: string };

export interface PageHandle {
	page: Page;
	/** The first error thrown by the page itself, if any. */
	pageError: () => Error | undefined;
}

/**
 * Open `url` and wait until it offers the bridge, or fail with the reason it could not.
 * `videoFrames` answers the frame requests of `<OffthreadVideo>`.
 */
export async function openPage(browser: Browser, url: string, videoFrames?: VideoFrames): Promise<PageHandle> {
	const page = await browser.newPage();
	await videoFrames?.attach(page);
	let pageError: Error | undefined;
	page.on('pageerror', (e) => (pageError ??= e));

	await page.goto(url);
	// The page either exposes the bridge or reports why it cannot (unknown composition, bad props...).
	await page.waitForFunction(() => {
		const g = globalThis as BridgeGlobal;
		return g.__Svelteframe?.ready === true || g.__SvelteframeError !== undefined;
	});
	const failure = await page.evaluate(() => (globalThis as BridgeGlobal).__SvelteframeError);
	if (failure !== undefined) throw new Error(`${url} failed to load: ${failure}`);

	return { page, pageError: () => pageError };
}
