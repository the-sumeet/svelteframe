<script lang="ts">
	import { AbsoluteFill, interpolate, useVideo } from '@svelteframe/core';

	// A white flash that fades over 12 frames: a visual cue for when the sound effect starts.
	const video = useVideo();
	const opacity = $derived(interpolate(video.frame, [0, 12], [0.9, 0]));
</script>

<AbsoluteFill style="background:#fff;opacity:{opacity};pointer-events:none"></AbsoluteFill>
