<script lang="ts">
	import { interpolate, spring, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	interface Props {
		title: string;
		subtitle: string;
		color: string;
	}

	let { title, subtitle, color }: Props = $props();

	const video = useVideo();
	const pop = $derived(spring({ frame: video.frame, fps: video.fps, config: { damping: 12 } }));
</script>

<Stage style="background:{color}">
	<h1 style="margin:0;font-size:92px;transform:scale({pop});opacity:{Math.min(1, pop)}">{title}</h1>
	<p style="margin:12px 0 0;font-size:34px;opacity:{interpolate(video.frame, [15, 35], [0, 0.9])}">{subtitle}</p>
</Stage>
