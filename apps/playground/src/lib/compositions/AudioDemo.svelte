<script lang="ts">
	import {
		AbsoluteFill,
		Audio,
		Sequence,
		interpolate,
		useVideo
	} from '@svelteframe/core';
	import Flash from '#lib/demo/Flash.svelte';

	interface Props {
		/** Play the background music. */
		music?: boolean;
		/** Frame at which the sound effect plays, and the screen flashes. */
		sfxFrame?: number;
	}

	let { music = true, sfxFrame = 60 }: Props = $props();

	const video = useVideo();

	// Fade the music in over the first half second and out over the last second.
	const musicVolume = (frame: number) =>
		interpolate(frame, [0, 15, video.durationInFrames - 30, video.durationInFrames - 1], [0, 0.35, 0.35, 0]);
</script>

<AbsoluteFill
	style="background:#1a1033;align-items:center;justify-content:center;gap:24px;font-family:system-ui,sans-serif;color:#fff"
>
	<h1 style="margin:0;font-size:120px;font-weight:700">♪ Audio demo</h1>
	<p style="margin:0;font-size:44px;opacity:0.7">
		{music ? 'Music bed with a fade' : 'No music'} · ding at frame {sfxFrame}
	</p>
	<p style="margin:0;font-size:36px;opacity:0.5">frame {video.frame}</p>
</AbsoluteFill>

{#if music}
	<Audio src="/audio/music.wav" volume={musicVolume} />
{/if}

<Sequence from={sfxFrame} durationInFrames={20}>
	<Flash />
	<Audio src="/audio/ding.wav" volume={0.9} />
</Sequence>
