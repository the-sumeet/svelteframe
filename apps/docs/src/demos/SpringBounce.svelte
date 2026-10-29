<script lang="ts">
	import { spring, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	const video = useVideo();

	const springs = [
		{ label: 'damping 10 (default)', config: { damping: 10 }, color: '#ff3e00' },
		{ label: 'damping 20', config: { damping: 20 }, color: '#8ab4ff' },
		{ label: 'damping 8, stiffness 200', config: { damping: 8, stiffness: 200 }, color: '#06d6a0' }
	];
</script>

<Stage style="flex-direction:row;gap:70px">
	{#each springs as s}
		<div style="text-align:center">
			<div
				style="width:160px;height:160px;border-radius:50%;background:{s.color};transform:scale({spring({
					frame: video.frame - 10,
					fps: video.fps,
					config: s.config
				})})"
			></div>
			<p style="font-size:20px;opacity:0.7;margin-top:30px">{s.label}</p>
		</div>
	{/each}
</Stage>
