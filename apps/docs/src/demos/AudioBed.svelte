<script lang="ts">
	import { Audio, Sequence, interpolate, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	const video = useVideo();
	const base = import.meta.env.BASE_URL;

	// Fade in over the first half second, fade out over the last second.
	const musicVolume = (frame: number) =>
		interpolate(frame, [0, 15, video.durationInFrames - 30, video.durationInFrames - 1], [0, 0.5, 0.5, 0]);
</script>

<Stage>
	<h1 style="margin:0;font-size:64px">♪ music and a sound effect</h1>
	<p style="font-size:28px;opacity:0.7">Press play: sound starts once you interact with the page.</p>
	<p style="font-size:24px;opacity:0.6">frame {video.frame}</p>
</Stage>

<Audio src="{base}media/music.wav" volume={musicVolume} />
<Sequence from={45} durationInFrames={20}>
	<Audio src="{base}media/ding.wav" volume={0.9} />
</Sequence>
