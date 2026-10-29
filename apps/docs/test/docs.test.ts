import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { docsRoot, exportedNames, filesUnder, packages } from './exports.ts';

const pages = filesUnder(join(docsRoot, 'src/content/docs'), ['.mdx']);
const read = (file: string) => readFileSync(file, 'utf8');
const referencePages = pages.filter((page) => page.includes('/reference/'));
const referenceText = referencePages.map(read).join('\n');

describe('the reference', () => {
	for (const [name, entry] of Object.entries(packages)) {
		it(`documents everything ${name} exports`, () => {
			const names = exportedNames(entry);
			assert.ok(names.length > 5, `found the exports of ${name}`);
			const missing = names.filter((exported) => !new RegExp(`^#{2,4} .*\`${exported}\``, 'm').test(referenceText));
			assert.deepEqual(missing, [], `${name} exports names with no heading in a reference page`);
		});
	}

	it('does not document names that are no longer exported', () => {
		const exported = new Set(Object.values(packages).flatMap(exportedNames));
		const headings = [...referenceText.matchAll(/^#{3} `([A-Za-z_$][\w$]*)`/gm)].map((match) => match[1]);
		// Members of an object (`Easing.linear`) are not top-level headings, so only plain names are checked.
		const stale = headings.filter((name) => !exported.has(name));
		assert.deepEqual(stale, [], 'reference headings that name nothing exported');
	});
});

describe('the examples', () => {
	it('only import names that the packages export', () => {
		const exported = Object.fromEntries(Object.entries(packages).map(([name, entry]) => [name, new Set(exportedNames(entry))]));
		const problems: string[] = [];
		for (const page of pages) {
			for (const [, list, pkg] of read(page).matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(@svelteframe\/[\w-]+)'/g)) {
				const known = exported[pkg];
				if (!known) {
					problems.push(`${page}: imports from ${pkg}, which is not documented`);
					continue;
				}
				for (const item of list.split(',')) {
					const name = item.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
					if (name && !known.has(name)) problems.push(`${page}: ${name} is not exported by ${pkg}`);
				}
			}
		}
		assert.deepEqual(problems, []);
	});

	const demoSource = read(join(docsRoot, 'src/demos/index.ts'));
	const demoNames = [...demoSource.matchAll(/^\t'?([\w-]+)'?:\s*\{/gm)].map((match) => match[1]);

	it('only embed demos that exist', () => {
		assert.ok(demoNames.length >= 10, `found the demos (${demoNames.length})`);
		const used = pages.flatMap((page) => [...read(page).matchAll(/<Demo\s+name="([^"]+)"/g)].map((match) => `${page}: ${match[1]}`));
		const missing = used.filter((use) => !demoNames.includes(use.split(': ')[1]));
		assert.deepEqual(missing, []);
	});

	it('have a page that uses them', () => {
		const text = pages.map(read).join('\n');
		const unused = demoNames.filter((name) => !text.includes(`<Demo name="${name}"`));
		assert.deepEqual(unused, []);
	});
});

describe('the pages', () => {
	it('each have a title and a description', () => {
		for (const page of pages) {
			const front = /^---\n([\s\S]*?)\n---/.exec(read(page))?.[1] ?? '';
			assert.match(front, /^title:/m, `${page} has a title`);
			assert.match(front, /^description:/m, `${page} has a description`);
		}
	});
});
