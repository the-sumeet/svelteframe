import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { initProject } from './init.js';

describe('initProject', () => {
	it('creates src/compositions.ts and src/FirstVideo.svelte and updates package.json', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'svelteframe-init-'));
		try {
			await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'test-app' }));

			const logs: string[] = [];
			await initProject({ root: dir, onLog: (m) => logs.push(m) });

			assert.ok(existsSync(join(dir, 'src/compositions.ts')));
			assert.ok(existsSync(join(dir, 'src/FirstVideo.svelte')));

			const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
			assert.equal(pkg.scripts?.svelteframe, 'svelteframe');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('does not overwrite existing compositions', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'svelteframe-init-'));
		try {
			const compPath = join(dir, 'compositions.ts');
			await writeFile(compPath, '// existing');

			const logs: string[] = [];
			await initProject({ root: dir, onLog: (m) => logs.push(m) });

			assert.equal(await readFile(compPath, 'utf8'), '// existing');
			assert.ok(logs.some((l) => l.includes('Found existing compositions')));
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
