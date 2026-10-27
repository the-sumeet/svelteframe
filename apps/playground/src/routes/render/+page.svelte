<script lang="ts">
	import { Composition, VideoState } from '@svelteframe/core';
	import { onMount } from 'svelte';
	import Main, { config } from '#lib/compositions/Main.svelte';
	import { exposeBridge } from '#lib/bridge.js';

	const video = new VideoState(config);

	onMount(() => exposeBridge(video, config));
</script>

<svelte:head>
	<title>Svelteframe render</title>
</svelte:head>

<Composition {video}>
	<Main />
</Composition>

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;
	}
</style>
