import type { IncomingMessage, ServerResponse } from 'node:http';

export interface SvelteframePluginOptions {
	compositionsFile: string;
}

function describeCompositions(compositions: readonly any[]) {
	return compositions.map((c) => ({
		id: c.id,
		fps: c.fps,
		width: c.width,
		height: c.height,
		durationInFrames: c.durationInFrames,
		defaultProps: c.defaultProps ?? {},
		calculatesMetadata: typeof c.calculateMetadata === 'function'
	}));
}

export function svelteframeVitePlugin(options: SvelteframePluginOptions) {
	const { compositionsFile } = options;
	const virtualRenderPrefix = '/@svelteframe/virtual-render.js';
	const virtualRenderId = '\0svelteframe:virtual-render';

	return {
		name: 'svelteframe:virtual-harness',
		configureServer(server: any) {
			server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
				const rawUrl = req.url ?? '/';
				const parsedUrl = new URL(rawUrl, 'http://127.0.0.1');

				// 1. /svelteframe/compositions.json
				if (parsedUrl.pathname === '/svelteframe/compositions.json') {
					try {
						const mod = await server.ssrLoadModule(compositionsFile);
						const list = mod.compositions || mod.default;
						if (!Array.isArray(list)) {
							res.statusCode = 500;
							res.setHeader('Content-Type', 'application/json');
							res.end(
								JSON.stringify({
									error: `Compositions file at ${compositionsFile} does not export a "compositions" array.`
								})
							);
							return;
						}
						const described = describeCompositions(list);
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json');
						res.end(JSON.stringify(described));
						return;
					} catch (err: any) {
						res.statusCode = 500;
						res.setHeader('Content-Type', 'application/json');
						res.end(JSON.stringify({ error: err.message || String(err) }));
						return;
					}
				}

				// 2. /render/:id
				if (parsedUrl.pathname.startsWith('/render/')) {
					const compositionId = decodeURIComponent(parsedUrl.pathname.slice('/render/'.length));
					const propsParam = parsedUrl.searchParams.get('props');

					const scriptSrc = `${virtualRenderPrefix}?id=${encodeURIComponent(compositionId)}${
						propsParam ? `&props=${encodeURIComponent(propsParam)}` : ''
					}`;

					const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Svelteframe render: ${compositionId}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="svelteframe-root"></div>
  <script type="module" src="${scriptSrc}"></script>
</body>
</html>`;

					try {
						const transformed = await server.transformIndexHtml(rawUrl, html);
						res.statusCode = 200;
						res.setHeader('Content-Type', 'text/html; charset=utf-8');
						res.end(transformed);
						return;
					} catch (err: any) {
						next();
						return;
					}
				}

				next();
			});
		},

		resolveId(id: string) {
			if (id.startsWith(virtualRenderPrefix)) {
				return virtualRenderId + id.slice(virtualRenderPrefix.length);
			}
			return null;
		},

		load(id: string) {
			if (id.startsWith(virtualRenderId)) {
				const queryIndex = id.indexOf('?');
				const search = queryIndex !== -1 ? id.slice(queryIndex) : '';
				const searchParams = new URLSearchParams(search);
				const targetId = searchParams.get('id') || '';
				const propsEncoded = searchParams.get('props');

				return `
import { mount } from 'svelte';
import { RenderHarness, decodeProps, resolveComposition } from '@svelteframe/core';
import * as compositionsModule from ${JSON.stringify(compositionsFile)};

async function bootstrap() {
  const compositionsList = compositionsModule.compositions || compositionsModule.default;
  if (!Array.isArray(compositionsList)) {
    const msg = 'Compositions file at ' + ${JSON.stringify(compositionsFile)} + ' does not export a "compositions" array.';
    window.__SvelteframeError = msg;
    throw new Error(msg);
  }

  const targetId = ${JSON.stringify(targetId)};
  const composition = compositionsList.find((c) => c && c.id === targetId);
  if (!composition) {
    const known = compositionsList.map((c) => c && c.id).filter(Boolean).join(', ');
    const msg = 'Unknown composition "' + targetId + '". Available: ' + known;
    window.__SvelteframeError = msg;
    throw new Error(msg);
  }

  let inputProps = undefined;
  ${
		propsEncoded
			? `
  try {
    inputProps = decodeProps(${JSON.stringify(propsEncoded)});
  } catch (err) {
    const msg = 'Invalid ?props: ' + (err.message || String(err));
    window.__SvelteframeError = msg;
    throw new Error(msg);
  }
  `
			: ''
	}

  try {
    const { props, metadata } = await resolveComposition(composition, inputProps);
    const target = document.getElementById('svelteframe-root') || document.body;
    mount(RenderHarness, {
      target,
      props: {
        component: composition.component,
        props,
        metadata
      }
    });
  } catch (err) {
    window.__SvelteframeError = err.message || String(err);
    throw err;
  }
}

bootstrap().catch((err) => {
  console.error('[svelteframe]', err);
});
`;
			}
			return null;
		}
	};
}
