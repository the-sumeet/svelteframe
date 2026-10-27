<script lang="ts">
	import { untrack, type Component } from 'svelte';
	import Composition from './Composition.svelte';
	import { formatTimecode } from './timecode.js';
	import { VideoState } from './video.svelte.js';

	interface Props {
		/** Root component of the video; it reads the frame via `useVideo()`. */
		component: Component;
		fps: number;
		width: number;
		height: number;
		durationInFrames: number;
		controls?: boolean;
		loop?: boolean;
		autoplay?: boolean;
	}

	let {
		component: Root,
		fps,
		width,
		height,
		durationInFrames,
		controls = true,
		loop = true,
		autoplay = false
	}: Props = $props();

	// A new VideoState (and a remounted tree) whenever the video's shape changes.
	const video = $derived(new VideoState({ fps, width, height, durationInFrames }));
	const lastFrame = $derived(Math.max(0, durationInFrames - 1));

	// svelte-ignore state_referenced_locally
	let playing = $state(autoplay);
	let boxWidth = $state(0);
	const scale = $derived(boxWidth > 0 ? boxWidth / width : 1);

	// Playback position is anchored to wall-clock time so speed is independent of display refresh rate.
	let anchorTime = 0;
	let anchorFrame = 0;

	function seek(frame: number) {
		video.frame = Math.min(lastFrame, Math.max(0, Math.round(frame)));
		anchorTime = performance.now();
		anchorFrame = video.frame;
	}

	function togglePlay() {
		if (!playing && video.frame >= lastFrame) seek(0);
		playing = !playing;
	}

	$effect(() => {
		if (!playing) return;
		const current = video;
		anchorTime = performance.now();
		anchorFrame = untrack(() => current.frame);

		let raf = requestAnimationFrame(function tick(now) {
			let position = anchorFrame + ((now - anchorTime) / 1000) * fps;
			if (position >= durationInFrames) {
				if (loop) {
					position %= durationInFrames;
					anchorTime = now;
					anchorFrame = position;
				} else {
					current.frame = lastFrame;
					playing = false;
					return;
				}
			}
			current.frame = Math.floor(position);
			raf = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(raf);
	});

	function onkeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? Math.round(fps) : 1;
		switch (event.key) {
			case ' ':
				// Buttons already toggle on Space; don't double-fire.
				if (event.target instanceof HTMLButtonElement) return;
				togglePlay();
				break;
			case 'ArrowLeft':
				seek(video.frame - step);
				break;
			case 'ArrowRight':
				seek(video.frame + step);
				break;
			default:
				return;
		}
		event.preventDefault();
	}
</script>

<!-- The player is a focusable widget driven by the keyboard shortcuts above. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div class="sf-player" tabindex="0" role="application" aria-label="Video player" {onkeydown}>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="sf-stage"
		style="aspect-ratio:{width}/{height}"
		bind:clientWidth={boxWidth}
		onclick={togglePlay}
	>
		<!-- Hidden until measured, so it never flashes at full size before scaling. -->
		<div
			class="sf-scaled"
			style="transform:scale({scale});visibility:{boxWidth > 0 ? 'visible' : 'hidden'}"
		>
			{#key video}
				<Composition {video}>
					<Root />
				</Composition>
			{/key}
		</div>
	</div>

	{#if controls}
		<div class="sf-controls">
			<button
				type="button"
				class="sf-play"
				aria-label={playing ? 'Pause' : 'Play'}
				onclick={togglePlay}
			>
				{playing ? '❚❚' : '▶'}
			</button>
			<input
				class="sf-scrubber"
				type="range"
				min="0"
				max={lastFrame}
				step="1"
				aria-label="Frame"
				value={video.frame}
				oninput={(e) => seek(Number(e.currentTarget.value))}
			/>
			<span class="sf-time">
				{formatTimecode(video.frame, fps)} / {formatTimecode(durationInFrames, fps)}
			</span>
			<span class="sf-frame">frame {video.frame}</span>
		</div>
	{/if}
</div>

<style>
	.sf-player {
		width: 100%;
		background: #000;
		color: #e6e6e6;
		font: 13px/1 system-ui, sans-serif;
		outline-offset: 2px;
	}
	.sf-stage {
		position: relative;
		width: 100%;
		overflow: hidden;
		cursor: pointer;
	}
	.sf-scaled {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 0 0;
	}
	.sf-controls {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		background: #181a1f;
	}
	.sf-play {
		width: 32px;
		height: 28px;
		border: 0;
		border-radius: 4px;
		background: #2a2d35;
		color: inherit;
		cursor: pointer;
	}
	.sf-scrubber {
		flex: 1;
		min-width: 0;
	}
	.sf-time,
	.sf-frame {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.sf-frame {
		opacity: 0.6;
	}
</style>
