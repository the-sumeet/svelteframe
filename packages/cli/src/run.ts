import { resolve } from 'node:path';
import {
	buildRenderUrl,
	readPropsFile,
	renderStill,
	renderVideo,
	type RenderProgress
} from '@svelteframe/renderer';
import type { Command } from './args.js';
import { formatListing, parseListing } from './format.js';
import { startProjectServer } from './server.js';

export interface Io {
	/** Where relative paths in the command are relative to. */
	cwd: string;
	signal: AbortSignal;
	/** Results and progress. */
	stdout: { write(text: string): unknown; isTTY?: boolean };
	/** Status messages, so that stdout stays clean for output such as `--json`. */
	stderr: { write(text: string): unknown };
	verbose?: boolean;
}

type Served = Exclude<Command, { name: 'help' } | { name: 'version' }>;

/** Run `work` against the project's server: the one at `--url`, or one started for the occasion. */
async function withProject<T>(command: Served, io: Io, work: (baseUrl: string) => Promise<T>): Promise<T> {
	if (command.url !== undefined) return work(command.url);

	const server = await startProjectServer({
		root: resolve(io.cwd, command.root ?? '.'),
		dev: command.dev,
		verbose: io.verbose,
		signal: io.signal,
		onStatus: (message) => io.stderr.write(`${message}\n`)
	});
	try {
		return await work(server.url);
	} finally {
		await server.close();
	}
}

async function readProps(command: { props?: string }, io: Io) {
	return command.props === undefined ? undefined : readPropsFile(resolve(io.cwd, command.props));
}

const progressLine = (p: RenderProgress) =>
	`frame ${p.frame}/${p.total}  ${(p.elapsedMs / 1000).toFixed(1)}s  ${p.fps.toFixed(1)} fps`;

async function render(command: Extract<Command, { name: 'render' }>, io: Io): Promise<void> {
	const output = resolve(io.cwd, command.out);
	const props = await readProps(command, io);

	await withProject(command, io, async (base) => {
		const tty = io.stdout.isTTY;
		const result = await renderVideo({
			url: buildRenderUrl({ url: base, composition: command.id, props }),
			output,
			imageFormat: command.png ? 'png' : 'jpeg',
			quality: command.quality,
			chromiumPath: command.chromium,
			concurrency: command.concurrency,
			signal: io.signal,
			onProgress: (p) => {
				if (tty) io.stdout.write(`\r${progressLine(p)}`);
				else if (p.frame % 30 === 0 || p.frame === p.total) io.stdout.write(`${progressLine(p)}\n`);
			}
		});
		if (tty) io.stdout.write('\n');

		const audio = result.audioSegments > 0 ? ` with ${result.audioSegments} audio segment(s)` : '';
		const workers = result.concurrency > 1 ? ` using ${result.concurrency} workers` : '';
		io.stdout.write(`Rendered ${result.frame} frames${audio}${workers} to ${output}\n`);
	});
}

async function still(command: Extract<Command, { name: 'still' }>, io: Io): Promise<void> {
	const output = resolve(io.cwd, command.out);
	const props = await readProps(command, io);

	await withProject(command, io, async (base) => {
		const result = await renderStill({
			url: buildRenderUrl({ url: base, composition: command.id, props }),
			output,
			frame: command.frame,
			quality: command.quality,
			chromiumPath: command.chromium,
			signal: io.signal
		});
		io.stdout.write(`Saved frame ${result.frame} of ${command.id} (${result.width}×${result.height}) to ${output}\n`);
	});
}

async function compositions(command: Extract<Command, { name: 'compositions' }>, io: Io): Promise<void> {
	const listing = await withProject(command, io, async (base) => {
		const endpoint = new URL('svelteframe/compositions.json', base.endsWith('/') ? base : `${base}/`);
		const response = await fetch(endpoint, { signal: io.signal });
		if (!response.ok) {
			throw new Error(
				`${endpoint} answered ${response.status}. The project needs a route at /svelteframe/compositions.json ` +
					'that returns describeCompositions(compositions) from @svelteframe/core.'
			);
		}
		try {
			return parseListing(await response.json());
		} catch (err) {
			throw new Error(`${endpoint} did not return a composition list: ${(err as Error).message}`);
		}
	});

	io.stdout.write(command.json ? `${JSON.stringify(listing, null, 2)}\n` : `${formatListing(listing)}\n`);
}

/** Run a command that talks to the project. Rejects with the reason when it fails. */
export async function run(command: Served, io: Io): Promise<void> {
	switch (command.name) {
		case 'render':
			return render(command, io);
		case 'still':
			return still(command, io);
		case 'compositions':
			return compositions(command, io);
	}
}
