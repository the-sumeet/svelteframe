import { decodeProps, resolveComposition } from '@svelteframe/core';
import { error } from '@sveltejs/kit';
import { compositions, getComposition } from './index.js';

/**
 * Shared by the preview and render routes: find the composition, read `?props=`,
 * and work out the final props and metadata. Unknown ids and bad input become HTTP errors.
 */
export async function loadComposition(id: string, url: URL) {
	const composition = getComposition(id);
	if (!composition) {
		const known = compositions.map((c) => c.id).join(', ');
		error(404, `Unknown composition "${id}". Available: ${known}`);
	}

	let input: Record<string, unknown> | undefined;
	const encoded = url.searchParams.get('props');
	if (encoded) {
		try {
			input = decodeProps(encoded);
		} catch (err) {
			error(400, `Invalid ?props: ${(err as Error).message}`);
		}
	}

	try {
		const { props, metadata } = await resolveComposition(composition, input);
		return { id, props, metadata };
	} catch (err) {
		error(500, (err as Error).message);
	}
}
