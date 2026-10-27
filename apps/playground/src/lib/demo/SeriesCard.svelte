<script lang="ts">
	import { AbsoluteFill } from '@svelteframe/core';
	import Ball from './Ball.svelte';

	let { label, background, color }: { label: string; background: string; color: string } =
		$props();
</script>

<AbsoluteFill
	style="background:{background};align-items:center;justify-content:center;gap:48px;font-family:system-ui,sans-serif"
>
	<Ball {color} />
	<h2 style="margin:0;color:#fff;font-size:72px;font-weight:600">{label}</h2>
</AbsoluteFill>
