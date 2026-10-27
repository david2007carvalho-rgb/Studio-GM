import { DEFAULT_MARKETING_RATIO } from "./constants";
import { movieCost, movieProfit } from "./movie";
import { installmentOf } from "./franchise";
import type { AwardWinner, FilmGenre, GameState, Movie, Person, SeasonAwards } from "./types";

// ═════════════════════════════════════════════════════════════
// Studio stats: numbers about one studio's history, for the Stats page.
// Pure maths over the saved history; nothing here changes how the game plays.
// ═════════════════════════════════════════════════════════════

export const AWARD_CATEGORIES = [
	{ key: "bestPicture", label: "Best Picture" },
	{ key: "bestDirector", label: "Best Director" },
	{ key: "bestActor", label: "Best Actor" },
	{ key: "bestActress", label: "Best Actress" },
	{ key: "bestSupportingActor", label: "Best Supporting Actor" },
	{ key: "bestSupportingActress", label: "Best Supporting Actress" },
] as const;
export type AwardKey = (typeof AWARD_CATEGORIES)[number]["key"];

/** Films the studio has paid for (cash leaves at the start of Production). */
export const paidFilms = (state: GameState, tid: number): Movie[] =>
	state.movies.filter((m) => m.tid === tid && m.productionQuality !== undefined);

/** Films that are out in cinemas / on screens and have a result. */
export const releasedFilms = (state: GameState, tid: number): Movie[] =>
	state.movies.filter((m) => m.tid === tid && m.boxOffice !== undefined && m.criticScore !== undefined);

// ── awards ──

export type AwardWin = { season: number; key: AwardKey; label: string; winner: AwardWinner };

export const awardWins = (awards: SeasonAwards[], tid: number): AwardWin[] => {
	const out: AwardWin[] = [];
	for (const a of awards) {
		for (const c of AWARD_CATEGORIES) {
			const w = a[c.key];
			if (w && w.tid === tid) out.push({ season: a.season, key: c.key, label: c.label, winner: w });
		}
	}
	return out.sort((a, b) => b.season - a.season);
};

/** Nominations per category (wins included). Seasons from old saves without nominees are skipped. */
export const nominationCount = (awards: SeasonAwards[], tid: number): number => {
	let n = 0;
	for (const a of awards) {
		if (!a.nominees) continue;
		for (const c of AWARD_CATEGORIES) n += a.nominees[c.key].filter((e) => e.tid === tid).length;
	}
	return n;
};

// ── most worked people ──

export type WorkRow = {
	person: Person;
	films: number;
	leads: number; // films as a lead (actors only)
	gross: number;
	avgCritic: number;
	wins: number; // awards won (any category) while working with your studio's films
	lastSeason: number;
};

/** People ranked by number of your films they worked on. Ties: total box office. */
export const mostWorked = (state: GameState, tid: number, role: "actor" | "director"): WorkRow[] => {
	const films = paidFilms(state, tid);
	const rows = new Map<number, WorkRow & { critics: number; scored: number }>();
	const wins = awardWins(state.awards, tid);
	for (const m of films) {
		const pids = role === "director" ? [m.directorPid] : m.castPids;
		for (const pid of pids) {
			const person = state.people.find((p) => p.pid === pid);
			if (!person) continue;
			const r = rows.get(pid) ?? { person, films: 0, leads: 0, gross: 0, avgCritic: 0, wins: 0, lastSeason: 0, critics: 0, scored: 0 };
			r.films++;
			if (role === "actor" && (m.leadPids === undefined || m.leadPids.includes(pid))) r.leads++;
			r.gross += m.boxOffice ?? 0;
			if (m.criticScore !== undefined) {
				r.critics += m.criticScore;
				r.scored++;
			}
			r.lastSeason = Math.max(r.lastSeason, m.season);
			rows.set(pid, r);
		}
	}
	for (const w of wins) {
		if (w.winner.pid !== undefined && w.key !== "bestPicture") {
			const r = rows.get(w.winner.pid);
			if (r) r.wins++;
		}
	}
	return [...rows.values()]
		.map((r) => ({ ...r, avgCritic: r.scored ? r.critics / r.scored : 0 }))
		.sort((a, b) => b.films - a.films || b.gross - a.gross);
};

// ── money ──

export type Money = {
	production: number; // budget, salaries included
	marketing: number;
	licenseFees: number;
	scriptFees: number;
	platformCover: number; // what streaming platforms paid towards budgets and marketing (reduces spending)
	spent: number; // net cost of all films = production + marketing + fees - platformCover
	boxOffice: number;
	streamingIncome: number; // yearly payments and licence fees from streaming contracts
	profit: number; // box office + streaming - spent (released and paid films only)
	roi: number; // profit / spent
};

