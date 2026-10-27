<script lang="ts">
	import { interpolate, useVideo } from '@svelteframe/core';

	// Inside <Loop>, `durationInFrames` is the loop length and `frame` wraps within it.
	const video = useVideo();
	const angle = $derived(interpolate(video.frame, [0, video.durationInFrames], [0, 360]));
</script>

<div
	style="position:absolute;left:80px;bottom:80px;display:flex;align-items:center;gap:32px;font-family:system-ui,sans-serif;color:#fff"
>
	<div
		style="width:120px;height:120px;border-radius:16px;background:#4cc9f0;transform:rotate({angle}deg)"
	></div>
	<div style="font-size:36px;line-height:1.3">
		Loop ({video.durationInFrames}f)<br />
		<span style="opacity:0.7">loop frame {video.frame}</span>
	</div>
</div>
