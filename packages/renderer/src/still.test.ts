import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { FRAMES, skip, startFixture, type Fixture } from '../test/fixture.js';
import { imageFormatFor, renderStill } from './still.js';

describe('imageFormatFor', () => {
	it('picks the format from the extension, ignoring case', () => {
		assert.equal(imageFormatFor('frame.png'), 'png');
		assert.equal(imageFormatFor('/a/b/Frame.PNG'), 'png');
		assert.equal(imageFormatFor('frame.jpg'), 'jpeg');
		assert.equal(imageFormatFor('frame.JPEG'), 'jpeg');
	});

	it('rejects anything else, naming the file', () => {
		for (const name of ['frame', 'frame.gif', 'frame.mp4', 'png']) {
			assert.throws(() => imageFormatFor(name), new RegExp(`"${name}".*\\.png, \\.jpg or \\.jpeg`));
		}
	});
});

describe('renderStill', { skip }, () => {
	let fixture: Fixture;
	before(async () => {
		fixture = await startFixture();
	});
	after(() => fixture.close());

	const out = (name: string) => join(fixture.dir, name);

	/** Width and height from a PNG header. */
	const pngSize = (file: string) => {
		const bytes = readFileSync(file);
		assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
		return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
	};

	/** Mean gray of an image, as ffmpeg decodes it. */
	const gray = (file: string) => {
		const { stdout } = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=1:1,format=gray', '-f', 'rawvideo', '-']);
		return stdout[0];
	};

	it('captures the requested frame at the size of the video', async () => {
		const file = out('frame-37.png');
		const result = await renderStill({ url: fixture.page(), output: file, frame: 37 });

		assert.deepEqual(result, { frame: 37, total: FRAMES, width: 160, height: 90 });
		assert.deepEqual(pngSize(file), { width: 160, height: 90 });
		// The fixture paints frame n as gray 4n.
		assert.ok(Math.abs(gray(file) - 4 * 37) <= 2, `gray ${gray(file)}`);
	});

	it('captures different frames as different images', async () => {
		await renderStill({ url: fixture.page(), output: out('a.png'), frame: 5 });
		await renderStill({ url: fixture.page(), output: out('b.png'), frame: 50 });
		assert.ok(Math.abs(gray(out('a.png')) - 20) <= 2);
		assert.ok(Math.abs(gray(out('b.png')) - 200) <= 2);
	});

	it('defaults to the first frame, and can take the last', async () => {
		await renderStill({ url: fixture.page(), output: out('first.png') });
		assert.ok(gray(out('first.png')) <= 2);

		const last = await renderStill({ url: fixture.page(), output: out('last.png'), frame: FRAMES - 1 });
		assert.equal(last.frame, FRAMES - 1);
		assert.ok(Math.abs(gray(out('last.png')) - 4 * (FRAMES - 1)) <= 2);
	});

	it('writes JPEG when asked by the extension', async () => {
		const file = out('frame.jpg');
		await renderStill({ url: fixture.page(), output: file, frame: 30, quality: 95 });
		const bytes = readFileSync(file);
		assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
		assert.ok(Math.abs(gray(file) - 120) <= 4);
	});

	it('creates missing directories', async () => {
		const file = out('deep/er/frame.png');
		await renderStill({ url: fixture.page(), output: file });
		assert.ok(existsSync(file));
	});

	it('rejects a frame past the end, saying how many there are', async () => {
		await assert.rejects(
			() => renderStill({ url: fixture.page(), output: out('x.png'), frame: FRAMES }),
			new RegExp(`Frame ${FRAMES} is out of range: the video has ${FRAMES} frames \\(0-${FRAMES - 1}\\)`)
		);
		assert.equal(existsSync(out('x.png')), false);
	});

	it('rejects invalid frames and file names before opening a browser', async () => {
		await assert.rejects(() => renderStill({ url: fixture.page(), output: out('x.png'), frame: -1 }), /whole number/);
		await assert.rejects(() => renderStill({ url: fixture.page(), output: out('x.png'), frame: 1.5 }), /whole number/);
		await assert.rejects(() => renderStill({ url: fixture.page(), output: out('x.gif') }), /\.png, \.jpg or \.jpeg/);
	});

	it('fails with the page error raised while drawing the frame', async () => {
		await assert.rejects(
			() => renderStill({ url: fixture.page('fail=12'), output: out('x.png'), frame: 12 }),
			/boom at frame 12/
		);
		assert.equal(existsSync(out('x.png')), false);
	});

	it('fails with the reason when the page cannot load', async () => {
		await assert.rejects(
			() => renderStill({ url: fixture.page('broken=1'), output: out('x.png') }),
			/failed to load: the page is broken/
		);
	});

	it('stops when already aborted', async () => {
		await assert.rejects(
			() => renderStill({ url: fixture.page(), output: out('x.png'), signal: AbortSignal.abort() }),
			{ name: 'AbortError' }
		);
	});
});
