<script lang="ts">
	import { Sequence, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';
	import Card from './SequenceCard.svelte';
</script>

<Stage>
	<Sequence from={0} durationInFrames={60}>
		<Card label="from 0, 60 frames" color="#ff3e00" y={-150} />
	</Sequence>
	<Sequence from={30} durationInFrames={60}>
		<Card label="from 30, 60 frames" color="#8ab4ff" y={0} />
	</Sequence>
	<Sequence from={60}>
		<Card label="from 60, until the end" color="#06d6a0" y={150} />
	</Sequence>
</Stage>
