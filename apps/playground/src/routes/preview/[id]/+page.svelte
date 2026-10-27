<script lang="ts">
	import { Player } from '@svelteframe/core';
	import { getComposition } from '#lib/compositions/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const Root = $derived(getComposition(data.id)!.component);
</script>

<svelte:head>
	<title>Preview: {data.id}</title>
</svelte:head>

<main>
	<p class="back"><a href="/">← All compositions</a></p>
	<h1>{data.id}</h1>
	<Player component={Root} inputProps={data.props} {...data.metadata} />
	<p class="hint">Space: play/pause · ←/→: ±1 frame · Shift+←/→: ±1 second</p>

	<h2>Props</h2>
	<pre>{JSON.stringify(data.props, null, 2)}</pre>
	<p class="hint">
		Override with <code>?props=</code> (base64url JSON), or render with
		<code>pnpm render --url {'<'}base url{'>'} --composition {data.id} --props props.json</code>.
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
		font-size: 22px;
		font-weight: 600;
	}
	h2 {
		font-size: 15px;
		margin-top: 28px;
	}
	pre {
		padding: 12px 16px;
		background: #15171c;
		border-radius: 6px;
		overflow: auto;
		font-size: 13px;
	}
	.hint,
	.back {
		opacity: 0.7;
		font-size: 13px;
	}
	a {
		color: #8ab4ff;
	}
</style>
