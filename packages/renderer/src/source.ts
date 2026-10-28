import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Local path for a media URL, downloading it into `dir` as `source-<index>` if it is remote.
 * `what` names the kind of media in error messages ("audio", "video").
 */
export async function localSource(src: string, dir: string, index: number, what: string): Promise<string> {
	let url: URL;
	try {
		url = new URL(src);
	} catch {
		throw new Error(`Unsupported ${what} source "${src}": it must be an absolute URL`);
	}
	if (url.protocol === 'file:') return fileURLToPath(url);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`Unsupported ${what} source "${src}"`);
	}

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Could not fetch ${what} "${src}": HTTP ${response.status}`);
	}
	const file = join(dir, `source-${index}${extname(url.pathname)}`);
	await writeFile(file, Buffer.from(await response.arrayBuffer()));
	return file;
}

export interface MediaInfo {
	hasVideo: boolean;
	hasAudio: boolean;
	/** Frames per second of the first video stream. */
	fps: number;
	/** Length of the media in seconds. */
	duration: number;
}

/** Parse ffprobe's `30000/1001` (or `25`) into a number; 0 when unknown. */
export function parseRate(rate: string | undefined): number {
	if (!rate) return 0;
	const [numerator, denominator = '1'] = rate.split('/');
	const value = Number(numerator) / Number(denominator);
	return Number.isFinite(value) && value > 0 ? value : 0;
}

/** What is in a media file. */
export function probeMedia(file: string): Promise<MediaInfo> {
	return new Promise((resolve, reject) => {
		const ffprobe = spawn(
			'ffprobe',
			['-v', 'error', '-show_entries', 'stream=codec_type,avg_frame_rate,r_frame_rate,duration:format=duration', '-of', 'json', file],
			{ stdio: ['ignore', 'pipe', 'pipe'] }
		);
		let stdout = '';
		let stderr = '';
		ffprobe.stdout.on('data', (d) => (stdout += d));
		ffprobe.stderr.on('data', (d) => (stderr += d));
		ffprobe.once('error', reject);
		ffprobe.once('close', (code) => {
			if (code !== 0) return reject(new Error(`Could not read ${file}: ${stderr.trim() || `ffprobe exited with code ${code}`}`));
			try {
				const { streams = [], format = {} } = JSON.parse(stdout) as {
					streams?: { codec_type: string; avg_frame_rate?: string; r_frame_rate?: string; duration?: string }[];
					format?: { duration?: string };
				};
				const video = streams.find((s) => s.codec_type === 'video');
				const duration = Number(format.duration ?? video?.duration ?? 0);
				resolve({
					hasVideo: video !== undefined,
					hasAudio: streams.some((s) => s.codec_type === 'audio'),
					fps: parseRate(video?.avg_frame_rate) || parseRate(video?.r_frame_rate),
					duration: Number.isFinite(duration) ? duration : 0
				});
			} catch (err) {
				reject(new Error(`Could not read ${file}: ${err instanceof Error ? err.message : err}`));
			}
		});
	});
}
