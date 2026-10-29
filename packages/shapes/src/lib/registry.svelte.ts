import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { assertShapeId, type ShapeGeometry } from './connect.js';

/**
 * The shapes of a `<Canvas>` that have an `id`, so lines and arrows can attach to them. A shape is
 * registered as soon as it is created, from its props alone, so an arrow is right on the first
 * frame, wherever in the markup the shape is.
 */
export class Registry {
	#shapes = new SvelteMap<string, () => ShapeGeometry>();

	/** `geometry` is read again whenever what it reads changes, so a moving shape is followed. */
	register(id: string, geometry: () => ShapeGeometry): void {
		assertShapeId(id);
		if (this.#shapes.has(id)) throw new Error(`Two shapes have the id "${id}": ids must be unique within a <Canvas>`);
		this.#shapes.set(id, geometry);
	}

	/** Forget a shape, unless another one has taken its id since. */
	unregister(id: string, geometry: () => ShapeGeometry): void {
		if (this.#shapes.get(id) === geometry) this.#shapes.delete(id);
	}

	find = (id: string): ShapeGeometry | undefined => this.#shapes.get(id)?.();

	/** The ids there are now. */
	get ids(): string[] {
		return [...this.#shapes.keys()];
	}
}

const CANVAS_KEY = Symbol('svelteframe.shapes.canvas');

/** Provided by `<Canvas>`: shapes inside it are placed in composition pixels. */
export function setCanvas(): Registry {
	const registry = new Registry();
	setContext(CANVAS_KEY, registry);
	return registry;
}

/** The enclosing `<Canvas>`'s shapes, or `undefined` outside one. */
export function useCanvas(): Registry | undefined {
	return getContext<Registry | undefined>(CANVAS_KEY);
}
