<script lang="ts">
	import { compositions } from '#lib/compositions/index.js';
</script>

<svelte:head>
	<title>Svelteframe playground</title>
</svelte:head>

<main>
	<h1>Svelteframe playground</h1>
	<p class="lead">Pick a composition to preview it. Each is also a render target at <code>/render/&lt;id&gt;</code>.</p>

	<ul>
		{#each compositions as c (c.id)}
			<li>
				<a class="title" href="/preview/{c.id}">{c.id}</a>
				<span class="meta">
					{c.width}×{c.height} · {c.fps} fps · {c.durationInFrames} frames ({(
						c.durationInFrames / c.fps
					).toFixed(1)}s)
				</span>
				<code>pnpm render --url http://localhost:5173 --composition {c.id} --out {c.id}.mp4</code>
			</li>
		{/each}
	</ul>
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
	.lead {
		opacity: 0.7;
		font-size: 14px;
	}
	ul {
		list-style: none;
		margin: 24px 0 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	li {
		display: grid;
		gap: 4px;
		padding: 14px 16px;
		background: #15171c;
		border-radius: 8px;
	}
	.title {
		font-size: 17px;
		font-weight: 600;
	}
	.meta {
		font-size: 13px;
		opacity: 0.7;
	}
	code {
		font-size: 12px;
		opacity: 0.8;
		overflow-wrap: anywhere;
	}
	a {
		color: #8ab4ff;
	}
</style>
