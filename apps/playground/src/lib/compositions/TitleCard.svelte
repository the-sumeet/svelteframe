<script lang="ts">
	import { AbsoluteFill, Easing, interpolate, spring, useVideo } from '@svelteframe/core';

	interface Props {
		title: string;
		subtitle: string;
		color: string;
		/** Only informational here: the composition derives its duration from it. */
		seconds: number;
	}

	let { title, subtitle, color, seconds }: Props = $props();

	const video = useVideo();

	const pop = $derived(spring({ frame: video.frame, fps: video.fps, config: { damping: 12 } }));
	const subtitleOpacity = $derived(
		interpolate(video.frame, [15, 35], [0, 1], { easing: Easing.out(Easing.cubic) })
	);
	// The bar spans the whole video, whatever length the props gave it.
	const progress = $derived(interpolate(video.frame, [0, video.durationInFrames - 1], [0, 100]));
</script>

<AbsoluteFill
	style="background:{color};align-items:center;justify-content:center;gap:28px;font-family:system-ui,sans-serif;color:#fff"
>
	<h1
		style="margin:0;font-size:150px;font-weight:700;text-align:center;transform:scale({pop});opacity:{Math.min(
			1,
			pop
		)}"
	>
		{title}
	</h1>
	<p style="margin:0;font-size:56px;opacity:{subtitleOpacity * 0.9}">{subtitle}</p>
	<p style="margin:0;font-size:32px;opacity:0.6">{seconds}s · {video.durationInFrames} frames</p>

	<div style="position:absolute;left:0;bottom:0;height:12px;width:{progress}%;background:rgba(255,255,255,0.85)"></div>
</AbsoluteFill>
