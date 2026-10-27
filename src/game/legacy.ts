import { franchiseFilms, franchiseIdOf, installmentOf } from "./franchise";
import { peakOf } from "./develop";
import { average } from "./random";
import { RETIRED } from "./constants";
import { ovr } from "./ovr";
import { movieProfit } from "./movie";
import type { AwardWinner, GameState, Movie, Person, RaceEntry } from "./types";

// ═════════════════════════════════════════════════════════════
// Legacy: all-time rankings for the Frivolities page. Pure maths over the game's history;
// nothing here changes the game. Edit the GOAT_* weights to change who counts as the greatest.
// ═════════════════════════════════════════════════════════════

// ── GOAT weights ─────────────────────────────────────────────
export const GOAT_ACTOR = {
	leadWin: 10, // Best Actor / Actress
	supportingWin: 6, // Best Supporting Actor / Actress
	pictureFilm: 2, // each Best Picture winner they were in
	grossPer: 50000, // 1 point per $50M of box office from their films (money is in thousands)
	rating: 0.6, // per overall point above 50
	starPower: 0.4, // per (charisma + audience connection)/2 point above 50: their public reputation
	critics: 0.5, // per average critic point above 60
};

export const GOAT_FILM = {
	critics: 0.5, // per critic point above 50
	grossPer: 25000, // 1 point per $25M
	picture: 15, // Best Picture
	director: 6, // Best Director
	leadWin: 5, // each lead acting award won by someone in the film
	supportingWin: 3,
	roi: 1.5, // per 100% return on cost...
	roiMax: 7.5, // ...up to this
	sequel: 2, // each later film in its franchise...
	sequelMax: 10, // ...up to this
};

export const IP_FAME = {
	grossPer: 10, // 1 point per $10M of total box office (x critic factor)
	award: 3, // each award won by any of its films
	part: 2, // each film in the series
};

// ── awards lookups ───────────────────────────────────────────

const isWinner = (w: AwardWinner | null | undefined, p: Pick<Person, "pid" | "name">): boolean =>
	!!w && (w.pid !== undefined ? w.pid === p.pid : w.name === p.name); // older saves have no pid

export type ActingWins = { lead: number; supporting: number };

export const actingWins = (state: GameState, p: Pick<Person, "pid" | "name">): ActingWins => {
	let lead = 0;
	let supporting = 0;
	for (const a of state.awards) {
		if (isWinner(a.bestActor, p)) lead++;
		if (isWinner(a.bestActress, p)) lead++;
		if (isWinner(a.bestSupportingActor, p)) supporting++;
		if (isWinner(a.bestSupportingActress, p)) supporting++;
	}
	return { lead, supporting };
};

/** Awards a film won, as plain counts. */
export type FilmWins = { picture: boolean; director: boolean; lead: number; supporting: number; total: number };

const filmWins = (state: GameState, mid: number): FilmWins => {
	const w: FilmWins = { picture: false, director: false, lead: 0, supporting: 0, total: 0 };
	for (const a of state.awards) {
		if (a.bestPicture.mid === mid) w.picture = true;
		if (a.bestDirector.mid === mid) w.director = true;
		if (a.bestActor?.mid === mid) w.lead++;
		if (a.bestActress?.mid === mid) w.lead++;
		if (a.bestSupportingActor?.mid === mid) w.supporting++;
		if (a.bestSupportingActress?.mid === mid) w.supporting++;
	}
	w.total = (w.picture ? 1 : 0) + (w.director ? 1 : 0) + w.lead + w.supporting;
	return w;
};

const released = (state: GameState): Movie[] =>
	state.movies.filter((m) => m.boxOffice !== undefined && m.criticScore !== undefined);

// ── actors ───────────────────────────────────────────────────

export type ActorLegacy = {
	person: Person;
	films: number;
	gross: number; // thousands of $, all films they were in (any studio)
	avgCritics: number;
	wins: ActingWins;
	awardCount: number;
	pictureFilms: number;
	overall: number; // peak overall, not current
	starPower: number; // at their peak
	/** The GOAT score broken into its parts. */
	parts: { awards: number; money: number; rating: number; starPower: number; critics: number };
	goat: number;
};

