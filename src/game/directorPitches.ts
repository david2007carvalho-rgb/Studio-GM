import { pickLeads } from "./ai";
import {
	BASE_PRODUCTION_COST,
	CAST_SIZE,
	DEFAULT_MARKETING_RATIO,
	DIRECTOR_PITCHES,
	DIRECTOR_PITCH_EXTRA,
	DIRECTOR_PITCH_POOL,
	DIRECTOR_PITCH_RESERVE,
	DIRECTOR_PITCH_RIVAL_CHANCE,
	DIRECTOR_PITCH_ROUNDS,
	DIRECTOR_PITCH_SLACK,
	MAX_ACTOR_FILMS,
	RETIRED,
} from "./constants";
import { fmtMoney } from "./format";
import { genTitle } from "./generate";
import { refusalReason, salaryOf } from "./hiring";
import { movieBudget, teamRating } from "./movie";
import { genreOvr, ovr, specialtyBonus } from "./ovr";
import type { GreenlightPlan } from "./phase";
import { choice, randInt } from "./random";
import { GENRES, Phase } from "./types";
import { directorScript } from "./scripts";
import type { DirectorPitch, FilmGenre, GameState, Movie, Person } from "./types";

// ═════════════════════════════════════════════════════════════
// Director pitches. At the start of every Development phase a few directors bring you a film:
//   a title, a genre, a wish list of about 10 actors and the budget they need.
// You can FUND it (the director's film becomes your plan, and the cast must come from the wish list),
// COUNTER with another amount (a director has a hidden reserve: below it they refuse, and after
// DIRECTOR_PITCH_ROUNDS refusals they walk away), or PASS. A film you pass on (or lose by haggling)
// may be picked up by a rival studio (rivalsTakePitches), which is the cost of saying no.
// ═════════════════════════════════════════════════════════════

/** How well a person suits the genre, specialty bonus included (the "Fit" column of the talent list). */
export const fitFor = (p: Person, genre: FilmGenre): number => Math.min(100, genreOvr(p.attrs, p.role, genre) + specialtyBonus(p.specialties, genre));

/** Pick `count` different items at random, each draw weighted. Does not repeat items. */
const weightedSample = <T,>(items: T[], weight: (item: T) => number, count: number): T[] => {
	const left = [...items];
	const picked: T[] = [];
	while (picked.length < count && left.length > 0) {
		const weights = left.map((x) => Math.max(0.0001, weight(x)));
		let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
		let i = 0;
		while (i < left.length - 1 && roll >= weights[i]) {
			roll -= weights[i];
			i++;
		}
		picked.push(left[i]);
		left.splice(i, 1);
	}
	return picked;
};

/** Round a budget to whole millions (money is in thousands of $). */
const roundMillion = (x: number): number => Math.round(x / 1000) * 1000;

/**
 * Make this season's pitches. Directors who would refuse your studio do not come; actors who would refuse you are not on a
 * wish list. Better directors pitch a bit more often. Mutates `state`, so call it on a copy (newGame and the phase machine do).
 */
