/** One entry of the project's `/svelteframe/compositions.json`. */
export interface CompositionListing {
	id: string;
	fps: number;
	width: number;
	height: number;
	durationInFrames: number;
	defaultProps: Record<string, unknown>;
	/** The length (or size) can change depending on the props. */
	calculatesMetadata: boolean;
}

/** Check what a project served as its composition list. */
export function parseListing(value: unknown): CompositionListing[] {
	if (!Array.isArray(value)) throw new Error('the composition list is not an array');
	return value.map((entry, i) => {
		const where = `composition list entry ${i}`;
		if (typeof entry !== 'object' || entry === null) throw new Error(`${where} is not an object`);
		const { id, fps, width, height, durationInFrames, defaultProps, calculatesMetadata } = entry as Record<string, unknown>;
		if (typeof id !== 'string' || id === '') throw new Error(`${where}: id must be a string`);
		for (const [name, v] of Object.entries({ fps, width, height, durationInFrames })) {
			if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${where} (${id}): ${name} must be a number`);
		}
		return {
			id,
			fps: fps as number,
			width: width as number,
			height: height as number,
			durationInFrames: durationInFrames as number,
			defaultProps: typeof defaultProps === 'object' && defaultProps !== null ? (defaultProps as Record<string, unknown>) : {},
			calculatesMetadata: calculatesMetadata === true
		};
	});
}

/** A table of compositions for the terminal. */
export function formatListing(list: CompositionListing[]): string {
	if (list.length === 0) return 'No compositions found.';

	const rows = list.map((c) => [
		c.id,
		`${c.width}×${c.height}`,
		String(c.fps),
		String(c.durationInFrames),
		`${(c.durationInFrames / c.fps).toFixed(1)}s${c.calculatesMetadata ? '*' : ''}`,
		Object.keys(c.defaultProps).join(', ') || '-'
	]);
	const table = [['ID', 'SIZE', 'FPS', 'FRAMES', 'LENGTH', 'PROPS'], ...rows];
	const widths = table[0].map((_, column) => Math.max(...table.map((row) => row[column].length)));
	const lines = table.map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd());

	if (list.some((c) => c.calculatesMetadata)) lines.push('', '* the length depends on the props');
	return lines.join('\n');
}
