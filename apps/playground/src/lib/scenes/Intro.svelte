<script lang="ts">
	import { AbsoluteFill, Easing, interpolate, useVideo } from '@svelteframe/core';

	const video = useVideo();

	const fade = { easing: Easing.out(Easing.cubic) };
	const opacity = $derived(interpolate(video.frame, [0, 30], [0, 1], fade));
	const offsetY = $derived(interpolate(video.frame, [0, 30], [60, 0], fade));
</script>

<AbsoluteFill
	style="background:#0f1115;align-items:center;justify-content:center;font-family:system-ui,sans-serif"
>
	<h1
		style="margin:0;color:#fff;font-size:140px;font-weight:700;opacity:{opacity};transform:translateY({offsetY}px)"
	>
		Svelteframe
	</h1>
</AbsoluteFill>