export const addDirectorPitches = (state: GameState): void => {
	const pitches: DirectorPitch[] = [];
	let nextId = state.nextPitchId ?? 0;
	const taken = state.movies.map((m) => m.title);
	const active = (p: Person) => p.tid !== RETIRED && refusalReason(state, p) === null;
	const directors = state.people.filter((p) => p.role === "director" && active(p));
	const actors = state.people.filter((p) => p.role === "actor" && active(p));
	const count = randInt(DIRECTOR_PITCHES[0], DIRECTOR_PITCHES[1]);
	const cash = state.studios.find((s) => s.tid === state.userTid)?.cash ?? 0;

	// Look at more directors than needed: some will not come because their film is out of your reach.
	for (const director of weightedSample(directors, (d) => Math.pow(Math.max(1, ovr(d.attrs, "director") - 40), 1.5), count * 4)) {
		if (pitches.length >= count) break;
		// The director pitches one of their three best genres, the best most often.
		const genres = [...GENRES]
			.map((g) => ({ g, fit: fitFor(director, g) }))
			.sort((a, b) => b.fit - a.fit)
			.slice(0, 3);
		const genre = weightedSample(genres, (x) => (x === genres[0] ? 5 : x === genres[1] ? 3 : 2), 1)[0].g;

		// Their wish list: actors who suit the genre, with some luck.
		const size = randInt(DIRECTOR_PITCH_POOL[0], DIRECTOR_PITCH_POOL[1]);
		const pool = weightedSample(actors, (a) => Math.pow(Math.max(1, fitFor(a, genre) - 35), 2), size).sort((a, b) => fitFor(b, genre) - fitFor(a, genre));
		if (pool.length < CAST_SIZE) continue;

		// The budget they need: their fee, a cast priced a little above the wish list's average, base costs and some money for production.
		const avgSalary = pool.reduce((sum, a) => sum + a.contract.amount, 0) / pool.length;
		const production = randInt(DIRECTOR_PITCH_EXTRA[0], DIRECTOR_PITCH_EXTRA[1]);
		const wanted = director.contract.amount + CAST_SIZE * avgSalary * DIRECTOR_PITCH_SLACK + BASE_PRODUCTION_COST + production;
		// Directors know what your studio can afford: the ask stays within 70-100% of your cash (with the usual marketing on top),
		// but never drops below what the film costs with the cheapest cast on the wish list.
		const cheapest = pool.map((a) => a.contract.amount).sort((a, b) => a - b).slice(0, CAST_SIZE).reduce((sum, x) => sum + x, 0);
		const least = director.contract.amount + cheapest + BASE_PRODUCTION_COST;
		if (least * 1.1 > cash) continue; // even the cheapest version of this film is out of your reach
		const ask = Math.max(roundMillion(least * 1.1), Math.min(roundMillion(wanted), roundMillion((cash / (1 + DEFAULT_MARKETING_RATIO)) * (0.7 + Math.random() * 0.3))));

		const title = genTitle(genre, [...taken, ...pitches.map((x) => x.title)]);
		pitches.push({
			id: nextId++,
			season: state.season,
			directorPid: director.pid,
			title,
			genre,
			pool: pool.map((a) => a.pid),
			ask,
			reserve: Math.round((DIRECTOR_PITCH_RESERVE[0] + Math.random() * (DIRECTOR_PITCH_RESERVE[1] - DIRECTOR_PITCH_RESERVE[0])) * 100) / 100,
			rounds: 0,
			status: "open",
		});
	}
	state.directorPitches = pitches;
	state.nextPitchId = nextId;
};

// ── lookups ──────────────────────────────────────────────────

/** This season's pitch with this id, whatever its status. */
export const pitchById = (state: GameState, id: number | null | undefined): DirectorPitch | undefined =>
	id === null || id === undefined ? undefined : state.directorPitches?.find((x) => x.id === id && x.season === state.season);

/** A pitch you have funded (the one your plan can be built on). */
export const fundedPitch = (state: GameState, id: number | null | undefined): DirectorPitch | undefined => {
	const dp = pitchById(state, id);
	return dp?.status === "funded" ? dp : undefined;
};

/** How firm the director is about the price, from the hidden reserve. */
export const temperament = (dp: DirectorPitch): "flexible" | "reasonable" | "firm" =>
	dp.reserve <= 0.78 ? "flexible" : dp.reserve <= 0.86 ? "reasonable" : "firm";

const peopleOf = (state: GameState, pids: number[]): Person[] =>
	pids.map((pid) => state.people.find((p) => p.pid === pid)).filter((p): p is Person => p !== undefined && p.tid !== RETIRED);

/** What a pitch looks like with your studio's prices: the wish list, the best cast in it and what that cast costs. */
export const pitchPreview = (state: GameState, dp: DirectorPitch) => {
	const director = state.people.find((p) => p.pid === dp.directorPid)!;
	const pool = peopleOf(state, dp.pool).sort((a, b) => fitFor(b, dp.genre) - fitFor(a, dp.genre));
	const stub = { genre: dp.genre } as Movie;
	const best = pool.slice(0, CAST_SIZE);
	const cheapest = [...pool].sort((a, b) => salaryOf(state, a) - salaryOf(state, b)).slice(0, CAST_SIZE);
	const pay = (p: Person) => salaryOf(state, p);
	const fixed = movieBudget([director], 0, pay); // director's fee + base costs
	return {
		director,
		pool,
		bestFit: best.length === CAST_SIZE ? Math.round(teamRating(stub, director, best)) : null,
		bestCost: best.reduce((sum, p) => sum + pay(p), 0),
		bestCastLeft: dp.ask - fixed - best.reduce((sum, p) => sum + pay(p), 0), // what is left for production at the asked price if you sign the best-fit trio
		lowest: fixed + cheapest.reduce((sum, p) => sum + pay(p), 0), // the least the film can cost with this wish list
	};
};

