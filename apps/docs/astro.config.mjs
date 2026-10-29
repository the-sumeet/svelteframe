import svelte from '@astrojs/svelte';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
	integrations: [
		svelte(),
		starlight({
			title: 'Svelteframe',
			description: 'Programmatic video with Svelte 5: a video is a function of the frame number.',
			sidebar: [
				{ label: 'Introduction', slug: 'index' },
				{ label: 'Getting started', items: [{ autogenerate: { directory: 'getting-started' } }] },
				{ label: 'Concepts', items: [{ autogenerate: { directory: 'concepts' } }] },
				{ label: 'Rendering', items: [{ autogenerate: { directory: 'rendering' } }] },
				{ label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] }
			]
		})
	],
	vite: {
		// The workspace packages ship Svelte components under the `svelte` export condition.
		ssr: { noExternal: [/^@svelteframe\//] }
	}
});
