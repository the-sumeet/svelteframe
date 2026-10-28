import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright';
import { startProjectServer, type ProjectServer } from './server.js';

/**
 * These run the built `svelteframe` binary against the real playground, from a scratch directory
 * that is not the project: relative paths must be relative to where the command was run.
 */
const packageDir = resolve(import.meta.dirname, '..');
const bin = join(packageDir, 'dist/bin.js');
const playground = resolve(packageDir, '../../apps/playground');

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const missing =
	(!existsSync(join(playground, 'node_modules/@svelteframe/core/dist/index.js')) && 'the playground is not installed and built') ||
	(!hasFfmpeg && 'ffmpeg is not installed') ||
	(!existsSync(chromium.executablePath()) && 'Chromium is not installed');

interface Result {
	code: number | null;
	stdout: string;
	stderr: string;
}

function run(args: string[], cwd: string, onStdout?: (text: string, child: ReturnType<typeof spawn>) => void): Promise<Result> {
	return new Promise((resolveRun) => {
		// Not run from pnpm: drop what pnpm sets so only the command line decides.
		const { INIT_CWD, NODE_PATH, SVELTEFRAME_VERBOSE, ...env } = process.env;
		void INIT_CWD, void NODE_PATH, void SVELTEFRAME_VERBOSE;
		const child = spawn(process.execPath, [bin, ...args], { cwd, env });
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (d) => {
			stdout += d;
			onStdout?.(stdout, child);
		});
		child.stderr.on('data', (d) => (stderr += d));
		child.on('close', (code) => resolveRun({ code, stdout, stderr }));
	});
}

const chunkDirs = () => readdirSync(tmpdir()).filter((n) => n.startsWith('svelteframe-chunks-'));

/** Width and height of a PNG. */
function pngSize(file: string) {
	const bytes = readFileSync(file);
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const frames = (file: string) =>
	Number(
		spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'default=noprint_wrappers=1:nokey=1', file]).stdout
			.toString()
			.trim()
	);

