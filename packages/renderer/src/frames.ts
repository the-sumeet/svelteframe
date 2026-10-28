import { cpus } from 'node:os';

/** A run of consecutive frames: `start` is included, `end` is not. */
export interface FrameRange {
	start: number;
	end: number;
}

/** Half the cores: each worker is a browser page plus an ffmpeg, which both want CPU. */
export function defaultConcurrency(cpuCount: number = cpus().length): number {
	return Math.max(1, Math.floor(cpuCount / 2));
}

/** The number of workers to use: what was asked for (or the default), never more than frames. */
export function resolveConcurrency(
	requested: number | undefined,
	totalFrames: number,
	cpuCount?: number
): number {
	if (requested !== undefined && (!Number.isInteger(requested) || requested < 1)) {
		throw new Error(`concurrency must be a positive integer, got ${requested}`);
	}
	return Math.min(requested ?? defaultConcurrency(cpuCount), Math.max(1, totalFrames));
}

/**
 * Split `total` frames into `parts` contiguous ranges that differ in size by at most one
 * (the earlier ranges take the extra frames). Asking for more parts than frames gives one
 * frame per range.
 */
export function splitFrames(total: number, parts: number): FrameRange[] {
	if (!Number.isInteger(total) || total < 1) {
		throw new Error(`total frames must be a positive integer, got ${total}`);
	}
	if (!Number.isInteger(parts) || parts < 1) {
		throw new Error(`parts must be a positive integer, got ${parts}`);
	}

	const count = Math.min(parts, total);
	const base = Math.floor(total / count);
	const extra = total % count;

	const ranges: FrameRange[] = [];
	let start = 0;
	for (let i = 0; i < count; i++) {
		const end = start + base + (i < extra ? 1 : 0);
		ranges.push({ start, end });
		start = end;
	}
	return ranges;
}
