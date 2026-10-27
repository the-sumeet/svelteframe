<script lang="ts">
	import { useVideo } from './video.svelte.js';

	let { title = 'default', count = 0 }: { title?: string; count?: number } = $props();

	const video = useVideo();
</script>

<span data-testid="probe">{title}|{count}|{video.frame}</span>
