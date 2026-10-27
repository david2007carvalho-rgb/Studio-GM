import { ovr } from "./ovr";
import { clamp } from "./random";
import { TRAIT_IDS } from "./types";
import type { GameState, Movie, Person, TraitId } from "./types";

// ═════════════════════════════════════════════════════════════
// Talent personality traits.
//
// Every person has 0-2 traits (Diva, Workaholic, Injury-prone, Loyal, Scandal-prone, Mentor, Peacemaker, Press darling).
// They are HIDDEN at first. A trait becomes known (Person.knownTraits) when
//   - it was public knowledge from the start (a fraction of them: see `known` below),
//   - it causes a drama event on a film (news/drama.ts reveals it in the article), or
//   - you work with the person: every film they make has a chance to show you who they are (discoverFromFilm).
// What a trait DOES works whether or not you know it. That is the point: scouting the people you cast pays off.
//
// The drama engine (news/drama.ts) reads three numbers from each trait:
//   odds  : how much likelier (or rarer) an event is when this person is on the film
//   tilt  : how the outcomes of an event lean when it is about this person (more hurt, more helped, more "nothing happened")
//   heat  : how much more (or less) often the film has *any* event at all, per stage
// Traits of several people on the same film add up (see traitOdds, stageHeat).
// Tuning: edit TRAITS below. Nothing else needs to change.
// ═════════════════════════════════════════════════════════════

export type Effect = "hurt" | "helped" | "none";
export type Stage = "production" | "post" | "release";

export type TraitDef = {
	id: TraitId;
	label: string;
	tone: "good" | "bad" | "mixed"; // for the colour of the chip
	blurb: string; // what the player reads
	/** Relative frequency among people who get a trait, for actors and directors. 0 = never. */
	freq: { actor: number; director: number };
	/** Chance that the trait is already public knowledge when the person is created. */
	known: number;
	/** Said in the news when the trait comes out: "<name> <tell>". */
	tell: string;
	odds: Record<string, number>;
	tilt: Record<string, Partial<Record<Effect, number>>>;
	heat: Partial<Record<Stage, number>>;
};

