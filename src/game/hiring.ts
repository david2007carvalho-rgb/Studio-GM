import {
	ALWAYS_WILLING,
	DIFFICULTY_SETTINGS,
	PITCH_GAP_COST,
	PITCH_MAX_CHANCE,
	PITCH_MAX_GAP,
	PITCH_MIN_CHANCE,
	PITCH_SLOPE,
	RETIRED,
} from "./constants";
import { fmtMoney } from "./format";
import { ovr } from "./ovr";
import { clamp } from "./random";
import { talentAccessBonus } from "./streamingPerks";
import { loyaltyDiscount } from "./traits";
import type { DealTerms, Difficulty, GameState, Negotiation, Person, Pitch } from "./types";

/**
 * Studio reputation needed before this person agrees to work for you (0 = anyone).
 * Give `state` to take personality into account: a Loyal person asks less of a studio they have worked for (see traits.ts).
 */
export const requiredReputation = (difficulty: Difficulty, p: Person, state?: Pick<GameState, "movies" | "userTid">): number => {
	const { refusalFloor, refusalSlope } = DIFFICULTY_SETTINGS[difficulty];
	if (refusalFloor === null) return 0;
	const base = Math.max(0, Math.ceil((ovr(p.attrs, p.role) - refusalFloor) * refusalSlope));
	return state ? Math.max(0, base - loyaltyDiscount(state, p)) : base;
};

// The weakest people of each role always accept. Sorting everyone for every single check was the
// slow part, so we work it out once per `people` array (a new array = new state = recomputed).
const willingCache = new WeakMap<Person[], Set<number>>();
const alwaysWilling = (people: Person[]): Set<number> => {
	let set = willingCache.get(people);
	if (set) return set;
	set = new Set<number>();
	for (const role of ["director", "actor"] as const) {
		people
			.filter((x) => x.role === role && x.tid !== RETIRED)
			.map((x) => ({ pid: x.pid, o: ovr(x.attrs, role) }))
			.sort((a, b) => a.o - b.o)
			.slice(0, ALWAYS_WILLING[role])
			.forEach((x) => set!.add(x.pid));
	}
	willingCache.set(people, set);
	return set;
};

/** The pitch you made to this person this season, if any. */
export const pitchOf = (state: GameState, pid: number): Pitch | undefined => {
	const pitch = state.pitches?.[pid];
	return pitch && pitch.season === state.season ? pitch : undefined;
};

/** Talks with this person this season (advanced negotiations, see negotiate.ts). */
export const negotiationOf = (state: GameState, pid: number): Negotiation | undefined => {
	const n = state.negotiations?.[pid];
	return n && n.season === state.season ? n : undefined;
};

/** The deal you signed with this person this season, if any. */
export const signedDeal = (state: GameState, pid: number): (Negotiation & { terms: DealTerms }) | undefined => {
	const n = negotiationOf(state, pid);
	return n?.status === "signed" && n.terms ? (n as Negotiation & { terms: DealTerms }) : undefined;
};

/** What this person is paid for one film: a signed deal, or their price plus the premium of an accepted pitch. */
export const salaryOf = (state: GameState, p: Person): number => {
	const deal = signedDeal(state, p.pid);
	if (deal) return deal.terms.salary;
	const pitch = pitchOf(state, p.pid);
	return pitch?.accepted ? Math.round(p.contract.amount * (1 + pitch.premium)) : p.contract.amount;
};

/** Your reputation as talent sees it: the real one plus what running streaming contracts add (talentAccess perks). */
export const userReputation = (state: GameState): number =>
	Math.round(state.studios.find((s) => s.tid === state.userTid)?.reputation ?? 0) + Math.round(talentAccessBonus(state));

/** Reputation points you are short of what this person needs (0 = none). */
export const reputationGap = (state: GameState, p: Person): number =>
	Math.max(0, requiredReputation(state.difficulty, p, state) - userReputation(state));

/**
 * Chance an actor says yes to a pitch of `premium` extra salary. The bigger the reputation gap, the more
 * you must pay for the same odds. null = they will not take the meeting (not an actor, or too far out of your league).
 */
export const pitchChance = (state: GameState, p: Person, premium: number): number | null => {
	if (p.role !== "actor") return null;
	const gap = reputationGap(state, p);
	if (gap === 0 || gap > PITCH_MAX_GAP) return null;
	return clamp(0.5 + (premium - gap * PITCH_GAP_COST) * PITCH_SLOPE, PITCH_MIN_CHANCE, PITCH_MAX_CHANCE);
};

export type PitchResult = { ok: true; state: GameState; accepted: boolean; message: string } | { ok: false; error: string };

/** Pitch an actor who refuses you. One try per actor per season; a yes means you pay the premium when you greenlight. */
export const pitchActor = (state: GameState, pid: number, premium: number): PitchResult => {
	const p = state.people.find((x) => x.pid === pid && x.role === "actor" && x.tid !== RETIRED);
	if (!p) return { ok: false, error: "That actor is not available." };
	if (pitchOf(state, pid)) return { ok: false, error: `You already pitched ${p.name} this season.` };
	const chance = pitchChance(state, p, premium);
	if (chance === null) {
		return { ok: false, error: reputationGap(state, p) === 0 ? `${p.name} already works with you.` : `${p.name} will not even take a meeting with a studio this small.` };
	}
	const accepted = Math.random() < chance;
	const next = structuredClone(state);
	next.pitches = { ...(next.pitches ?? {}), [pid]: { season: state.season, premium, accepted } };
	const pay = fmtMoney(Math.round(p.contract.amount * (1 + premium)));
	const message = accepted
		? `${p.name} loved the pitch and will work with you this season for ${pay} (+${Math.round(premium * 100)}%).`
		: `${p.name} passed on your pitch. You cannot pitch them again this season.`;
	next.notice = message;
	return { ok: true, state: next, accepted, message };
};

/** null = they will work with you. Otherwise a message explaining why not. */
export const refusalReason = (state: GameState, p: Person): string | null => {
	if (pitchOf(state, p.pid)?.accepted || signedDeal(state, p.pid)) return null; // sold on your pitch or signed
	const needed = requiredReputation(state.difficulty, p, state);
	const reputation = userReputation(state);
	if (reputation >= needed) return null;

	// Safety net: the weakest people of each role always accept.
	if (alwaysWilling(state.people).has(p.pid)) return null;

	return `${p.name} refuses to work with a studio below reputation ${needed} (yours is ${reputation}).`;
};
