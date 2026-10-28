import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page, Route } from 'playwright';
import { localSource, probeMedia, type MediaInfo } from './source.js';

/**
 * Path the render page requests frames from: `<OffthreadVideo>` asks for
 * `/__svelteframe/video-frame?src=<absolute video URL>&time=<seconds>`. The renderer answers the
 * request itself, so the project needs no server code.
 */
export const VIDEO_FRAME_PATH = '/__svelteframe/video-frame';

/** Frames kept for requests that land on the same source frame (slow motion, several pages). */
const CACHE_SIZE = 16;
const STDERR_LIMIT = 16 * 1024;

/**
 * Which frame of a video is on screen `time` seconds in, and where to seek to decode it.
 *
 * The frame shown is the last one that starts at or before `time`, and past the end the last
 * frame stays. Seeking lands on the first frame at or after the seek time, so aiming half a frame
 * early finds the wanted frame without being thrown by rounding.
 */
export function sourceFrameAt(time: number, { fps, duration }: Pick<MediaInfo, 'fps' | 'duration'>) {
	let index = Math.max(0, Math.floor(time * fps + 1e-6));
	if (duration > 0) index = Math.min(index, Math.max(0, Math.round(duration * fps) - 1));
	const seek = Math.max(0, Math.floor(((index - 0.5) / fps) * 1e6) / 1e6);
	return { index, seek };
}

export interface VideoFramesOptions {
	/** `png` is lossless; `jpeg` is smaller and faster. */
	imageFormat?: 'jpeg' | 'png';
}

export interface VideoFrames {
	/** Answer the frame requests of `page`. */
	attach(page: Page): Promise<void>;
	/** The image of the frame on screen `time` seconds into `src`. */
	frame(src: string, time: number): Promise<{ image: Buffer; contentType: string }>;
	/** Stop any ffmpeg still decoding and remove the downloaded videos. */
	close(): Promise<void>;
}

export function createVideoFrames({ imageFormat = 'jpeg' }: VideoFramesOptions = {}): VideoFrames {
	const png = imageFormat === 'png';
	const contentType = png ? 'image/png' : 'image/jpeg';

	let dir: Promise<string> | undefined;
	const sources = new Map<string, Promise<{ file: string; info: MediaInfo }>>();
	const cache = new Map<string, Promise<Buffer>>();
	const children = new Set<ChildProcess>();
	let closed = false;

	function source(src: string) {
		let found = sources.get(src);
		if (!found) {
			found = (async () => {
				dir ??= mkdtemp(join(tmpdir(), 'svelteframe-video-'));
				const file = await localSource(src, await dir, sources.size, 'video');
				const info = await probeMedia(file);
				if (!info.hasVideo) throw new Error(`"${src}" has no video stream`);
				if (info.fps <= 0) throw new Error(`Could not tell the frame rate of "${src}"`);
				return { file, info };
			})();
			sources.set(src, found);
		}
		return found;
	}

	function decode(file: string, seek: number, label: string): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			if (closed) return reject(new Error('The renderer was closed'));
			const ffmpeg = spawn(
				'ffmpeg',
				[
					'-hide_banner', '-loglevel', 'error',
					'-ss', String(seek), '-i', file,
					'-an', '-frames:v', '1',
					...(png ? ['-c:v', 'png'] : ['-c:v', 'mjpeg', '-q:v', '2']),
					'-f', 'image2pipe', '-'
				],
				{ stdio: ['ignore', 'pipe', 'pipe'] }
			);
			children.add(ffmpeg);
			const out: Buffer[] = [];
			let stderr = '';
			ffmpeg.stdout.on('data', (chunk: Buffer) => out.push(chunk));
			ffmpeg.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk).slice(-STDERR_LIMIT)));
			ffmpeg.once('error', reject);
			ffmpeg.once('close', (code) => {
				children.delete(ffmpeg);
				const image = Buffer.concat(out);
				if (code === 0 && image.length > 0) resolve(image);
				else reject(new Error(`ffmpeg could not decode ${label}${stderr ? `:\n${stderr.trim()}` : ''}`));
			});
		});
	}

	async function frame(src: string, time: number) {
		if (!Number.isFinite(time) || time < 0) throw new Error(`Invalid video time ${time}`);
		const { file, info } = await source(src);
		const { index, seek } = sourceFrameAt(time, info);

		const key = `${src}#${index}`;
		let image = cache.get(key);
		if (image) {
			// Most recently used last.
			cache.delete(key);
		} else {
			image = decode(file, seek, `frame ${index} of "${src}"`);
			// A failure is not remembered: the next request tries again.
			image.catch(() => cache.delete(key));
		}
		cache.set(key, image);
		while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
		return { image: await image, contentType };
	}

	async function answer(route: Route) {
		const params = new URL(route.request().url()).searchParams;
		try {
			const src = params.get('src');
			const time = params.get('time');
			if (!src) throw new Error('The video frame request has no src');
			if (time === null) throw new Error('The video frame request has no time');
			const { image, contentType } = await frame(src, Number(time));
			await route.fulfill({ status: 200, contentType, body: image, headers: { 'cache-control': 'no-store' } });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			// The page reads this text and fails the render with it.
			await route
				.fulfill({ status: 500, contentType: 'text/plain; charset=utf-8', body: message })
				.catch(() => {});
		}
	}

	return {
		frame,
		async attach(page) {
			await page.route((url) => url.pathname === VIDEO_FRAME_PATH, answer);
		},
		async close() {
			closed = true;
			for (const child of children) child.kill('SIGKILL');
			await Promise.allSettled([...sources.values()]);
			if (dir) await rm(await dir, { recursive: true, force: true });
		}
	};
}
