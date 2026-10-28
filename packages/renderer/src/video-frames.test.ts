import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright';
import { skip, startFixture, VIDEO_FPS, VIDEO_FRAMES, videoFrameOf, type Fixture } from '../test/fixture.js';
import { createVideoFrames, sourceFrameAt, VIDEO_FRAME_PATH } from './video-frames.js';

describe('sourceFrameAt', () => {
	const video = { fps: 24, duration: 3 };

	it('shows the frame that starts at or before the time', () => {
		assert.equal(sourceFrameAt(0, video).index, 0);
		assert.equal(sourceFrameAt(1 / 24, video).index, 1);
		assert.equal(sourceFrameAt(1 / 24 + 0.03, video).index, 1, 'between frames 1 and 2');
		assert.equal(sourceFrameAt(2 / 24 - 0.001, video).index, 1, 'just before frame 2');
		assert.equal(sourceFrameAt(1, video).index, 24);
	});

	it('is not thrown by floating point error at a frame boundary', () => {
		// 3 / 30 is 0.09999999999999999 in floating point; at 30 fps it is exactly frame 3.
		assert.equal(sourceFrameAt(3 / 30, { fps: 30, duration: 10 }).index, 3);
		for (let n = 0; n < 500; n++) assert.equal(sourceFrameAt(n / 30, { fps: 30, duration: 100 }).index, n);
		for (let n = 0; n < 500; n++) assert.equal(sourceFrameAt(n / 29.97, { fps: 29.97, duration: 100 }).index, n);
	});

	it('holds the last frame past the end', () => {
		assert.equal(sourceFrameAt(3, video).index, 71);
		assert.equal(sourceFrameAt(100, video).index, 71);
	});

	it('does not clamp to the end when the length is unknown', () => {
		assert.equal(sourceFrameAt(100, { fps: 24, duration: 0 }).index, 2400);
	});

	it('seeks half a frame before the frame, and never before the start', () => {
		assert.ok(Math.abs(sourceFrameAt(10 / 24, video).seek - 9.5 / 24) < 1e-5);
		assert.equal(sourceFrameAt(0, video).seek, 0);
		assert.equal(sourceFrameAt(-5, video).seek, 0);
	});
});

