import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatListing, parseListing, type CompositionListing } from './format.js';

const listing = (overrides: Partial<CompositionListing> = {}): CompositionListing => ({
	id: 'main',
	fps: 30,
	width: 1920,
	height: 1080,
	durationInFrames: 150,
	defaultProps: {},
	calculatesMetadata: false,
	...overrides
});

describe('formatListing', () => {
	it('prints an aligned table', () => {
		const table = formatListing([
			listing(),
			listing({ id: 'title-card', durationInFrames: 90, defaultProps: { title: 'Hi', color: 'red' }, calculatesMetadata: true })
		]);
		assert.equal(
			table,
			[
				'ID          SIZE       FPS  FRAMES  LENGTH  PROPS',
				'main        1920×1080  30   150     5.0s    -',
				'title-card  1920×1080  30   90      3.0s*   title, color',
				'',
				'* the length depends on the props'
			].join('\n')
		);
	});

	it('leaves out the footnote when no length depends on props', () => {
		assert.ok(!formatListing([listing()]).includes('*'));
	});

	it('says so when there is nothing', () => {
		assert.equal(formatListing([]), 'No compositions found.');
	});

	it('shows fractional lengths', () => {
		assert.match(formatListing([listing({ fps: 24, durationInFrames: 100 })]), /4\.2s/);
	});
});

describe('parseListing', () => {
	it('accepts what describeCompositions produces', () => {
		const entries = [listing(), listing({ id: 'b', defaultProps: { a: 1 }, calculatesMetadata: true })];
		assert.deepEqual(parseListing(JSON.parse(JSON.stringify(entries))), entries);
	});

	it('fills in missing optional fields', () => {
		const [entry] = parseListing([{ id: 'x', fps: 30, width: 1, height: 1, durationInFrames: 1 }]);
		assert.deepEqual(entry.defaultProps, {});
		assert.equal(entry.calculatesMetadata, false);
	});

	it('rejects anything malformed, naming the entry', () => {
		assert.throws(() => parseListing({}), /not an array/);
		assert.throws(() => parseListing([null]), /entry 0 is not an object/);
		assert.throws(() => parseListing([{ ...listing(), id: '' }]), /entry 0: id must be a string/);
		assert.throws(() => parseListing([listing(), { ...listing(), fps: 'fast' }]), /entry 1 \(main\): fps must be a number/);
	});
});
