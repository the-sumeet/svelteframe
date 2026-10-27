<script lang="ts">
	import { Player } from '@svelteframe/core';
	import Main, { config } from '#lib/compositions/Main.svelte';
</script>

<svelte:head>
	<title>Svelteframe playground</title>
</svelte:head>

<main>
	<h1>Svelteframe playground</h1>
	<div class="player">
		<Player component={Main} {...config} />
	</div>
	<p>
		Space: play/pause · ←/→: ±1 frame · Shift+←/→: ±1 second ·
		<a href="/demo">Primitives demo</a>
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
		opacity: 0.6;
		font-size: 13px;
	}
	a {
		color: #8ab4ff;
	}
</style>
