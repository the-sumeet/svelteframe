<script lang="ts">
	import { AbsoluteFill, interpolate, useVideo } from '@svelteframe/core';

	let { label, color, y }: { label: string; color: string; y: number } = $props();

	// Inside a <Sequence>, `frame` counts from the Sequence's own start.
	const video = useVideo();
</script>

<AbsoluteFill style="align-items:center;justify-content:center">
	<div
		style="transform:translateY({y}px);width:520px;padding:18px 26px;border-radius:14px;background:{color};color:#0f1722;font-size:26px;font-weight:600;opacity:{interpolate(
			video.frame,
			[0, 10],
			[0, 1]
		)}"
	>
		{label} · local frame {video.frame}
	</div>
</AbsoluteFill>
