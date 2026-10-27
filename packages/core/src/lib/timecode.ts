const pad = (n: number) => String(n).padStart(2, '0');

/** Format a frame number as `m:ss.ff` (ff = frame within the second). */
export function formatTimecode(frame: number, fps: number): string {
	const whole = Math.max(0, Math.round(frame));
	const perSecond = Math.max(1, Math.round(fps));
	const seconds = Math.floor(whole / perSecond);
	return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}.${pad(whole % perSecond)}`;
}
