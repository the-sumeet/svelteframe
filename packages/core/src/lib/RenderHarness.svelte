<script lang="ts">
	import type { Component } from 'svelte';
	import { onMount } from 'svelte';
	import Composition from './Composition.svelte';
	import { exposeBridge } from './bridge.js';
	import { VideoState } from './video.svelte.js';
	import type { CompositionMetadata } from './composition.js';

	interface Props {
		component: Component<any>;
		props?: Record<string, unknown>;
		metadata: CompositionMetadata;
	}

	let { component: Root, props = {}, metadata }: Props = $props();
	// svelte-ignore state_referenced_locally
	const video = new VideoState(metadata);

	onMount(() => exposeBridge(video, metadata));
</script>

<Composition {video} mode="render">
	<Root {...props} />
</Composition>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
</style>
