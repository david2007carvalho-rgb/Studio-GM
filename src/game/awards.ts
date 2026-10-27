import { average, gauss } from "./random";
import { isLead } from "./cast";
import { AWARDS_PENALTY_WEIGHT } from "./constants";
import { awardsPenaltyOf } from "./ip";
import { awardsDelta } from "./streamingPerks";
import type {
	AwardRace,
	AwardWinner,
	CastRole,
	Gender,
	GameState,
	Movie,
	Person,
	RaceEntry,
	SeasonAwards,
} from "./types";

const findPerson = (state: GameState, pid: number): Person => {
	const p = state.people.find((x) => x.pid === pid);
	if (!p) throw new Error(`Person ${pid} not found`);
	return p;
};

const NOISE = 6; // luck on the night, same for every category

// --- Voter fatigue (person categories only; a film only competes once) ---
const FATIGUE_WIN_WEIGHT = 0.11; // fatigue per past win in the category...
const FATIGUE_WIN_DECAY = 0.58; // ...times this for every season since (d seasons ago: 0.11 x 0.58^(d-1))
const FATIGUE_NOM_STEP = 0.015; // per nomination in the last 5 seasons beyond the first
const FATIGUE_NOM_WINDOW = 5;
const FATIGUE_STREAK_STEP = 0.0075; // per consecutive nominated season beyond the 2nd
const FATIGUE_STREAK_CAP = 0.02;
const FATIGUE_MAX = 0.2; // voters never dock more than 20% of the score
const OVERDUE_STEP = 0.8; // bonus per nomination beyond the 2nd, for someone who has never won
const OVERDUE_CAP = 4;

type PersonCategory = "bestDirector" | "bestActor" | "bestActress" | "bestSupportingActor" | "bestSupportingActress";
const PERSON_CATEGORIES: PersonCategory[] = ["bestDirector", "bestActor", "bestActress", "bestSupportingActor", "bestSupportingActress"];

/** A person's history in one category, read from past ceremonies. */
type PastRecord = { winSeasons: number[]; nomSeasons: Set<number> };

const historyIn = (state: GameState, cat: PersonCategory): Map<number, PastRecord> => {
	const out = new Map<number, PastRecord>();
	const get = (pid: number) => {
		let r = out.get(pid);
		if (!r) out.set(pid, (r = { winSeasons: [], nomSeasons: new Set() }));
		return r;
	};
	for (const a of state.awards) {
		if (a.season >= state.season) continue;
		const w = a[cat];
		if (w?.pid !== undefined) {
			const r = get(w.pid);
			r.winSeasons.push(a.season);
			r.nomSeasons.add(a.season);
		}
		// Older saves have no nominee lists: only their wins are known.
		for (const e of a.nominees?.[cat] ?? []) if (e.pid !== undefined) get(e.pid).nomSeasons.add(a.season);
	}
	return out;
};

/**
 * Voter fatigue: A = B(1 - F) + O.
 *  F = min(0.20, W + N + C)
 *    W = sum over past wins in this category of 0.11 x 0.58^(d-1), d = seasons since the win (recent wins weigh most)
 *    N = 0.015 x (nominations in the last 5 seasons, capped at 5, minus 1)  -> "we keep seeing them"
 *    C = min(0.02, 0.0075 x (consecutive nominated seasons - 2))
 *  O = overdue bonus, only if they have never won: min(4, 0.8 x (past nominations - 2)).
 */
export const fatigueAdjusted = (base: number, season: number, r: PastRecord | undefined): number => {
	if (!r) return base;
	const W = r.winSeasons.reduce((sum, ws) => sum + FATIGUE_WIN_WEIGHT * FATIGUE_WIN_DECAY ** (season - ws - 1), 0);
	let n5 = 0;
	for (let d = 1; d <= FATIGUE_NOM_WINDOW; d++) if (r.nomSeasons.has(season - d)) n5++;
	const N = FATIGUE_NOM_STEP * Math.max(0, Math.min(n5, 5) - 1);
	let streak = 0;
	while (r.nomSeasons.has(season - 1 - streak)) streak++;
	const C = Math.min(FATIGUE_STREAK_CAP, FATIGUE_STREAK_STEP * Math.max(0, streak - 2));
	const F = Math.min(FATIGUE_MAX, W + N + C);
	const O = r.winSeasons.length === 0 ? Math.min(OVERDUE_CAP, OVERDUE_STEP * Math.max(0, r.nomSeasons.size - 2)) : 0;
	return base * (1 - F) + O;
};

