import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderVideo, type RenderProgress } from './render.js';

const USAGE = `Usage: tsx src/cli.ts --url <url> [--out out.mp4] [--png] [--quality 90] [--chromium <path>]`;

const { values } = parseArgs({
	options: {
		url: { type: 'string' },
		out: { type: 'string', default: 'out.mp4' },
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

// `pnpm exec` runs from the package directory; resolve paths from where the user ran it.
const output = resolve(process.env.INIT_CWD ?? process.cwd(), values.out!);

const controller = new AbortController();
process.once('SIGINT', () => {
	console.error('\nInterrupted, cleaning up...');
	controller.abort();
	process.once('SIGINT', () => process.exit(130));
});

const tty = process.stdout.isTTY;
const line = (p: RenderProgress) =>
	`frame ${p.frame}/${p.total}  ${(p.elapsedMs / 1000).toFixed(1)}s  ${p.fps.toFixed(1)} fps`;

try {
	const result = await renderVideo({
		url: values.url,
		output,
		imageFormat: values.png ? 'png' : 'jpeg',
		quality,
		chromiumPath: values.chromium,
		signal: controller.signal,
		onProgress: (p) => {
			if (tty) process.stdout.write(`\r${line(p)}`);
			else if (p.frame % 30 === 0 || p.frame === p.total) console.log(line(p));
		}
	});
	if (tty) process.stdout.write('\n');
	console.log(`Rendered ${result.frame} frames to ${output}`);
} catch (err) {
	if (tty) process.stdout.write('\n');
	if (controller.signal.aborted) process.exit(130);
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
}
