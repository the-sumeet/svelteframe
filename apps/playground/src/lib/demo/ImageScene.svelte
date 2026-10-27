<script lang="ts">
	import { AbsoluteFill, Img } from '@svelteframe/core';

	// Takes ~800ms to arrive; the render waits for it instead of capturing a blank frame.
</script>

<AbsoluteFill style="background:#000;font-family:system-ui,sans-serif">
	<Img
		src="/api/slow?type=image&ms=800"
		alt="Large image"
		style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"
	/>
	<h2
		style="position:absolute;left:80px;bottom:80px;margin:0;padding:16px 32px;border-radius:12px;background:rgba(0,0,0,0.6);color:#fff;font-size:64px;font-weight:600"
	>
		Img waits for a large image
	</h2>
</AbsoluteFill>
