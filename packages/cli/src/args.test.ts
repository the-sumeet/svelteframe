import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HELP, UsageError, parseCommand } from './args.js';

const usage = (argv: string[], message: RegExp) =>
	assert.throws(() => parseCommand(argv), (err) => err instanceof UsageError && message.test(err.message), argv.join(' '));

describe('help and version', () => {
	it('shows help for --help, -h, or no arguments', () => {
		assert.deepEqual(parseCommand(['--help']), { name: 'help' });
		assert.deepEqual(parseCommand(['-h']), { name: 'help' });
		assert.deepEqual(parseCommand([]), { name: 'help' });
		assert.deepEqual(parseCommand(['render', 'main', '--help']), { name: 'help' });
	});

	it('shows the version for --version and -v', () => {
		assert.deepEqual(parseCommand(['--version']), { name: 'version' });
		assert.deepEqual(parseCommand(['-v']), { name: 'version' });
	});

	it('documents every command and option', () => {
		for (const word of ['render', 'still', 'compositions', '--root', '--url', '--dev', '--out', '--props', '--concurrency', '--quality', '--png', '--frame', '--json']) {
			assert.ok(HELP.includes(word), word);
		}
	});
});

describe('render', () => {
	it('takes a composition id and defaults everything else', () => {
		assert.deepEqual(parseCommand(['render', 'main']), {
			name: 'render',
			id: 'main',
			out: 'main.mp4',
			props: undefined,
			concurrency: undefined,
			quality: 90,
			png: false,
			root: undefined,
			url: undefined,
			dev: false,
			chromium: undefined
		});
	});

	it('reads every option, in any position', () => {
		const command = parseCommand([
			'--root', 'apps/site', 'render', '--out', 'out/video.mp4', 'title-card', '--props', 'p.json',
			'--concurrency', '6', '--quality', '75', '--png', '--dev', '--chromium', '/usr/bin/chromium'
		]);
		assert.deepEqual(command, {
			name: 'render',
			id: 'title-card',
			out: 'out/video.mp4',
			props: 'p.json',
			concurrency: 6,
			quality: 75,
			png: true,
			root: 'apps/site',
			url: undefined,
			dev: true,
			chromium: '/usr/bin/chromium'
		});
	});

	it('accepts --opt=value', () => {
		const command = parseCommand(['render', 'main', '--out=x.mp4', '--concurrency=2']);
		assert.equal(command.name === 'render' && command.out, 'x.mp4');
		assert.equal(command.name === 'render' && command.concurrency, 2);
	});

	it('needs exactly one id', () => {
		usage(['render'], /Missing the composition id/);
		usage(['render', 'a', 'b'], /one composition id, got extra "b"/);
	});

	it('validates numbers', () => {
		for (const bad of ['0', '-1', '1.5', 'many', '']) usage(['render', 'main', `--concurrency=${bad}`], /--concurrency must be a whole number of 1 or more/);
		for (const bad of ['-1', '101', 'high', '']) usage(['render', 'main', `--quality=${bad}`], /--quality must be a number from 0 to 100/);
		assert.equal((parseCommand(['render', 'main', '--quality', '0']) as { quality: number }).quality, 0);
		assert.equal((parseCommand(['render', 'main', '--quality', '100']) as { quality: number }).quality, 100);
	});

	it('rejects options that belong to other commands', () => {
		usage(['render', 'main', '--frame', '3'], /--frame does not apply to "render"/);
		usage(['render', 'main', '--json'], /--json does not apply to "render"/);
	});
});

describe('still', () => {
	it('defaults to the first frame and a png named after the composition', () => {
		assert.deepEqual(parseCommand(['still', 'main']), {
			name: 'still',
			id: 'main',
			frame: 0,
			out: 'main.png',
			props: undefined,
			quality: 90,
			root: undefined,
			url: undefined,
			dev: false,
			chromium: undefined
		});
	});

	it('reads the frame, output, props and quality', () => {
		const command = parseCommand(['still', 'main', '--frame', '45', '--out', 'frame.jpg', '--props', 'p.json', '--quality', '80']);
		assert.deepEqual(
			{ ...command },
			{ name: 'still', id: 'main', frame: 45, out: 'frame.jpg', props: 'p.json', quality: 80, root: undefined, url: undefined, dev: false, chromium: undefined }
		);
	});

	it('validates the frame', () => {
		for (const bad of ['-1', '1.5', 'last', '']) usage(['still', 'main', `--frame=${bad}`], /--frame must be a whole number of 0 or more/);
		assert.equal((parseCommand(['still', 'main', '--frame', '0']) as { frame: number }).frame, 0);
	});

	it('rejects options that belong to other commands', () => {
		usage(['still', 'main', '--concurrency', '2'], /--concurrency does not apply to "still"/);
		usage(['still', 'main', '--png'], /--png does not apply to "still"/);
	});

	it('needs an id', () => {
		usage(['still'], /Missing the composition id: svelteframe still <id>/);
	});
});

describe('compositions', () => {
	it('lists as a table, or as JSON', () => {
		assert.equal((parseCommand(['compositions']) as { json: boolean }).json, false);
		assert.equal((parseCommand(['compositions', '--json']) as { json: boolean }).json, true);
	});

	it('takes no arguments and none of the render options', () => {
		usage(['compositions', 'main'], /takes no arguments, got "main"/);
		usage(['compositions', '--out', 'x'], /--out does not apply to "compositions"/);
	});
});

describe('shared options', () => {
	it('--url must be a full url', () => {
		assert.equal((parseCommand(['render', 'main', '--url', 'http://localhost:5173']) as { url: string }).url, 'http://localhost:5173');
		assert.equal((parseCommand(['render', 'main', '--url', 'https://example.com/app']) as { url: string }).url, 'https://example.com/app');
		for (const bad of ['localhost:5173', 'nonsense', 'ftp://host', 'file:///tmp/x']) {
			usage(['render', 'main', '--url', bad], /--url must be a full URL/);
		}
	});

	it('--dev makes no sense with --url', () => {
		usage(['render', 'main', '--url', 'http://localhost:5173', '--dev'], /--dev has no effect with --url/);
	});
});

describe('mistakes', () => {
	it('names an unknown command and lists the real ones', () => {
		usage(['bogus'], /Unknown command "bogus". Commands: render, still, compositions/);
	});

	it('names an unknown option', () => {
		usage(['render', 'main', '--bogus'], /Unknown option '--bogus'/);
	});

	it('names an option that is missing its value', () => {
		usage(['render', 'main', '--out'], /--out/);
	});

	it('explains how to give a value that starts with a dash', () => {
		usage(['still', 'main', '--frame', '-1'], /--frame needs a value\. A value that starts with "-" must be written --frame=<value>/);
	});
});
