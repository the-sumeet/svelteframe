<script lang="ts">
	import { useVideo } from './video.svelte.js';

	const video = useVideo();
</script>

<span data-testid="probe">{video.frame}</span>
