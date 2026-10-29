<script lang="ts">
	import { OffthreadVideo, Sequence } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	const base = import.meta.env.BASE_URL;
	const src = `${base}media/clip.mp4`;
</script>

<Stage style="flex-direction:row;gap:36px">
	<figure style="margin:0;text-align:center">
		<div style="position:relative;width:420px;height:236px;border-radius:12px;overflow:hidden;background:#000">
			<OffthreadVideo {src} muted />
		</div>
		<figcaption style="margin-top:12px;font-size:22px;opacity:0.7">normal speed</figcaption>
	</figure>
	<figure style="margin:0;text-align:center">
		<!-- A Sequence fills its nearest positioned parent, hence position: relative. -->
		<div style="position:relative;width:420px;height:236px;border-radius:12px;overflow:hidden;background:#000">
			<Sequence from={30}>
				<OffthreadVideo {src} startFrom={30} playbackRate={0.5} muted />
			</Sequence>
		</div>
		<figcaption style="margin-top:12px;font-size:22px;opacity:0.7">from 1 s, half speed, starting at frame 30</figcaption>
	</figure>
</Stage>
