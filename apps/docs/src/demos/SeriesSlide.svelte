<script lang="ts">
	import { AbsoluteFill, interpolate, useVideo } from '@svelteframe/core';

	let { title, color }: { title: string; color: string } = $props();
	const video = useVideo();
</script>

<AbsoluteFill style="align-items:center;justify-content:center;background:{color};opacity:{interpolate(video.frame, [0, 8], [0, 1])}">
	<h1 style="margin:0;font-size:120px;color:#0f1722">{title}</h1>
</AbsoluteFill>
