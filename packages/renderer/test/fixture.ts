import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

/**
 * A small page that stands in for a Svelteframe render page, so renderer tests need no project:
 * every frame is a different gray, and the decoded output shows exactly which frame is where.
 */
export const FPS = 30;
export const FRAMES = 60;

export const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
export const hasChromium = existsSync(chromium.executablePath());
/** Pass to `describe(..., { skip })` for tests that need ffmpeg and Chromium. */
export const skip =
	(!hasFfmpeg && 'ffmpeg is not installed') || (!hasChromium && 'Chromium is not installed');

export const ffmpeg = (...args: string[]) => {
	const result = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]);
	assert.equal(result.status, 0, result.stderr.toString());
};

/** One frame is gray `4 * frame`. A page reports what it rendered the way `<Audio>` would. */
const PAGE = `<!doctype html><meta charset="utf-8">
<body style="margin:0"><div id="a" style="width:100vw;height:100vh"></div>
<script>
const q = new URLSearchParams(location.search);
const total = Number(q.get('frames') ?? ${FRAMES});
const failAt = q.has('fail') ? Number(q.get('fail')) : -1;
// Models what <Audio> records: stretches of consecutive frames. A page shows frame 0 as soon as it
// loads, before the renderer has said which frames it wants, and that is recorded too.
const segments = [];
let lastFrame = -1;
function observe(n) {
	if (n <= lastFrame) return; // each frame is recorded once
	lastFrame = n;
	const last = segments[segments.length - 1];
	const gain = (n + 1) / total;
	if (last && n === last.startFrame + last.volume.length) last.volume.push(gain);
	else segments.push({ startFrame: n, volume: [gain] });
}
observe(0);
if (q.has('broken')) {
	window.__SvelteframeError = 'the page is broken';
} else {
	window.__Svelteframe = {
		config: { fps: ${FPS}, width: 160, height: 90, durationInFrames: total },
		ready: true,
		async setFrame(n) {
			if (n === failAt) throw new Error('boom at frame ' + n);
			const g = n * 4;
			document.getElementById('a').style.background = 'rgb(' + g + ',' + g + ',' + g + ')';
			observe(n);
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		},
		// A sound that plays for the whole video, with a volume that rises with the frame.
		get audio() {
			if (!q.has('audio')) return [];
			return segments.map((s) => ({
				src: location.origin + '/tone.wav',
				startFrame: s.startFrame,
				durationInFrames: s.volume.length,
				sourceStartSeconds: s.startFrame / ${FPS},
				playbackRate: 1,
				volume: s.volume
			}));
		}
	};
}
</script>`;

export interface Fixture {
	/** A scratch directory, removed by `close()`. */
	dir: string;
	/** Page URL. Query options: `frames=N`, `fail=N`, `audio=1`, `broken=1`. */
	page(query?: string): string;
	close(): Promise<void>;
}

export async function startFixture(): Promise<Fixture> {
	const dir = await mkdtemp(join(tmpdir(), 'svelteframe-fixture-'));
	ffmpeg('-f', 'lavfi', '-i', 'sine=f=440:d=3:r=44100', join(dir, 'tone.wav'));

	const server = createServer(async (req, res) => {
		if (req.url?.startsWith('/tone.wav')) {
			res.writeHead(200, { 'content-type': 'audio/wav' }).end(await readFile(join(dir, 'tone.wav')));
		} else {
			res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
		}
	}).listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));
	const address = server.address();
	const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

	return {
		dir,
		page: (query = '') => `${base}/?${query}`,
		close: async () => {
			server.close();
			await rm(dir, { recursive: true, force: true });
		}
	};
}
