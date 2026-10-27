<script lang="ts">
	import { Player } from '@svelteframe/core';
	import AsyncDemo, { config as asyncConfig } from '#lib/compositions/AsyncDemo.svelte';
	import Primitives, { config } from '#lib/compositions/Primitives.svelte';
</script>

<svelte:head>
	<title>Svelteframe primitives demo</title>
</svelte:head>

<main>
	<h1>Primitives demo</h1>
	<Player component={Primitives} {...config} />
	<p>
		<code>spring</code>, <code>Series</code>, <code>Loop</code>, <code>Freeze</code> and
		<code>random</code> · <a href="/">Back to the intro video</a>
	</p>

	<h1>Async demo</h1>
	<Player component={AsyncDemo} {...asyncConfig} />
	<p>
		<code>Img</code> and <code>delayRender</code>. Rendered with
		<code>/render/async</code>, every frame waits for its image and data.
	</p>
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
	h1 {
		font-size: 20px;
		font-weight: 600;
	}
	p {
		opacity: 0.7;
		font-size: 13px;
	}
	a {
		color: #8ab4ff;
	}
</style>
