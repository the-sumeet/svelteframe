<script lang="ts">
	import { Freeze, Loop, interpolate, useVideo } from '@svelteframe/core';
	import Stage from './Stage.svelte';
	import Pulse from './Pulse.svelte';
</script>

<Stage style="flex-direction:row;gap:90px">
	<div style="text-align:center">
		<!-- A 20-frame pulse, repeated. -->
		<Loop durationInFrames={20}><Pulse color="#ff3e00" /></Loop>
		<p style="font-size:22px;opacity:0.7">Loop, 20 frames</p>
	</div>
	<div style="text-align:center">
		<!-- Always sees frame 10. -->
		<Freeze frame={10}><Pulse color="#8ab4ff" /></Freeze>
		<p style="font-size:22px;opacity:0.7">Freeze at frame 10</p>
	</div>
</Stage>
