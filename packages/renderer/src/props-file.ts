import { readFile } from 'node:fs/promises';
import { assertProps, type Props } from './url.js';

/** Read input props from a JSON file, with errors that name the file. */
export async function readPropsFile(file: string): Promise<Props> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(file, 'utf8'));
	} catch (err) {
		throw new Error(`Could not read props from ${file}: ${(err as Error).message}`);
	}
	return assertProps(parsed, file);
}
