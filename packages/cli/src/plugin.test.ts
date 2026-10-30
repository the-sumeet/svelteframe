import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { svelteframeVitePlugin } from './plugin.js';

describe('svelteframeVitePlugin', () => {
	const compositionsFile = '/test/src/compositions.ts';
	const plugin = svelteframeVitePlugin({ compositionsFile });

	it('resolves virtual render id', () => {
		const resolved = plugin.resolveId('/@svelteframe/virtual-render.js?id=main&props=abc');
		assert.equal(resolved, '\0svelteframe:virtual-render?id=main&props=abc');
		assert.equal(plugin.resolveId('/other.js'), null);
	});

	it('loads virtual render entry code', () => {
		const code = plugin.load('\0svelteframe:virtual-render?id=intro&props=eyJhIjoxfQ');
		assert.ok(code);
		assert.ok(code.includes('import { RenderHarness'));
		assert.ok(code.includes('/test/src/compositions.ts'));
		assert.ok(code.includes('targetId = "intro"'));
		assert.ok(code.includes('mount(RenderHarness'));
	});

	it('serves virtual HTML for /render/:id', async () => {
		let registeredMiddleware: any;
		const mockServer = {
			middlewares: {
				use(fn: any) {
					registeredMiddleware = fn;
				}
			},
			transformIndexHtml: async (_url: string, html: string) => `<!-- transformed -->\n${html}`
		};

		plugin.configureServer(mockServer);
		assert.ok(registeredMiddleware);

		const req: any = { url: '/render/my-comp?props=xyz' };
		let statusCode = 0;
		let headers: Record<string, string> = {};
		let body = '';
		const res: any = {
			set statusCode(code: number) {
				statusCode = code;
			},
			setHeader(key: string, val: string) {
				headers[key] = val;
			},
			end(data: string) {
				body = data;
			}
		};

		let nextCalled = false;
		await registeredMiddleware(req, res, () => {
			nextCalled = true;
		});

		assert.equal(nextCalled, false);
		assert.equal(statusCode, 200);
		assert.equal(headers['Content-Type'], 'text/html; charset=utf-8');
		assert.ok(body.includes('/@svelteframe/virtual-render.js?id=my-comp&props=xyz'));
		assert.ok(body.includes('<!-- transformed -->'));
	});
});
