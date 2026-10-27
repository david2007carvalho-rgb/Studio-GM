import { RETIRED } from "./constants";
import { movieProfit } from "./movie";
import { personNominations, personWins } from "./legacy";
import type { GameState, Movie, Person } from "./types";

// ═════════════════════════════════════════════════════════════
// Record books: the extremes of the game's history, for the Records page.
// Pure maths over the saved history; nothing here changes how the game plays.
// ═════════════════════════════════════════════════════════════

const released = (state: GameState): Movie[] =>
	state.movies.filter((m) => m.boxOffice !== undefined && m.criticScore !== undefined);

export type OpeningRecord = { movie: Movie; opening: number; share: number };

/** Biggest opening weekends. Films from saves made before openings existed have none and are skipped. */
export const biggestOpenings = (state: GameState): OpeningRecord[] =>
	released(state)
		.filter((m) => m.opening !== undefined)
		.map((movie) => ({ movie, opening: movie.opening ?? 0, share: (movie.opening ?? 0) / Math.max(1, movie.boxOffice ?? 1) }));

export type FlopRecord = { movie: Movie; loss: number; cost: number; returnOnCost: number };

/** Films that lost money, worst first (by dollars lost). */
export const biggestFlops = (state: GameState): FlopRecord[] =>
	released(state)
		.map((movie) => {
			const profit = movieProfit(movie);
			const cost = movie.budget + (movie.marketing ?? 0) + (movie.licenseFee ?? 0) + (movie.scriptFee ?? 0);
			return { movie, loss: -profit, cost, returnOnCost: cost > 0 ? profit / cost : 0 };
		})
		.filter((f) => f.loss > 0);

export type DroughtRecord = {
	person: Person;
	longest: number; // seasons without an award (the longest stretch)
	from: number; // last season they won before the stretch
	to: number | null; // season they won again; null = the stretch is still going (or their career ended in it)
	ongoing: boolean; // still active and still waiting
	wins: number;
};

/**
 * Longest awards drought: the most seasons a person went without winning between two points of their career.
 * Only people with at least one win count. The stretch runs from a win to the next win, or, for the
 * latest one, from their last win to now (active people) or to their last film (retired people).
 */
export const awardDroughts = (state: GameState): DroughtRecord[] => {
	if (state.awards.length === 0) return [];
	const lastCeremony = Math.max(...state.awards.map((a) => a.season));
	const out: DroughtRecord[] = [];
	for (const person of state.people) {
		const seasons = [...new Set(personWins(state, person).map((w) => w.season))].sort((a, b) => a - b);
		if (seasons.length === 0) continue;
		const wins = personWins(state, person).length;
		const lastFilm = Math.max(
			...state.movies
				.filter((m) => m.directorPid === person.pid || m.castPids.includes(person.pid))
				.map((m) => m.season),
			seasons[seasons.length - 1],
		);
		const retired = person.tid === RETIRED;
		const end = retired ? Math.min(lastFilm, lastCeremony) : lastCeremony;

		let best: DroughtRecord = { person, longest: -1, from: seasons[0], to: null, ongoing: false, wins };
		for (let i = 0; i < seasons.length - 1; i++) {
			const gap = seasons[i + 1] - seasons[i] - 1;
			if (gap > best.longest) best = { person, longest: gap, from: seasons[i], to: seasons[i + 1], ongoing: false, wins };
		}
		const tail = end - seasons[seasons.length - 1];
		if (tail > best.longest) best = { person, longest: tail, from: seasons[seasons.length - 1], to: null, ongoing: !retired, wins };
		if (best.longest > 0) out.push(best);
	}
	return out;
};

export type ScoreRecord = { movie: Movie; critics: number; audience: number };

/** Films with both scores. Films from saves made before audience scores existed are skipped. */
export const scoredFilms = (state: GameState): ScoreRecord[] =>
	released(state)
		.filter((m) => m.audienceScore !== undefined)
		.map((movie) => ({ movie, critics: movie.criticScore ?? 0, audience: movie.audienceScore ?? 0 }));

export type NominationRecord = { person: Person; nominations: number; wins: number };

/** Most award nominations (wins count as nominations too) among directors or actors. Needs seasons that recorded nominees. */
export const nominationLeaders = (state: GameState, role: "director" | "actor"): NominationRecord[] =>
	state.people
		.filter((p) => p.role === role)
		.map((person) => {
			const noms = personNominations(state, person);
			return { person, nominations: noms.length, wins: noms.filter((n) => n.won).length };
		})
		.filter((r) => r.nominations > 0);