describe('the svelteframe command', () => {
	let work: string;
	before(async () => {
		// Build what is under test, so this never runs against a stale dist.
		const build = spawnSync(process.execPath, [join(packageDir, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'], { cwd: packageDir });
		assert.equal(build.status, 0, build.stdout.toString());
		work = await mkdtemp(join(tmpdir(), 'svelteframe-cli-work-'));
	});
	after(() => rm(work, { recursive: true, force: true }));

	describe('without a project', () => {
		it('--help prints the usage and exits 0', async () => {
			const result = await run(['--help'], work);
			assert.equal(result.code, 0);
			assert.match(result.stdout, /Usage:/);
			assert.match(result.stdout, /svelteframe render <id>/);
		});

		it('--version prints the package version', async () => {
			const result = await run(['--version'], work);
			assert.equal(result.code, 0);
			assert.equal(result.stdout.trim(), JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version);
		});

		it('exits 2 with the mistake and a hint, printing nothing on stdout', async () => {
			for (const [args, message] of [
				[['bogus'], /Unknown command "bogus"/],
				[['render'], /Missing the composition id/],
				[['still', 'main', '--concurrency', '2'], /--concurrency does not apply to "still"/]
			] as const) {
				const result = await run([...args], work);
				assert.equal(result.code, 2, args.join(' '));
				assert.match(result.stderr, message);
				assert.match(result.stderr, /Run "svelteframe --help" for usage/);
				assert.equal(result.stdout, '');
			}
		});

		it('fails with a clear message when there is no project here', async () => {
			const result = await run(['compositions'], work);
			assert.equal(result.code, 1);
			assert.match(result.stderr, /No project at .*no package\.json/);
		});
	});

	describe('with the playground', { skip: missing }, () => {
		const root = ['--root', playground];

		it('compositions --json prints only JSON on stdout, and status on stderr', async () => {
			const result = await run(['compositions', '--json', ...root], work);
			assert.equal(result.code, 0, result.stderr);
			const list = JSON.parse(result.stdout) as { id: string; durationInFrames: number }[];
			assert.deepEqual(
				list.map((c) => c.id),
				['main', 'primitives', 'async', 'audio-demo', 'title-card']
			);
			assert.match(result.stderr, /Building the project/);
			assert.doesNotMatch(result.stderr + result.stdout, /adapter-auto/, 'the build output is not shown');
		});

		it('compositions prints a table', async () => {
			const result = await run(['compositions', ...root], work);
			assert.equal(result.code, 0, result.stderr);
			assert.match(result.stdout, /ID\s+SIZE\s+FPS\s+FRAMES\s+LENGTH\s+PROPS/);
			assert.match(result.stdout, /title-card\s+1920×1080\s+30\s+90\s+3\.0s\*\s+title, subtitle, color, seconds/);
			assert.match(result.stdout, /\* the length depends on the props/);
		});

		it('still writes the frame where the command was run, not in the project', async () => {
			const result = await run(['still', 'title-card', '--frame', '20', '--out', 'shots/card.png', ...root], work);
			assert.equal(result.code, 0, result.stderr);
			assert.match(result.stdout, /Saved frame 20 of title-card \(1920×1080\)/);

			const file = join(work, 'shots/card.png');
			assert.ok(existsSync(file), 'written relative to the working directory');
			assert.deepEqual(pngSize(file), { width: 1920, height: 1080 });
			assert.equal(existsSync(join(playground, 'shots/card.png')), false, 'not relative to the project');
		});

		it('still applies props from a file, which changes the picture', async () => {
			await writeFile(join(work, 'props.json'), JSON.stringify({ color: '#1b3a8a', title: 'From props' }));
			const plain = await run(['still', 'title-card', '--frame', '30', '--out', 'plain.png', ...root], work);
			const styled = await run(['still', 'title-card', '--frame', '30', '--props', 'props.json', '--out', 'styled.png', ...root], work);
			assert.equal(plain.code, 0, plain.stderr);
			assert.equal(styled.code, 0, styled.stderr);
			assert.notDeepEqual(readFileSync(join(work, 'plain.png')), readFileSync(join(work, 'styled.png')));
		});

		it('still rejects a frame past the end', async () => {
			const result = await run(['still', 'main', '--frame', '999', '--out', 'late.png', ...root], work);
			assert.equal(result.code, 1);
			assert.match(result.stderr, /Frame 999 is out of range: the video has 150 frames \(0-149\)/);
			assert.equal(existsSync(join(work, 'late.png')), false);
		});

		it('render makes a video, with the props, in parallel', async () => {
			await writeFile(join(work, 'short.json'), JSON.stringify({ seconds: 2 }));
			const result = await run(['render', 'title-card', '--props', 'short.json', '--out', 'out/card.mp4', '--concurrency', '2', ...root], work);
			assert.equal(result.code, 0, result.stderr);
			assert.match(result.stdout, /Rendered 60 frames using 2 workers to /);

			const file = join(work, 'out/card.mp4');
			assert.equal(frames(file), 60, '2 seconds at 30 fps, from the seconds prop');
			assert.equal(existsSync(join(playground, 'out/card.mp4')), false);
		});

		it('render mixes the audio of a composition', async () => {
			const result = await run(['render', 'audio-demo', '--out', 'audio.mp4', '--concurrency', '2', ...root], work);
			assert.equal(result.code, 0, result.stderr);
			assert.match(result.stdout, /with 2 audio segment\(s\)/);
			const streams = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', join(work, 'audio.mp4')]).stdout.toString();
			assert.match(streams, /audio/);
		});

		it('render fails with the reason for an unknown composition, leaving no file', async () => {
			const result = await run(['render', 'nope', '--out', 'nope.mp4', ...root], work);
			assert.equal(result.code, 1);
			assert.match(result.stderr, /Unknown composition "nope". Available: main, primitives, async, audio-demo, title-card/);
			assert.equal(result.stdout, '');
			assert.equal(existsSync(join(work, 'nope.mp4')), false);
		});

		it('render reports a bad props file by name', async () => {
			await writeFile(join(work, 'bad.json'), '[1, 2]');
			const result = await run(['render', 'main', '--props', 'bad.json', ...root], work);
			assert.equal(result.code, 1);
			assert.match(result.stderr, /bad\.json must contain a JSON object/);
			assert.doesNotMatch(result.stderr, /Building/, 'checked before the project is built');
		});

		it('works against a server that is already running, without building anything', async () => {
			let server: ProjectServer | undefined;
			try {
				server = await startProjectServer({ root: playground });
				const result = await run(['still', 'main', '--frame', '5', '--out', 'running.png', '--url', server.url], work);
				assert.equal(result.code, 0, result.stderr);
				assert.doesNotMatch(result.stderr, /Building|Starting/);
				assert.ok(existsSync(join(work, 'running.png')));
			} finally {
				await server?.close();
			}
		});

		it('--dev uses the dev server', async () => {
			const result = await run(['compositions', '--json', '--dev', ...root], work);
			assert.equal(result.code, 0, result.stderr);
			assert.match(result.stderr, /Starting the dev server/);
			assert.equal((JSON.parse(result.stdout) as unknown[]).length, 5);
		});

		it('Ctrl-C stops a render, exits 130 and leaves nothing behind', async () => {
			const before = chunkDirs().length;
			let interrupted = false;
			const result = await run(['render', 'primitives', '--out', 'interrupted.mp4', '--concurrency', '3', ...root], work, (text, child) => {
				if (!interrupted && /frame [1-9]\d*\//.test(text)) {
					interrupted = true;
					child.kill('SIGINT');
				}
			});
			assert.equal(interrupted, true, 'it started rendering');
			assert.equal(result.code, 130);
			assert.match(result.stderr, /Interrupted, cleaning up/);
			assert.equal(existsSync(join(work, 'interrupted.mp4')), false);
			assert.equal(chunkDirs().length, before, 'no chunk directory left');
			assert.equal(spawnSync('pgrep', ['-f', 'svelteframe-chunks']).stdout.toString().trim(), '', 'no ffmpeg left');
		});
	});
});
