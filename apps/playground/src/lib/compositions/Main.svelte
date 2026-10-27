<script lang="ts">
	import { Sequence } from '@svelteframe/core';
	import Intro from '#lib/scenes/Intro.svelte';
	import Outro from '#lib/scenes/Outro.svelte';
</script>

<Sequence from={0} durationInFrames={90}>
	<Intro />
</Sequence>
<Sequence from={90} durationInFrames={60}>
	<Outro />
</Sequence>
