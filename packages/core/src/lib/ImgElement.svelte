<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { continueRender, delayRender, failRender, type RenderHandle } from './delay-render.js';

	let { src, alt = '', ...rest }: HTMLImgAttributes & { src: string } = $props();

	// One element per `src` (see Img.svelte), so the handle's lifetime is the element's.
	// svelte-ignore state_referenced_locally
	let handle: RenderHandle | undefined = delayRender(`<Img src="${src}">`);
	let img: HTMLImageElement;

	function release() {
		if (handle === undefined) return;
		continueRender(handle);
		handle = undefined;
	}

	async function loaded() {
		// Decoded images paint on the first screenshot; undecoded ones may not.
		try {
			await img.decode?.();
		} catch {
			// A decode failure is not a load failure; the load event already succeeded.
		}
		release();
	}

	function failed() {
		if (handle === undefined) return;
		const failing = handle;
		handle = undefined;
		failRender(failing, new Error(`<Img> failed to load "${src}"`));
	}

	// A server-rendered image can finish loading before hydration, so its events were missed.
	onMount(() => {
		if (img.complete) {
			if (img.naturalWidth > 0) loaded();
			else failed();
		}
	});

	// Don't leave a render hanging if the image is removed while it loads.
	onDestroy(release);
</script>

<img bind:this={img} {src} {alt} {...rest} onload={loaded} onerror={failed} />
