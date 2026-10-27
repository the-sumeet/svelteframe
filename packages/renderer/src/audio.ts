import { spawn } from 'node:child_process';
import { mkdtemp, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One stretch of a sound, as recorded by `<Audio>` in the page (see `@svelteframe/core`). */
export interface AudioSegment {
	/** Absolute URL of the audio file. */
	src: string;
	startFrame: number;
	durationInFrames: number;
	/** Where in the source file the stretch starts, in seconds. */
	sourceStartSeconds: number;
	playbackRate: number;
	/** Gain: constant, or one value per video frame of the segment. */
	volume: number | number[];
}

export interface FilterOptions {
	fps: number;
	/** Length of the video, in frames. */
	totalFrames: number;
	/** ffmpeg input index of the first segment's file (0 is the video). */
	firstInput?: number;
}

const SAMPLE_RATE = 48000;

/** Plain decimal, never exponent notation, which ffmpeg's expressions do not accept. */
const num = (value: number): string => String(Number(value.toFixed(6)));

/** `atempo` only accepts 0.5 to 2 per stage, so other speeds are chained. */
export function tempoFilters(rate: number): string[] {
	if (!(rate > 0)) throw new Error(`playbackRate must be greater than 0, got ${rate}`);
	if (rate === 1) return [];
	const stages: number[] = [];
	let rest = rate;
	while (rest > 2) {
		stages.push(2);
		rest /= 2;
	}
	while (rest < 0.5) {
		stages.push(0.5);
		rest *= 2;
	}
	stages.push(rest);
	return stages.map((stage) => `atempo=${num(stage)}`);
}

/**
 * ffmpeg filters for a gain: nothing for 1, `volume=g` for a constant, and for a per-frame
 * curve an expression of `t` that interpolates linearly between the frames. The expression
 * is a flat sum of ramps, so its length follows the number of bends in the curve, not the
 * number of frames.
 */
export function volumeFilters(volume: number | number[], fps: number): string[] {
	const samples = Array.isArray(volume) ? volume : [volume];
	if (samples.some((v) => !Number.isFinite(v) || v < 0)) {
		throw new Error('volume must be finite and not negative');
	}
	if (samples.every((v) => v === samples[0])) {
		return samples[0] === 1 ? [] : [`volume=${num(samples[0])}`];
	}

	// Slope (gain per second) between each frame and the next; the last value is held.
	const slopes = samples.map((v, i) => (i < samples.length - 1 ? (samples[i + 1] - v) * fps : 0));
	const ramps: string[] = [];
	let previous = 0;
	slopes.forEach((slope, i) => {
		if (Math.abs(slope - previous) > 1e-9) {
			ramps.push(`(${num(slope - previous)})*max(0,t-${num(i / fps)})`);
		}
		previous = slope;
	});
	const expression = [num(samples[0]), ...ramps].join('+');

	// Short chunks let the gain follow the curve closely, instead of one step per ~20ms.
	return ['asetnsamples=n=480:p=0', `volume='${expression}':eval=frame`];
}

/**
 * The `-filter_complex` graph that turns segments into one stereo track labelled `[aout]`,
 * as long as the video. Segment i reads ffmpeg input `firstInput + i`.
 */
export function buildAudioFilter(segments: AudioSegment[], options: FilterOptions): string {
	const { fps, totalFrames, firstInput = 1 } = options;
	if (segments.length === 0) throw new Error('buildAudioFilter needs at least one segment');

	const chains = segments.map((segment, i) => {
		const delayMs = (segment.startFrame / fps) * 1000;
		const sourceSeconds = (segment.durationInFrames * segment.playbackRate) / fps;
		const filters = [
			`aresample=${SAMPLE_RATE}`,
			'aformat=sample_fmts=fltp:channel_layouts=stereo',
			`atrim=start=${num(segment.sourceStartSeconds)}:duration=${num(sourceSeconds)}`,
			'asetpts=PTS-STARTPTS',
			...tempoFilters(segment.playbackRate),
			...volumeFilters(segment.volume, fps),
			...(delayMs > 0 ? [`adelay=${num(delayMs)}:all=1`] : [])
		];
		return `[${firstInput + i}:a]${filters.join(',')}[a${i}]`;
	});

	const total = num(totalFrames / fps);
	const totalSamples = Math.round((totalFrames / fps) * SAMPLE_RATE);
	const mix =
		segments.length === 1
			? '[a0]'
			: `${segments.map((_, i) => `[a${i}]`).join('')}amix=inputs=${segments.length}:normalize=0:duration=longest,`;
	// Pad short audio out to the video's length and cut anything that runs past it. The cut counts
	// samples: `atrim=end=<seconds>` goes by timestamps, which `adelay` leaves misaligned, and it
	// then removes real audio.
	const tail = `apad=whole_dur=${total},atrim=end_sample=${totalSamples}[aout]`;

	return [...chains, `${mix}${tail}`].join(';');
}

/** Check what came back from the page before trusting it. */
export function parseAudioManifest(value: unknown): AudioSegment[] {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value)) throw new Error('window.__Svelteframe.audio must be an array');

	return value.map((entry, i) => {
		const where = `audio manifest entry ${i}`;
		if (typeof entry !== 'object' || entry === null) throw new Error(`${where} is not an object`);
		const { src, startFrame, durationInFrames, sourceStartSeconds, playbackRate, volume } =
			entry as Record<string, unknown>;

		if (typeof src !== 'string' || src === '') throw new Error(`${where}: src must be a string`);
		for (const [name, v] of Object.entries({
			startFrame,
			durationInFrames,
			sourceStartSeconds,
			playbackRate
		})) {
			if (typeof v !== 'number' || !Number.isFinite(v)) {
				throw new Error(`${where}: ${name} must be a finite number`);
			}
		}
		const ok = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
		if (!(ok(volume) || (Array.isArray(volume) && volume.every(ok)))) {
			throw new Error(`${where}: volume must be a number or an array of numbers, not negative`);
		}
		return entry as AudioSegment;
	});
}

