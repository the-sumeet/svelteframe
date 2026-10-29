<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import { useCanvas } from './registry.svelte.js';
	import type { Outline, ShapeGeometry } from './connect.js';
	import { shapeTransform } from './geometry.js';
	import type { ShapeProps } from './types.js';

	/** Places a shape: in a `<Canvas>` as a group, otherwise as an element of its own. */
	interface Props extends Pick<ShapeProps, 'id' | 'x' | 'y' | 'anchor' | 'rotate' | 'scale' | 'origin' | 'class' | 'style'> {
		/** The size of the shape's box, before it is scaled. */
		width: number;
		height: number;
		/** Where its edge is, for arrows that attach to it. Defaults to the box. */
		outline?: Outline;
		children: Snippet;
	}

	let { id, width, height, outline = { kind: 'box' }, x, y, anchor, rotate, scale, origin, class: className, style, children }: Props = $props();

	const registry = useCanvas();
	const canvas = registry !== undefined;

	// Findable by id as soon as it exists, and as long as it does.
	// svelte-ignore state_referenced_locally
	if (registry && id !== undefined) {
		const name = id;
		const geometry = (): ShapeGeometry => ({ width, height, outline, placement: { x, y, anchor, rotate, scale, origin } });
		registry.register(name, geometry);
		onDestroy(() => registry.unregister(name, geometry));
	}

	// Elsewhere CSS positions the element, so only what the shape does to itself applies.
	const transform = $derived(
		shapeTransform({ width, height, anchor, rotate, scale, origin, ...(canvas ? { x, y } : {}) })
	);
</script>

{#if canvas}
	<g class={className} {style} transform={transform || undefined}>
		{@render children()}
	</g>
{:else}
	<!-- Overflow is visible so strokes, rotation and scaling are not cut off by the box. -->
	<svg class={className} {width} {height} viewBox="0 0 {width} {height}" style="display:block;overflow:visible;{style ?? ''}" aria-hidden="true">
		<g transform={transform || undefined}>
			{@render children()}
		</g>
	</svg>
{/if}