// ── your decisions ───────────────────────────────────────────

export type PitchOutcome = { ok: true; state: GameState; message: string } | { ok: false; error: string };

const openPitch = (state: GameState, id: number): { dp: DirectorPitch } | { error: string } => {
	const dp = pitchById(state, id);
	if (!dp) return { error: "That pitch is no longer on the table." };
	if (state.phase !== Phase.DEVELOPMENT) return { error: "Pitches can only be decided during Development." };
	if (dp.status === "declined" || dp.status === "walked") return { error: "You already closed that pitch." };
	return { dp };
};

/** Fund a pitch at `amount` (thousands). At or above the ask the director accepts. Below it, they accept only above their hidden reserve. */
export const counterPitch = (state: GameState, id: number, amount: number): PitchOutcome => {
	const found = openPitch(state, id);
	if ("error" in found) return { ok: false, error: found.error };
	const price = Math.round(amount);
	if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Enter an amount." };
	if (found.dp.status === "funded") return { ok: false, error: "That pitch is already funded. Withdraw your funding first if you want to haggle again." };
	const next = structuredClone(state);
	const dp = pitchById(next, id)!;
	const director = next.people.find((p) => p.pid === dp.directorPid)!;
	const { lowest } = pitchPreview(next, dp);
	if (price < lowest) {
		return { ok: false, error: `${director.name} cannot make this for less than ${fmtMoney(lowest)}: their fee, the cheapest cast on the wish list and the base costs.` };
	}
	if (price >= dp.ask || price >= dp.ask * dp.reserve) {
		for (const other of next.directorPitches ?? []) if (other.status === "funded") { other.status = "open"; delete other.agreed; } // one funded film at a time
		dp.status = "funded";
		dp.agreed = price;
		next.notice = `${director.name} is on board: "${dp.title}" is funded at ${fmtMoney(price)}${price > dp.ask ? " (more than they asked)" : price < dp.ask ? ` (they asked ${fmtMoney(dp.ask)})` : ""}. Pick the cast from their wish list.`;
		return { ok: true, state: next, message: next.notice };
	}
	dp.rounds += 1;
	const left = DIRECTOR_PITCH_ROUNDS - dp.rounds;
	if (left <= 0) {
		dp.status = "walked";
		next.notice = `${director.name} walked away from "${dp.title}": ${fmtMoney(price)} was not enough. Another studio may pick it up.`;
	} else {
		next.notice = `${director.name}: "${fmtMoney(price)} is not enough for this film." You can try ${left} more time${left > 1 ? "s" : ""}.`;
	}
	return { ok: true, state: next, message: next.notice };
};

/** Fund a pitch at the asking price. */
export const fundPitch = (state: GameState, id: number): PitchOutcome => {
	const dp = pitchById(state, id);
	return dp ? counterPitch(state, id, dp.ask) : { ok: false, error: "That pitch is no longer on the table." };
};

/** Turn a pitch down for good. A rival may make the film. */
export const passPitch = (state: GameState, id: number): PitchOutcome => {
	const found = openPitch(state, id);
	if ("error" in found) return { ok: false, error: found.error };
	const next = structuredClone(state);
	const dp = pitchById(next, id)!;
	dp.status = "declined";
	delete dp.agreed;
	next.notice = `You passed on "${dp.title}".`;
	return { ok: true, state: next, message: next.notice };
};

/** Take back your funding: the pitch is open again (you can fund it again or pass). */
export const withdrawPitch = (state: GameState, id: number): PitchOutcome => {
	const dp = fundedPitch(state, id);
	if (!dp) return { ok: false, error: "That pitch is not funded." };
	const next = structuredClone(state);
	const mine = pitchById(next, id)!;
	mine.status = "open";
	delete mine.agreed;
	next.notice = undefined;
	return { ok: true, state: next, message: `You withdrew your funding for "${dp.title}".` };
};

// ── building the film ────────────────────────────────────────

