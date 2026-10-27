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
		/** Sound recorded by `<Audio>` while rendering, for the renderer to mix. */
		readonly audio?: readonly unknown[];
	}

	interface Window {
		__Svelteframe?: SvelteframeBridge;
		/** Set by the error page so the renderer can fail with the reason. */
		__SvelteframeError?: string;
	}
}

export {};
