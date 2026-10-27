<script lang="ts">
	import AudioScene from './AudioScene.test.svelte';
	import Composition from './Composition.svelte';
	import type { RenderMode } from './environment.js';
	import type { VideoState } from './video.svelte.js';

	let { video, mode, ...scene }: { video: VideoState; mode?: RenderMode } & Record<string, any> =
		$props();
</script>

<Composition {video} {mode}>
	<AudioScene {...scene} />
</Composition>
