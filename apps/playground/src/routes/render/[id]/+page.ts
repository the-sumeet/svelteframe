import { loadComposition } from '#lib/compositions/load.js';
import type { PageLoad } from './$types';

// The render target is driven entirely from the browser by the renderer.
export const ssr = false;

export const load: PageLoad = ({ params, url }) => loadComposition(params.id, url);