export const TRAITS: Record<TraitId, TraitDef> = {
	diva: {
		id: "diva",
		label: "Diva",
		tone: "bad",
		blurb: "Wants the spotlight. Feuds, walkouts and costly demands are much likelier, and the shoot is rarely quiet.",
		freq: { actor: 10, director: 6 },
		known: 0.3,
		tell: "has a long reputation for being difficult on set",
		odds: { feud: 2.2, walkout: 3.2, castClash: 2.5, finalCut: 1.5, controversy: 1.3, meddling: 1.3 },
		tilt: { walkout: { hurt: 1.35, none: 0.55 }, feud: { hurt: 1.25, helped: 0.8 } },
		heat: { production: 0.45, post: 0.15, release: 0.2 },
	},
	workaholic: {
		id: "workaholic",
		label: "Workaholic",
		tone: "mixed",
		blurb: "Lives on set. Marathon shoots and deep commitment lift the film, but exhaustion causes accidents.",
		freq: { actor: 12, director: 12 },
		known: 0.2,
		tell: "is known for never leaving the set",
		odds: { injury: 1.6, walkout: 0.3, overrun: 0.8, method: 1.3, feud: 0.8 },
		tilt: { method: { helped: 1.3, hurt: 0.5 }, injury: { hurt: 1.2 }, perfectionist: { helped: 1.2, hurt: 0.7 }, overrun: { hurt: 0.8 } },
		heat: { production: 0.15 },
	},
	injuryProne: {
		id: "injuryProne",
		label: "Injury-prone",
		tone: "bad",
		blurb: "Gets hurt far more often than anyone else, and the injuries tend to stick.",
		freq: { actor: 10, director: 0 },
		known: 0.25,
		tell: "has a history of injuries on set",
		odds: { injury: 4.5 },
		tilt: { injury: { hurt: 1.5, none: 0.5 } },
		heat: { production: 0.2 },
	},
	loyal: {
		id: "loyal",
		label: "Loyal",
		tone: "good",
		blurb: "Sticks with the studio that gave them work. Rarely walks off, backs the crew when a shoot gets rough, and needs less reputation from a studio they have already worked for.",
		freq: { actor: 12, director: 12 },
		known: 0.15,
		tell: "is known for sticking by the people who hired them",
		odds: { walkout: 0.25, feud: 0.55, castClash: 0.5, finalCut: 0.8 },
		tilt: { feud: { hurt: 0.6, none: 1.3, helped: 1.2 }, walkout: { hurt: 0.6, none: 1.6 }, overrun: { helped: 1.4 } },
		heat: { production: -0.1, post: -0.05 },
	},
	scandalProne: {
		id: "scandalProne",
		label: "Scandal-prone",
		tone: "bad",
		blurb: "A tabloid magnet. Bad headlines tend to land just before release, and controversies and boycotts find their films.",
		freq: { actor: 9, director: 3 },
		known: 0.35,
		tell: "is a fixture in the tabloids",
		odds: { scandal: 4.5, castClash: 1.3, controversy: 1.7, boycott: 1.6, reviewBomb: 1.4 },
		tilt: { scandal: { hurt: 1.35, none: 0.5 }, controversy: { hurt: 1.3, helped: 0.7 } },
		heat: { release: 0.4 },
	},
	mentor: {
		id: "mentor",
		label: "Mentor",
		tone: "good",
		blurb: "A natural teacher. Younger castmates pick up specialties from them much faster, and shoots with a protégé run smoother.",
		freq: { actor: 8, director: 4 },
		known: 0.2,
		tell: "is known for taking young actors under their wing",
		odds: { feud: 0.8 },
		tilt: { feud: { helped: 1.3 }, method: { hurt: 0.6 } },
		heat: { production: -0.05 },
	},
	peacemaker: {
		id: "peacemaker",
		label: "Peacemaker",
		tone: "good",
		blurb: "Calms the set. Feuds, walkouts and studio fights rarely get out of hand around them.",
		freq: { actor: 9, director: 9 },
		known: 0.15,
		tell: "is known for keeping the peace on difficult sets",
		odds: { feud: 0.3, walkout: 0.35, castClash: 0.3, finalCut: 0.65, meddling: 0.8, controversy: 0.85 },
		tilt: { feud: { hurt: 0.55, none: 1.6, helped: 1.2 }, walkout: { hurt: 0.5, none: 1.8 }, finalCut: { hurt: 0.7, none: 1.5 }, meddling: { hurt: 0.7, none: 1.5 } },
		heat: { production: -0.25, post: -0.15 },
	},
	darling: {
		id: "darling",
		label: "Press darling",
		tone: "good",
		blurb: "The press and the public love them. Buzz, viral moments and cameos come easier, and bad press bounces off.",
		freq: { actor: 7, director: 3 },
		known: 0.4,
		tell: "is a darling of the press",
		odds: { viral: 2, cameo: 1.6, romance: 2.2, festival: 1.3, boycott: 0.7, reviewBomb: 0.7 },
		tilt: { scandal: { hurt: 0.6, none: 2 }, controversy: { hurt: 0.7, helped: 1.5 }, boycott: { hurt: 0.7, none: 1.5 } },
		heat: { production: 0.05, release: 0.15 },
	},
};

/** Traits that cannot live in one person. */
const CLASH: [TraitId, TraitId][] = [["diva", "peacemaker"], ["diva", "loyal"], ["scandalProne", "peacemaker"]];

/** Hidden mentor mechanic (mentor.ts): how many times faster a student learns from a teacher with the Mentor trait. */
export const MENTOR_TRAIT_GAIN = 1.7;
/** Reputation points a Loyal person asks for less from a studio they have already worked for. */
export const LOYAL_REP_DISCOUNT = 10;
/** Chance per film, per hidden trait, that working on it shows you the trait: your own films, then everyone else's. */
const LEARN_CHANCE = { mine: 0.3, others: 0.08 };
/** Chance that a trait that caused an event is named in the article (events made *by* a trait are always named). */
const REVEAL_ON_EVENT = 0.8;

export const hasTrait = (p: Pick<Person, "traits">, id: TraitId): boolean => !!p.traits?.includes(id);
export const isKnown = (p: Pick<Person, "knownTraits">, id: TraitId): boolean => !!p.knownTraits?.includes(id);
export const knownTraitsOf = (p: Pick<Person, "traits" | "knownTraits">): TraitId[] => (p.traits ?? []).filter((id) => isKnown(p, id));
/** True while the person has traits the player has not discovered yet. */
export const hasHiddenTraits = (p: Pick<Person, "traits" | "knownTraits">): boolean => (p.traits ?? []).some((id) => !isKnown(p, id));

