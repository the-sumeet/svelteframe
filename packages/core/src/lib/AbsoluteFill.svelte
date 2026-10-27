<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		style?: string;
		class?: string;
		children?: Snippet;
	}

	let { style = '', class: className = '', children }: Props = $props();
</script>

<div
	class={className}
	style="position:absolute;inset:0;display:flex;flex-direction:column;{style}"
>
	{@render children?.()}
</div>
