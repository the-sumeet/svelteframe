import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export const COMPOSITION_CANDIDATES = [
	'src/compositions.ts',
	'src/compositions.js',
	'src/lib/compositions/index.ts',
	'src/lib/compositions/index.js',
	'src/lib/compositions.ts',
	'src/lib/compositions.js',
	'compositions.ts',
	'compositions.js',
	'svelteframe.config.ts',
	'svelteframe.config.js'
];

/**
 * Find the file in `root` that exports the project's compositions.
 * If `customPath` is provided, verifies that it exists or throws.
 */
export function findCompositionsFile(root: string, customPath?: string): string | undefined {
	const resolvedRoot = resolve(root);

	if (customPath) {
		const target = isAbsolute(customPath) ? customPath : resolve(resolvedRoot, customPath);
		if (!existsSync(target)) {
			throw new Error(`Compositions file not found: ${customPath} (resolved to ${target})`);
		}
		return target;
	}

	for (const candidate of COMPOSITION_CANDIDATES) {
		const full = join(resolvedRoot, candidate);
		if (existsSync(full)) {
			return full;
		}
	}

	return undefined;
}
