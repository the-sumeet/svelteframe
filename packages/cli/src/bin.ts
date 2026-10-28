#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { HELP, UsageError, parseCommand } from './args.js';
import { run } from './run.js';

async function main(): Promise<number> {
	let command;
	try {
		command = parseCommand(process.argv.slice(2));
	} catch (err) {
		if (!(err instanceof UsageError)) throw err;
		process.stderr.write(`${err.message}\nRun "svelteframe --help" for usage.\n`);
		return 2;
	}

	if (command.name === 'help') {
		process.stdout.write(`${HELP}\n`);
		return 0;
	}
	if (command.name === 'version') {
		const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
		process.stdout.write(`${manifest.version}\n`);
		return 0;
	}

	// Ctrl-C stops the render and shuts the server down before leaving; a second one leaves at once.
	const controller = new AbortController();
	process.once('SIGINT', () => {
		process.stderr.write('\nInterrupted, cleaning up...\n');
		controller.abort();
		process.once('SIGINT', () => process.exit(130));
	});

	try {
		await run(command, {
			cwd: process.cwd(),
			signal: controller.signal,
			stdout: process.stdout,
			stderr: process.stderr,
			verbose: process.env.SVELTEFRAME_VERBOSE === '1'
		});
		return 0;
	} catch (err) {
		if (process.stdout.isTTY) process.stdout.write('\n');
		if (controller.signal.aborted) return 130;
		process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
		return 1;
	}
}

process.exit(await main());
