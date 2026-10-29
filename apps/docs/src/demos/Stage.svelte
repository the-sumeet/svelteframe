<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AbsoluteFill } from '@svelteframe/core';

	/** The backdrop every demo shares, so the examples can focus on what they show. */
	let { children, style = '' }: { children?: Snippet; style?: string } = $props();
</script>

<AbsoluteFill
	style="background:#0f1722;color:#fff;font-family:system-ui,sans-serif;align-items:center;justify-content:center;{style}"
>
	{@render children?.()}
</AbsoluteFill>
