import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { findCompositionsFile } from './discover.js';

const SAMPLE_COMPONENT = `<script lang="ts">
  import { AbsoluteFill, interpolate, spring, useVideo } from '@svelteframe/core';

  interface Props {
    title?: string;
  }

  let { title = 'Hello from Svelteframe' }: Props = $props();
  const video = useVideo();

  // Smooth spring entrance from frame 0
  const scale = $derived(spring({ frame: video.frame, fps: video.fps, config: { damping: 12 } }));
  // Subtitle fades in between frames 15 and 35
  const opacity = $derived(interpolate(video.frame, [15, 35], [0, 1]));
</script>

<AbsoluteFill style="background: #111116; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, sans-serif;">
  <h1 style="font-size: 72px; margin: 0; transform: scale({scale});">{title}</h1>
  <p style="font-size: 28px; color: #ff3e00; opacity: {opacity}; margin-top: 20px;">
    Frame {video.frame} of {video.durationInFrames}
  </p>
</AbsoluteFill>
`;

const SAMPLE_COMPOSITIONS = `import { defineComposition } from '@svelteframe/core';
import FirstVideo from './FirstVideo.svelte';

export const compositions = [
  defineComposition({
    id: 'first',
    component: FirstVideo,
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 90,
    defaultProps: {
      title: 'Hello from Svelteframe'
    }
  })
];
`;

export interface InitOptions {
	root: string;
	onLog?: (message: string) => void;
}

export async function initProject(options: InitOptions): Promise<void> {
	const root = resolve(options.root);
	const log = options.onLog ?? console.log;

	const pkgPath = join(root, 'package.json');
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
			pkg.scripts ??= {};
			if (!pkg.scripts.svelteframe) {
				pkg.scripts.svelteframe = 'svelteframe';
				await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
				log('Added "svelteframe" script to package.json');
			}
		} catch {
			// Non-critical if package.json cannot be parsed
		}
	}

	const existing = findCompositionsFile(root);
	if (!existing) {
		const srcDir = join(root, 'src');
		if (!existsSync(srcDir)) {
			await mkdir(srcDir, { recursive: true });
		}

		const compPath = join(srcDir, 'FirstVideo.svelte');
		if (!existsSync(compPath)) {
			await writeFile(compPath, SAMPLE_COMPONENT, 'utf8');
			log('Created src/FirstVideo.svelte');
		}

		const configFile = join(srcDir, 'compositions.ts');
		if (!existsSync(configFile)) {
			await writeFile(configFile, SAMPLE_COMPOSITIONS, 'utf8');
			log('Created src/compositions.ts');
		}
	} else {
		log(`Found existing compositions at ${existing}`);
	}

	log('\n✨ Svelteframe is ready!');
	log('To preview compositions: svelteframe dev');
	log('To render your video:    svelteframe render first\n');
}
