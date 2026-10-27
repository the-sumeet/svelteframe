import type { EasingFunction } from './easing.js';

export type ExtrapolateType = 'clamp' | 'extend' | 'identity';

export interface InterpolateOptions {
	/** Behaviour when `input` is below the first point of `inputRange`. Default `'clamp'`. */
	extrapolateLeft?: ExtrapolateType;
	/** Behaviour when `input` is above the last point of `inputRange`. Default `'clamp'`. */
	extrapolateRight?: ExtrapolateType;
	/** Applied to the 0..1 progress within the active segment. */
	easing?: EasingFunction;
}

function validate(inputRange: readonly number[], outputRange: readonly number[]) {
	if (inputRange.length !== outputRange.length) {
		throw new Error(
			`interpolate: inputRange (${inputRange.length}) and outputRange (${outputRange.length}) must have the same length`
		);
	}
	if (inputRange.length < 2) {
		throw new Error('interpolate: ranges must contain at least 2 points');
	}
	for (let i = 0; i < inputRange.length; i++) {
		if (!Number.isFinite(inputRange[i]) || !Number.isFinite(outputRange[i])) {
			throw new Error('interpolate: range values must be finite numbers');
		}
		if (i > 0 && inputRange[i] <= inputRange[i - 1]) {
			throw new Error('interpolate: inputRange must be strictly increasing');
		}
	}
}

/**
 * Map `input` from `inputRange` onto `outputRange`, piecewise-linearly across
 * any number of points (e.g. `[0, 10, 20] -> [0, 1, 0]`).
 */
export function interpolate(
	input: number,
	inputRange: readonly number[],
	outputRange: readonly number[],
	opts: InterpolateOptions = {}
): number {
	validate(inputRange, outputRange);
	if (Number.isNaN(input)) throw new Error('interpolate: input must not be NaN');

	const { extrapolateLeft = 'clamp', extrapolateRight = 'clamp', easing } = opts;
	const last = inputRange.length - 1;

	if (input < inputRange[0]) {
		if (extrapolateLeft === 'clamp') return outputRange[0];
		if (extrapolateLeft === 'identity') return input;
	}
	if (input > inputRange[last]) {
		if (extrapolateRight === 'clamp') return outputRange[last];
		if (extrapolateRight === 'identity') return input;
	}

	// Pick the segment containing `input`; out-of-range inputs ('extend') use the edge segment.
	let i = 1;
	while (i < last && input > inputRange[i]) i++;

	const [in0, in1] = [inputRange[i - 1], inputRange[i]];
	const [out0, out1] = [outputRange[i - 1], outputRange[i]];

	let t = (input - in0) / (in1 - in0);
	if (easing) t = easing(t);
	return out0 + t * (out1 - out0);
}
