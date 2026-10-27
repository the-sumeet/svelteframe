import { getContext, setContext } from 'svelte';

export interface SeriesEntry {
	readonly durationInFrames: number;
	/** Shifts the start relative to the end of the previous item; negative overlaps. */
	readonly offset: number;
}

/** Tracks the items of a `<Series>` in render order so each can derive its start frame. */
export class SeriesState {
	#entries = $state.raw<SeriesEntry[]>([]);

	register(entry: SeriesEntry): void {
		this.#entries = [...this.#entries, entry];
	}

	unregister(entry: SeriesEntry): void {
		this.#entries = this.#entries.filter((e) => e !== entry);
	}

	startOf(entry: SeriesEntry): number {
		let end = 0;
		for (const e of this.#entries) {
			const start = end + e.offset;
			if (e === entry) return start;
			end = start + e.durationInFrames;
		}
		return 0;
	}
}

const SERIES_KEY = Symbol('svelteframe.series');

export function setSeries(series: SeriesState): void {
	setContext(SERIES_KEY, series);
}

export function useSeries(): SeriesState {
	const series = getContext<SeriesState | undefined>(SERIES_KEY);
	if (!series) throw new Error('<SeriesItem> must be used inside a <Series>');
	return series;
}
