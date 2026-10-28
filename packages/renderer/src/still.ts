import { mkdir } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import { chromium } from 'playwright';
import { openPage, type BridgeGlobal } from './page.js';

export type ImageFormat = 'png' | 'jpeg';

/** The image format an output file name asks for: `.png`, `.jpg` or `.jpeg`. */
export function imageFormatFor(output: string): ImageFormat {
	switch (extname(output).toLowerCase()) {
		case '.png':
			return 'png';
		case '.jpg':
		case '.jpeg':
			return 'jpeg';
		default:
			throw new Error(`Cannot write "${output}": use a .png, .jpg or .jpeg file name`);
	}
}

export interface StillOptions {
	/** Page exposing `window.__Svelteframe` (e.g. the playground's `/render/<id>` route). */
	url: string;
	/** Image file to write. Its extension picks the format. */
	output: string;
	/** Which frame to capture. Defaults to the first. */
	frame?: number;
	/** JPEG quality, 0-100. Ignored for PNG. */
	quality?: number;
	/** Chromium executable to use instead of Playwright's bundled one. */
	chromiumPath?: string;
	signal?: AbortSignal;
}

export interface StillResult {
	frame: number;
	/** Frames in the video, so the valid range is `0` to `total - 1`. */
	total: number;
	width: number;
	height: number;
}

/** Capture one frame of a composition as an image. */
export async function renderStill(opts: StillOptions): Promise<StillResult> {
	const { url, output, frame = 0, quality = 90, chromiumPath, signal } = opts;
	const format = imageFormatFor(output);
	if (!Number.isInteger(frame) || frame < 0) {
		throw new Error(`frame must be a whole number of 0 or more, got ${frame}`);
	}

	signal?.throwIfAborted();
	const browser = await chromium.launch({ executablePath: chromiumPath });
	try {
		const worker = await openPage(browser, url);
		const { width, height, durationInFrames: total } = await worker.page.evaluate(
			() => (globalThis as BridgeGlobal).__Svelteframe!.config
		);
		if (frame >= total) {
			throw new Error(`Frame ${frame} is out of range: the video has ${total} frames (0-${total - 1})`);
		}

		await worker.page.setViewportSize({ width, height });
		signal?.throwIfAborted();
		await worker.page.evaluate((n) => (globalThis as BridgeGlobal).__Svelteframe!.setFrame(n), frame);
		const pageError = worker.pageError();
		if (pageError) throw pageError;

		await mkdir(dirname(output), { recursive: true });
		await worker.page.screenshot(
			format === 'png' ? { path: output, type: 'png' } : { path: output, type: 'jpeg', quality }
		);
		return { frame, total, width, height };
	} finally {
		await browser.close().catch(() => {});
	}
}