/** What a funded pitch leaves for sets and effects once the director, the cast and the base costs are paid. Negative = the cast is too expensive. */
export const pitchLeftover = (state: GameState, dp: DirectorPitch, director: Person, cast: Person[]): number =>
	(dp.agreed ?? dp.ask) - movieBudget([director, ...cast], 0, (p) => salaryOf(state, p));

/** null = the plan fits the funded pitch. Otherwise a message for the player. Used by greenlightMovie. */
export const pitchPlanError = (state: GameState, dp: DirectorPitch, plan: GreenlightPlan, director: Person, cast: Person[]): string | null => {
	if (director.pid !== dp.directorPid) return `This film is ${peopleOf(state, [dp.directorPid])[0]?.name ?? "the pitching director"}'s pitch: they direct it. Drop the pitch to hire someone else.`;
	if (plan.genre !== dp.genre) return `The pitched film is a ${dp.genre} film.`;
	if (plan.sequelOfMid || plan.propertyId) return "A pitched film is an original idea: it cannot be a sequel or a licensed property.";
	const outside = cast.find((a) => !dp.pool.includes(a.pid));
	if (outside) return `${outside.name} is not on the director's wish list. Pick the cast from the list, or drop the pitch.`;
	const left = pitchLeftover(state, dp, director, cast);
	if (left < 0) return `This cast costs ${fmtMoney(-left)} more than the ${fmtMoney(dp.agreed ?? dp.ask)} you funded (fees plus base costs). Pick cheaper actors or counter for more money.`;
	return null;
};

// ── rivals ───────────────────────────────────────────────────

/**
 * Before the rivals pick their films: a rival may make a pitch you turned down (or lost by haggling), with the same director,
 * title and genre and the best-fitting actors from the wish list. Mutates `state` (call it on a copy). Returns what happened, for the notice.
 */
export const rivalsTakePitches = (state: GameState): string[] => {
	const notes: string[] = [];
	const rivals = state.studios.filter((s) => s.tid !== state.userTid);
	if (rivals.length === 0) return notes;
	const films = () => state.movies.filter((m) => m.season === state.season);

	for (const dp of state.directorPitches ?? []) {
		if (dp.season !== state.season || (dp.status !== "declined" && dp.status !== "walked")) continue;
		if (Math.random() >= DIRECTOR_PITCH_RIVAL_CHANCE) continue;

		const director = state.people.find((p) => p.pid === dp.directorPid && p.role === "director" && p.tid !== RETIRED);
		if (!director || films().some((m) => m.directorPid === director.pid)) continue; // retired, or already making a film this season

		const load = new Map<number, number>();
		for (const m of films()) m.castPids.forEach((pid) => load.set(pid, (load.get(pid) ?? 0) + 1));
		const free = peopleOf(state, dp.pool).filter((a) => (load.get(a.pid) ?? 0) < MAX_ACTOR_FILMS);
		if (free.length < CAST_SIZE) continue;
		const cast = free.sort((a, b) => fitFor(b, dp.genre) - fitFor(a, dp.genre)).slice(0, CAST_SIZE);

		// The rival with the fewest films this season takes it.
		const counts = rivals.map((s) => ({ s, n: films().filter((m) => m.tid === s.tid).length }));
		const fewest = Math.min(...counts.map((c) => c.n));
		const studio = choice(counts.filter((c) => c.n === fewest)).s;

		const budget = Math.max(dp.ask, movieBudget([director, ...cast]));
		const title = state.movies.some((m) => m.title === dp.title) ? genTitle(dp.genre, state.movies.map((m) => m.title)) : dp.title;
		state.movies.push({
			mid: state.nextMid++,
			tid: studio.tid,
			title,
			genre: dp.genre,
			season: state.season,
			budget,
			marketing: Math.round(budget * (0.1 + Math.random() * 0.5)),
			directorPid: director.pid,
			castPids: cast.map((p) => p.pid),
			leadPids: pickLeads(cast, dp.genre),
			script: directorScript(director, dp.genre, state.season),
			directorPitchId: dp.id,
			passedPitch: true,
		});
		notes.push(`${studio.name} picked up "${title}" (${director.name}), the pitch you ${dp.status === "walked" ? "lost by haggling" : "passed on"}.`);
	}
	return notes;
};
