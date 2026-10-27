import { AI_IP_FILM_CHANCE, AI_SEQUEL_CHANCE, CAST_SIZE, MAX_ACTOR_FILMS, MIN_LEADS, MIN_SUPPORTING, MOVIES_PER_SEASON, RETIRED } from "./constants";
import { aiSequelBase, franchiseIdOf, franchiseName, installmentOf } from "./franchise";
import { genSequelTitle, genTitle } from "./generate";
import { aiLicensedOptions, licenseOf, propertyById, propertyStats, propertyTitle } from "./ip";
import { movieBudget } from "./movie";
import { genreOvr } from "./ovr";
import { choice, randInt } from "./random";
import { GENRES } from "./types";
import { aiScript } from "./scripts";
import type { FilmGenre, GameState, Movie, Person, ProductionRole } from "./types";

/** Best of `k` random candidates for this genre (richer studios look at more candidates). */
const pickBest = (
	state: GameState,
	role: ProductionRole,
	genre: FilmGenre,
	blocked: (p: Person) => boolean,
	k: number,
): Person | null => {
	const available = state.people.filter((p) => p.role === role && p.tid !== RETIRED && !blocked(p));
	if (available.length === 0) return null;
	let best: Person | null = null;
	for (let i = 0; i < k; i++) {
		const candidate = choice(available);
		if (best === null || genreOvr(candidate.attrs, role, genre) > genreOvr(best.attrs, role, genre)) {
			best = candidate;
		}
	}
	return best;
};

/** Rivals bill their best genre fits as the leads (1 or 2 of them); everyone else is supporting. */
export const pickLeads = (cast: Person[], genre: FilmGenre): number[] => {
	const leadCount = randInt(MIN_LEADS, cast.length - MIN_SUPPORTING);
	return [...cast]
		.sort((a, b) => genreOvr(b.attrs, "actor", genre) - genreOvr(a.attrs, "actor", genre))
		.slice(0, leadCount)
		.map((p) => p.pid);
};

/**
 * Rivals fill the season up to MOVIES_PER_SEASON films in total (yours included),
 * taking turns so each studio makes about the same number.
 * Mutates `state` (adds the movies, bumps nextMid). Call it on a copy.
 * A director makes one film per season; an actor can be in up to MAX_ACTOR_FILMS.
 */
export const genAiMovies = (state: GameState): void => {
	const busyDirectors = new Set<number>();
	const actorFilms = new Map<number, number>();
	const seasonFilms = state.movies.filter((m) => m.season === state.season);
	for (const m of seasonFilms) {
		busyDirectors.add(m.directorPid);
		m.castPids.forEach((pid) => actorFilms.set(pid, (actorFilms.get(pid) ?? 0) + 1));
	}
	const actorFree = (p: Person) => (actorFilms.get(p.pid) ?? 0) < MAX_ACTOR_FILMS;

	const rivals = state.studios.filter((s) => s.tid !== state.userTid);
	if (rivals.length === 0) return;
	const sequelled = new Set<number>(); // prequels already continued this season
	const target = Math.max(0, MOVIES_PER_SEASON - seasonFilms.length);

	for (let turn = 0, made = 0; made < target && turn < target * 3; turn++) {
		const studio = rivals[turn % rivals.length];
		// Sometimes a rival continues one of its own past hits instead of starting something new.
		let base = Math.random() < AI_SEQUEL_CHANCE ? aiSequelBase(state, studio.tid) : null;
		if (base && sequelled.has(base.mid)) base = null;
		// A rival that owns IP rights sometimes makes a licensed film (a new hero, or the next part of one it already made).
		const options = aiLicensedOptions(state, studio);
		let ipPick = options.length > 0 && Math.random() < AI_IP_FILM_CHANCE ? choice(options) : null;
		if (ipPick) {
			if (ipPick.prev && sequelled.has(ipPick.prev.mid)) ipPick = null;
			else base = ipPick.prev;
		}
		let licensed = ipPick ? { ip: ipPick.ip, prop: ipPick.prop } : null;
		if (!licensed && base?.propertyId) {
			// continuing one of its own licensed films keeps the licence
			const found = propertyById(state, base.propertyId);
			if (found && licenseOf(state, found.ip.id)?.tid === studio.tid && !state.movies.some((m) => m.season === state.season && m.ipId === found.ip.id)) {
				licensed = found;
			}
		}
		const genre = base?.genre ?? licensed?.prop.genre ?? choice(GENRES);
		const k = studio.reputation > 60 ? 8 : 5;

		const returningDirector = base ? state.people.find((x) => x.pid === base.directorPid) : undefined;
		const director =
			returningDirector && returningDirector.tid !== RETIRED && !busyDirectors.has(returningDirector.pid)
				? returningDirector
				: pickBest(state, "director", genre, (p) => busyDirectors.has(p.pid), k);
		if (!director) continue;

		const cast: Person[] = [];
		const inCast = (p: Person) => cast.some((c) => c.pid === p.pid);
		if (base) {
			// Each returning actor comes back about two times out of three.
			for (const pid of base.castPids) {
				const actor = state.people.find((x) => x.pid === pid);
				if (actor && actor.role === "actor" && actor.tid !== RETIRED && actorFree(actor) && !inCast(actor) && Math.random() < 0.65) {
					cast.push(actor);
				}
			}
		}
		while (cast.length < CAST_SIZE) {
			const actor = pickBest(state, "actor", genre, (p) => !actorFree(p) || inCast(p), k);
			if (!actor) break;
			cast.push(actor);
		}
		if (cast.length < CAST_SIZE) continue;

		busyDirectors.add(director.pid);
		for (const a of cast) actorFilms.set(a.pid, (actorFilms.get(a.pid) ?? 0) + 1);
		if (base) sequelled.add(base.mid);
		made++;

		const extra = randInt(0, 20000);
		const budget = movieBudget([director, ...cast], extra);
		const script = aiScript(state.season, genre); // rivals buy the better of two scripts
		const takenTitles = state.movies.map((m) => m.title);
		const movie: Movie = {
			mid: state.nextMid++,
			tid: studio.tid,
			title: licensed
				? propertyTitle(licensed.prop, base ? installmentOf(base) + 1 : 1, takenTitles)
				: base
					? genSequelTitle(franchiseName(state, base), installmentOf(base) + 1, takenTitles)
					: genTitle(genre, takenTitles),
			genre,
			season: state.season,
			budget,
			marketing: Math.round(budget * (0.1 + Math.random() * 0.5)),
			directorPid: director.pid,
			castPids: cast.map((p) => p.pid),
			leadPids: pickLeads(cast, genre),
			script: script.info,
			scriptFee: script.fee,
			...(licensed && { ipId: licensed.ip.id, propertyId: licensed.prop.id, licenseFee: propertyStats(licensed.ip, licensed.prop).fee }),
			...(base && {
				prequelMid: base.mid,
				franchiseId: franchiseIdOf(base),
				installment: installmentOf(base) + 1,
			}),
		};
		state.movies.push(movie);
	}
};