/** Make a trait public. Returns true if it was news. Mutates (call it on a copy of the state). */
export const reveal = (p: Person, id: TraitId): boolean => {
	if (!hasTrait(p, id) || isKnown(p, id)) return false;
	p.knownTraits = [...(p.knownTraits ?? []), id];
	return true;
};

// ── making traits ────────────────────────────────────────────

/** Small seeded random numbers, so the same name always gets the same personality (real roster, old saves). */
const hashString = (s: string): number => {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
};
export const seededRandom = (seed: string): (() => number) => {
	let a = hashString(`traits:${seed}`);
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** How likely each trait is for this person: stars are more often divas and tabloid regulars, mentors need years behind them. */
const traitWeight = (id: TraitId, role: Person["role"], age: number, rating: number): number => {
	let w = TRAITS[id].freq[role];
	if (id === "diva") w *= rating >= 78 ? 1.8 : rating < 60 ? 0.4 : 1;
	if (id === "scandalProne" || id === "darling") w *= rating >= 78 ? 1.5 : rating < 55 ? 0.6 : 1;
	if (id === "mentor") w *= age < 32 ? 0 : age < 40 ? 0.6 : age >= 45 ? 1.6 : 1;
	return w;
};

/**
 * Roll a personality. 42% of people have no trait, 42% one, 16% two.
 * `rand` is Math.random for newcomers and a seeded generator for the real roster.
 */
export const genTraits = (role: Person["role"], age: number, rating: number, rand: () => number = Math.random): { traits: TraitId[]; knownTraits: TraitId[] } => {
	const roll = rand();
	const count = roll < 0.42 ? 0 : roll < 0.84 ? 1 : 2;
	const traits: TraitId[] = [];
	for (let n = 0; n < count; n++) {
		const pool = TRAIT_IDS.filter((id) => !traits.includes(id) && !CLASH.some(([a, b]) => (a === id && traits.includes(b)) || (b === id && traits.includes(a))))
			.map((id) => ({ id, w: traitWeight(id, role, age, rating) }))
			.filter((x) => x.w > 0);
		const total = pool.reduce((sum, x) => sum + x.w, 0);
		if (total <= 0) break;
		let r = rand() * total;
		const chosen = pool.find((x) => (r -= x.w) <= 0) ?? pool[pool.length - 1];
		traits.push(chosen.id);
	}
	const knownTraits = traits.filter((id) => rand() < TRAITS[id].known);
	return { traits, knownTraits };
};

/** Give a person from the real roster (or an old save) the personality their name always gets. */
export const withTraits = <P extends Person>(p: P): P => {
	if (p.traits) return p;
	return { ...p, ...genTraits(p.role, p.age, ovr(p.attrs, p.role), seededRandom(p.name)) };
};

/** Off-season: a veteran may grow into a mentor (hidden until they show it). Returns the person unchanged most of the time. */
export const lateBloom = (p: Person): Person => {
	if (p.age < 38 || p.age > 52 || !p.traits || hasTrait(p, "mentor") || p.traits.length >= 2) return p;
	if (p.traits.some((id) => CLASH.some(([a, b]) => (a === id && b === "mentor") || (b === id && a === "mentor")))) return p;
	return Math.random() < 0.05 ? { ...p, traits: [...p.traits, "mentor"] } : p;
};

// ── what traits do to the drama ──────────────────────────────

/**
 * Whose traits count for an event: only the cast (injuries, walkouts, scandals...), only the director (final cut, rewrites...) or everyone.
 * Events not listed count everyone.
 */
const SCOPE: Record<string, "cast" | "director"> = {
	injury: "cast", walkout: "cast", method: "cast", romance: "cast", scandal: "cast", cameo: "cast", viral: "cast",
	castClash: "cast", divaDemands: "cast", mentorship: "cast", rallies: "cast", marathon: "cast",
	finalCut: "director", rewrite: "director", perfectionist: "director", thinIce: "director", reshoots: "director", meddling: "director", composer: "director",
};

/** The people whose traits count for this event. */
export const concerned = (key: string, director: Person, cast: Person[]): Person[] => {
	const scope = SCOPE[key];
	return scope === "cast" ? cast : scope === "director" ? [director] : [director, ...cast];
};

const ODDS_RANGE = [0.15, 4.5] as const;

/** How many times likelier an event is on this film, from the personalities involved (1 = no change). Effects of several people add up. */
export const traitOdds = (key: string, people: Person[]): number => {
	let m = 1;
	for (const p of people) for (const id of p.traits ?? []) m += (TRAITS[id].odds[key] ?? 1) - 1;
	return clamp(m, ODDS_RANGE[0], ODDS_RANGE[1]);
};

/** How much more (or less) often a film has any event at this stage, from the personalities involved (1 = no change). */
export const stageHeat = (stage: Stage, people: Person[]): number => {
	let m = 1;
	for (const p of people) for (const id of p.traits ?? []) m += TRAITS[id].heat[stage] ?? 0;
	return clamp(m, 0.55, 2.6);
};

/** How the outcomes of an event lean when it is about these people: a multiplier for each outcome's weight. */
export const outcomeTilt = (key: string, effect: Effect, subjects: Person[]): number => {
	let m = 1;
	for (const p of subjects) for (const id of p.traits ?? []) m *= TRAITS[id].tilt[key]?.[effect] ?? 1;
	return clamp(m, 0.1, 6);
};

/** Which person an event is about: more likely the one whose traits make it likelier. Leads are favoured over supporting players. */
export const chooseSubject = (key: string, cast: Person[], isLeadOf: (p: Person) => boolean, extra: (p: Person) => number = () => 1, rand: () => number = Math.random): Person => {
	const weights = cast.map((p) => (isLeadOf(p) ? 1 : 0.35) * traitOdds(key, [p]) * extra(p));
	let r = rand() * weights.reduce((a, b) => a + b, 0);
	for (let i = 0; i < cast.length; i++) {
		r -= weights[i];
		if (r <= 0) return cast[i];
	}
	return cast[cast.length - 1];
};

/** The trait of this person that did the most to make the event happen (null = pure chance). */
export const causeOf = (key: string, p: Person): TraitId | null => {
	let best: TraitId | null = null;
	let bestOdds = 1;
	for (const id of p.traits ?? []) {
		const o = TRAITS[id].odds[key] ?? 1;
		if (o > bestOdds) {
			best = id;
			bestOdds = o;
		}
	}
	return best;
};

/** Events that exist only because of a trait, and the trait they come from. */
export const GATED: Record<string, TraitId> = { divaDemands: "diva", mentorship: "mentor", rallies: "loyal", marathon: "workaholic" };

/** Should the article name the trait that caused it? Gated events always do. */
export const revealsOnEvent = (key: string): boolean => key in GATED || Math.random() < REVEAL_ON_EVENT;

// ── what traits do outside the drama ─────────────────────────

/** Reputation points off what this person asks of your studio (a Loyal person you have worked with before). */
export const loyaltyDiscount = (state: Pick<GameState, "movies" | "userTid">, p: Person): number => {
	if (!hasTrait(p, "loyal")) return 0;
	const worked = state.movies.some((m) => m.tid === state.userTid && (m.directorPid === p.pid || m.castPids.includes(p.pid)));
	return worked ? LOYAL_REP_DISCOUNT : 0;
};

/**
 * A released film shows the people who made it for who they are: each hidden trait may come out.
 * Mutates the people in `state`. Returns lines for the player about what THEY learned (your own films only).
 */
export const discoverFromFilm = (state: GameState, m: Movie): string[] => {
	const mine = m.tid === state.userTid;
	const notes: string[] = [];
	for (const pid of [m.directorPid, ...m.castPids]) {
		const p = state.people.find((x) => x.pid === pid);
		if (!p) continue;
		for (const id of p.traits ?? []) {
			if (isKnown(p, id) || Math.random() >= (mine ? LEARN_CHANCE.mine : LEARN_CHANCE.others)) continue;
			reveal(p, id);
			if (mine) notes.push(`Working on ${m.title} showed you something about ${p.name}: ${TRAITS[id].label}.`);
		}
	}
	return notes;
};
