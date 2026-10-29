import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesUnder } from '../test/exports.ts';

/**
 * Checks the built site: every internal link and asset must resolve to a built page or file, and a
 * `#fragment` must name an element of the page it points at. Run `pnpm build` first.
 */
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
if (!existsSync(dist)) {
	console.error('There is no dist/ folder. Run "pnpm build" first.');
	process.exit(1);
}

/** The built file a site path stands for, if there is one. */
function fileFor(path: string): string | undefined {
	const clean = decodeURIComponent(path.replace(/^\//, ''));
	for (const candidate of [clean, join(clean, 'index.html'), `${clean}.html`]) {
		const file = join(dist, candidate);
		if (existsSync(file) && !file.endsWith('/') && candidate !== '') return file;
	}
	return clean === '' ? join(dist, 'index.html') : undefined;
}

const ids = new Map<string, Set<string>>();
function idsOf(file: string): Set<string> {
	let found = ids.get(file);
	if (!found) {
		found = new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
		ids.set(file, found);
	}
	return found;
}

const problems: string[] = [];
let checked = 0;
for (const page of filesUnder(dist, ['.html'])) {
	const pagePath = '/' + page.slice(dist.length + 1).replace(/index\.html$/, '');
	const html = readFileSync(page, 'utf8');
	for (const [, attribute, value] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
		if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/.test(value) || value === '') continue;
		const target = new URL(value, `http://site${pagePath}`);
		checked++;
		const file = target.pathname === pagePath ? page : fileFor(target.pathname);
		if (!file) {
			problems.push(`${pagePath}: ${attribute}="${value}" points at nothing`);
		} else if (target.hash && file.endsWith('.html') && !idsOf(file).has(decodeURIComponent(target.hash.slice(1)))) {
			problems.push(`${pagePath}: ${attribute}="${value}" has no element with id "${target.hash.slice(1)}"`);
		}
	}
}

if (problems.length > 0) {
	console.error([...new Set(problems)].join('\n'));
	console.error(`\n${problems.length} broken link(s) in ${checked} checked.`);
	process.exit(1);
}
console.log(`All ${checked} internal links and assets resolve.`);
