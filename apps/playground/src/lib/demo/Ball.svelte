<script lang="ts">
	import { spring, useVideo } from '@svelteframe/core';

	let { damping = 8, color = '#ff3e00' }: { damping?: number; color?: string } = $props();

	const video = useVideo();
	const scale = $derived(spring({ frame: video.frame, fps: video.fps, config: { damping } }));
</script>

<div
	style="width:220px;height:220px;border-radius:50%;background:{color};transform:scale({scale})"
></div>