export const actorLegacies = (state: GameState): ActorLegacy[] => {
	const films = released(state);
	const pictures = new Set(state.awards.map((a) => a.bestPicture.mid));
	const out: ActorLegacy[] = [];
	for (const person of state.people) {
		if (person.role !== "actor") continue;
		const theirs = films.filter((m) => m.castPids.includes(person.pid));
		const wins = actingWins(state, person);
		if (theirs.length === 0 && wins.lead + wins.supporting === 0) continue;

		const gross = theirs.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
		const avgCritics = average(theirs.map((m) => m.criticScore ?? 0));
		const pictureFilms = theirs.filter((m) => pictures.has(m.mid)).length;
		const peak = peakOf(person); // judged at their best, so retired and declining people keep their standing
		const overall = peak.ovr;
		const starPower = average([peak.attrs.charisma, peak.attrs.audienceConnection]);

		const parts = {
			awards: GOAT_ACTOR.leadWin * wins.lead + GOAT_ACTOR.supportingWin * wins.supporting + GOAT_ACTOR.pictureFilm * pictureFilms,
			money: gross / GOAT_ACTOR.grossPer,
			rating: GOAT_ACTOR.rating * Math.max(0, overall - 50),
			starPower: GOAT_ACTOR.starPower * Math.max(0, starPower - 50),
			critics: theirs.length === 0 ? 0 : GOAT_ACTOR.critics * Math.max(0, avgCritics - 60),
		};
		out.push({
			person,
			films: theirs.length,
			gross,
			avgCritics,
			wins,
			awardCount: wins.lead + wins.supporting,
			pictureFilms,
			overall,
			starPower,
			parts,
			goat: Object.values(parts).reduce((a, b) => a + b, 0),
		});
	}
	return out;
};

// ── films ────────────────────────────────────────────────────

export type FilmLegacy = {
	movie: Movie;
	wins: FilmWins;
	profit: number;
	returnOnCost: number; // 1 = made back double its cost
	laterParts: number;
	parts: { critics: number; money: number; awards: number; profit: number; legacy: number };
	goat: number;
};

export const filmLegacies = (state: GameState): FilmLegacy[] =>
	released(state).map((movie) => {
		const wins = filmWins(state, movie.mid);
		const cost = movie.budget + (movie.marketing ?? 0) + (movie.licenseFee ?? 0) + (movie.scriptFee ?? 0);
		const profit = movieProfit(movie);
		const returnOnCost = cost > 0 ? profit / cost : 0;
		const laterParts = franchiseFilms(state, franchiseIdOf(movie)).filter(
			(m) => installmentOf(m) > installmentOf(movie),
		).length;
		const parts = {
			critics: GOAT_FILM.critics * Math.max(0, (movie.criticScore ?? 0) - 50),
			money: (movie.boxOffice ?? 0) / GOAT_FILM.grossPer,
			awards:
				(wins.picture ? GOAT_FILM.picture : 0) +
				(wins.director ? GOAT_FILM.director : 0) +
				GOAT_FILM.leadWin * wins.lead +
				GOAT_FILM.supportingWin * wins.supporting,
			profit: Math.min(GOAT_FILM.roiMax, GOAT_FILM.roi * Math.max(0, returnOnCost)),
			legacy: Math.min(GOAT_FILM.sequelMax, GOAT_FILM.sequel * laterParts),
		};
		return { movie, wins, profit, returnOnCost, laterParts, parts, goat: Object.values(parts).reduce((a, b) => a + b, 0) };
	});

// ── IPs (franchises) ─────────────────────────────────────────

export type IpLegacy = {
	id: number;
	name: string;
	films: Movie[];
	gross: number;
	avgCritics: number;
	awardCount: number;
	fame: number;
};

/** Every series with at least two released films, from any studio. */
export const ipLegacies = (state: GameState): IpLegacy[] => {
	const ids = new Set(released(state).map(franchiseIdOf));
	const out: IpLegacy[] = [];
	for (const id of ids) {
		const films = franchiseFilms(state, id).filter((m) => m.boxOffice !== undefined && m.criticScore !== undefined);
		if (films.length < 2) continue;
		const gross = films.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
		const avgCritics = average(films.map((m) => m.criticScore ?? 0));
		const awardCount = films.reduce((sum, m) => sum + filmWins(state, m.mid).total, 0);
		const criticFactor = 0.7 + 0.3 * (avgCritics / 100);
		const fame = Math.round(
			(gross / 1000 / IP_FAME.grossPer) * criticFactor + IP_FAME.award * awardCount + IP_FAME.part * films.length,
		);
		const root = state.movies.find((m) => m.mid === id) ?? films[0];
		out.push({ id, name: root.title, films, gross, avgCritics, awardCount, fame });
	}
	return out;
};

/** Top `n` by a score, highest first. */
export const top = <T,>(list: T[], n: number, score: (x: T) => number, tiebreak: (x: T) => number = () => 0): T[] =>
	[...list].sort((a, b) => score(b) - score(a) || tiebreak(b) - tiebreak(a)).slice(0, n);

