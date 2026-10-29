<script lang="ts">
	import { Arrow, Canvas, Circle, Ellipse, Line, Polygon, Rect, Star, Triangle } from '@svelteframe/shapes';
	import { interpolate, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	const video = useVideo();
	const spin = $derived(interpolate(video.frame, [0, 90], [0, 360]));
</script>

<Stage>
	<Canvas>
		<Rect x={60} y={60} width={200} height={120} radius={20} fill="#ff3e00" />
		<Circle x={380} y={120} radius={60} anchor="center" fill="#8ab4ff" />
		<Ellipse x={560} y={120} rx={90} ry={50} anchor="center" fill="#06d6a0" />
		<Triangle x={700} y={60} width={140} height={120} fill="#ffd166" />

		<Polygon x={160} y={340} sides={6} radius={70} anchor="center" fill="#c77dff" rotate={spin} />
		<Star x={380} y={340} outerRadius={80} anchor="center" fill="#ffd166" rotate={-spin} />
		<Line from={[520, 410]} to={[700, 280]} stroke="#fff" strokeWidth={6} strokeLinecap="round" />
		<Arrow from={[720, 420]} to={[880, 300]} stroke="#ef476f" strokeWidth={8} />
	</Canvas>
</Stage>
