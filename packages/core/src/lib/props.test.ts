import { describe, expect, it } from 'vitest';
import { decodeProps, encodeProps } from './props.js';

/** Also asserted in the renderer's tests, which encode independently with Node's Buffer. */
const VECTOR = {
	props: { title: 'héllo ✓ ~?>', n: 1, nested: { ok: true } },
	encoded: 'eyJ0aXRsZSI6ImjDqWxsbyDinJMgfj8-IiwibiI6MSwibmVzdGVkIjp7Im9rIjp0cnVlfX0'
};
const URL_SAFE_VECTOR = { props: { a: '>>>???' }, encoded: 'eyJhIjoiPj4-Pz8_In0' };

describe('encodeProps / decodeProps', () => {
	it('round-trips objects, including unicode', () => {
		for (const props of [{}, { a: 1 }, VECTOR.props, { emoji: '🎬', list: [1, 'two', null] }]) {
			expect(decodeProps(encodeProps(props))).toEqual(props);
		}
	});

	it('produces url-safe output without padding', () => {
		const encoded = encodeProps(URL_SAFE_VECTOR.props);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(encoded).toContain('-');
		expect(encoded).toContain('_');
	});

	it('matches the encoding produced by Node (what the renderer sends)', () => {
		for (const { props, encoded } of [VECTOR, URL_SAFE_VECTOR]) {
			expect(encodeProps(props)).toBe(encoded);
			expect(Buffer.from(JSON.stringify(props)).toString('base64url')).toBe(encoded);
			expect(decodeProps(encoded)).toEqual(props);
		}
	});

	it('handles large payloads', () => {
		const props = { text: 'x'.repeat(200_000) };
		expect(decodeProps(encodeProps(props))).toEqual(props);
	});

	it('accepts padded input too', () => {
		expect(decodeProps('e30=')).toEqual({});
	});

	it('rejects input that is not base64url UTF-8', () => {
		expect(() => decodeProps('***')).toThrow(/base64url/);
		expect(() => decodeProps('/w')).toThrow(/UTF-8/);
	});

	it('rejects invalid JSON', () => {
		expect(() => decodeProps(Buffer.from('{nope').toString('base64url'))).toThrow(/valid JSON/);
	});

	it('rejects JSON that is not an object', () => {
		for (const value of ['[1,2]', '"text"', '42', 'null']) {
			expect(() => decodeProps(Buffer.from(value).toString('base64url'))).toThrow(/JSON object/);
		}
	});
});
