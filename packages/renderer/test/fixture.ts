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
/** The test video: frame n of it is luma 16 + 3n (limited range), so the picture says which frame it is. */
export const VIDEO_FPS = 24;
export const VIDEO_FRAMES = 72;

export const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
export const hasChromium = existsSync(chromium.executablePath());
/** Pass to `describe(..., { skip })` for tests that need ffmpeg and Chromium. */
export const skip =
	(!hasFfmpeg && 'ffmpeg is not installed') || (!hasChromium && 'Chromium is not installed');

export const ffmpeg = (...args: string[]) => {
	const result = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]);
	assert.equal(result.status, 0, result.stderr.toString());
};

/**
 * A 72-frame video at 24 fps whose frame n is luma 16 + 3n, with a keyframe only every
 * 250 frames so seeking has to decode forward. Optionally with a tone as its sound.
 */
export function makeTestVideo(file: string, { audio }: { audio: boolean }) {
	ffmpeg(
		'-f', 'lavfi', '-i', `nullsrc=s=64x64:r=${VIDEO_FPS},format=yuv420p,geq=lum='16+3*N':cb=128:cr=128`,
		...(audio ? ['-f', 'lavfi', '-i', 'sine=f=440:r=44100'] : []),
		'-frames:v', String(VIDEO_FRAMES),
		...(audio ? ['-shortest', '-c:a', 'aac'] : []),
		'-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-color_range', 'tv', file
	);
}

/** Which frame of the test video a decoded image shows, from its mean gray. */
export function videoFrameOf(image: Buffer): number {
	const { stdout } = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', 'scale=1:1,format=gray', '-f', 'rawvideo', '-'], { input: image });
	const luma = (stdout[0] * 219) / 255 + 16;
	return Math.round((luma - 16) / 3);
}

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
			if (q.has('video')) {
				// What <OffthreadVideo> does in a render: ask for the frame, show it, and fail with the reason.
				const src = location.origin + '/' + q.get('video');
				const response = await fetch('/__svelteframe/video-frame?src=' + encodeURIComponent(src) + '&time=' + n / ${FPS});
				if (!response.ok) throw new Error(await response.text());
				const img = document.getElementById('v') ?? document.body.appendChild(Object.assign(document.createElement('img'), { id: 'v' }));
				img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
				img.src = URL.createObjectURL(await response.blob());
				await img.decode();
			}
			observe(n);
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		},
		// A sound that plays for the whole video, with a volume that rises with the frame.
		get audio() {
			if (!q.has('audio')) return [];
			return segments.map((s) => ({
				src: location.origin + '/' + (q.get('audio') === '1' ? 'tone.wav' : q.get('audio')),
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
	/** Page URL. Query options: `frames=N`, `fail=N`, `audio=1` (or a file name), `video=<file>`, `broken=1`. */
	page(query?: string): string;
	close(): Promise<void>;
}

export async function startFixture(): Promise<Fixture> {
	const dir = await mkdtemp(join(tmpdir(), 'svelteframe-fixture-'));
	ffmpeg('-f', 'lavfi', '-i', 'sine=f=440:d=3:r=44100', join(dir, 'tone.wav'));
	makeTestVideo(join(dir, 'frames.mp4'), { audio: false });
	makeTestVideo(join(dir, 'frames-audio.mp4'), { audio: true });

	const files: Record<string, string> = {
		'/tone.wav': 'audio/wav',
		'/frames.mp4': 'video/mp4',
		'/frames-audio.mp4': 'video/mp4'
	};
	const server = createServer(async (req, res) => {
		const path = new URL(req.url ?? '/', 'http://x').pathname;
		if (files[path]) {
			res.writeHead(200, { 'content-type': files[path] }).end(await readFile(join(dir, path)));
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
