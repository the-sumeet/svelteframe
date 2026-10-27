<script lang="ts" module>
	export const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 90 };
</script>

<script lang="ts">
	import { Sequence } from '@svelteframe/core';
	import DataScene from '#lib/demo/DataScene.svelte';
	import ImageScene from '#lib/demo/ImageScene.svelte';
</script>

<Sequence from={0} durationInFrames={45}>
	<ImageScene />
</Sequence>
<Sequence from={45} durationInFrames={45}>
	<DataScene />
</Sequence>
