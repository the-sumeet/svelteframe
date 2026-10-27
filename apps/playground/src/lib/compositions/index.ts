import { defineComposition, type AnyComposition } from '@svelteframe/core';
import AsyncDemo from './AsyncDemo.svelte';
import Main from './Main.svelte';
import Primitives from './Primitives.svelte';
import TitleCard from './TitleCard.svelte';

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
