<script lang="ts">
	import { Player } from '@svelteframe/core';
	import { demos } from '../demos/index.js';

	interface Props {
		/** Which demo composition to play: a key of `demos`. */
		name: string;
		/** Input props for the composition, when it takes any. */
		props?: Record<string, unknown>;
		autoplay?: boolean;
		loop?: boolean;
	}

	let { name, props, autoplay = false, loop = true }: Props = $props();

	const demo = $derived(demos[name]);
</script>

{#if demo}
	<figure class="demo not-content">
		<Player
			component={demo.component}
			inputProps={props ?? demo.props}
			fps={demo.fps}
			width={demo.width}
			height={demo.height}
			durationInFrames={demo.durationInFrames}
			{autoplay}
			{loop}
		/>
		<figcaption>Live preview. Space plays and pauses, the arrow keys step through frames.</figcaption>
	</figure>
{:else}
	<p class="demo-missing">No demo named “{name}”.</p>
{/if}

<style>
	.demo {
		margin: 1.5rem 0;
	}
	figcaption {
		margin-top: 0.5rem;
		font-size: var(--sl-text-xs);
		color: var(--sl-color-gray-3);
	}
	.demo-missing {
		color: var(--sl-color-red);
	}
</style>
