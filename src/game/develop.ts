import { RETIRE_RATE, RETIRE_START_AGE } from "./constants";
import { fadeMentoring } from "./mentor";
import { ovr } from "./ovr";
import { clamp, gauss } from "./random";
import { lateBloom } from "./traits";
import { ATTRIBUTE_KEYS } from "./types";
import type { Person } from "./types";

/** Estimated peak overall: young people still have room to grow. */
export const estimatePot = (currentOvr: number, age: number, role: Person["role"] = "actor"): number =>
	Math.round(clamp(currentOvr + Math.max(0, growthLeft(age, role))));

/**
 * Age at which a person has finished developing. Actors mature by about 29; directors keep
 * improving into their mid 30s (craft takes longer than screen presence).
 */
export const PEAK_AGE = { actor: 29, director: 35 };

/**
 * Average yearly attribute change by age (compare ZenGM's developSeason).
 * Directors and actors both grow while young and then hold a long plateau, but a director's
 * plateau is much longer: Scorsese, Miyazaki or Eastwood did their best work in their 60s-80s.
 */
export const ageDelta = (age: number, role: Person["role"] = "actor"): number => {
	if (role === "director") {
		if (age <= 28) return 3.5;
		if (age <= 35) return 1.5;
		if (age <= 62) return 0; // long plateau
		if (age <= 72) return -0.4;
		if (age <= 80) return -0.9;
		return -1.8;
	}
	if (age <= 24) return 3.5;
	if (age <= 28) return 2;
	if (age <= 46) return 0; // plateau (was 40)
	if (age <= 56) return -0.3;
	if (age <= 65) return -0.8;
	return -1.5;
};

/** Expected rating growth between `age` and the age this role peaks. Used to give newcomers room to grow. */
export const growthLeft = (age: number, role: Person["role"]): number => {
	let total = 0;
	for (let a = age + 1; a <= PEAK_AGE[role]; a++) total += ageDelta(a, role);
	return total;
};

/**
 * The best this person ever was: the highest overall seen so far (or right now, if that is higher),
 * with the attributes they had then. Used by the all-time rankings so a veteran in decline, or a
 * retired legend, is judged at their best rather than at their final ratings.
 */
export const peakOf = (p: Person): NonNullable<Person["peak"]> => {
	const now = ovr(p.attrs, p.role);
	return p.peak && p.peak.ovr >= now ? p.peak : { ovr: now, attrs: { ...p.attrs } };
};

/** One year older: age + attribute changes + new potential. Returns a new Person. */
export const developPerson = (p: Person, season?: number): Person => {
	const age = p.age + 1;
	const attrs = { ...p.attrs };
	for (const key of ATTRIBUTE_KEYS) {
		attrs[key] = Math.round(clamp(attrs[key] + gauss(ageDelta(age, p.role), 4)));
	}
	const aged = lateBloom({ ...fadeMentoring(p), age, attrs, pot: estimatePot(ovr(attrs, p.role), age, p.role) });
	const next = { ...aged, peak: peakOf({ ...aged, peak: peakOf(p) }) };
	if (season === undefined) return next;
	// Remember the rating at the start of each season (seeded with last season's, so the graph has a first point).
	const before = p.history ?? [{ season: season - 1, ovr: Math.round(ovr(p.attrs, p.role)) }];
	return { ...next, history: [...before.filter((h) => h.season !== season), { season, ovr: Math.round(ovr(attrs, p.role)) }] };
};

/** Chance of retiring grows every year after the retirement age (later for directors). */
export const shouldRetire = (p: Person): boolean => {
	const start = RETIRE_START_AGE[p.role];
	return p.age > start && Math.random() < Math.min(1, (p.age - start) * RETIRE_RATE);
};
