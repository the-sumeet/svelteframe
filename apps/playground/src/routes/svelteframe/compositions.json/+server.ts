import { describeCompositions } from '@svelteframe/core';
import { json } from '@sveltejs/kit';
import { compositions } from '#lib/compositions/index.js';

/** What `svelteframe compositions` reads: the project's compositions as JSON. */
export const GET = () => json(describeCompositions(compositions));
