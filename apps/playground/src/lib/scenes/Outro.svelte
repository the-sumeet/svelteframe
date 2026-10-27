<script lang="ts">
	import { AbsoluteFill, interpolate, useVideo } from '@svelteframe/core';

	const video = useVideo();

	const opacity = $derived(interpolate(video.frame, [0, 20], [0, 1]));
	const scale = $derived(interpolate(video.frame, [0, 60], [0.9, 1]));
</script>

<AbsoluteFill
	style="background:#ff3e00;align-items:center;justify-content:center;font-family:system-ui,sans-serif"
>
	<h2
		style="margin:0;color:#fff;font-size:96px;font-weight:600;opacity:{opacity};transform:scale({scale})"
	>
		Videos are functions of frame
	</h2>
</AbsoluteFill>
