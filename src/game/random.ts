// Small random helpers (like ZenGM's src/common/random.ts).
// Written for you so you can focus on game design.

/** Random integer between min and max, both included. */
export const randInt = (min: number, max: number): number =>
	Math.floor(Math.random() * (max - min + 1)) + min;

/** Random pick from a list. */
export const choice = <T,>(list: readonly T[]): T =>
	list[Math.floor(Math.random() * list.length)];

/** Roughly bell-curve random number (sum of 3 uniforms). */
export const gauss = (mean: number, sd: number): number => {
	const u = (Math.random() + Math.random() + Math.random()) / 3; // 0..1, centered on 0.5
	return mean + (u - 0.5) * 2 * sd * 1.7;
};

/** Keep a number between min and max. */
export const clamp = (x: number, min = 0, max = 100): number =>
	Math.max(min, Math.min(max, x));

/** Average of a list (0 for an empty list, to avoid NaN). */
export const average = (values: number[]): number =>
	values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
