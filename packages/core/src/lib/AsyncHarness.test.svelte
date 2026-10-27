<script lang="ts">
	import Composition from './Composition.svelte';
	import Img from './Img.svelte';
	import Sequence from './Sequence.svelte';
	import type { VideoState } from './video.svelte.js';

	let { video, src = 'a.png' }: { video: VideoState; src?: string } = $props();
</script>

<Composition {video}>
	<!-- Only mounts once the video reaches frame 5. -->
	<Sequence from={5}>
		<Img {src} alt="scene" class="scene" data-testid="img" />
	</Sequence>
</Composition>
