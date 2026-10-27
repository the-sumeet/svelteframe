<script lang="ts">
	import Audio from './Audio.svelte';
	import Sequence from './Sequence.svelte';

	interface Props {
		/** Where the enclosing Sequence starts. */
		from?: number;
		durationInFrames?: number;
		src?: string;
		startFrom?: number;
		endAt?: number;
		volume?: number | ((frame: number) => number);
		playbackRate?: number;
	}

	let { from, durationInFrames, src = '/a.wav', ...audio }: Props = $props();
</script>

<Sequence {from} {durationInFrames}>
	<Audio {src} {...audio} />
</Sequence>
