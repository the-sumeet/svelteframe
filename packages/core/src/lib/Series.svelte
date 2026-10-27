<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SeriesState, setSeries } from './series.svelte.js';

	let { children }: { children: Snippet } = $props();

	setSeries(new SeriesState());
</script>

{@render children()}