describe('createVideoFrames', { skip }, () => {
	let fixture: Fixture;
	before(async () => {
		fixture = await startFixture();
	});
	after(() => fixture.close());

	const url = (name: string) => `${fixture.page().replace(/\?$/, '')}${name}`;
	const frames = (opts?: Parameters<typeof createVideoFrames>[0]) => createVideoFrames(opts);

	it('returns the frame that is on screen at a time, for a video from a URL', async () => {
		const service = frames({ imageFormat: 'png' });
		try {
			for (const n of [0, 1, 17, 35, 71]) {
				const { image, contentType } = await service.frame(url('frames.mp4'), n / VIDEO_FPS);
				assert.equal(contentType, 'image/png');
				assert.equal(videoFrameOf(image), n, `frame ${n}`);
			}
		} finally {
			await service.close();
		}
	});

	it('works for a local file', async () => {
		const service = frames({ imageFormat: 'png' });
		try {
			const file = pathToFileURL(join(fixture.dir, 'frames.mp4')).href;
			assert.equal(videoFrameOf((await service.frame(file, 40 / VIDEO_FPS)).image), 40);
		} finally {
			await service.close();
		}
	});

	it('maps the times of a composition at another frame rate onto the video', async () => {
		const service = frames({ imageFormat: 'png' });
		try {
			// A 30 fps composition showing a 24 fps video: composition frame n is at n / 30 s.
			for (const n of [0, 1, 2, 3, 4, 5, 29, 30, 31, 60, 89]) {
				const shown = videoFrameOf((await service.frame(url('frames.mp4'), n / 30)).image);
				assert.equal(shown, Math.min(Math.floor((n / 30) * VIDEO_FPS + 1e-6), VIDEO_FRAMES - 1), `composition frame ${n}`);
			}
		} finally {
			await service.close();
		}
	});

	it('holds the last frame past the end of the video', async () => {
		const service = frames({ imageFormat: 'png' });
		try {
			assert.equal(videoFrameOf((await service.frame(url('frames.mp4'), 50)).image), VIDEO_FRAMES - 1);
		} finally {
			await service.close();
		}
	});

	it('gives the same frame to requests made at the same time', async () => {
		const service = frames({ imageFormat: 'png' });
		try {
			const results = await Promise.all(
				Array.from({ length: 8 }, (_, i) => service.frame(url('frames.mp4'), (20 + (i % 2) * 0.001) / VIDEO_FPS))
			);
			for (const { image } of results) assert.equal(videoFrameOf(image), 20);
		} finally {
			await service.close();
		}
	});

	it('produces JPEG unless asked for PNG', async () => {
		const service = frames();
		try {
			const { image, contentType } = await service.frame(url('frames.mp4'), 30 / VIDEO_FPS);
			assert.equal(contentType, 'image/jpeg');
			assert.deepEqual([...image.subarray(0, 3)], [0xff, 0xd8, 0xff]);
			assert.ok(Math.abs(videoFrameOf(image) - 30) <= 1);
		} finally {
			await service.close();
		}
	});

	it('explains what is wrong with a source', async () => {
		const service = frames();
		try {
			await assert.rejects(() => service.frame(url('missing.mp4'), 0), /Could not read/);
			await assert.rejects(() => service.frame(url('tone.wav'), 0), /tone\.wav" has no video stream/);
			await assert.rejects(() => service.frame('ftp://example.com/a.mp4', 0), /Unsupported video source/);
			await assert.rejects(() => service.frame('a.mp4', 0), /must be an absolute URL/);
			await assert.rejects(() => service.frame(url('frames.mp4'), -1), /Invalid video time -1/);
			await assert.rejects(() => service.frame(url('frames.mp4'), Number.NaN), /Invalid video time/);
		} finally {
			await service.close();
		}
	});

	it('leaves no downloaded videos behind', async () => {
		const before = readdirSync(tmpdir()).filter((n) => n.startsWith('svelteframe-video-')).length;
		const service = frames();
		await service.frame(url('frames.mp4'), 0);
		assert.equal(readdirSync(tmpdir()).filter((n) => n.startsWith('svelteframe-video-')).length, before + 1);
		await service.close();
		assert.equal(readdirSync(tmpdir()).filter((n) => n.startsWith('svelteframe-video-')).length, before);
	});

	describe('in a page', () => {
		const withPage = async (run: (page: import('playwright').Page, service: ReturnType<typeof createVideoFrames>) => Promise<void>) => {
			const browser = await chromium.launch();
			const service = frames();
			try {
				const page = await browser.newPage();
				await service.attach(page);
				await page.goto(fixture.page('broken=1'));
				await run(page, service);
			} finally {
				await browser.close();
				await service.close();
			}
		};
		const request = (page: import('playwright').Page, query: string) =>
			page.evaluate(async (path) => {
				const response = await fetch(path);
				return { status: response.status, type: response.headers.get('content-type'), text: response.ok ? '' : await response.text() };
			}, `${VIDEO_FRAME_PATH}?${query}`);

		it('answers the requests of <OffthreadVideo>', async () => {
			await withPage(async (page) => {
				const src = encodeURIComponent(url('frames.mp4'));
				const ok = await request(page, `src=${src}&time=1`);
				assert.deepEqual([ok.status, ok.type], [200, 'image/jpeg']);
			});
		});

		it('reports why a frame could not be made, in the response', async () => {
			await withPage(async (page) => {
				const noVideo = await request(page, `src=${encodeURIComponent(url('tone.wav'))}&time=0`);
				assert.equal(noVideo.status, 500);
				assert.match(noVideo.text, /has no video stream/);

				assert.match((await request(page, 'time=0')).text, /has no src/);
				assert.match((await request(page, `src=${encodeURIComponent(url('frames.mp4'))}`)).text, /has no time/);
				assert.match((await request(page, `src=${encodeURIComponent(url('frames.mp4'))}&time=abc`)).text, /Invalid video time/);
			});
		});
	});
});
