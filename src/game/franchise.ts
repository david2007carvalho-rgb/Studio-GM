import {
	AI_MAX_INSTALLMENTS,
	CAST_SIZE,
	FRANCHISE_CARRYOVER_CAP,
	FRANCHISE_CRITIC_WEIGHT,
	FRANCHISE_FATIGUE,
	FRANCHISE_FATIGUE_MAX,
	FRANCHISE_GROWTH_DROP,
	FRANCHISE_GROWTH_FIRST,
	FRANCHISE_GROWTH_FLOOR,
	FRANCHISE_MONEY_WEIGHT,
} from "./constants";
import { clamp } from "./random";
import type { GameState, Movie } from "./types";

// ═════════════════════════════════════════════════════════════
// Franchises. No separate "franchise" object: a franchise is simply a chain of films,
// each pointing at the one it continues (`prequelMid`). The first film's mid is the franchise id.
// ═════════════════════════════════════════════════════════════

/** 1 for an original, 2 for the first sequel, and so on. */
export const installmentOf = (m: Movie): number => m.installment ?? 1;

/** Franchise id = mid of the first film. */
export const franchiseIdOf = (m: Movie): number => m.franchiseId ?? m.mid;

/** The franchise's name is the title of its first film. */
export const franchiseName = (state: GameState, m: Movie): string =>
	state.movies.find((x) => x.mid === franchiseIdOf(m))?.title ?? m.title;

/** Films you could continue: released films of this studio. */
export const sequelCandidates = (state: GameState, tid: number): Movie[] => {
	// A franchise that was sold on as an IP belongs to whoever holds the licence: continue it from the IP Store.
	const sold = new Set((state.customIps ?? []).map((ip) => ip.custom!.fid));
	return state.movies
		.filter((m) => m.tid === tid && m.boxOffice !== undefined && m.criticScore !== undefined && !sold.has(franchiseIdOf(m)))
		.sort((a, b) => b.season - a.season || b.mid - a.mid);
};

/** Share (0-1) of the prequel's director + cast that is back for the sequel. */
export const continuityOf = (directorPid: number | null, castPids: number[], prequel: Movie): number => {
	const before = new Set([prequel.directorPid, ...prequel.castPids]);
	const now = [...(directorPid === null ? [] : [directorPid]), ...castPids];
	return now.filter((pid) => before.has(pid)).length / (CAST_SIZE + 1);
};

const lerp = (range: { min: number; max: number }, t: number): number => range.min + (range.max - range.min) * t;

/** How much of the result comes from the prequel (0-1), given how many people returned. */
export const franchiseWeights = (continuity: number) => ({
	money: lerp(FRANCHISE_MONEY_WEIGHT, continuity),
	critic: lerp(FRANCHISE_CRITIC_WEIGHT, continuity),
});

/** How much of the prequel's audience carries over. Peaks at part 2, then fades. */
export const sequelGrowth = (installment: number): number =>
	Math.max(FRANCHISE_GROWTH_FLOOR, FRANCHISE_GROWTH_FIRST - FRANCHISE_GROWTH_DROP * (installment - 2));

/** Critic points lost to sequel fatigue. */
export const sequelFatigue = (installment: number): number =>
	Math.min(FRANCHISE_FATIGUE_MAX, FRANCHISE_FATIGUE * Math.max(0, installment - 1));

/**
 * Blend a sequel's standalone results with its prequel's.
 * Money: part of the result is the prequel's gross * growth. Critics: part is the prequel's score, minus fatigue.
 */
export const applyFranchise = (
	movie: Movie,
	prequel: Movie,
	ownBoxOffice: number,
	ownCritic: number,
): { boxOffice: number; criticScore: number; continuity: number } => {
	const continuity = continuityOf(movie.directorPid, movie.castPids, prequel);
	const w = franchiseWeights(continuity);
	const n = installmentOf(movie);
	const carried = Math.min(prequel.boxOffice ?? 0, FRANCHISE_CARRYOVER_CAP) * sequelGrowth(n);
	const boxOffice = Math.round((1 - w.money) * ownBoxOffice + w.money * carried);
	const criticScore = Math.round(
		clamp((1 - w.critic) * ownCritic + w.critic * (prequel.criticScore ?? ownCritic) - sequelFatigue(n)),
	);
	return { boxOffice, criticScore, continuity };
};

/** Every released film of a franchise, oldest first. */
export const franchiseFilms = (state: GameState, fid: number): Movie[] =>
	state.movies
		.filter((m) => franchiseIdOf(m) === fid)
		.sort((a, b) => a.season - b.season || a.mid - b.mid);

/** Rival studios: a past hit that has no sequel yet and is not too deep into a series. */
export const aiSequelBase = (state: GameState, tid: number): Movie | null => {
	const continued = new Set(state.movies.map((m) => m.prequelMid).filter((x): x is number => x !== undefined));
	const options = sequelCandidates(state, tid).filter(
		(m) =>
			m.season < state.season &&
			m.season >= state.season - 4 &&
			!continued.has(m.mid) &&
			installmentOf(m) < AI_MAX_INSTALLMENTS &&
			(m.criticScore ?? 0) >= 50 &&
			(m.boxOffice ?? 0) > m.budget + (m.marketing ?? 0) + (m.licenseFee ?? 0) + (m.scriptFee ?? 0),
	);
	if (options.length === 0) return null;
	return options.sort((a, b) => (b.boxOffice ?? 0) - (a.boxOffice ?? 0))[0];
};
