<script lang="ts">
	import { AbsoluteFill, continueRender, delayRender, failRender } from '@svelteframe/core';
	import { onMount } from 'svelte';

	interface Data {
		title: string;
		items: string[];
	}

	let data = $state<Data | null>(null);

	// Register while initialising so the render is held before this frame counts as drawn.
	const handle = delayRender('DataScene fetch');

	onMount(async () => {
		try {
			const response = await fetch('/api/slow?type=json&ms=500');
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			data = await response.json();
			continueRender(handle);
		} catch (error) {
			failRender(handle, new Error(`DataScene fetch failed: ${error}`));
		}
	});

	// Releasing twice is harmless; this covers the scene being removed mid-fetch.
	$effect(() => () => continueRender(handle));
</script>

<AbsoluteFill
	style="background:#12301f;align-items:center;justify-content:center;gap:32px;font-family:system-ui,sans-serif;color:#fff"
>
	{#if data}
		<h2 style="margin:0;font-size:84px;font-weight:600">{data.title}</h2>
		<ul style="margin:0;padding:0;list-style:none;font-size:56px;opacity:0.85;text-align:center">
			{#each data.items as item (item)}
				<li>{item}</li>
			{/each}
		</ul>
	{:else}
		<h2 style="margin:0;font-size:64px;opacity:0.6">Loading…</h2>
	{/if}
</AbsoluteFill>
