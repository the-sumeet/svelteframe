export type Props = Record<string, unknown>;

/** base64url(JSON), the format the page decodes from `?props=`. */
export function encodeProps(props: Props): string {
	return Buffer.from(JSON.stringify(props), 'utf8').toString('base64url');
}

/** Check that parsed JSON is a props object, with an error that says what was wrong. */
export function assertProps(value: unknown, source: string): Props {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${source} must contain a JSON object`);
	}
	return value as Props;
}

export interface RenderUrlOptions {
	/** Page URL, or the playground's base URL when `composition` is set. */
	url: string;
	/** Render `/render/<composition>` under `url` instead of using `url` as is. */
	composition?: string;
	props?: Props;
}

/** The page the renderer opens: `<url>/render/<composition>?props=...`, or `url` unchanged. */
export function buildRenderUrl({ url, composition, props }: RenderUrlOptions): string {
	const target = new URL(url);
	if (composition !== undefined) {
		target.pathname = `${target.pathname.replace(/\/+$/, '')}/render/${encodeURIComponent(composition)}`;
	} else if (props !== undefined) {
		throw new Error('props can only be passed together with a composition');
	}
	if (props !== undefined && Object.keys(props).length > 0) {
		target.searchParams.set('props', encodeProps(props));
	}
	return target.toString();
}
