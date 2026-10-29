<script lang="ts">
	import { Composition, type VideoState } from '@svelteframe/core';
	import type { End } from './connect.js';
	import Arrow from './Arrow.svelte';
	import Canvas from './Canvas.svelte';
	import Circle from './Circle.svelte';
	import Line from './Line.svelte';
	import Rect from './Rect.svelte';

	let {
		video,
		from = 'card.right',
		to = 'dot.left',
		gap,
		heads = 'none',
		line = false,
		arrowFirst = false,
		slide = false,
		duplicate = false,
		showCard = true
	}: {
		video: VideoState;
		from?: End;
		to?: End;
		gap?: number;
		heads?: 'none' | 'end' | 'start' | 'both';
		line?: boolean;
		arrowFirst?: boolean;
		slide?: boolean;
		duplicate?: boolean;
		showCard?: boolean;
	} = $props();

	// The card slides 10 pixels a frame when asked to.
	const cardX = $derived(slide ? 100 + video.frame * 10 : 100);
</script>

{#snippet connection()}
	{#if line}
		<Line {from} {to} {gap} stroke="white" />
	{:else}
		<Arrow {from} {to} {gap} {heads} stroke="white" />
	{/if}
{/snippet}

<Composition {video}>
	<Canvas>
		{#if arrowFirst}{@render connection()}{/if}
		{#if showCard}<Rect id="card" x={cardX} y={100} width={200} height={100} />{/if}
		<Circle id="dot" x={600} y={150} radius={50} anchor="center" />
		{#if duplicate}<Rect id="card" x={0} y={0} width={5} height={5} />{/if}
		{#if !arrowFirst}{@render connection()}{/if}
	</Canvas>
</Composition>
