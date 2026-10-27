<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	// Lets the renderer fail with the real reason instead of waiting for a bridge that never appears.
	onMount(() => {
		window.__SvelteframeError = page.error?.message ?? `HTTP ${page.status}`;
	});
</script>

<main>
	<h1>{page.status}</h1>
	<p>{page.error?.message}</p>
	<p><a href="/">← All compositions</a></p>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0b0c0f;
		color: #e6e6e6;
		font-family: system-ui, sans-serif;
	}
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 32px 16px;
	}
	a {
		color: #8ab4ff;
	}
</style>
