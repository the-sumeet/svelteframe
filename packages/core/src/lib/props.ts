/** Props travel in URLs as base64url(JSON), e.g. `/render/intro?props=eyJ0aXRsZSI6IkhpIn0`. */

const BINARY_CHUNK = 0x8000;

/** Encode a props object for the `?props=` query parameter. */
export function encodeProps(props: Record<string, unknown>): string {
	const bytes = new TextEncoder().encode(JSON.stringify(props));
	let binary = '';
	for (let i = 0; i < bytes.length; i += BINARY_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + BINARY_CHUNK));
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Decode the `?props=` query parameter. Throws a descriptive error on bad input. */
export function decodeProps(encoded: string): Record<string, unknown> {
	let json: string;
	try {
		const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/');
		const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
		json = new TextDecoder('utf-8', { fatal: true }).decode(
			Uint8Array.from(binary, (char) => char.charCodeAt(0))
		);
	} catch {
		throw new Error('props are not valid base64url-encoded UTF-8');
	}

	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		throw new Error('props are not valid JSON');
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('props must be a JSON object');
	}
	return value as Record<string, unknown>;
}
