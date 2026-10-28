import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { concatChunks, concatList } from './chunks.js';

describe('concatList', () => {
	it('lists one file per line, in order', () => {
		assert.equal(concatList(['/tmp/a.mp4', '/tmp/b.mp4']), "file '/tmp/a.mp4'\nfile '/tmp/b.mp4'\n");
	});

	it('escapes single quotes the way the concat demuxer expects', () => {
		assert.equal(concatList(["/tmp/it's here/a.mp4"]), "file '/tmp/it'\\''s here/a.mp4'\n");
	});

	it('keeps spaces as they are, since the names are quoted', () => {
		assert.equal(concatList(['/tmp/my chunks/a b.mp4']), "file '/tmp/my chunks/a b.mp4'\n");
	});
});

describe('concatChunks', () => {
	it('refuses an empty list', async () => {
		await assert.rejects(() => concatChunks([], '/tmp/out.mp4', '/tmp'), /at least one chunk/);
	});
});
