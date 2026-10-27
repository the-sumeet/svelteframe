import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertProps, buildRenderUrl, encodeProps } from './url.js';

describe('encodeProps', () => {
	// The same vectors are decoded by @svelteframe/core's tests, which pins the two sides together.
	it('produces base64url of the JSON', () => {
		assert.equal(
			encodeProps({ title: 'héllo ✓ ~?>', n: 1, nested: { ok: true } }),
			'eyJ0aXRsZSI6ImjDqWxsbyDinJMgfj8-IiwibiI6MSwibmVzdGVkIjp7Im9rIjp0cnVlfX0'
		);
		assert.equal(encodeProps({ a: '>>>???' }), 'eyJhIjoiPj4-Pz8_In0');
	});

	it('uses only url-safe characters', () => {
		assert.match(encodeProps({ a: '>>>???', b: 'ÿÿÿ' }), /^[A-Za-z0-9_-]+$/);
	});
});

describe('assertProps', () => {
	it('returns objects', () => {
		assert.deepEqual(assertProps({ a: 1 }, 'x'), { a: 1 });
	});

	it('rejects everything else, naming the source', () => {
		for (const value of [[], 'text', 3, null, undefined]) {
			assert.throws(() => assertProps(value, 'props.json'), /props\.json must contain a JSON object/);
		}
	});
});

describe('buildRenderUrl', () => {
	it('returns the url unchanged when no composition is given', () => {
		assert.equal(buildRenderUrl({ url: 'http://localhost:5173/render/main' }), 'http://localhost:5173/render/main');
	});

	it('targets /render/<composition> under the base url', () => {
		assert.equal(
			buildRenderUrl({ url: 'http://localhost:5173', composition: 'title-card' }),
			'http://localhost:5173/render/title-card'
		);
	});

	it('keeps a base path and ignores trailing slashes', () => {
		assert.equal(
			buildRenderUrl({ url: 'http://host/app/', composition: 'main' }),
			'http://host/app/render/main'
		);
	});

	it('encodes the composition id', () => {
		assert.equal(buildRenderUrl({ url: 'http://h', composition: 'a b' }), 'http://h/render/a%20b');
	});

	it('adds props as ?props=base64url(JSON)', () => {
		const url = new URL(
			buildRenderUrl({ url: 'http://h', composition: 'x', props: { title: 'Hi there' } })
		);
		assert.equal(url.pathname, '/render/x');
		const encoded = url.searchParams.get('props')!;
		assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), { title: 'Hi there' });
	});

	it('omits ?props when there are none', () => {
		assert.equal(
			buildRenderUrl({ url: 'http://h', composition: 'x', props: {} }),
			'http://h/render/x'
		);
	});

	it('keeps existing query parameters', () => {
		const url = new URL(
			buildRenderUrl({ url: 'http://h/?debug=1', composition: 'x', props: { a: 1 } })
		);
		assert.equal(url.searchParams.get('debug'), '1');
		assert.ok(url.searchParams.get('props'));
	});

	it('refuses props without a composition', () => {
		assert.throws(
			() => buildRenderUrl({ url: 'http://h/render/x', props: { a: 1 } }),
			/together with a composition/
		);
	});
});
