// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Player from './Player.svelte';
import PlayerProbe from './PlayerProbe.test.svelte';
import PropsProbe from './PropsProbe.test.svelte';

const base = { component: PlayerProbe, fps: 30, width: 320, height: 180, durationInFrames: 90 };
const probe = () => Number(screen.getByTestId('probe').textContent);
const player = () => screen.getByRole('application');

describe('Player', () => {
	beforeEach(() => {
		// jsdom has no ResizeObserver, which Svelte's `bind:clientWidth` relies on.
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			}
		);
		vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('renders the root component at frame 0 with controls', () => {
		render(Player, base);
		expect(probe()).toBe(0);
		expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
		expect(screen.getByRole('slider').getAttribute('max')).toBe('89');
		expect(screen.getByText('0:00.00 / 0:03.00')).toBeTruthy();
	});

	it('hides controls when controls = false', () => {
		render(Player, { ...base, controls: false });
		expect(screen.queryByRole('slider')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('steps frames with the arrow keys, Shift for one second, clamped to range', async () => {
		render(Player, base);
		await fireEvent.keyDown(player(), { key: 'ArrowRight' });
		expect(probe()).toBe(1);
		await fireEvent.keyDown(player(), { key: 'ArrowRight', shiftKey: true });
		expect(probe()).toBe(31);
		await fireEvent.keyDown(player(), { key: 'ArrowLeft' });
		expect(probe()).toBe(30);
		await fireEvent.keyDown(player(), { key: 'ArrowLeft', shiftKey: true });
		await fireEvent.keyDown(player(), { key: 'ArrowLeft', shiftKey: true });
		expect(probe()).toBe(0);
		for (let i = 0; i < 4; i++) await fireEvent.keyDown(player(), { key: 'ArrowRight', shiftKey: true });
		expect(probe()).toBe(89);
	});

	it('seeks with the scrubber', async () => {
		render(Player, base);
		await fireEvent.input(screen.getByRole('slider'), { target: { value: '42' } });
		expect(probe()).toBe(42);
		expect(screen.getByText('frame 42')).toBeTruthy();
	});

	it('plays at real speed, independent of refresh rate, and toggles with Space', async () => {
		render(Player, base);
		await fireEvent.keyDown(player(), { key: ' ' });
		expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();

		await vi.advanceTimersByTimeAsync(1000);
		flushSync();
		expect(probe()).toBeGreaterThanOrEqual(28);
		expect(probe()).toBeLessThanOrEqual(30);

		await fireEvent.keyDown(player(), { key: ' ' });
		const paused = probe();
		await vi.advanceTimersByTimeAsync(500);
		expect(probe()).toBe(paused);
	});

	it('loops when loop = true', async () => {
		render(Player, { ...base, autoplay: true });
		await vi.advanceTimersByTimeAsync(3500);
		flushSync();
		expect(probe()).toBeGreaterThanOrEqual(10);
		expect(probe()).toBeLessThanOrEqual(20);
		expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
	});

	it('stops on the last frame when loop = false, and replays from the start', async () => {
		render(Player, { ...base, autoplay: true, loop: false });
		await vi.advanceTimersByTimeAsync(3500);
		flushSync();
		expect(probe()).toBe(89);
		expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
		expect(probe()).toBe(0);
		expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
	});

	it('passes inputProps to the root component', () => {
		render(Player, {
			...base,
			component: PropsProbe,
			inputProps: { title: 'Hello', count: 3 }
		});
		expect(screen.getByTestId('probe').textContent).toBe('Hello|3|0');
	});

	it('updates the root component when inputProps change', async () => {
		const { rerender } = render(Player, {
			...base,
			component: PropsProbe,
			inputProps: { title: 'One', count: 1 }
		});
		await rerender({ ...base, component: PropsProbe, inputProps: { title: 'Two', count: 2 } });
		expect(screen.getByTestId('probe').textContent).toBe('Two|2|0');
	});

	it('toggles playback when the stage is clicked', async () => {
		const { container } = render(Player, base);
		await fireEvent.click(container.querySelector('.sf-stage')!);
		expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
	});
});
