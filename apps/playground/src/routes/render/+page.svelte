<script lang="ts">
	import { Composition, VideoState } from '@svelteframe/core';
	import { onMount, tick } from 'svelte';
	import Main, { config } from '#lib/compositions/Main.svelte';

	const video = new VideoState(config);

	onMount(() => {
		const initial = Number(new URLSearchParams(location.search).get('frame'));
		if (Number.isInteger(initial) && initial >= 0) video.frame = initial;

		window.__Svelteframe = {
			config,
			ready: true,
			async setFrame(n) {
				video.frame = n;
				await tick();
			}
		};

		return () => {
			delete window.__Svelteframe;
		};
	});
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