// ── directors ────────────────────────────────────────────────

export const GOAT_DIRECTOR = {
	win: 10, // Best Director
	pictureFilm: 6, // each Best Picture winner they directed
	grossPer: 50000, // 1 point per $50M of box office from their films
	rating: 0.6, // per overall point above 50
	craft: 0.4, // per (vision + technique)/2 point above 50
	critics: 0.5, // per average critic point above 60
};

export type DirectorLegacy = {
	person: Person;
	films: number;
	gross: number;
	avgCritics: number;
	awardCount: number; // Best Director wins
	pictureFilms: number;
	overall: number; // peak overall, not current
	craft: number; // at their peak
	parts: { awards: number; money: number; rating: number; craft: number; critics: number };
	goat: number;
};

export const directorLegacies = (state: GameState): DirectorLegacy[] => {
	const films = released(state);
	const pictures = new Set(state.awards.map((a) => a.bestPicture.mid));
	const out: DirectorLegacy[] = [];
	for (const person of state.people) {
		if (person.role !== "director") continue;
		const theirs = films.filter((m) => m.directorPid === person.pid);
		const awardCount = state.awards.filter((a) => isWinner(a.bestDirector, person)).length;
		if (theirs.length === 0 && awardCount === 0) continue;

		const gross = theirs.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
		const avgCritics = average(theirs.map((m) => m.criticScore ?? 0));
		const pictureFilms = theirs.filter((m) => pictures.has(m.mid)).length;
		const peak = peakOf(person); // judged at their best, so retired and declining people keep their standing
		const overall = peak.ovr;
		const craft = average([peak.attrs.vision, peak.attrs.technique]);

		const parts = {
			awards: GOAT_DIRECTOR.win * awardCount + GOAT_DIRECTOR.pictureFilm * pictureFilms,
			money: gross / GOAT_DIRECTOR.grossPer,
			rating: GOAT_DIRECTOR.rating * Math.max(0, overall - 50),
			craft: GOAT_DIRECTOR.craft * Math.max(0, craft - 50),
			critics: theirs.length === 0 ? 0 : GOAT_DIRECTOR.critics * Math.max(0, avgCritics - 60),
		};
		out.push({
			person, films: theirs.length, gross, avgCritics, awardCount, pictureFilms, overall, craft, parts,
			goat: Object.values(parts).reduce((a, b) => a + b, 0),
		});
	}
	return out;
};

// ── pairs: who works together most ───────────────────────────

export type Pairing = {
	a: Person; // for a duo: the director
	b: Person; // for a duo: the actor
	films: Movie[]; // oldest first
	gross: number;
	avgCritics: number;
	filmAwards: number; // awards won by those films (all categories)
};

const buildPairings = (state: GameState, pairsOf: (m: Movie) => [number, number][]): Pairing[] => {
	const byPid = new Map(state.people.map((p) => [p.pid, p]));
	const groups = new Map<string, { a: number; b: number; films: Movie[] }>();
	for (const m of [...released(state)].sort((x, y) => x.season - y.season)) {
		for (const [a, b] of pairsOf(m)) {
			const key = `${a}-${b}`;
			const g = groups.get(key) ?? { a, b, films: [] };
			g.films.push(m);
			groups.set(key, g);
		}
	}
	const out: Pairing[] = [];
	for (const g of groups.values()) {
		const a = byPid.get(g.a);
		const b = byPid.get(g.b);
		if (!a || !b || g.films.length < 2) continue; // a pair needs at least two films together
		out.push({
			a,
			b,
			films: g.films,
			gross: g.films.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0),
			avgCritics: average(g.films.map((m) => m.criticScore ?? 0)),
			filmAwards: g.films.reduce((sum, m) => sum + filmWins(state, m.mid).total, 0),
		});
	}
	return out;
};

/** Actors who were in the same film at least twice. */
export const actingPairs = (state: GameState): Pairing[] =>
	buildPairings(state, (m) => {
		const pids = [...m.castPids].sort((x, y) => x - y);
		const pairs: [number, number][] = [];
		for (let i = 0; i < pids.length; i++) for (let j = i + 1; j < pids.length; j++) pairs.push([pids[i], pids[j]]);
		return pairs;
	});

/** A director and an actor who made at least two films together. */
export const directorDuos = (state: GameState): Pairing[] =>
	buildPairings(state, (m) => m.castPids.map((pid): [number, number] => [m.directorPid, pid]));

// ── one person's career (for the profile window) ─────────────

export type PersonWin = { season: number; award: string; mid: number; movieTitle: string };

