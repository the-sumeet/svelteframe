import { loadComposition } from '#lib/compositions/load.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => loadComposition(params.id, url);
