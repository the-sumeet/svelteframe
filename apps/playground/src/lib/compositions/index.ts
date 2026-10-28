import { defineComposition, type AnyComposition } from '@svelteframe/core';
import AsyncDemo from './AsyncDemo.svelte';
import AudioDemo from './AudioDemo.svelte';
import Main from './Main.svelte';
import Primitives from './Primitives.svelte';
import TitleCard from './TitleCard.svelte';
import VideoDemo from './VideoDemo.svelte';

const fps = 30;

export const compositions: AnyComposition[] = [
	defineComposition({
		id: 'main',
		component: Main,
		fps,
		width: 1920,
		height: 1080,
		durationInFrames: 150
	}),
	defineComposition({
		id: 'primitives',
		component: Primitives,
		fps,
		width: 1920,
		height: 1080,
		durationInFrames: 180
	}),
	defineComposition({
		id: 'async',
		component: AsyncDemo,
		fps,
		width: 1920,
		height: 1080,
		durationInFrames: 90
	}),
	// Background music with a volume curve, plus a sound effect that starts at `sfxFrame`.
	defineComposition({
		id: 'audio-demo',
		component: AudioDemo,
		fps,
		width: 1920,
		height: 1080,
		durationInFrames: 5 * fps,
		defaultProps: { music: true, sfxFrame: 60 }
	}),
	// Two clips of the same video, one trimmed and slowed down, frame-accurate through ffmpeg.
	defineComposition({
		id: 'video-demo',
		component: VideoDemo,
		fps,
		width: 1920,
		height: 1080,
		durationInFrames: 5 * fps,
		defaultProps: { sound: true }
	}),
	// Takes input props, and its length follows the `seconds` prop.
	defineComposition({
		id: 'title-card',
		component: TitleCard,
		fps,
		width: 1920,
		height: 1080,
		durationInFrames: 3 * fps,
		defaultProps: {
			title: 'Hello, Svelteframe',
			subtitle: 'Props change what you see',
			color: '#ff3e00',
			seconds: 3
		},
		calculateMetadata: ({ props }) => ({ durationInFrames: Math.round(props.seconds * fps) })
	})
];

export function getComposition(id: string): AnyComposition | undefined {
	return compositions.find((composition) => composition.id === id);
}
