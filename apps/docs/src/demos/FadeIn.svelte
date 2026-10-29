<script lang="ts">
	import { interpolate, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	const video = useVideo();
	// 0 at frame 0, 1 at frame 30; before and after, it stays at the ends.
	const opacity = $derived(interpolate(video.frame, [0, 30], [0, 1]));
	const x = $derived(interpolate(video.frame, [0, 30], [-120, 0]));
</script>

<Stage>
	<div
		style="width:300px;height:300px;border-radius:24px;background:#ff3e00;display:grid;place-items:center;font-size:44px;opacity:{opacity};transform:translateX({x}px)"
	>
		frame {video.frame}
	</div>
</Stage>
