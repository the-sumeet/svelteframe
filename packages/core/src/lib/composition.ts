import type { Component } from 'svelte';

export interface CompositionMetadata {
	fps: number;
	width: number;
	height: number;
	durationInFrames: number;
}

export interface CalculateMetadataArgs<P> {
	/** Default props with the input props merged over them. */
	props: P;
}

export interface CompositionConfig<P extends Record<string, any>> extends CompositionMetadata {
	/** Used in URLs and on the command line: letters, digits, `-` and `_`. */
	id: string;
	component: Component<P>;
	defaultProps?: P;
	/** Override the metadata above from the final props, e.g. a duration that depends on them. */
	calculateMetadata?: (
		args: CalculateMetadataArgs<P>
	) => Partial<CompositionMetadata> | Promise<Partial<CompositionMetadata>>;
}

export interface CompositionDefinition<P extends Record<string, any> = Record<string, any>>
	extends CompositionConfig<P> {
	defaultProps: P;
}

export type AnyComposition = CompositionDefinition<any>;

export interface ResolvedComposition<P> {
	props: P;
	metadata: CompositionMetadata;
}

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertMetadata(metadata: CompositionMetadata, where: string): void {
	const { fps, width, height, durationInFrames } = metadata;
	if (!(Number.isFinite(fps) && fps > 0)) {
		throw new Error(`${where}: fps must be a positive number, got ${fps}`);
	}
	for (const [name, value] of [
		['width', width],
		['height', height],
		['durationInFrames', durationInFrames]
	] as const) {
		if (!Number.isInteger(value) || value <= 0) {
			throw new Error(`${where}: ${name} must be a positive integer, got ${value}`);
		}
	}
}

/** Declare a video that can be previewed and rendered by id. */
export function defineComposition<P extends Record<string, any> = Record<string, never>>(
	config: CompositionConfig<P>
): CompositionDefinition<P> {
	if (!ID_PATTERN.test(config.id)) {
		throw new Error(
			`defineComposition: id "${config.id}" may only contain letters, digits, "-" and "_"`
		);
	}
	assertMetadata(config, `Composition "${config.id}"`);
	return { ...config, defaultProps: config.defaultProps ?? ({} as P) };
}

/**
 * The props and metadata a composition runs with: input props merged over the defaults,
 * then `calculateMetadata` applied on top of the declared metadata.
 */
export async function resolveComposition<P extends Record<string, any>>(
	definition: CompositionDefinition<P>,
	inputProps: Partial<P> | Record<string, unknown> = {}
): Promise<ResolvedComposition<P>> {
	const props = { ...definition.defaultProps, ...inputProps } as P;
	const { fps, width, height, durationInFrames } = definition;
	const overrides = (await definition.calculateMetadata?.({ props })) ?? {};
	const metadata = { fps, width, height, durationInFrames, ...overrides };
	assertMetadata(metadata, `Composition "${definition.id}" calculateMetadata`);
	return { props, metadata };
}
