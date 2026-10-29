import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(docsRoot, '../..');

/** The entry file of each documented package. */
export const packages = {
	'@svelteframe/core': join(repoRoot, 'packages/core/src/lib/index.ts'),
	'@svelteframe/shapes': join(repoRoot, 'packages/shapes/src/lib/index.ts'),
	'@svelteframe/renderer': join(repoRoot, 'packages/renderer/src/index.ts')
} as const;

/** Names a package's entry file exports, from its `export { a, type B, c as d } from ...` lines. */
export function exportedNames(entry: string): string[] {
	const source = readFileSync(entry, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	const names: string[] = [];
	for (const [, list] of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
		for (const item of list.split(',')) {
			const name = item.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim();
			if (name) names.push(name);
		}
	}
	return [...new Set(names)].sort();
}

/** Every file under `dir` with one of the extensions. */
export function filesUnder(dir: string, extensions: string[]): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return filesUnder(path, extensions);
		return extensions.some((extension) => name.endsWith(extension)) ? [path] : [];
	});
}
