<script lang="ts">
	import Composition from './Composition.svelte';
	import type { RenderMode } from './environment.js';
	import OffthreadVideo from './OffthreadVideo.svelte';
	import Sequence from './Sequence.svelte';
	import type { VideoState } from './video.svelte.js';

	let {
		video,
		mode,
		from,
		durationInFrames,
		...props
	}: { video: VideoState; mode?: RenderMode; from?: number; durationInFrames?: number } & Record<string, any> = $props();
</script>

<Composition {video} {mode}>
	<Sequence {from} {durationInFrames}>
		<OffthreadVideo src="/clip.mp4" {...props} />
	</Sequence>
</Composition>