/** One contender: a film (Best Picture) or a person in a film. `base` is the score before luck. */
type Contender = { base: number; movie: Movie; person?: Person };

type Field = {
	bestPicture: Contender[];
	bestDirector: Contender[];
	bestActor: Contender[];
	bestActress: Contender[];
	bestSupportingActor: Contender[];
	bestSupportingActress: Contender[];
};

/**
 * Best Picture: critic score of the film.
 * Best Director: critic score of the film + the director's vision and technique.
 * Best Actor / Best Actress: lead roles only. Men and women compete separately.
 * Best Supporting Actor / Actress: supporting roles only, again separately by gender.
 * Acting score = critic score of the film + the actor's immersion and emotional range.
 * An actor's billing is per film (movie.leadPids), so the same person can be nominated
 * as a lead one year and as supporting the next, or in several films in one year.
 * Licensed films are discounted by their IP's awards penalty (ipData.ts): Best Picture takes all of it,
 * Best Director 60%, the acting awards 40%. Voters admire the big franchises but rarely crown them.
 * Person awards also get voter fatigue (see fatigueAdjusted): past winners are docked, perennial losers get an overdue bonus.
 * Every score then gets a dose of luck (NOISE) when the winner is drawn.
 * Only films released this season compete.
 */
const buildField = (state: GameState): Field | null => {
	const movies = state.movies.filter((m) => m.season === state.season && m.criticScore !== undefined);
	if (movies.length === 0) return null;

	const field: Field = {
		bestPicture: [],
		bestDirector: [],
		bestActor: [],
		bestActress: [],
		bestSupportingActor: [],
		bestSupportingActress: [],
	};
	const actingKey = (role: CastRole, gender: Gender) =>
		role === "lead"
			? gender === "male" ? "bestActor" : "bestActress"
			: gender === "male" ? "bestSupportingActor" : "bestSupportingActress";

	for (const movie of movies) {
		const critics = movie.criticScore ?? 0;
		const penalty = awardsPenaltyOf(state, movie);
		const streaming = awardsDelta(state, movie); // a platform's awards campaign, or the snub for skipping cinemas
		field.bestPicture.push({ base: critics + streaming - AWARDS_PENALTY_WEIGHT.picture * penalty, movie });

		const director = findPerson(state, movie.directorPid);
		field.bestDirector.push({
			base: 0.7 * critics + 0.3 * average([director.attrs.vision, director.attrs.technique]) + streaming - AWARDS_PENALTY_WEIGHT.director * penalty,
			movie,
			person: director,
		});

		for (const pid of movie.castPids) {
			const actor = findPerson(state, pid);
			const key = actingKey(isLead(movie, pid) ? "lead" : "supporting", actor.gender);
			field[key].push({
				base: 0.5 * critics + 0.5 * average([actor.attrs.immersion, actor.attrs.emotionalRange]) + streaming - AWARDS_PENALTY_WEIGHT.acting * penalty,
				movie,
				person: actor,
			});
		}
	}

	// Voter fatigue / overdue bonus from past ceremonies (same score for the race and the real draw).
	for (const cat of PERSON_CATEGORIES) {
		const history = historyIn(state, cat);
		for (const c of field[cat]) c.base = fatigueAdjusted(c.base, state.season, history.get(c.person!.pid));
	}
	return field;
};

/** Draw a winner: base score plus luck. */
const drawWinner = (contenders: Contender[]): Contender | null => {
	let best: Contender | null = null;
	let bestScore = -Infinity;
	for (const c of contenders) {
		const score = c.base + gauss(0, NOISE);
		if (score > bestScore) {
			bestScore = score;
			best = c;
		}
	}
	return best;
};

