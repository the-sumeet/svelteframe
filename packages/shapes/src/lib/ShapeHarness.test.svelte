<script lang="ts">
	import type { Component } from 'svelte';
	import { Composition, type VideoState } from '@svelteframe/core';
	import Canvas from './Canvas.svelte';

	let {
		shape,
		shapeProps = {},
		video,
		canvas = true
	}: { shape: Component<any>; shapeProps?: Record<string, unknown>; video: VideoState; canvas?: boolean } = $props();

	const Shape = $derived(shape);
</script>

{#if canvas}
	<Composition {video}>
		<Canvas class="canvas" style="color:red">
			<Shape {...shapeProps} />
		</Canvas>
	</Composition>
{:else}
	<Shape {...shapeProps} />
{/if}
