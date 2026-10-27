import type { GameState, Movie, Perk, StreamingDeal } from "./types";

// ═════════════════════════════════════════════════════════════
// What your running streaming contracts do for you, read by other systems (hiring, awards, IP fees, box office).
// This file only imports types, so any module can use it without import cycles.
// ═════════════════════════════════════════════════════════════

/** Contracts that are running right now. */
export const activeDeals = (state: GameState): StreamingDeal[] => (state.streamDeals ?? []).filter((d) => d.status === "active");

/** The active contract on one film, if any. */
export const dealOf = (state: GameState, mid: number): StreamingDeal | undefined => activeDeals(state).find((d) => d.mid === mid);

const sumPerk = <K extends Perk["kind"]>(deals: StreamingDeal[], kind: K, pick: (p: Extract<Perk, { kind: K }>) => number): number =>
	deals.reduce((sum, d) => sum + d.perks.reduce((s, p) => (p.kind === kind ? s + pick(p as Extract<Perk, { kind: K }>) : s), 0), 0);

/** Reputation points talent adds to your studio when deciding whether to work with you. */
export const talentAccessBonus = (state: GameState): number => sumPerk(activeDeals(state), "talentAccess", (p) => p.points);

/** Share (0-1, capped) off the licence fee of licensed-IP films. */
export const ipFeeDiscount = (state: GameState): number => Math.min(0.5, sumPerk(activeDeals(state), "ipDiscount", (p) => p.pct) / 100);

/** Box-office multiplier your new wide or limited releases get from platforms that promote your studio. */
export const slatePromoMult = (state: GameState): number => 1 + sumPerk(activeDeals(state), "slatePromo", (p) => p.pct) / 100;

/** Box-office multiplier a sequel gets because its prequel sits on a platform that likes franchises. */
export const franchiseMult = (state: GameState, prequelMid: number | undefined): number => {
	if (prequelMid === undefined) return 1;
	const deal = dealOf(state, prequelMid);
	return deal ? 1 + sumPerk([deal], "franchise", (p) => p.pct) / 100 : 1;
};

/** Reputation points a running contract pays every off-season. */
export const prestigePoints = (deal: StreamingDeal): number => sumPerk([deal], "prestige", (p) => p.points);

/** Points added to a film's awards score: its platform's awards campaign, minus the voters' snub if it skipped cinemas. */
export const awardsDelta = (state: GameState, movie: Movie): number => {
	const deal = dealOf(state, movie.mid);
	const campaign = deal ? sumPerk([deal], "awardsPush", (p) => p.points) : 0;
	return campaign + (movie.awardsDelta ?? 0);
};
