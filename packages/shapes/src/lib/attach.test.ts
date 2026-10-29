// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { VideoState, waitUntilReady } from '@svelteframe/core';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AttachHarness from './AttachHarness.test.svelte';
import { Arrow, Line } from './index.js';
import { Registry } from './registry.svelte.js';

const makeVideo = () => new VideoState({ fps: 30, width: 1920, height: 1080, durationInFrames: 90 });
const mount = (props: Record<string, unknown> = {}, video = makeVideo()) => render(AttachHarness, { video, ...props });
const attrs = (element: Element | null) => Object.fromEntries([...(element?.attributes ?? [])].map((a) => [a.name, a.value]));
/** The arrow is the last group on the canvas; its line is drawn relative to the group's position. */
const lastGroup = (container: HTMLElement) => [...container.querySelectorAll('svg > g')].at(-1)!;

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe('an arrow attached to shapes by id', () => {
	it('runs between the points it names', async () => {
		const { container } = mount();
		await waitUntilReady();
		// card.right is (300, 150) and dot.left is (550, 150).
		const group = lastGroup(container);
		expect(group.getAttribute('transform')).toBe('translate(300 150)');
		expect(attrs(group.querySelector('line'))).toMatchObject({ x1: '0', y1: '0', x2: '250', y2: '0' });
	});

	it('meets the edges of the shapes when only ids are given', async () => {
		const { container } = mount({ from: 'card', to: 'dot' });
		await waitUntilReady();
		const group = lastGroup(container);
		expect(group.getAttribute('transform')).toBe('translate(300 150)');
		expect(attrs(group.querySelector('line'))).toMatchObject({ x2: '250' });
	});

	it('leaves a gap, moves an end, and ends in a head', async () => {
		const gapped = mount({ from: 'card', to: 'dot', gap: 20 });
		await waitUntilReady();
		expect(attrs(lastGroup(gapped.container).querySelector('line'))).toMatchObject({ x2: '210' });
		expect(lastGroup(gapped.container).getAttribute('transform')).toBe('translate(320 150)');
		gapped.unmount();

		const moved = mount({ from: { id: 'card', anchor: 'bottom', dy: 20 }, to: 'dot.top' });
		await waitUntilReady();
		expect(lastGroup(moved.container).getAttribute('transform')).toBe('translate(200 100)');
		moved.unmount();

		const headed = mount({ heads: 'end' });
		await waitUntilReady();
		expect(lastGroup(headed.container).querySelectorAll('polygon')).toHaveLength(1);
	});

	it('is right even when it comes before the shapes in the markup', async () => {
		const first = mount({ arrowFirst: true });
		await waitUntilReady();
		const second = mount();
		await waitUntilReady();
		const a = [...first.container.querySelectorAll('svg > g')].find((g) => g.querySelector('line'))!;
		const b = lastGroup(second.container);
		expect(a.getAttribute('transform')).toBe(b.getAttribute('transform'));
		expect(a.querySelector('line')!.outerHTML).toBe(b.querySelector('line')!.outerHTML);
	});

	it('follows a shape that moves', async () => {
		const video = makeVideo();
		const { container } = mount({ slide: true }, video);
		await waitUntilReady();
		expect(lastGroup(container).getAttribute('transform')).toBe('translate(300 150)');

		video.frame = 10; // the card is 100 pixels further on
		flushSync();
		await waitUntilReady();
		expect(lastGroup(container).getAttribute('transform')).toBe('translate(400 150)');
		expect(attrs(lastGroup(container).querySelector('line'))).toMatchObject({ x2: '150' });
	});

	it('draws a line the same way', async () => {
		const { container } = mount({ line: true, from: 'card.top', to: 'dot.top' });
		await waitUntilReady();
		const group = lastGroup(container);
		// (200, 100) to (600, 100).
		expect(group.getAttribute('transform')).toBe('translate(200 100)');
		expect(attrs(group.querySelector('line'))).toMatchObject({ x2: '400', y2: '0' });
	});

	it('draws nothing, and fails the render, naming the id and the ones there are', async () => {
		mount({ to: 'dott.left' });
		await expect(waitUntilReady()).rejects.toThrow(/<Arrow> is attached to "dott", but no shape has that id\. Shapes with an id: card, dot\./);
	});

	it('names every missing id', async () => {
		mount({ from: 'a', to: 'b' });
		await expect(waitUntilReady()).rejects.toThrow('"a", "b", but no shape has those ids');
	});

	it('fails when its shape goes away', async () => {
		const { rerender } = mount({ from: 'card.top', to: 'dot.top' });
		await waitUntilReady();
		await rerender({ video: makeVideo(), showCard: false, from: 'card.top', to: 'dot.top' });
		await expect(waitUntilReady()).rejects.toThrow(/attached to "card"/);
	});

	it('rejects an anchor that does not exist', () => {
		expect(() => mount({ from: 'card.botom' })).toThrow(/Unknown anchor "botom"/);
	});
});

describe('shape ids', () => {
	it('must be unique in a canvas', () => {
		expect(() => mount({ duplicate: true })).toThrow('Two shapes have the id "card"');
	});

	it('are of no use without a canvas', () => {
		expect(() => render(Arrow, { from: 'card', to: [1, 1] })).toThrow(/<Arrow> is attached to "card", which needs a <Canvas>/);
		expect(() => render(Line, { from: [0, 0], to: 'dot.top' })).toThrow(/<Line> is attached to "dot"/);
	});

	it('still let an arrow outside a canvas use points', () => {
		const { container } = render(Arrow, { from: [0, 0], to: [100, 0] });
		expect(container.querySelector('svg')).not.toBeNull();
	});
});

describe('Registry', () => {
	const geometry = () => ({ width: 1, height: 1, outline: { kind: 'box' as const }, placement: {} });

	it('finds shapes by id, and forgets them', () => {
		const registry = new Registry();
		const a = geometry;
		registry.register('a', a);
		expect(registry.find('a')).toMatchObject({ width: 1 });
		expect(registry.ids).toEqual(['a']);
		registry.unregister('a', a);
		expect(registry.find('a')).toBeUndefined();
	});

	it('does not forget a shape that took the id over', () => {
		const registry = new Registry();
		const first = geometry;
		const second = () => geometry();
		registry.register('a', first);
		registry.unregister('a', first);
		registry.register('a', second);
		registry.unregister('a', first);
		expect(registry.ids).toEqual(['a']);
	});

	it('rejects duplicates and bad ids', () => {
		const registry = new Registry();
		registry.register('a', geometry);
		expect(() => registry.register('a', geometry)).toThrow('Two shapes have the id "a"');
		expect(() => registry.register('a.b', geometry)).toThrow('Invalid shape id');
	});
});