/** Pick this season's winners. Returns null if there were no films. */
export const computeAwards = (state: GameState): SeasonAwards | null => {
	const field = buildField(state);
	if (!field) return null;

	const toWinner = (c: Contender | null, isPicture = false): AwardWinner | null =>
		c && {
			pid: c.person?.pid,
			name: isPicture ? c.movie.title : c.person!.name,
			movieTitle: c.movie.title,
			mid: c.movie.mid,
			tid: c.movie.tid,
		};
	const picture = toWinner(drawWinner(field.bestPicture), true);
	const director = toWinner(drawWinner(field.bestDirector));
	if (!picture || !director) return null;
	return {
		season: state.season,
		bestPicture: picture,
		bestDirector: director,
		bestActor: toWinner(drawWinner(field.bestActor)),
		bestActress: toWinner(drawWinner(field.bestActress)),
		bestSupportingActor: toWinner(drawWinner(field.bestSupportingActor)),
		bestSupportingActress: toWinner(drawWinner(field.bestSupportingActress)),
	};
};

const RACE_TRIALS = 4000;
const RACE_SIZE = 5;

/**
 * The awards race: simulate the vote many times to estimate each contender's chance of winning,
 * then keep the top 5 per category. It uses the same scoring as the real draw, but the real
 * awards are a fresh draw, so the favourite does not always win.
 * A person up for the same award in two films counts once, with their best film.
 */
export const computeRace = (state: GameState): AwardRace | undefined => {
	const field = buildField(state);
	if (!field) return undefined;

	const race = (contenders: Contender[], isPicture = false): RaceEntry[] => {
		if (contenders.length === 0) return [];
		const wins = new Array<number>(contenders.length).fill(0);
		for (let t = 0; t < RACE_TRIALS; t++) {
			let best = 0;
			let bestScore = -Infinity;
			for (let i = 0; i < contenders.length; i++) {
				const score = contenders[i].base + gauss(0, NOISE);
				if (score > bestScore) {
					bestScore = score;
					best = i;
				}
			}
			wins[best]++;
		}
		// Merge a person's entries (several films), keeping the film where they are strongest.
		const merged = new Map<string, RaceEntry & { top: number }>();
		contenders.forEach((c, i) => {
			const key = isPicture ? `m${c.movie.mid}` : `p${c.person!.pid}`;
			const chance = wins[i] / RACE_TRIALS;
			const prev = merged.get(key);
			if (prev) {
				prev.chance += chance;
				if (wins[i] > prev.top) {
					prev.top = wins[i];
					prev.movieTitle = c.movie.title;
					prev.mid = c.movie.mid;
					prev.tid = c.movie.tid;
				}
			} else {
				merged.set(key, {
					pid: c.person?.pid,
					name: isPicture ? c.movie.title : c.person!.name,
					movieTitle: c.movie.title,
					mid: c.movie.mid,
					tid: c.movie.tid,
					chance,
					top: wins[i],
				});
			}
		});
		return [...merged.values()]
			.sort((a, b) => b.chance - a.chance)
			.slice(0, RACE_SIZE)
			.map(({ top: _top, ...entry }) => entry);
	};

	return {
		bestPicture: race(field.bestPicture, true),
		bestDirector: race(field.bestDirector),
		bestActor: race(field.bestActor),
		bestActress: race(field.bestActress),
		bestSupportingActor: race(field.bestSupportingActor),
		bestSupportingActress: race(field.bestSupportingActress),
	};
};

/** The nominees for the ceremony: the race's top 5 per category, plus the winner if luck picked someone outside it. */
export const nomineesWithWinners = (race: AwardRace, awards: SeasonAwards): AwardRace => {
	const add = (list: RaceEntry[], w: AwardWinner | null | undefined): RaceEntry[] => {
		if (!w) return list;
		const has = list.some((e) => (w.pid !== undefined ? e.pid === w.pid : e.mid === w.mid));
		return has ? list : [...list, { pid: w.pid, name: w.name, movieTitle: w.movieTitle, mid: w.mid, tid: w.tid, chance: 0 }];
	};
	return {
		bestPicture: add(race.bestPicture, awards.bestPicture),
		bestDirector: add(race.bestDirector, awards.bestDirector),
		bestActor: add(race.bestActor, awards.bestActor),
		bestActress: add(race.bestActress, awards.bestActress),
		bestSupportingActor: add(race.bestSupportingActor, awards.bestSupportingActor),
		bestSupportingActress: add(race.bestSupportingActress, awards.bestSupportingActress),
	};
};
