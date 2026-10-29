<script lang="ts">
	import { interpolate, useVideo } from '@svelteframe/core';

	let { color }: { color: string } = $props();
	const video = useVideo();
	// 0 → 1 → 0 over 20 frames.
	const scale = $derived(interpolate(video.frame, [0, 10, 20], [0.6, 1.2, 0.6]));
</script>

<div style="width:180px;height:180px;margin:auto;border-radius:50%;background:{color};transform:scale({scale})"></div>
<p style="font-size:22px;margin:18px 0 0;text-align:center">frame {Math.round(video.frame)}</p>
