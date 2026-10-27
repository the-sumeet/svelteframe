<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import ImgElement from './ImgElement.svelte';

	let { src, ...rest }: HTMLImgAttributes & { src: string } = $props();
</script>

<!-- Holds the render until the image has loaded; fails the render if it cannot load. -->
{#key src}
	<ImgElement {src} {...rest} />
{/key}
