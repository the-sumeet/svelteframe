import type { Component } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { defineComposition, resolveComposition } from './composition.js';

// Only the definition's data is under test, so a stand-in component is enough.
const component = (() => {}) as unknown as Component<{ title: string; seconds: number }>;

const base = { id: 'intro', component, fps: 30, width: 1920, height: 1080, durationInFrames: 150 };

describe('defineComposition', () => {
	it('keeps the configuration and defaults props to an empty object', () => {
		const def = defineComposition({ ...base, component: component as Component<any> });
		expect(def).toMatchObject({ id: 'intro', fps: 30, width: 1920, height: 1080, durationInFrames: 150 });
		expect(def.defaultProps).toEqual({});
	});

	it('keeps provided defaultProps and calculateMetadata', () => {
		const calculateMetadata = () => ({});
		const def = defineComposition({
			...base,
			defaultProps: { title: 'Hi', seconds: 3 },
			calculateMetadata
		});
		expect(def.defaultProps).toEqual({ title: 'Hi', seconds: 3 });
		expect(def.calculateMetadata).toBe(calculateMetadata);
	});

	it('accepts url-safe ids only', () => {
		for (const id of ['a', 'my-video', 'my_video', 'Video2']) {
			expect(() => defineComposition({ ...base, id })).not.toThrow();
		}
		for (const id of ['', 'has space', 'a/b', 'a?b', 'ünï']) {
			expect(() => defineComposition({ ...base, id })).toThrow(/id/);
		}
	});

	it('validates the declared metadata', () => {
		expect(() => defineComposition({ ...base, fps: 0 })).toThrow(/fps/);
		expect(() => defineComposition({ ...base, fps: NaN })).toThrow(/fps/);
		expect(() => defineComposition({ ...base, width: 0 })).toThrow(/width/);
		expect(() => defineComposition({ ...base, height: 10.5 })).toThrow(/height/);
		expect(() => defineComposition({ ...base, durationInFrames: -1 })).toThrow(/durationInFrames/);
		expect(() => defineComposition({ ...base, fps: 29.97 })).not.toThrow();
	});
});

describe('resolveComposition', () => {
	const def = defineComposition({
		...base,
		defaultProps: { title: 'Default', seconds: 3 },
		calculateMetadata: ({ props }) => ({ durationInFrames: props.seconds * 30 })
	});

	it('merges input props over the defaults', async () => {
		const { props } = await resolveComposition(def, { title: 'Custom' });
		expect(props).toEqual({ title: 'Custom', seconds: 3 });
	});

	it('uses the defaults when there are no input props', async () => {
		expect((await resolveComposition(def)).props).toEqual({ title: 'Default', seconds: 3 });
	});

	it('does not mutate the defaults', async () => {
		await resolveComposition(def, { title: 'Custom' });
		expect(def.defaultProps).toEqual({ title: 'Default', seconds: 3 });
	});

	it('passes through props the defaults do not know about', async () => {
		const { props } = await resolveComposition(def, { extra: true });
		expect(props).toMatchObject({ extra: true });
	});

	it('lets calculateMetadata override the declared metadata using the final props', async () => {
		const { metadata } = await resolveComposition(def, { seconds: 10 });
		expect(metadata).toEqual({ fps: 30, width: 1920, height: 1080, durationInFrames: 300 });
	});

	it('keeps the declared metadata when nothing is overridden', async () => {
		const plain = defineComposition(base);
		expect((await resolveComposition(plain)).metadata).toEqual({
			fps: 30,
			width: 1920,
			height: 1080,
			durationInFrames: 150
		});
	});

	it('supports an async calculateMetadata', async () => {
		const calculateMetadata = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return { width: 1080, height: 1920 };
		});
		const portrait = defineComposition({ ...base, calculateMetadata });
		const { metadata } = await resolveComposition(portrait);
		expect(metadata).toMatchObject({ width: 1080, height: 1920, durationInFrames: 150 });
		expect(calculateMetadata).toHaveBeenCalledOnce();
	});

	it('rejects invalid metadata from calculateMetadata, naming the composition', async () => {
		const broken = defineComposition({ ...base, calculateMetadata: () => ({ durationInFrames: 0 }) });
		await expect(resolveComposition(broken)).rejects.toThrow(/"intro" calculateMetadata.*durationInFrames/);
	});

	it('propagates errors thrown by calculateMetadata', async () => {
		const failing = defineComposition({
			...base,
			calculateMetadata: () => {
				throw new Error('no data');
			}
		});
		await expect(resolveComposition(failing)).rejects.toThrow('no data');
	});
});
