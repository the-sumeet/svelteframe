import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { formatBenchmark } from './benchmark.js';
import { defaultConcurrency } from './frames.js';
import { renderVideo, type RenderOptions, type RenderProgress } from './render.js';
import { assertProps, buildRenderUrl } from './url.js';

const USAGE = `Usage:
  tsx src/cli.ts --url <page url> [options]
  tsx src/cli.ts --url <base url> --composition <id> [--props props.json] [options]

Options:
  --out <file>          output file (default out.mp4)
  --concurrency <n>     pages rendering at once (default ${defaultConcurrency()}, half the CPU cores)
  --benchmark           render once with 1 worker and once with --concurrency, and compare their fps
  --png                 capture PNG frames instead of JPEG
  --quality <0-100>     JPEG quality (default 90)
  --chromium <path>     Chromium executable to use`;

const { values } = parseArgs({
	options: {
		url: { type: 'string' },
		composition: { type: 'string' },
		props: { type: 'string' },
		out: { type: 'string', default: 'out.mp4' },
		concurrency: { type: 'string' },
		benchmark: { type: 'boolean', default: false },
		png: { type: 'boolean', default: false },
		quality: { type: 'string', default: '90' },
		chromium: { type: 'string' },
		help: { type: 'boolean', short: 'h', default: false }
	}
});

if (values.help || !values.url) {
	console.error(USAGE);
	process.exit(values.help ? 0 : 1);
}

const quality = Number(values.quality);
if (!Number.isFinite(quality) || quality < 0 || quality > 100) {
	console.error('--quality must be a number between 0 and 100');
	process.exit(1);
}

let concurrency: number | undefined;
if (values.concurrency !== undefined) {
	concurrency = Number(values.concurrency);
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		console.error('--concurrency must be a whole number of 1 or more');
		process.exit(1);
	}
}

// `pnpm exec` runs from the package directory; resolve paths from where the user ran it.
const cwd = process.env.INIT_CWD ?? process.cwd();
const output = resolve(cwd, values.out!);

let pageUrl: string;
try {
	let props;
	if (values.props !== undefined) {
		const file = resolve(cwd, values.props);
		let parsed: unknown;
		try {
			parsed = JSON.parse(await readFile(file, 'utf8'));
		} catch (err) {
			throw new Error(`Could not read props from ${file}: ${(err as Error).message}`);
		}
		props = assertProps(parsed, file);
	}
	pageUrl = buildRenderUrl({ url: values.url, composition: values.composition, props });
} catch (err) {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
}

const controller = new AbortController();
process.once('SIGINT', () => {
	console.error('\nInterrupted, cleaning up...');
	controller.abort();
	process.once('SIGINT', () => process.exit(130));
});

const tty = process.stdout.isTTY;
const line = (label: string, p: RenderProgress) =>
	`${label}frame ${p.frame}/${p.total}  ${(p.elapsedMs / 1000).toFixed(1)}s  ${p.fps.toFixed(1)} fps`;

/** One render, printing progress under `label`. */
function render(overrides: Partial<RenderOptions>, label = '') {
	return renderVideo({
		url: pageUrl,
		output,
		imageFormat: values.png ? 'png' : 'jpeg',
		quality,
		chromiumPath: values.chromium,
		concurrency,
		signal: controller.signal,
		onProgress: (p) => {
			if (tty) process.stdout.write(`\r${line(label, p)}`);
			else if (p.frame % 30 === 0 || p.frame === p.total) console.log(line(label, p));
		},
		...overrides
	});
}

try {
	let baseline;
	if (values.benchmark) {
		// The "before": the same video, rendered by a single page, into a file that is thrown away.
		const scratch = join(tmpdir(), `svelteframe-benchmark-${process.pid}${extname(output) || '.mp4'}`);
		try {
			console.log('Benchmark: rendering with 1 worker...');
			baseline = await render({ output: scratch, concurrency: 1 }, '  1 worker   ');
			if (tty) process.stdout.write('\n');
		} finally {
			await unlink(scratch).catch(() => {});
		}
		console.log(`Benchmark: rendering with ${concurrency ?? defaultConcurrency()} worker(s)...`);
	}

	const result = await render({}, baseline ? `  ${concurrency ?? defaultConcurrency()} workers ` : '');
	if (tty) process.stdout.write('\n');

	const audio = result.audioSegments > 0 ? ` with ${result.audioSegments} audio segment(s)` : '';
	const workers = result.concurrency > 1 ? ` using ${result.concurrency} workers` : '';
	console.log(`Rendered ${result.frame} frames${audio}${workers} to ${output}`);

	if (baseline) {
		const run = (r: typeof result) => ({
			concurrency: r.concurrency,
			frames: r.frame,
			renderMs: r.elapsedMs,
			wallMs: r.wallMs
		});
		console.log(`\n${formatBenchmark(run(baseline), run(result))}`);
	}
} catch (err) {
	if (tty) process.stdout.write('\n');
	if (controller.signal.aborted) process.exit(130);
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
}
