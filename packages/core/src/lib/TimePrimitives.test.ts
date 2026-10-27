// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import TimeHarness from './TimeHarness.test.svelte';
import { VideoState } from './video.svelte.js';

const makeVideo = () =>
	new VideoState({ fps: 30, width: 320, height: 180, durationInFrames: 100 });

const goTo = (video: VideoState, frame: number) => {
	video.frame = frame;
	flushSync();
};
const text = (id: string) => screen.queryByTestId(id)?.textContent ?? null;

describe('Series', () => {
	it('lays items out back to back', () => {
		const video = makeVideo();
		render(TimeHarness, { video, kind: 'series' });

		const visible = () => ['a', 'b', 'c'].filter((id) => text(id) !== null).join('');
		const expected: Array<[number, string]> = [
			[0, 'a'],
			[9, 'a'],
			[10, 'b'],
			[29, 'b'],
			[30, 'c'],
			[34, 'c'],
			[35, '']
		];
		for (const [frame, ids] of expected) {
			goTo(video, frame);
			expect(visible(), `frame ${frame}`).toBe(ids);
		}
	});

	it('gives each item a frame relative to its own start', () => {
		const video = makeVideo();
		render(TimeHarness, { video, kind: 'series' });
		goTo(video, 14);
		expect(text('b')).toBe('4/100');
		goTo(video, 33);
		expect(text('c')).toBe('3/100');
	});

	it('applies a positive offset as a gap before the item', () => {
		const video = makeVideo();
		render(TimeHarness, { video, kind: 'series', lastOffset: 5 });
		goTo(video, 32);
		expect(text('c')).toBeNull();
		goTo(video, 35);
		expect(text('c')).toBe('0/100');
	});

	it('applies a negative offset as an overlap with the previous item', () => {
		const video = makeVideo();
		render(TimeHarness, { video, kind: 'series', lastOffset: -3 });
		goTo(video, 27);
		expect(text('b')).not.toBeNull();
		expect(text('c')).toBe('0/100');
	});

	it('closes the gap when an item is removed', async () => {
		const video = makeVideo();
		const { rerender } = render(TimeHarness, { video, kind: 'series', showMiddle: true });
		goTo(video, 10);
		expect(text('b')).not.toBeNull();

		await rerender({ video, kind: 'series', showMiddle: false });
		goTo(video, 10);
		expect(text('b')).toBeNull();
		expect(text('c')).toBe('0/100');
	});
});

describe('Loop', () => {
	it('wraps the frame every durationInFrames and reports that duration', () => {
		const video = makeVideo();
		render(TimeHarness, { video, kind: 'loop' });
		const cases: Array<[number, string | null]> = [
			[4, null], // before the enclosing Sequence starts
			[5, '0/10'],
			[14, '9/10'],
			[15, '0/10'],
			[27, '2/10'],
			[99, '4/10']
		];
		for (const [frame, expected] of cases) {
			goTo(video, frame);
			expect(text('loop'), `frame ${frame}`).toBe(expected);
		}
	});

	it('does not affect siblings', () => {
		const video = makeVideo();
		render(TimeHarness, { video, kind: 'loop' });
		goTo(video, 27);
		expect(text('outside')).toBe('27/100');
	});
});

describe('Freeze', () => {
	it('always shows the frozen frame', () => {
		const video = makeVideo();
		render(TimeHarness, { video, kind: 'freeze' });
		for (const frame of [0, 20, 50, 99]) {
			goTo(video, frame);
			expect(text('frozen'), `frame ${frame}`).toBe('20/100');
		}
	});
});
