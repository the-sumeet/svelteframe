import type { Component } from 'svelte';
import ArrowsById from './ArrowsById.svelte';
import AudioBed from './AudioBed.svelte';
import DrawOn from './DrawOn.svelte';
import Easings from './Easings.svelte';
import FadeIn from './FadeIn.svelte';
import Hero from './Hero.svelte';
import LoopFreeze from './LoopFreeze.svelte';
import RandomDots from './RandomDots.svelte';
import SeriesDemo from './SeriesDemo.svelte';
import Sequences from './Sequences.svelte';
import ShapesAnchors from './ShapesAnchors.svelte';
import ShapesGallery from './ShapesGallery.svelte';
import SpringBounce from './SpringBounce.svelte';
import Title from './Title.svelte';
import VideoClip from './VideoClip.svelte';

export interface DemoDefinition {
	component: Component<any>;
	fps: number;
	width: number;
	height: number;
	durationInFrames: number;
	/** Props the composition is previewed with. */
	props?: Record<string, unknown>;
}

const base = { fps: 30, width: 960, height: 540 };

/** The compositions the docs pages embed with `<Demo name="..." />`. */
export const demos: Record<string, DemoDefinition> = {
	hero: { ...base, component: Hero, durationInFrames: 120 },
	'fade-in': { ...base, component: FadeIn, durationInFrames: 60 },
	easings: { ...base, component: Easings, durationInFrames: 100 },
	'spring-bounce': { ...base, component: SpringBounce, durationInFrames: 90 },
	sequences: { ...base, component: Sequences, durationInFrames: 120 },
	series: { ...base, component: SeriesDemo, durationInFrames: 120 },
	'loop-freeze': { ...base, component: LoopFreeze, durationInFrames: 60 },
	title: {
		...base,
		component: Title,
		durationInFrames: 75,
		props: { title: 'Hello, Svelteframe', subtitle: 'Props change what you see', color: '#ff3e00' }
	},
	random: { ...base, component: RandomDots, durationInFrames: 90 },
	'shapes-gallery': { ...base, component: ShapesGallery, durationInFrames: 90 },
	'shapes-anchors': { ...base, component: ShapesAnchors, durationInFrames: 30 },
	'arrows-by-id': { ...base, component: ArrowsById, durationInFrames: 90 },
	'draw-on': { ...base, component: DrawOn, durationInFrames: 90 },
	'audio-bed': { ...base, component: AudioBed, durationInFrames: 150 },
	'video-clip': { ...base, component: VideoClip, durationInFrames: 120 }
};
