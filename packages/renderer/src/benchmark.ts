/** The numbers worth comparing between two renders of the same video. */
export interface BenchmarkRun {
	concurrency: number;
	frames: number;
	/** Time spent rendering frames. */
	renderMs: number;
	/** Everything, including starting the browser and mixing audio. */
	wallMs: number;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const fps = (run: BenchmarkRun) => run.frames / (run.renderMs / 1000);

const line = (label: string, run: BenchmarkRun) =>
	`  ${label.padEnd(12)} ${seconds(run.renderMs).padStart(7)} rendering  ${fps(run).toFixed(1).padStart(7)} fps   (${seconds(run.wallMs)} in total)`;

/** A short report comparing a single-threaded run (before) with a parallel one (after). */
export function formatBenchmark(before: BenchmarkRun, after: BenchmarkRun): string {
	const speedup = fps(after) / fps(before);
	const outcome =
		after.concurrency === before.concurrency
			? 'Nothing to compare: both runs used the same number of workers.'
			: speedup >= 1
				? `${speedup.toFixed(2)}x faster with ${after.concurrency} workers`
				: `${(1 / speedup).toFixed(2)}x slower with ${after.concurrency} workers`;

	return [
		`Benchmark, ${before.frames} frames:`,
		line(`${before.concurrency} worker${before.concurrency === 1 ? '' : 's'}`, before),
		line(`${after.concurrency} worker${after.concurrency === 1 ? '' : 's'}`, after),
		`  ${outcome}`
	].join('\n');
}
