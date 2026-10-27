<script lang="ts">
	import { Composition, VideoState } from '@svelteframe/core';
	import { onMount } from 'svelte';
	import AsyncDemo, { config } from '#lib/compositions/AsyncDemo.svelte';
	import { exposeBridge } from '#lib/bridge.js';

	const video = new VideoState(config);

	onMount(() => exposeBridge(video, config));
</script>

<svelte:head>
	<title>Svelteframe render: async</title>
</svelte:head>

<Composition {video}>
	<AsyncDemo />
</Composition>

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;
	}
</style>
