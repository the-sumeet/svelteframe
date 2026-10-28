import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { getFreePort, lockPathFor, startProjectServer } from './server.js';

const playground = resolve(import.meta.dirname, '../../../apps/playground');
const skip = !existsSync(join(playground, 'node_modules/@svelteframe/core/dist/index.js')) && 'the playground is not installed and built';

describe('getFreePort', () => {
	it('returns a usable port number', async () => {
		const port = await getFreePort();
		assert.ok(Number.isInteger(port) && port > 0 && port < 65536, String(port));
	});
});

describe('startProjectServer', { skip }, () => {
	const stopped = async (url: string) => {
		await assert.rejects(() => fetch(url), 'the server is still answering');
	};

	for (const dev of [false, true]) {
		it(`serves the project (${dev ? 'dev server' : 'build and preview'}), then lets go of the port and the directory`, async () => {
			const before = process.cwd();
			const statuses: string[] = [];
			const server = await startProjectServer({ root: playground, dev, onStatus: (m) => statuses.push(m) });
			try {
				assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
				assert.equal(process.cwd(), playground, 'runs from the project, so its routes find their files');

				const listing = await fetch(new URL('svelteframe/compositions.json', server.url));
				assert.equal(listing.status, 200);
				const ids = ((await listing.json()) as { id: string }[]).map((c) => c.id);
				assert.ok(ids.includes('main') && ids.includes('title-card'), ids.join(','));

				// A route that reads a file relative to the project (the playground's static image).
				const image = await fetch(new URL('api/slow?type=image&ms=0', server.url));
				assert.equal(image.status, 200);
				assert.equal(image.headers.get('content-type'), 'image/jpeg');

				assert.equal((await fetch(new URL('render/main', server.url))).status, 200);
				assert.ok(statuses.length > 0);
				assert.match(statuses.join('\n'), dev ? /dev server/i : /Building/);
			} finally {
				await server.close();
			}
			assert.equal(process.cwd(), before, 'back in the original directory');
			await stopped(server.url);
		});
	}

	it('serves the project it was built from, not a stale build (every environment is built)', async () => {
		// The server routes live in the server build; a client-only build would leave them out.
		const server = await startProjectServer({ root: playground });
		try {
			assert.equal((await fetch(new URL('svelteframe/compositions.json', server.url))).status, 200);
		} finally {
			await server.close();
		}
	});

	it('fails clearly when the directory is not a project', async () => {
		const empty = await mkdtemp(join(tmpdir(), 'svelteframe-cli-empty-'));
		try {
			await assert.rejects(() => startProjectServer({ root: empty }), /No project at .*no package\.json/);
		} finally {
			await rm(empty, { recursive: true, force: true });
		}
	});

	it('fails clearly when the project has no vite', async () => {
		const bare = await mkdtemp(join(tmpdir(), 'svelteframe-cli-bare-'));
		try {
			await writeFile(join(bare, 'package.json'), '{"name":"bare"}');
			await assert.rejects(() => startProjectServer({ root: bare }), /Could not find "vite"/);
		} finally {
			await rm(bare, { recursive: true, force: true });
		}
	});

	it('reports a failing build with what the build printed, and restores the directory', async () => {
		const broken = await mkdtemp(join(tmpdir(), 'svelteframe-cli-broken-'));
		const before = process.cwd();
		try {
			await writeFile(join(broken, 'package.json'), '{"name":"broken","type":"module"}');
			await writeFile(join(broken, 'vite.config.js'), 'export default {');
			await symlink(join(playground, 'node_modules'), join(broken, 'node_modules'));
			await assert.rejects(() => startProjectServer({ root: broken }), /vite\.config|Unexpected|Expected|error/i);
			assert.equal(process.cwd(), before);
		} finally {
			await rm(broken, { recursive: true, force: true });
		}
	});

	it('does not leave console methods replaced after a build', async () => {
		const log = console.log;
		const server = await startProjectServer({ root: playground });
		await server.close();
		assert.equal(console.log, log);
	});
});


describe('taking turns on a project', { skip }, () => {
	const pending = async (promise: Promise<unknown>, ms: number) => {
		let settled = false;
		promise.then(() => (settled = true), () => (settled = true));
		await new Promise((done) => setTimeout(done, ms));
		return !settled;
	};

	it('makes a second build wait until the first server is closed', async () => {
		const first = await startProjectServer({ root: playground });
		const messages: string[] = [];
		const second = startProjectServer({ root: playground, onStatus: (m) => messages.push(m) });
		try {
			assert.equal(await pending(second, 1200), true, 'the second one is still waiting');
			assert.match(messages.join('\n'), /Another svelteframe command \(process \d+\) is using this project; waiting/);
		} finally {
			await first.close();
		}

		const server = await second;
		try {
			assert.equal((await fetch(new URL('svelteframe/compositions.json', server.url))).status, 200);
		} finally {
			await server.close();
		}
		assert.equal(existsSync(lockPathFor(playground)), false, 'the lock is gone');
	});

	it('stops waiting when aborted', async () => {
		const first = await startProjectServer({ root: playground });
		try {
			const controller = new AbortController();
			const waiting = startProjectServer({ root: playground, signal: controller.signal });
			setTimeout(() => controller.abort(), 400);
			await assert.rejects(() => waiting, { name: 'AbortError' });
		} finally {
			await first.close();
		}
		assert.equal(existsSync(lockPathFor(playground)), false);
	});

	it('ignores a lock left behind by a process that no longer exists', async () => {
		const lock = lockPathFor(playground);
		await mkdir(lock);
		await writeFile(join(lock, 'pid'), '999999');
		const server = await startProjectServer({ root: playground });
		await server.close();
		assert.equal(existsSync(lock), false);
	});

	it('does not make dev servers wait for each other, or for a build', async () => {
		const build = await startProjectServer({ root: playground });
		try {
			const dev = await startProjectServer({ root: playground, dev: true });
			await dev.close();
		} finally {
			await build.close();
		}
	});

	it('releases the lock when the build fails', async () => {
		const broken = await mkdtemp(join(tmpdir(), 'svelteframe-cli-lock-'));
		try {
			await writeFile(join(broken, 'package.json'), '{"name":"broken","type":"module"}');
			await writeFile(join(broken, 'vite.config.js'), 'export default {');
			await symlink(join(playground, 'node_modules'), join(broken, 'node_modules'));
			await assert.rejects(() => startProjectServer({ root: broken }));
			assert.equal(existsSync(lockPathFor(broken)), false);
		} finally {
			await rm(broken, { recursive: true, force: true });
		}
	});
});
