<script lang="ts">
	import { useVideo } from './video.svelte.js';

	let { id }: { id: string } = $props();

	const video = useVideo();
</script>

<span data-testid={id}>{video.frame}/{video.durationInFrames}</span>
