<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useVideo } from '@svelteframe/core';
	import { setCanvas } from './registry.svelte.js';

	interface Props {
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { class: className, style = '', children }: Props = $props();

	const video = useVideo();
	setCanvas();
</script>

<!-- One user unit is one pixel of the composition, with the origin at the top-left. Like a
     <Sequence>, it fills its nearest positioned parent. -->
<svg
	class={className}
	width={video.width}
	height={video.height}
	viewBox="0 0 {video.width} {video.height}"
	style="position:absolute;inset:0;{style}"
	aria-hidden="true"
>
	{@render children?.()}
</svg>
