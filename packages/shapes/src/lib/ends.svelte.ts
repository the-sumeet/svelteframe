import { delayRender, failRender } from '@svelteframe/core';
import { useCanvas } from './registry.svelte.js';
import { parseEnd, resolveEnds, type End } from './connect.js';
import type { Point } from './geometry.js';

/**
 * The two ends of a line or arrow on the canvas, following the shapes they are attached to.
 * Call while a component is created. `ends.points` is `undefined` until every shape they name
 * exists; one that never does fails the render, naming it and the ids there are.
 */
export function useEnds(component: string, from: () => End, to: () => End, gap: () => number | undefined) {
	const canvas = useCanvas();

	const resolved = $derived.by(() => {
		const [a, b] = [from(), to()];
		if (!canvas) {
			// Without a canvas there are no shapes to find, only points.
			for (const end of [a, b]) {
				const parsed = parseEnd(end);
				if (parsed.kind === 'shape') {
					throw new Error(`<${component}> is attached to "${parsed.id}", which needs a <Canvas> around them to be found`);
				}
			}
		}
		return resolveEnds(a, b, { find: canvas?.find ?? (() => undefined), gap: gap() });
	});

	// Checked after the whole canvas is created, so a shape may come after the arrow in the markup.
	$effect(() => {
		const { missing } = resolved;
		if (missing.length === 0) return;
		const known = canvas?.ids ?? [];
		const names = missing.map((id) => `"${id}"`).join(', ');
		const handle = delayRender(`<${component}> shapes`);
		failRender(
			handle,
			new Error(
				`<${component}> is attached to ${names}, but no shape has ${missing.length === 1 ? 'that id' : 'those ids'}. ` +
					(known.length > 0 ? `Shapes with an id: ${known.join(', ')}.` : 'No shape has an id: give one with the id prop.')
			)
		);
	});

	return {
		get points(): readonly [Point, Point] | undefined {
			return resolved.points;
		}
	};
}
