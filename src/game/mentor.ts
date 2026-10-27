import { GENRE_SPECIALTIES, MENTOR_AGE_SLOWDOWN, MENTOR_ATTR_BOOST, MENTOR_DECAY, MENTOR_GAIN, MENTOR_LEARNED_FLOOR, MENTOR_MAX_AGE_FACTOR, MENTOR_PRUNE, MENTOR_START_AGE, SPECIALTY_ATTRIBUTES } from "./constants";
import { clamp } from "./random";
import { MENTOR_TRAIT_GAIN, hasTrait, reveal } from "./traits";
import type { Movie, Person, ProductionRatings, Specialty } from "./types";

// ═════════════════════════════════════════════════════════════
// Hidden mentor mechanic. Nothing here is shown in the UI.
//
// When a film is released, every actor in its cast who still has room for another specialty
// can learn from a castmate who has a specialty that fits the film's genre. One film is never
// enough: each film only adds a little "mentoring progress" (Person.mentoring, 0 to 1) towards
// that specialty and nudges the student's matching attributes up. At 1 the specialty is learned.
// Young actors gain faster than old ones, and progress slowly fades if they stop working with
// people who have the specialty (see fadeMentoring, run every off-season).
// ═════════════════════════════════════════════════════════════

/** How many specialties a person can hold (very versatile people can hold three). */
export const maxSpecialties = (r: ProductionRatings): number => (r.versatility >= 85 ? 3 : 2);

const specialtyScore = (r: ProductionRatings, s: Specialty): number => {
	const keys = SPECIALTY_ATTRIBUTES[s];
	return keys.reduce((sum, key) => sum + r[key], 0) / keys.length;
};

/** 1 for young actors, growing with age: how many times slower an actor of this age learns. */
const ageFactor = (age: number): number =>
	Math.min(MENTOR_MAX_AGE_FACTOR, 1 + Math.max(0, age - MENTOR_START_AGE) * MENTOR_AGE_SLOWDOWN);

/** Round up or down at random so small fractional boosts still add up over several films. */
const stochasticRound = (x: number): number => Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);

/**
 * Apply one released film's mentoring to its cast. Mutates the people in place
 * (the caller works on a cloned state). Returns nothing: the mechanic is hidden.
 */
export const applyMentoring = (movie: Movie, cast: Person[]): void => {
	const learnable = GENRE_SPECIALTIES[movie.genre];
	for (const student of cast) {
		if (student.role !== "actor") continue;
		if (student.specialties.length >= maxSpecialties(student.attrs)) continue;
		for (const s of learnable) {
			if (student.specialties.includes(s)) continue;
			// The best teacher in the cast: a castmate who has this specialty.
			let teacher: Person | undefined;
			for (const other of cast) {
				if (other.pid === student.pid || other.role !== "actor" || !other.specialties.includes(s)) continue;
				if (!teacher || specialtyScore(other.attrs, s) > specialtyScore(teacher.attrs, s)) teacher = other;
			}
			if (!teacher) continue;

			const quality = clamp(specialtyScore(teacher.attrs, s) / 80, 0.8, 1.25);
			const luck = 0.8 + Math.random() * 0.4;
			const taughtByMentor = hasTrait(teacher, "mentor"); // a natural teacher (see traits.ts)
			const gain = (MENTOR_GAIN / ageFactor(student.age)) * quality * luck * (taughtByMentor ? MENTOR_TRAIT_GAIN : 1);

			// Skills rub off a little at a time, never past the teacher's own level.
			for (const key of SPECIALTY_ATTRIBUTES[s]) {
				const room = teacher.attrs[key] - student.attrs[key];
				if (room <= 0) continue;
				student.attrs[key] = Math.min(teacher.attrs[key], student.attrs[key] + stochasticRound(Math.min(room, gain * MENTOR_ATTR_BOOST)));
			}

			const progress = (student.mentoring?.[s] ?? 0) + gain;
			if (progress >= 1) {
				// Learned. Bring the defining attributes up to a believable level.
				for (const key of SPECIALTY_ATTRIBUTES[s]) student.attrs[key] = Math.max(student.attrs[key], MENTOR_LEARNED_FLOOR);
				student.specialties = [...student.specialties, s];
				if (taughtByMentor) reveal(teacher, "mentor"); // a protégé who learned a craft gives the teacher away
				if (student.mentoring) delete student.mentoring[s];
				break; // at most one new specialty per film
			}
			student.mentoring = { ...student.mentoring, [s]: progress };
		}
	}
};

/** Off-season: unused mentoring progress fades, and progress for specialties already learned is dropped. */
export const fadeMentoring = (p: Person): Person => {
	if (!p.mentoring) return p;
	const kept: Partial<Record<Specialty, number>> = {};
	for (const [s, v] of Object.entries(p.mentoring) as [Specialty, number][]) {
		const faded = v * MENTOR_DECAY;
		if (faded >= MENTOR_PRUNE && !p.specialties.includes(s)) kept[s] = faded;
	}
	const { mentoring: _old, ...rest } = p;
	return Object.keys(kept).length ? { ...rest, mentoring: kept } : rest;
};
