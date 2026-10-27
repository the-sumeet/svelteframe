import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Demo endpoint that answers after a delay, to exercise `delayRender`:
 * `/api/slow?type=json|image&ms=500`.
 */
export const GET: RequestHandler = async ({ url }) => {
	const requested = Number(url.searchParams.get('ms'));
	const ms = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), 5000) : 500;
	await new Promise((resolve) => setTimeout(resolve, ms));

	if (url.searchParams.get('type') === 'image') {
		const file = await readFile(join(process.cwd(), 'static', 'large-demo.jpg'));
		return new Response(new Uint8Array(file), {
			headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }
		});
	}

	return json(
		{ title: 'Loaded from the server', items: ['delayRender', 'continueRender', 'Img'] },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
