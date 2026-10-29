<script lang="ts">
	import { Easing, interpolate, spring, useVideo } from '@svelteframe/core';
	import { Arrow, Canvas, Circle, Rect } from '@svelteframe/shapes';
	import Stage from './Stage.svelte';

	const video = useVideo();
	const frame = $derived(video.frame);

	const pop = $derived(spring({ frame, fps: video.fps, config: { damping: 12 } }));
	const draw = $derived(interpolate(frame, [20, 60], [0, 1], { easing: Easing.out(Easing.cubic) }));
	const grow = $derived(spring({ frame: frame - 45, fps: video.fps, config: { damping: 11 } }));
</script>

<Stage>
	<Canvas>
		<Rect id="frame" x={110} y={310} width={250} height={150} radius={16} fill="#1a2535" stroke="#ff3e00" strokeWidth={4} progress={draw} />
		<Circle id="video" x={780} y={385} radius={70 * grow} anchor="center" fill="#ff3e00" />
		<Arrow from="frame" to="video" gap={14} stroke="#8ab4ff" strokeWidth={6} progress={draw} />
	</Canvas>
	<h1 style="margin:0;position:absolute;top:60px;width:760px;text-align:center;font-size:56px;line-height:1.15;transform:scale({pop});opacity:{Math.min(1, pop)}">
		A video is a function of the frame
	</h1>
	<p style="margin:0;position:absolute;top:210px;font-size:28px;opacity:{interpolate(frame, [30, 50], [0, 0.7])}">
		frame {frame} → pixels
	</p>
</Stage>