function runFfmpeg(args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
		let stderr = '';
		ffmpeg.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk).slice(-16 * 1024)));
		ffmpeg.once('error', reject);
		ffmpeg.once('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`))
		);
	});
}

/** Local path for a source URL, downloading it into `dir` if it is remote. */
async function localFile(src: string, dir: string, index: number): Promise<string> {
	const url = new URL(src);
	if (url.protocol === 'file:') return fileURLToPath(url);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`Unsupported audio source "${src}"`);
	}

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Could not fetch audio "${src}": HTTP ${response.status}`);
	}
	const file = join(dir, `source-${index}${extname(url.pathname)}`);
	await writeFile(file, Buffer.from(await response.arrayBuffer()));
	return file;
}

export interface MuxOptions {
	/** The finished video, without sound. */
	videoPath: string;
	/** Where to write the result. May equal `videoPath`. */
	output: string;
	segments: AudioSegment[];
	fps: number;
	totalFrames: number;
}

/** Mix the segments and add them to the video without re-encoding the picture. */
export async function muxAudio({
	videoPath,
	output,
	segments,
	fps,
	totalFrames
}: MuxOptions): Promise<void> {
	const dir = await mkdtemp(join(tmpdir(), 'svelteframe-audio-'));
	// Next to the output so the final rename stays on one filesystem.
	const muxed = join(dirname(output), `.svelteframe-${process.pid}-${basename(output)}`);
	try {
		const files = new Map<string, string>();
		for (const { src } of segments) {
			if (!files.has(src)) files.set(src, await localFile(src, dir, files.size));
		}

		await runFfmpeg([
			'-hide_banner',
			'-loglevel',
			'error',
			'-y',
			'-i',
			videoPath,
			...segments.flatMap((segment) => ['-i', files.get(segment.src)!]),
			'-filter_complex',
			buildAudioFilter(segments, { fps, totalFrames }),
			'-map',
			'0:v',
			'-map',
			'[aout]',
			'-c:v',
			'copy',
			'-c:a',
			'aac',
			'-b:a',
			'192k',
			muxed
		]);
		await rename(muxed, output);
	} finally {
		await unlink(muxed).catch(() => {});
		await rm(dir, { recursive: true, force: true });
	}
}
