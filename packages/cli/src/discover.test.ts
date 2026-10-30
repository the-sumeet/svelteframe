import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { findCompositionsFile } from './discover.js';

describe('findCompositionsFile', () => {
	it('discovers compositions in src/compositions.ts', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'svelteframe-discover-'));
		try {
			await mkdir(join(dir, 'src'));
			const file = join(dir, 'src/compositions.ts');
			await writeFile(file, 'export const compositions = [];');

			const found = findCompositionsFile(dir);
			assert.equal(found, file);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('discovers compositions in src/lib/compositions/index.ts', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'svelteframe-discover-'));
		try {
			await mkdir(join(dir, 'src/lib/compositions'), { recursive: true });
			const file = join(dir, 'src/lib/compositions/index.ts');
			await writeFile(file, 'export const compositions = [];');

			const found = findCompositionsFile(dir);
			assert.equal(found, file);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('honors custom config path', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'svelteframe-discover-'));
		try {
			const file = join(dir, 'custom.ts');
			await writeFile(file, 'export const compositions = [];');

			const found = findCompositionsFile(dir, 'custom.ts');
			assert.equal(found, file);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('throws when custom config path does not exist', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'svelteframe-discover-'));
		try {
			assert.throws(() => findCompositionsFile(dir, 'nonexistent.ts'), /Compositions file not found/);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('returns undefined when no compositions file exists', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'svelteframe-discover-'));
		try {
			const found = findCompositionsFile(dir);
			assert.equal(found, undefined);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
