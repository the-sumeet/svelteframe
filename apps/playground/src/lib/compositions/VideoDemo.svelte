<script lang="ts">
	import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, useVideo } from '@svelteframe/core';

	interface Props {
		/** Play the sound of the left clip. */
		sound?: boolean;
	}

	let { sound = true }: Props = $props();

	const video = useVideo();
	const fadeIn = $derived(interpolate(video.frame, [0, 15], [0, 1]));
</script>

<AbsoluteFill
	style="background:#0f1a24;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#fff;gap:48px"
>
	<h1 style="margin:0;font-size:84px;font-weight:700;opacity:{fadeIn}">OffthreadVideo</h1>
	<div style="display:flex;gap:64px;opacity:{fadeIn}">
		<figure style="margin:0;width:800px;height:450px">
			<!-- `position: relative` keeps the Sequence, which fills its nearest positioned parent, inside the box. -->
			<div style="position:relative;width:100%;height:100%;border-radius:16px;overflow:hidden;background:#000">
				<!-- Plays from the start at normal speed. -->
				<OffthreadVideo src="/video/clip.mp4" muted={!sound} />
			</div>
			<figcaption style="margin-top:16px;font-size:32px;opacity:0.7">normal speed</figcaption>
		</figure>
		<figure style="margin:0;width:800px;height:450px">
			<div style="position:relative;width:100%;height:100%;border-radius:16px;overflow:hidden;background:#000">
				<!-- Skips the first second and plays at half speed. -->
				<Sequence from={30}>
					<OffthreadVideo src="/video/clip.mp4" startFrom={30} playbackRate={0.5} muted />
				</Sequence>
			</div>
			<figcaption style="margin-top:16px;font-size:32px;opacity:0.7">half speed, from 1 s, starts at frame 30</figcaption>
		</figure>
	</div>
	<p style="margin:0;font-size:36px;opacity:0.5">frame {video.frame}</p>
</AbsoluteFill>