export const moneyOf = (state: GameState, tid: number): Money => {
	const films = paidFilms(state, tid);
	let production = 0, marketing = 0, licenseFees = 0, scriptFees = 0, platformCover = 0, boxOffice = 0;
	for (const m of films) {
		production += m.budget;
		marketing += m.marketing ?? m.budget * DEFAULT_MARKETING_RATIO;
		licenseFees += m.licenseFee ?? 0;
		scriptFees += m.scriptFee ?? 0;
		platformCover += (m.financing ?? 0) + (m.platformMarketing ?? 0);
		boxOffice += m.boxOffice ?? 0;
	}
	const streamingIncome = tid === state.userTid ? (state.streamDeals ?? []).reduce((s, d) => s + d.paidTotal, 0) : 0;
	const spent = films.reduce((s, m) => s + movieCost(m), 0);
	const profit = boxOffice + streamingIncome - spent;
	return { production, marketing, licenseFees, scriptFees, platformCover, spent, boxOffice, streamingIncome, profit, roi: spent > 0 ? profit / spent : 0 };
};

export type YearRow = { season: number; films: number; spent: number; boxOffice: number; profit: number; wins: number };

export const byYear = (state: GameState, tid: number): YearRow[] => {
	const wins = awardWins(state.awards, tid);
	const map = new Map<number, YearRow>();
	for (const m of paidFilms(state, tid)) {
		const r = map.get(m.season) ?? { season: m.season, films: 0, spent: 0, boxOffice: 0, profit: 0, wins: 0 };
		r.films++;
		r.spent += movieCost(m);
		r.boxOffice += m.boxOffice ?? 0;
		r.profit += m.boxOffice !== undefined ? movieProfit(m) : 0;
		map.set(m.season, r);
	}
	for (const w of wins) {
		const r = map.get(w.season);
		if (r) r.wins++;
	}
	return [...map.values()].sort((a, b) => b.season - a.season);
};

// ── films & genres ──

export type GenreRow = { genre: FilmGenre; films: number; boxOffice: number; profit: number; avgCritic: number };

export const byGenre = (state: GameState, tid: number): GenreRow[] => {
	const map = new Map<FilmGenre, GenreRow & { critics: number }>();
	for (const m of releasedFilms(state, tid)) {
		const r = map.get(m.genre) ?? { genre: m.genre, films: 0, boxOffice: 0, profit: 0, avgCritic: 0, critics: 0 };
		r.films++;
		r.boxOffice += m.boxOffice ?? 0;
		r.profit += movieProfit(m);
		r.critics += m.criticScore ?? 0;
		map.set(m.genre, r);
	}
	return [...map.values()].map((r) => ({ ...r, avgCritic: r.critics / r.films })).sort((a, b) => b.profit - a.profit);
};

export type Summary = {
	films: number;
	hits: number; // profitable films
	avgCritic: number;
	avgAudience: number;
	sequels: number;
	licensed: number;
	streaming: number;
	bestProfit?: Movie;
	worstProfit?: Movie;
	bestCritic?: Movie;
	biggestGross?: Movie;
	longestFranchise: number;
};

export const summaryOf = (state: GameState, tid: number): Summary => {
	const films = releasedFilms(state, tid);
	const best = <T,>(f: (m: Movie) => number, dir: 1 | -1 = 1) =>
		films.length ? films.reduce((a, b) => (dir * (f(b) - f(a)) > 0 ? b : a)) : undefined;
	const audience = films.filter((m) => m.audienceScore !== undefined);
	return {
		films: films.length,
		hits: films.filter((m) => movieProfit(m) > 0).length,
		avgCritic: films.length ? films.reduce((s, m) => s + (m.criticScore ?? 0), 0) / films.length : 0,
		avgAudience: audience.length ? audience.reduce((s, m) => s + (m.audienceScore ?? 0), 0) / audience.length : 0,
		sequels: films.filter((m) => installmentOf(m) > 1).length,
		licensed: films.filter((m) => m.ipId !== undefined).length,
		streaming: films.filter((m) => m.streamPlatformId !== undefined).length,
		bestProfit: best(movieProfit),
		worstProfit: best(movieProfit, -1),
		bestCritic: best((m) => m.criticScore ?? 0),
		biggestGross: best((m) => m.boxOffice ?? 0),
		longestFranchise: films.reduce((n, m) => Math.max(n, installmentOf(m)), 0),
	};
};

// ── league table: how every studio compares ──

export type LeagueRow = { tid: number; name: string; films: number; boxOffice: number; profit: number; awards: number; cash: number; reputation: number };

export const leagueTable = (state: GameState): LeagueRow[] =>
	state.studios
		.map((s) => {
			const money = moneyOf(state, s.tid);
			return {
				tid: s.tid,
				name: s.name,
				films: releasedFilms(state, s.tid).length,
				boxOffice: money.boxOffice,
				profit: money.boxOffice - money.spent,
				awards: awardWins(state.awards, s.tid).length,
				cash: s.cash,
				reputation: s.reputation,
			};
		})
		.sort((a, b) => b.awards - a.awards || b.boxOffice - a.boxOffice);
