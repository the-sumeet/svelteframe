// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/** Control surface the renderer drives via Playwright. */
	interface SvelteframeBridge {
		config: {
			fps: number;
			width: number;
			height: number;
			durationInFrames: number;
		};
		ready: boolean;
		/** Resolves once the DOM reflects frame `n`. */
		setFrame(n: number): Promise<void>;
	}

	interface Window {
		__Svelteframe?: SvelteframeBridge;
	}
}

export {};