/** Every award this person has won, oldest first. */
export const personWins = (state: GameState, p: Pick<Person, "pid" | "name">): PersonWin[] => {
	const out: PersonWin[] = [];
	const check = (season: number, award: string, w: AwardWinner | null | undefined) => {
		if (w && isWinner(w, p)) out.push({ season, award, mid: w.mid, movieTitle: w.movieTitle });
	};
	for (const a of state.awards) {
		check(a.season, "Best director", a.bestDirector);
		check(a.season, "Best actor", a.bestActor);
		check(a.season, "Best actress", a.bestActress);
		check(a.season, "Best supporting actor", a.bestSupportingActor);
		check(a.season, "Best supporting actress", a.bestSupportingActress);
	}
	return out.sort((x, y) => x.season - y.season);
};

export type PersonNomination = { season: number; award: string; mid: number; movieTitle: string; won: boolean };

/** Every nomination this person has received (wins included), oldest first. Only seasons that recorded nominees count. */
export const personNominations = (state: GameState, p: Pick<Person, "pid">): PersonNomination[] => {
	const out: PersonNomination[] = [];
	for (const a of state.awards) {
		if (!a.nominees) continue;
		const cats: [string, RaceEntry[], AwardWinner | null | undefined][] = [
			["Best director", a.nominees.bestDirector, a.bestDirector],
			["Best actor", a.nominees.bestActor, a.bestActor],
			["Best actress", a.nominees.bestActress, a.bestActress],
			["Best supporting actor", a.nominees.bestSupportingActor, a.bestSupportingActor],
			["Best supporting actress", a.nominees.bestSupportingActress, a.bestSupportingActress],
		];
		for (const [award, list, winner] of cats) {
			const e = list.find((x) => x.pid === p.pid);
			if (e) out.push({ season: a.season, award, mid: e.mid, movieTitle: e.movieTitle, won: winner?.pid === p.pid });
		}
	}
	return out.sort((x, y) => x.season - y.season);
};

/** Film ids that were Best Picture nominees in any season. */
export const pictureNominee = (state: GameState): Set<number> =>
	new Set(state.awards.flatMap((a) => (a.nominees?.bestPicture ?? []).map((e) => e.mid)));

export type CreditRow = {
	movie: Movie;
	credit: "Director" | "Lead" | "Supporting";
	wins: string[]; // awards this person won for this film
	bestPicture: boolean; // the film itself won Best Picture
	nominations: string[]; // awards this person was nominated for with this film but did not win
	pictureNominee: boolean; // the film was a Best Picture nominee but did not win
};

/** Every film this person worked on (including one still in production), oldest first. */
export const filmography = (state: GameState, p: Person): CreditRow[] => {
	const wins = personWins(state, p);
	const pictures = new Set(state.awards.map((a) => a.bestPicture.mid));
	const noms = personNominations(state, p).filter((n) => !n.won);
	const nominated = pictureNominee(state);
	return state.movies
		.filter((m) => m.directorPid === p.pid || m.castPids.includes(p.pid))
		.sort((a, b) => a.season - b.season || a.mid - b.mid)
		.map((movie) => ({
			movie,
			credit: movie.directorPid === p.pid ? "Director" : movie.leadPids === undefined || movie.leadPids.includes(p.pid) ? "Lead" : "Supporting",
			wins: wins.filter((w) => w.mid === movie.mid).map((w) => w.award),
			bestPicture: pictures.has(movie.mid),
			nominations: noms.filter((n) => n.mid === movie.mid).map((n) => n.award),
			pictureNominee: nominated.has(movie.mid) && !pictures.has(movie.mid),
		}));
};

// ── one person's career, season by season (for the profile graphs) ──

export type CareerSeason = {
	season: number;
	films: number;
	gross: number; // thousands of $, films released that season
	avgCritics: number | null; // null if nothing was released
	critics: number[]; // each film's score
	won: boolean; // won an award that season
	nominated: boolean; // nominated (or won) that season
};

export type Career = {
	seasons: CareerSeason[]; // only seasons with a release or an award, oldest first
	ratings: { season: number; ovr: number }[]; // overall at the start of each season, ending with right now
};

