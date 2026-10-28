import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatBenchmark, type BenchmarkRun } from './benchmark.js';

const run = (overrides: Partial<BenchmarkRun>): BenchmarkRun => ({
	concurrency: 1,
	frames: 150,
	renderMs: 3000,
	wallMs: 4000,
	...overrides
});

describe('formatBenchmark', () => {
	it('shows fps before and after, and the speed-up', () => {
		const report = formatBenchmark(run({}), run({ concurrency: 4, renderMs: 1000, wallMs: 2000 }));
		assert.match(report, /Benchmark, 150 frames:/);
		assert.match(report, /1 worker\s+3\.0s rendering\s+50\.0 fps\s+\(4\.0s in total\)/);
		assert.match(report, /4 workers\s+1\.0s rendering\s+150\.0 fps\s+\(2\.0s in total\)/);
		assert.match(report, /3\.00x faster with 4 workers/);
	});

	it('says so when parallel is slower', () => {
		const report = formatBenchmark(run({ renderMs: 1000 }), run({ concurrency: 2, renderMs: 2000 }));
		assert.match(report, /2\.00x slower with 2 workers/);
	});

	it('does not claim a speed-up between identical worker counts', () => {
		assert.match(formatBenchmark(run({}), run({})), /Nothing to compare/);
	});
});
