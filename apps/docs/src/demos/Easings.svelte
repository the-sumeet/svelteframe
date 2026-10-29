<script lang="ts">
	import { Easing, interpolate, useVideo, type EasingFunction } from '@svelteframe/core';
	import Stage from './Stage.svelte';

	const video = useVideo();

	const rows: { label: string; easing: EasingFunction; color: string }[] = [
		{ label: 'linear', easing: Easing.linear, color: '#8ab4ff' },
		{ label: 'Easing.quad', easing: Easing.quad, color: '#06d6a0' },
		{ label: 'Easing.out(Easing.cubic)', easing: Easing.out(Easing.cubic), color: '#ffd166' },
		{ label: 'Easing.inOut(Easing.cubic)', easing: Easing.inOut(Easing.cubic), color: '#ef476f' }
	];
</script>

<Stage style="justify-content:center;gap:26px">
	{#each rows as row}
		<div style="width:760px;position:relative;height:56px">
			<div style="position:absolute;left:0;top:-2px;font-size:20px;opacity:0.7">{row.label}</div>
			<div
				style="position:absolute;top:24px;width:32px;height:32px;border-radius:50%;background:{row.color};left:{interpolate(
					video.frame,
					[10, 80],
					[0, 728],
					{ easing: row.easing }
				)}px"
			></div>
		</div>
	{/each}
</Stage>
