<script lang="ts">
	import { useVideo } from '@svelteframe/core';

	const video = useVideo();
</script>

<div
	style="position:absolute;right:80px;bottom:80px;padding:24px 36px;border-radius:16px;background:rgba(0,0,0,0.55);color:#fff;font:36px/1.3 system-ui,sans-serif;text-align:right"
>
	Freeze<br />
	<span style="opacity:0.7">always frame {video.frame}</span>
</div>
