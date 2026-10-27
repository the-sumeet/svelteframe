<script lang="ts">
	import { Composition, VideoState } from '@svelteframe/core';
	import { onMount } from 'svelte';
	import { exposeBridge } from '#lib/bridge.js';
	import { getComposition } from '#lib/compositions/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The route renders one composition for its whole lifetime, so reading `data` once is intended.
	// svelte-ignore state_referenced_locally
	const { id, props: inputProps, metadata } = data;
	const Root = getComposition(id)!.component;
	const video = new VideoState(metadata);

	onMount(() => exposeBridge(video, metadata));
</script>

<svelte:head>
	<title>Svelteframe render: {id}</title>
</svelte:head>

<Composition {video} mode="render">
	<Root {...inputProps} />
</Composition>

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;
	}
</style>
