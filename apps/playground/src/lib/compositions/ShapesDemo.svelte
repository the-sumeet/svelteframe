<script lang="ts">
	import { AbsoluteFill, Easing, interpolate, spring, useVideo } from '@svelteframe/core';
	import { Arrow, Canvas, Circle, Line, Polygon, Rect, Star, Triangle } from '@svelteframe/shapes';

	const video = useVideo();
	const frame = $derived(video.frame);

	// Everything is a function of the frame.
	const draw = $derived(interpolate(frame, [0, 45], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' }));
	const pop = $derived(spring({ frame: frame - 20, fps: video.fps, config: { damping: 12 } }));
	const spin = $derived(interpolate(frame, [0, 120], [0, 360]));
</script>

<AbsoluteFill style="background:#0e1116;font-family:system-ui,sans-serif;color:#fff">
	<Canvas>
		<!-- Placed by x/y; the top-left corner by default. -->
		<Rect id="card" x={160} y={160} width={520} height={300} radius={32} fill="#1d2430" stroke="#ff3e00" strokeWidth={6} progress={draw} />
		<!-- Placed by its centre. -->
		<Circle x={420} y={310} radius={90 * pop} anchor="center" fill="#ff3e00" />

		<!-- Rotating around its own centre. -->
		<Star id="star" x={1380} y={310} outerRadius={150} anchor="center" fill="#ffd166" rotate={spin} scale={0.8 + 0.2 * pop} />

		<!-- Attached by id: the edge of the card to the edge of the star, with a gap, growing from the card. -->
		<Arrow from="card" to="star.center" gap={24} stroke="#8ab4ff" strokeWidth={10} progress={draw} />
		<!-- Or to a chosen point of a shape. -->
		<Arrow from="card.bottom" to="tri.top" stroke="#06d6a0" strokeWidth={8} progress={draw} />

		<Triangle id="tri" x={160} y={600} width={220} height={190} fill="#06d6a0" />
		<Polygon x={520} y={695} sides={6} radius={100} anchor="center" fill="none" stroke="#c77dff" strokeWidth={10} progress={draw} />
		<Line from={[760, 800]} to={[1240, 600]} stroke="#fff" strokeWidth={6} strokeLinecap="round" progress={draw} />
		<Arrow from={[1300, 800]} to={[1700, 640]} heads="both" stroke="#ef476f" strokeWidth={8} progress={draw} />
	</Canvas>

	<!-- Outside a Canvas a shape is an ordinary element, placed by the page. -->
	<div style="position:absolute;left:160px;bottom:90px;display:flex;align-items:center;gap:20px;font-size:40px">
		<Circle radius={14} fill="#06d6a0" />
		<span>shapes are inline too</span>
	</div>
</AbsoluteFill>
