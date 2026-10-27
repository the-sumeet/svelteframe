// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import FrameProbe from './FrameProbe.test.svelte';
import SequenceHarness from './SequenceHarness.test.svelte';
import { VideoState } from './video.svelte.js';

const makeVideo = () =>
	new VideoState({ fps: 30, width: 320, height: 180, durationInFrames: 100 });

describe('Composition', () => {
	it('sizes its box from the video config', () => {
		const video = makeVideo();
		const { container } = render(SequenceHarness, { video });
		const box = container.firstElementChild as HTMLElement;
		expect(box.style.width).toBe('320px');
		expect(box.style.height).toBe('180px');
		expect(box.style.position).toBe('relative');
		expect(box.style.overflow).toBe('hidden');
	});

	it('provides the video to descendants', () => {
		const video = makeVideo();
		video.frame = 12;
		render(SequenceHarness, { video });
		expect(screen.getByTestId('root').textContent).toBe('12/100');
	});

	it('updates descendants when the frame changes', () => {
		const video = makeVideo();
		render(SequenceHarness, { video });
		video.frame = 40;
		flushSync();
		expect(screen.getByTestId('root').textContent).toBe('40/100');
	});
});

describe('useVideo', () => {
	it('throws a clear error outside a Composition', () => {
		expect(() => render(FrameProbe, { id: 'x' })).toThrow(/inside a <Composition>/);
	});
});

describe('Sequence', () => {
	it('renders children only while within [from, from + duration)', () => {
		const video = makeVideo();
		render(SequenceHarness, { video, from: 10, durationInFrames: 20 });
		const visible = () => screen.queryByTestId('seq') !== null;

		expect(visible()).toBe(false); // frame 0

		for (const [frame, expected] of [
			[9, false],
			[10, true],
			[29, true],
			[30, false],
			[99, false]
		] as const) {
			video.frame = frame;
			flushSync();
			expect(visible(), `frame ${frame}`).toBe(expected);
		}
	});

	it('gives children a frame relative to `from`', () => {
		const video = makeVideo();
		render(SequenceHarness, { video, from: 10, durationInFrames: 20 });
		video.frame = 15;
		flushSync();
		expect(screen.getByTestId('seq').textContent).toBe('5/100');
		video.frame = 29;
		flushSync();
		expect(screen.getByTestId('seq').textContent).toBe('19/100');
	});

	it('defaults to from = 0 with no end', () => {
		const video = makeVideo();
		render(SequenceHarness, { video });
		for (const frame of [0, 50, 99]) {
			video.frame = frame;
			flushSync();
			expect(screen.getByTestId('seq').textContent).toBe(`${frame}/100`);
		}
	});

	it('accumulates offsets when nested', () => {
		const video = makeVideo();
		render(SequenceHarness, { video, from: 10, nestedFrom: 5 });
		video.frame = 14;
		flushSync();
		expect(screen.queryByTestId('nested')).toBeNull();
		video.frame = 20;
		flushSync();
		expect(screen.getByTestId('nested').textContent).toBe('5/100');
	});

	it('fills its container absolutely', () => {
		const video = makeVideo();
		const { container } = render(SequenceHarness, { video, from: 0 });
		const fill = container.querySelector('[data-testid="seq"]')!.parentElement as HTMLElement;
		expect(fill.style.position).toBe('absolute');
		expect(fill.style.flexDirection).toBe('column');
	});
});
