import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { format } from 'node:util';

export interface ProjectServer {
	/** Where the project is being served, e.g. `http://127.0.0.1:53887/`. */
	url: string;
	close(): Promise<void>;
}

export interface StartOptions {
	/** The project directory. */
	root: string;
	/** Start the dev server instead of building the project and previewing the build. */
	dev?: boolean;
	/** Show Vite's own output. */
	verbose?: boolean;
	onStatus?: (message: string) => void;
	/** Stops waiting for another command that is using the project. */
	signal?: AbortSignal;
}

// Only the parts of Vite that are used. The project brings its own Vite, so its types are not ours.
interface ViteServer {
	resolvedUrls?: { local: string[] } | null;
	close(): Promise<void>;
}
interface ViteModule {
	build(config: object): Promise<unknown>;
	/** Newer versions: builds every environment (client and server), as `vite build` does. */
	createBuilder?(config: object): Promise<{ buildApp(): Promise<unknown> }>;
	preview(config: object): Promise<ViteServer>;
	createServer(config: object): Promise<ViteServer & { listen(): Promise<unknown> }>;
}

/**
 * The directory that has `name` in its `node_modules`, searching from `from` upwards. Unlike
 * `require.resolve`, this ignores `NODE_PATH` (which pnpm sets), so it cannot find some other copy.
 */
function findInstalled(name: string, from: string): string | undefined {
	for (let dir = from; ; dir = dirname(dir)) {
		if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return dir;
		if (dirname(dir) === dir) return undefined;
	}
}

/** Import the Vite that is installed in the project, whatever version it is. */
async function loadProjectVite(root: string): Promise<ViteModule> {
	const installedAt = findInstalled('vite', root);
	if (!installedAt) {
		throw new Error(`Could not find "vite" in ${root}. Are the project's dependencies installed?`);
	}
	const entry = createRequire(join(installedAt, 'package.json')).resolve('vite');
	return (await import(pathToFileURL(entry).href)) as ViteModule;
}

/**
 * Run `work` with console output held back. Build tools print progress straight to the console,
 * which would end up in the middle of our own output (`--json` must stay clean). If `work` fails,
 * what it printed is added to the error, as that is usually the explanation.
 */
async function withQuietConsole<T>(work: () => Promise<T>): Promise<T> {
	const methods = ['log', 'info', 'warn', 'error'] as const;
	const original = Object.fromEntries(methods.map((method) => [method, console[method]]));
	const captured: string[] = [];
	for (const method of methods) console[method] = (...args: unknown[]) => void captured.push(format(...args));

	try {
		return await work();
	} catch (err) {
		const output = captured.join('\n').trim();
		if (err instanceof Error && output) err.message += `\n\nOutput of the build:\n${output}`;
		throw err;
	} finally {
		Object.assign(console, original);
	}
}

/** Where the lock for a project lives: outside the project, and always writable. */
export function lockPathFor(root: string): string {
	return join(tmpdir(), `svelteframe-lock-${createHash('sha1').update(resolve(root)).digest('hex').slice(0, 12)}`);
}

const isAlive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		// EPERM means it exists but belongs to someone else.
		return (err as NodeJS.ErrnoException).code === 'EPERM';
	}
};

/**
 * Building writes to the project's own build folder, which the preview server then serves from.
 * Two commands doing that at once would break each other, so they take turns: the lock is held
 * from the build until the server is closed. A lock left behind by a process that is gone is ignored.
 * Returns a function that releases it.
 */
async function acquireBuildLock(root: string, options: StartOptions): Promise<() => Promise<void>> {
	const lock = lockPathFor(root);
	let announced = false;

	for (;;) {
		options.signal?.throwIfAborted();
		try {
			await mkdir(lock);
			await writeFile(join(lock, 'pid'), String(process.pid));
			return () => rm(lock, { recursive: true, force: true });
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
		}

		const owner = Number(await readFile(join(lock, 'pid'), 'utf8').catch(() => ''));
		// No pid yet means it was only just taken, unless it has been like that for a while.
		const age = await stat(lock).then((info) => Date.now() - info.mtimeMs, () => 0);
		if ((owner > 0 && !isAlive(owner)) || (!owner && age > 10_000)) {
			await rm(lock, { recursive: true, force: true });
			continue;
		}

		if (!announced) {
			announced = true;
			options.onStatus?.(`Another svelteframe command${owner ? ` (process ${owner})` : ''} is using this project; waiting for it...`);
		}
		await new Promise((done) => setTimeout(done, 250));
	}
}

/** A port nothing is listening on right now. */
export function getFreePort(): Promise<number> {
	return new Promise((resolvePort, reject) => {
		const probe = createNetServer();
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const { port } = probe.address() as { port: number };
			probe.close(() => resolvePort(port));
		});
	});
}

/**
 * Serve the project with its own Vite: `vite build` then `vite preview` by default, which is
 * steady and what you ship, or the dev server with `dev`. Returns once it answers.
 *
 * The working directory moves to the project while it runs, as it would if you had run Vite
 * there; server routes that read files relative to it depend on that. `close()` moves it back.
 * Building and previewing take turns between commands (see `acquireBuildLock`).
 */
export async function startProjectServer(options: StartOptions): Promise<ProjectServer> {
	const root = resolve(options.root);
	if (!existsSync(join(root, 'package.json'))) {
		throw new Error(`No project at ${root}: there is no package.json. Run this in your project, or pass --root.`);
	}

	const vite = await loadProjectVite(root);
	const port = await getFreePort();
	const logLevel = options.verbose ? 'info' : 'warn';
	const host = '127.0.0.1';

	const releaseLock = options.dev ? async () => {} : await acquireBuildLock(root, options);
	const previousDirectory = process.cwd();
	process.chdir(root);
	try {
		let server: ViteServer;
		if (options.dev) {
			options.onStatus?.('Starting the dev server...');
			const dev = await vite.createServer({ root, logLevel, server: { host, port, strictPort: true } });
			await dev.listen();
			server = dev;
		} else {
			options.onStatus?.('Building the project...');
			// `build()` alone builds only the client; an app with server code needs every environment.
			const build = async () => {
				if (vite.createBuilder) await (await vite.createBuilder({ root, logLevel })).buildApp();
				else await vite.build({ root, logLevel });
			};
			await (options.verbose ? build() : withQuietConsole(build));
			options.onStatus?.('Starting the preview server...');
			server = await vite.preview({ root, logLevel, preview: { host, port, strictPort: true } });
		}

		return {
			url: server.resolvedUrls?.local?.[0] ?? `http://${host}:${port}/`,
			close: async () => {
				try {
					await server.close();
				} finally {
					process.chdir(previousDirectory);
					await releaseLock();
				}
			}
		};
	} catch (err) {
		process.chdir(previousDirectory);
		await releaseLock();
		throw err;
	}
}