export const careerOf = (state: GameState, p: Person): Career => {
	const out = released(state).filter((m) => m.directorPid === p.pid || m.castPids.includes(p.pid));
	const winSeasons = new Set(personWins(state, p).map((w) => w.season));
	const nomSeasons = new Set(personNominations(state, p).map((n) => n.season));
	const years = new Set<number>([...out.map((m) => m.season), ...winSeasons]);
	const seasons: CareerSeason[] = [...years]
		.sort((a, b) => a - b)
		.map((season) => {
			const films = out.filter((m) => m.season === season);
			const critics = films.map((m) => m.criticScore ?? 0);
			return {
				season,
				films: films.length,
				gross: films.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0),
				avgCritics: critics.length === 0 ? null : average(critics),
				critics,
				won: winSeasons.has(season),
				nominated: nomSeasons.has(season) || winSeasons.has(season),
			};
		});
	const ratings = (p.history ?? []).filter((h) => h.season <= state.season);
	const now = Math.round(ovr(p.attrs, p.role));
	if (p.tid !== RETIRED || ratings.length === 0) {
		const last = ratings[ratings.length - 1];
		if (!last || last.season !== state.season) ratings.push({ season: state.season, ovr: now });
	}
	return { seasons, ratings };
};

// ── one film's page (for the movie window) ───────────────────

export type FilmAward = {
	award: string;
	won: boolean;
	pid?: number; // the person who won or was nominated (not set for Best Picture)
	name: string; // film title for Best Picture, person name otherwise
};

export type FilmRanks = {
	boxOffice: number; // all-time rank by box office (1 = highest)
	critics: number; // all-time rank by critics' score
	opening: number | null; // all-time rank by opening weekend (null for older saves without one)
	seasonBoxOffice: number; // rank within its own season
	of: number; // how many released films there are in total
	seasonOf: number; // how many released films that season
};

export type FilmPage = {
	awards: FilmAward[]; // wins first, then nominations
	wins: number;
	nominations: number; // nominations that did not win
	hasNomData: boolean;
	ranks: FilmRanks | null; // null while the film is not released
	sequels: Movie[]; // the whole franchise this film belongs to, oldest first (empty for a standalone with no sequel)
};

/** Everything the movie window needs beyond the film's own fields. */
export const filmPage = (state: GameState, movie: Movie): FilmPage => {
	const ceremony = state.awards.find((a) => a.season === movie.season);
	const awards: FilmAward[] = [];
	let hasNomData = false;
	if (ceremony) {
		hasNomData = !!ceremony.nominees;
		const cats: [string, AwardWinner | null | undefined, RaceEntry[] | undefined][] = [
			["Best picture", ceremony.bestPicture, ceremony.nominees?.bestPicture],
			["Best director", ceremony.bestDirector, ceremony.nominees?.bestDirector],
			["Best actor", ceremony.bestActor, ceremony.nominees?.bestActor],
			["Best actress", ceremony.bestActress, ceremony.nominees?.bestActress],
			["Best supporting actor", ceremony.bestSupportingActor, ceremony.nominees?.bestSupportingActor],
			["Best supporting actress", ceremony.bestSupportingActress, ceremony.nominees?.bestSupportingActress],
		];
		for (const [award, winner, nominees] of cats) {
			if (winner && winner.mid === movie.mid) awards.push({ award, won: true, pid: winner.pid, name: winner.name });
			for (const e of nominees ?? []) {
				if (e.mid !== movie.mid) continue;
				const alreadyWon = winner && winner.mid === movie.mid && (e.pid === undefined || winner.pid === e.pid);
				if (!alreadyWon) awards.push({ award, won: false, pid: e.pid, name: e.name });
			}
		}
	}
	awards.sort((a, b) => Number(b.won) - Number(a.won));

	const all = released(state);
	let ranks: FilmRanks | null = null;
	if (movie.boxOffice !== undefined && movie.criticScore !== undefined) {
		const sameSeason = all.filter((m) => m.season === movie.season);
		const withOpening = all.filter((m) => m.opening !== undefined);
		ranks = {
			boxOffice: all.filter((m) => (m.boxOffice ?? 0) > (movie.boxOffice ?? 0)).length + 1,
			critics: all.filter((m) => (m.criticScore ?? 0) > (movie.criticScore ?? 0)).length + 1,
			opening: movie.opening === undefined ? null : withOpening.filter((m) => (m.opening ?? 0) > (movie.opening ?? 0)).length + 1,
			seasonBoxOffice: sameSeason.filter((m) => (m.boxOffice ?? 0) > (movie.boxOffice ?? 0)).length + 1,
			of: all.length,
			seasonOf: sameSeason.length,
		};
	}

	const chain = franchiseFilms(state, franchiseIdOf(movie));
	return {
		awards,
		wins: awards.filter((a) => a.won).length,
		nominations: awards.filter((a) => !a.won).length,
		hasNomData,
		ranks,
		sequels: chain.length > 1 ? chain : [],
	};
};
