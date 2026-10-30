import { parseArgs } from 'node:util';

/** A mistake in how the command was written; reported with the usage hint, exit code 2. */
export class UsageError extends Error {
	override name = 'UsageError';
}

export const HELP = `svelteframe: render videos made with Svelteframe

Usage:
  svelteframe render <id> [options]        Render a composition to a video
  svelteframe dev [options]                Start the studio preview in your browser
  svelteframe still <id> [options]         Capture one frame as an image
  svelteframe compositions [options]       List the project's compositions
  svelteframe init [options]               Set up Svelteframe in a project

Common options:
  --root <dir>          the project (default: the current directory)
  --config <file>       path to compositions file (default: auto-detected)
  --url <base url>      use a server that is already running instead of starting one
  --dev                 start the dev server instead of building and previewing the project
  --chromium <path>     Chromium executable to use

dev options:
  --port <number>       port to serve on

render options:
  --out <file>          output video (default <id>.mp4)
  --props <file>        JSON file with input props
  --concurrency <n>     pages rendering at once (default: half the CPU cores)
  --quality <0-100>     JPEG quality of captured frames (default 90)
  --png                 capture PNG frames instead of JPEG

still options:
  --frame <n>           frame to capture (default 0)
  --out <file>          output image, .png or .jpg (default <id>.png)
  --props <file>        JSON file with input props
  --quality <0-100>     JPEG quality when writing .jpg (default 90)

compositions options:
  --json                print JSON instead of a table

Other:
  -h, --help            show this help
  -v, --version         show the version`;

interface Shared {
	root?: string;
	url?: string;
	dev: boolean;
	config?: string;
	chromium?: string;
}

export type Command =
	| { name: 'help' }
	| { name: 'version' }
	| { name: 'init'; root?: string }
	| (Shared & { name: 'dev'; port?: number })
	| (Shared & {
			name: 'render';
			id: string;
			out: string;
			props?: string;
			concurrency?: number;
			quality: number;
			png: boolean;
	  })
	| (Shared & {
			name: 'still';
			id: string;
			frame: number;
			out: string;
			props?: string;
			quality: number;
	  })
	| (Shared & { name: 'compositions'; json: boolean });

const OPTIONS = {
	root: { type: 'string' },
	url: { type: 'string' },
	dev: { type: 'boolean' },
	config: { type: 'string' },
	chromium: { type: 'string' },
	port: { type: 'string' },
	out: { type: 'string' },
	props: { type: 'string' },
	concurrency: { type: 'string' },
	quality: { type: 'string' },
	png: { type: 'boolean' },
	frame: { type: 'string' },
	json: { type: 'boolean' },
	help: { type: 'boolean', short: 'h' },
	version: { type: 'boolean', short: 'v' }
} as const;

type OptionName = keyof typeof OPTIONS;

const SHARED: OptionName[] = ['root', 'url', 'dev', 'config', 'chromium'];
const ALLOWED: Record<'render' | 'still' | 'compositions' | 'dev' | 'init', OptionName[]> = {
	render: [...SHARED, 'out', 'props', 'concurrency', 'quality', 'png'],
	still: [...SHARED, 'out', 'props', 'frame', 'quality'],
	compositions: [...SHARED, 'json'],
	dev: [...SHARED, 'port'],
	init: ['root']
};

function whole(value: string, flag: string, min: number): number {
	const n = Number(value);
	if (value.trim() === '' || !Number.isInteger(n) || n < min) {
		throw new UsageError(`${flag} must be a whole number of ${min} or more, got "${value}"`);
	}
	return n;
}

function quality(value: string | undefined): number {
	if (value === undefined) return 90;
	const n = Number(value);
	if (value.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100) {
		throw new UsageError(`--quality must be a number from 0 to 100, got "${value}"`);
	}
	return n;
}

/** Turn command-line arguments (without `node` and the script) into a command. */
export function parseCommand(argv: string[]): Command {
	let parsed;
	try {
		parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
	} catch (err) {
		const message = (err as Error).message;
		// A value that starts with "-" reads as another option.
		const ambiguous = /Option '(--[\w-]+)[^']*' argument is ambiguous/.exec(message);
		if (ambiguous) {
			throw new UsageError(`${ambiguous[1]} needs a value. A value that starts with "-" must be written ${ambiguous[1]}=<value>`);
		}
		throw new UsageError(message.replace(/\. To specify a positional.*$/s, ''));
	}
	const { values, positionals } = parsed;

	if (values.help) return { name: 'help' };
	if (values.version) return { name: 'version' };

	const [name, ...rest] = positionals;
	if (name === undefined) return { name: 'help' };
	if (name !== 'render' && name !== 'still' && name !== 'compositions' && name !== 'dev' && name !== 'init') {
		throw new UsageError(`Unknown command "${name}". Commands: render, dev, still, compositions, init`);
	}

	for (const option of Object.keys(values) as OptionName[]) {
		if (!ALLOWED[name].includes(option)) {
			throw new UsageError(`--${option} does not apply to "${name}"`);
		}
	}

	if (name === 'init') {
		if (rest.length > 0) throw new UsageError(`"init" takes no arguments, got "${rest[0]}"`);
		return { name: 'init', root: values.root };
	}

	const shared: Shared = {
		root: values.root,
		url: values.url,
		dev: values.dev ?? false,
		config: values.config,
		chromium: values.chromium
	};

	if (shared.url !== undefined) {
		let protocol: string | undefined;
		try {
			protocol = new URL(shared.url).protocol;
		} catch {
			// Reported below.
		}
		if (protocol !== 'http:' && protocol !== 'https:') {
			throw new UsageError(`--url must be a full URL such as http://localhost:5173, got "${shared.url}"`);
		}
		if (shared.dev) throw new UsageError('--dev has no effect with --url: no server is started');
	}

	if (name === 'dev') {
		if (rest.length > 0) throw new UsageError(`"dev" takes no arguments, got "${rest[0]}"`);
		return {
			name: 'dev',
			...shared,
			dev: true,
			port: values.port ? whole(values.port, '--port', 1) : undefined
		};
	}

	if (name === 'compositions') {
		if (rest.length > 0) throw new UsageError(`"compositions" takes no arguments, got "${rest[0]}"`);
		return { name, ...shared, json: values.json ?? false };
	}

	const [id, ...extra] = rest;
	if (id === undefined) {
		throw new UsageError(`Missing the composition id: svelteframe ${name} <id>. See "svelteframe compositions".`);
	}
	if (extra.length > 0) throw new UsageError(`"${name}" takes one composition id, got extra "${extra[0]}"`);

	if (name === 'render') {
		return {
			name,
			...shared,
			id,
			out: values.out ?? `${id}.mp4`,
			props: values.props,
			concurrency: values.concurrency === undefined ? undefined : whole(values.concurrency, '--concurrency', 1),
			quality: quality(values.quality),
			png: values.png ?? false
		};
	}

	return {
		name,
		...shared,
		id,
		frame: values.frame === undefined ? 0 : whole(values.frame, '--frame', 0),
		out: values.out ?? `${id}.png`,
		props: values.props,
		quality: quality(values.quality)
	};
}
