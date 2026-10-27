import { computeAwards, computeRace, nomineesWithWinners } from "./awards";
import { billingError } from "./cast";
import { genAiMovies } from "./ai";
import {
	BAILOUT_BELOW,
	BAILOUT_REPUTATION_COST,
	CAST_SIZE,
	DIFFICULTY_SETTINGS,
	RANDOM_TALENT_START_SEASON,
	RETIRED,
	STARTING_CASH,
	SUPPORTING_AWARD_REPUTATION,
	NEW_ACTORS_PER_YEAR,
	NEW_DIRECTORS_PER_YEAR,
	TARGET_ACTORS,
	TARGET_DIRECTORS,
} from "./constants";
import { addDirectorPitches, fundedPitch, pitchLeftover, pitchPlanError, rivalsTakePitches } from "./directorPitches";
import { bankruptcy, makeChallenge, planBlocker, settleChallenge, streamingBlocker, talentBlocker } from "./challenges";
import { applyFranchise, franchiseIdOf, installmentOf } from "./franchise";
import { refusalReason, salaryOf } from "./hiring";
import { backendFor, dealBlocker } from "./negotiate";
import { applyBrandRelease, brandOffseason, planBrands, settleBrands } from "./brands";
import { developPerson, shouldRetire } from "./develop";
import { applyMentoring } from "./mentor";
import { fmtMoney } from "./format";
import { genContract, genPerson, genTitle } from "./generate";
import { genAllTimePeople } from "./allTimeTalent";
import { genRealPeople } from "./realTalent";
import { discoverFromFilm } from "./traits";
import { addScripts, directorScript, infoOf } from "./scripts";
import { seedBonds } from "./rivalries";
import { aiBuyLicenses, licenseOf, lockReason, propertyById, propertyFilms, propertyStats, propertyTitle, releaseBoost, settleIp } from "./ip";
import { aiMakeOffers } from "./trade";
import { applyStreamingRelease, exclusiveBlocker, signOriginalDeal, streamPitch, streamingOffseason } from "./streaming";
import { ipFeeDiscount } from "./streamingPerks";
import { platformById } from "./streamingData";
import {
	criticScore,
	movieBudget,
	movieCost,
	teamRating,
	audienceScore,
	movieProfit,
	wordOfMouth,
	simDistribution,
	simOpening,
	simPost,
	simProduction,
} from "./movie";
import { makeNews, releaseEffect, stageBonds, stageDrama } from "./news";
import type { Draft } from "./news/util";
import { ovr } from "./ovr";
import { clamp, randInt } from "./random";
import { Phase } from "./types";
import type { BrandPick, Difficulty, FilmGenre, GameState, GoalId, Movie, Person, ReleaseMode, RuleId } from "./types";

const AI_STUDIOS = [
	"Aurora Pictures",
	"Blue Harbor Films",
	"Meridian Studios",
	"Nightjar Pictures",
	"Sunset Row",
	"Copperline Films",
	"Silver Reel",
	"Northgate Studios",
	"Vantage Pictures",
]; // 9 rivals + you = 10 films a year (MOVIES_PER_SEASON)

/** Starting state of a brand new game. */
/** Longest studio name the player can pick. */
export const STUDIO_NAME_MAX = 28;
const DEFAULT_STUDIO_NAME = "My Studio";

/** Clean up a typed studio name: trimmed, one space between words, not too long, never empty, never the name of a rival. */
export const cleanStudioName = (raw: string | undefined): string => {
	const name = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, STUDIO_NAME_MAX).trim();
	if (!name) return DEFAULT_STUDIO_NAME;
	return AI_STUDIOS.some((s) => s.toLowerCase() === name.toLowerCase()) ? DEFAULT_STUDIO_NAME : name;
};

export const newGame = (
	difficulty: Difficulty = "normal",
	options: { hideRatings?: boolean; studioName?: string; allTime?: boolean; rules?: RuleId[]; goal?: GoalId } = {},
): GameState => {
	const state: GameState = {
		difficulty,
		...(options.hideRatings && { hideRatings: true }),
		...(options.allTime && { allTime: true }),
		season: 2026,
		phase: Phase.DEVELOPMENT,
		userTid: 0,
		studios: [{ tid: 0, name: cleanStudioName(options.studioName), cash: DIFFICULTY_SETTINGS[difficulty].startingCash, reputation: 30 }],
		people: [],
		movies: [],
		awards: [],
		nextPid: 0,
		nextMid: 0,
	};
	AI_STUDIOS.forEach((name, i) =>
		state.studios.push({ tid: i + 1, name, cash: STARTING_CASH, reputation: randInt(30, 70) }),
	);
	// Real actors and directors only. Invented people start appearing in RANDOM_TALENT_START_SEASON.
	const real = options.allTime ? genAllTimePeople(state.nextPid, state.season) : genRealPeople(state.nextPid, state.season);
	state.people.push(...real);
	state.nextPid += real.length;
	const challenge = makeChallenge(options.rules ?? [], options.goal, state.season);
	if (challenge) state.challenge = challenge; // rules the game enforces and/or a goal with a deadline (see challenges.ts)
	addDirectorPitches(state); // the first directors come with a film for you
	addScripts(state); // the writers' market for the first season
	seedBonds(state); // a few feuds and friendships already in the air (see rivalries.ts)
	return state;
};

// ── small lookups ────────────────────────────────────────────

export const getPerson = (state: GameState, pid: number): Person => {
	const p = state.people.find((x) => x.pid === pid);
	if (!p) throw new Error(`Person ${pid} not found`);
	return p;
};

export const seasonMovies = (state: GameState): Movie[] => state.movies.filter((m) => m.season === state.season);

export const userMovie = (state: GameState): Movie | undefined =>
	seasonMovies(state).find((m) => m.tid === state.userTid);

// ── greenlighting (Development phase) ────────────────────────

export type GreenlightPlan = {
	title: string;
	genre: FilmGenre;
	sequelOfMid?: number | null; // one of your released films this one continues (null = original)
	propertyId?: string | null; // a licensed hero/story you own the rights to (null = original idea). See ip.ts
	directorPid: number | null;
	castPids: number[];
	leadPids: number[]; // which of castPids are leads; the rest are supporting
	extraBudget: number;
	marketingPct: number; // marketing as % of budget, 0-100
	platformId?: string | null; // a streaming platform that backs the film (null = none). See streaming.ts
	release?: ReleaseMode; // how it is released when a platform backs it (wide, a limited run, or a streaming premiere)
	scriptId?: number | null; // the script you bought (null = none picked yet). Its genre is the film's genre. A funded pitch comes with the director's own script instead. See scripts.ts
	directorPitchId?: number | null; // a director's pitch you funded (null = none). The film is built on it: its director, genre and wish list, and its funded budget. See directorPitches.ts
	brands?: BrandPick[]; // sponsors and product placements that pay towards the film (none = no brands). See brands.ts
};

export type GreenlightResult = { ok: true; state: GameState } | { ok: false; error: string };

/** Approve your film for this season (replaces an earlier greenlit film). Money is paid when production starts. */
export const greenlightMovie = (state: GameState, plan: GreenlightPlan): GreenlightResult => {
	const fail = (error: string): GreenlightResult => ({ ok: false, error });
	if (state.phase !== Phase.DEVELOPMENT) return fail("Films can only be greenlit during Development.");
	if (plan.directorPid === null) return fail("Pick a director.");

	const active = (p: Person) => p.tid !== RETIRED;
	const director = state.people.find((p) => p.pid === plan.directorPid && p.role === "director" && active(p));
	if (!director) return fail("That director is not available.");

	if (plan.castPids.length !== CAST_SIZE || new Set(plan.castPids).size !== CAST_SIZE) {
		return fail(`Pick exactly ${CAST_SIZE} different actors.`);
	}
	const found = plan.castPids.map((pid) => state.people.find((p) => p.pid === pid && p.role === "actor" && active(p)));
	if (found.some((p) => p === undefined)) return fail("One of the actors is not available.");
	const cast = found as Person[];
	const billing = billingError(plan.castPids, plan.leadPids);
	if (billing) return fail(billing);

	// Hard mode: stars may refuse a studio with a weak reputation.
	for (const person of [director, ...cast]) {
		const reason = refusalReason(state, person);
		if (reason) return fail(reason);
	}

	// Licensed property: you must own the rights, and every film after the first continues the last one.
	let propertyId = plan.propertyId ?? null;
	let prequelMid = plan.sequelOfMid ?? null;
	if (prequelMid !== null) {
		const chosen = state.movies.find((m) => m.mid === prequelMid);
		if (chosen?.propertyId) propertyId = chosen.propertyId; // continuing a licensed film keeps its licence
		else if (chosen && !propertyId && state.customIps?.some((ip) => ip.custom!.fid === franchiseIdOf(chosen))) {
			return fail("That franchise was sold as an IP. Buy its rights back in the IP Store to continue it.");
		}
	}
	const licensed = propertyId ? propertyById(state, propertyId) : undefined;
	if (propertyId && !licensed) return fail("That property does not exist.");
	if (licensed) {
		const lic = licenseOf(state, licensed.ip.id);
		if (!lic || lic.tid !== state.userTid) return fail(`You do not own the ${licensed.ip.name} rights. Buy them in the IP Store.`);
		const locked = lockReason(state, state.userTid, licensed.ip, licensed.prop);
		if (locked) return fail(locked);
		const films = propertyFilms(state, state.userTid, licensed.prop.id);
		prequelMid = films.length ? films[films.length - 1].mid : null;
	}
	const licenseFee = licensed ? Math.round(propertyStats(licensed.ip, licensed.prop).fee * (1 - ipFeeDiscount(state))) : 0; // streaming contracts can discount it

	const pay = (p: Person) => salaryOf(state, p);
	// A director's pitch you funded: the film gets the funded budget. What the director and cast do not cost goes into production,
	// and anything you add on top comes from the extra budget field. See directorPitches.ts.
	let extra = Math.max(0, Math.round(plan.extraBudget) || 0);
	let directorPitchId: number | undefined;
	if (plan.directorPitchId !== null && plan.directorPitchId !== undefined) {
		const dp = fundedPitch(state, plan.directorPitchId);
		if (!dp) return fail("That pitch is no longer funded. Fund it again, or drop it from the plan.");
		const problem = pitchPlanError(state, dp, plan, director, cast);
		if (problem) return fail(problem);
		extra += pitchLeftover(state, dp, director, cast);
		directorPitchId = dp.id;
	}
	const budget = movieBudget([director, ...cast], extra, pay);
	const pitchExtra = cast.reduce((sum, p) => sum + pay(p) - p.contract.amount, 0);
	const marketing = Math.round((budget * clamp(plan.marketingPct, 0, 100)) / 100);
	const studio = state.studios.find((s) => s.tid === state.userTid)!;

	// A streaming platform may back the film: it pays part of the budget (and marketing) and offers a contract. See streaming.ts.
	let backing: Partial<Movie> = {};
	let financed = 0;
	if (plan.platformId) {
		const noStreaming = streamingBlocker(state); // a challenge rule says it before the platform can say no
		if (noStreaming) return fail(noStreaming);
		const platform = platformById(plan.platformId);
		if (!platform) return fail("That platform does not exist.");
		const mode: ReleaseMode = plan.release ?? "wide";
		const stub = { genre: plan.genre } as Movie; // the genre is fixed below for sequels and licensed films, so use what the film will really be
		const filmGenre = prequelMid !== null ? (state.movies.find((m) => m.mid === prequelMid)?.genre ?? plan.genre) : licensed && prequelMid === null ? licensed.prop.genre : plan.genre;
		stub.genre = filmGenre;
		const pitch = streamPitch(state, platform, { genre: filmGenre, budget, marketing, fit: Math.round(teamRating(stub, director, cast)) }, mode);
		if (pitch.refusal || !pitch.terms) return fail(pitch.refusal ?? `${platform.name} is not interested.`);
		const lock = exclusiveBlocker(state, platform.id);
		if (lock) return fail(lock);
		financed = pitch.financing + pitch.marketingCover;
		backing = { streamPlatformId: platform.id, release: mode, financing: pitch.financing, platformMarketing: pitch.marketingCover, streamTerms: pitch.terms };
	}
	// The script: one from the market whose genre is the film's genre, or the director's own when you funded their pitch (see scripts.ts).
	const scriptGenre: FilmGenre =
		prequelMid !== null ? (state.movies.find((m) => m.mid === prequelMid)?.genre ?? plan.genre) : licensed ? licensed.prop.genre : plan.genre;
	let script: Movie["script"];
	let scriptFee = 0;
	if (directorPitchId !== undefined) {
		script = directorScript(director, scriptGenre, state.season);
	} else {
		const bought = plan.scriptId === null || plan.scriptId === undefined ? undefined : (state.scripts ?? []).find((s) => s.id === plan.scriptId && s.season === state.season);
		if (!bought) return fail(plan.scriptId === null || plan.scriptId === undefined ? "Pick a script for the film." : "That script is no longer on the market. Pick another.");
		if (bought.genre !== scriptGenre) return fail(`That script is for a ${bought.genre} film, and this film is ${scriptGenre}.`);
		script = infoOf(bought);
		scriptFee = bought.price;
	}

	// Advanced negotiations: what you promised the people you signed (see negotiate.ts).
	const promise = dealBlocker(state, director, cast, scriptGenre, script?.style);
	if (promise) return fail(promise);

	// Brand deals (see brands.ts): sponsors and product placements pay part of the cost.
	const brandPlan = planBrands(state, plan.brands, { genre: scriptGenre, budget, marketing, prequelMid });
	if (!brandPlan.ok) return fail(brandPlan.error);
	financed += brandPlan.funding;

	// Challenge rules (see challenges.ts): the same checks run here for every screen.
	const outlay = budget + marketing + licenseFee + scriptFee - financed;
	const canWork = (pid: number) => {
		const person = state.people.find((x) => x.pid === pid);
		return !!person && person.tid !== RETIRED && !refusalReason(state, person) && !talentBlocker(state, person);
	};
	const ruled = planBlocker(state, {
		directorPid: director.pid,
		castPids: plan.castPids,
		outlay,
		platform: !!plan.platformId,
		licensed: !!licensed,
		sequel: prequelMid !== null,
		canWork,
	});
	if (ruled) return fail(ruled);
	if (budget + marketing + licenseFee + scriptFee - financed > studio.cash) {
		return fail(`Not enough cash: this film costs ${fmtMoney(budget + marketing + licenseFee + scriptFee - financed)}${financed > 0 ? ` after the ${fmtMoney(financed)} paid by platforms and brands` : ""} and you have ${fmtMoney(studio.cash)}.`);
	}

	// Sequel? It must continue one of your own released films, and keeps that film's genre.
	let franchise: Partial<Movie> = {};
	let genre = licensed && prequelMid === null ? licensed.prop.genre : plan.genre;
	if (prequelMid !== null) {
		const prequel = state.movies.find((m) => m.mid === prequelMid);
		// A custom IP continues whatever the franchise's last film was, even one made by the studio that sold it to you.
		const ownFilm = prequel?.tid === state.userTid || !!licensed?.ip.custom;
		if (!prequel || !ownFilm || prequel.boxOffice === undefined || prequel.criticScore === undefined) {
			return fail("A sequel must continue one of your own released films.");
		}
		genre = prequel.genre;
		franchise = {
			prequelMid: prequel.mid,
			franchiseId: franchiseIdOf(prequel),
			installment: installmentOf(prequel) + 1,
		};
	}

	const backend = backendFor(state, director, cast);
	const next = structuredClone(state);
	next.movies = next.movies.filter((m) => !(m.season === next.season && m.tid === next.userTid));
	next.movies.push({
		mid: next.nextMid++,
		tid: next.userTid,
		title:
			plan.title.trim() ||
			(licensed
				? propertyTitle(licensed.prop, (franchise.installment ?? 1), next.movies.map((m) => m.title))
				: genTitle(genre, next.movies.map((m) => m.title))),
		genre,
		season: next.season,
		budget,
		marketing,
		...(pitchExtra > 0 && { pitchExtra }),
		...(directorPitchId !== undefined && { directorPitchId }),
		...(licensed && { ipId: licensed.ip.id, propertyId: licensed.prop.id, licenseFee }),
		script,
		...(scriptFee > 0 && { scriptFee }),
		...(backend.length > 0 && { backend }),
		...(brandPlan.picks.length > 0 && { brands: brandPlan.picks, brandFunding: brandPlan.funding }),
		directorPid: director.pid,
		castPids: cast.map((p) => p.pid),
		leadPids: cast.map((p) => p.pid).filter((pid) => plan.leadPids.includes(pid)),
		...franchise,
		...backing,
	});
	return { ok: true, state: next };
};

// ═════════════════════════════════════════════════════════════
// Phase machine. Like ZenGM's newPhase.ts: entering a phase runs its work.
//   Development  : you pick genre, director, cast (greenlightMovie)
//   Production   : rivals greenlight, everyone pays, shoot -> productionQuality
//   Post         : editing -> postQuality
//   Distribution : release -> box office, critic score, cash, reputation
//   Awards       : winners chosen
//   Off-season   : aging, retirements, new talent, new contracts
// ═════════════════════════════════════════════════════════════

/** Why the player cannot advance right now (null = can advance). */
export const canAdvance = (state: GameState): string | null => {
	if (state.phase === Phase.DEVELOPMENT && !userMovie(state)) {
		return "Greenlight a film first: pick a director, 3 actors, and who plays the leads.";
	}
	return null;
};

/** Move to the next phase and run what that phase needs. Returns a NEW state. */
export const advancePhase = (state: GameState): GameState => {
	if (canAdvance(state)) return state;
	const next = structuredClone(state); // safe to mutate: the original stays untouched
	next.notice = undefined;
	const movies = () => seasonMovies(next);
	const studioOf = (tid: number) => next.studios.find((s) => s.tid === tid)!;
	const castOf = (m: Movie) => m.castPids.map((pid) => getPerson(next, pid));
	let drama: Draft[] = []; // this phase's drama articles (see news/drama.ts), handed to the news at the end

	switch (state.phase) {
		case Phase.DEVELOPMENT: {
			next.phase = Phase.PRODUCTION;
			// Pitches you turned down may be made by a rival, before the other rivals pick their films.
			const missed = rivalsTakePitches(next);
			if (missed.length) next.notice = missed.join(" ");
			genAiMovies(next);
			for (const m of movies()) {
				studioOf(m.tid).cash -= movieCost(m);
				m.productionQuality = simProduction(m, getPerson(next, m.directorPid), castOf(m), next.movies, next.bonds);
			}
			drama = stageDrama(next, "production"); // feuds, injuries... change the shoot
			break;
		}
		case Phase.PRODUCTION: {
			next.phase = Phase.POST;
			for (const m of movies()) m.postQuality = simPost(m, getPerson(next, m.directorPid));
			drama = stageDrama(next, "post"); // final-cut wars, reshoots...
			break;
		}
		case Phase.POST: {
			next.phase = Phase.DISTRIBUTION;
			drama = stageDrama(next, "release"); // controversies, viral moments... (applied below, at release)
			for (const m of movies()) {
				const studio = studioOf(m.tid);
				const cast = castOf(m);
				m.boxOffice = simDistribution(m, cast, studio.reputation);
				m.criticScore = criticScore(m, getPerson(next, m.directorPid), cast);
				// Audiences judge differently from critics; word of mouth nudges the gross a little either way.
				m.audienceScore = audienceScore(m, cast);
				m.boxOffice = Math.round(m.boxOffice * wordOfMouth(m.audienceScore));
				// Drama around the film (buzz, boycotts, festival reviews) moves the gross and the reviews a little.
				const fx = releaseEffect(m);
				m.boxOffice = Math.round(m.boxOffice * fx.gross);
				m.criticScore = clamp(m.criticScore + fx.critic);
				// Brand deals: placements cost critic points and lift the gross; a sequel gets its franchise's heat (see brands.ts).
				applyBrandRelease(next, m);
				// Licensed IP: the famous name lifts the gross (before any sequel blend, so the lift carries forward).
				const ipBoost = releaseBoost(next, m);
				const grossBeforeBoost = m.boxOffice;
				m.boxOffice = Math.round(m.boxOffice * ipBoost);
				// Sequels: part of the result comes from the prequel (see franchise.ts).
				const prequel = m.prequelMid === undefined ? undefined : next.movies.find((x) => x.mid === m.prequelMid);
				if (prequel && prequel.boxOffice !== undefined && prequel.criticScore !== undefined) {
					const result = applyFranchise(m, prequel, m.boxOffice, m.criticScore);
					m.standaloneBoxOffice = m.boxOffice;
					m.standaloneCritic = m.criticScore;
					m.boxOffice = result.boxOffice;
					m.criticScore = result.criticScore;
					m.continuity = result.continuity;
				}
				// Licensed IP: the fans compare the result with what they expected (backlash or acclaim).
				const ipReputation = settleIp(next, m, ipBoost, grossBeforeBoost);
				// Streaming: the platform behind the film, and your other contracts, change how it is released (see streaming.ts).
				const repKept = m.tid === next.userTid ? applyStreamingRelease(next, m) : 1;
				m.opening = m.release === "streaming" ? undefined : simOpening(m); // a streaming premiere has no opening weekend
				studio.cash += m.boxOffice;
				// Backend deals (see negotiate.ts): the people you signed take their share of the gross.
				if (m.backend?.length) {
					m.backendPaid = Math.round(m.backend.reduce((sum, b) => sum + (b.pct / 100) * (m.boxOffice ?? 0), 0));
					studio.cash -= m.backendPaid;
					const who = m.backend.map((b) => `${getPerson(next, b.pid).name} (${b.pct}%)`).join(", ");
					next.notice = [next.notice, `Backend paid on ${m.title}: ${fmtMoney(m.backendPaid)} to ${who}.`].filter(Boolean).join(" ");
				}
				// Brand deals: hit bonus or make-good, before the profit is judged.
				if (m.tid === next.userTid) drama.push(...settleBrands(next, m));
				// Good reviews and profits build reputation; flops hurt it.
				// A pull toward 50 stops everyone from sitting at 100 forever.
				const profitRatio = clamp(movieProfit(m) / Math.max(m.budget, 1), -1, 1);
				const change = (m.criticScore - 60) / 10 + 1.5 * profitRatio - 0.08 * (studio.reputation - 50);
				const gain = clamp(change, -5, 5);
				studio.reputation = clamp(studio.reputation + (gain > 0 ? gain * repKept : gain) + ipReputation);
				// Hidden: castmates with a fitting specialty rub off on actors who lack it.
				applyMentoring(m, cast);
			}
			// A film a platform backed signs its contract now that it is out (after the other films, so it does not boost itself).
			const signed = movies().filter((m) => m.tid === next.userTid && m.streamPlatformId).map((m) => signOriginalDeal(next, m)).filter(Boolean);
			if (signed.length) next.notice = `Streaming contract: ${signed.join(" ")}`;
			// Making a film shows you who the people on it really are (see traits.ts).
			const learned = movies().flatMap((m) => discoverFromFilm(next, m));
			if (learned.length) next.notice = [next.notice, ...learned].filter(Boolean).join(" ");
			next.awardRace = computeRace(next);
			break;
		}
		case Phase.DISTRIBUTION: {
			next.phase = Phase.AWARDS;
			const awards = computeAwards(next);
			if (awards) {
				if (next.awardRace) awards.nominees = nomineesWithWinners(next.awardRace, awards);
				next.awards.push(awards);
				const bump = (tid: number, amount: number) => {
					const studio = studioOf(tid);
					studio.reputation = clamp(studio.reputation + amount);
				};
				bump(awards.bestPicture.tid, 5);
				bump(awards.bestDirector.tid, 3);
				if (awards.bestActor) bump(awards.bestActor.tid, 3);
				if (awards.bestActress) bump(awards.bestActress.tid, 3);
				if (awards.bestSupportingActor) bump(awards.bestSupportingActor.tid, SUPPORTING_AWARD_REPUTATION);
				if (awards.bestSupportingActress) bump(awards.bestSupportingActress.tid, SUPPORTING_AWARD_REPUTATION);
			}
			break;
		}
		case Phase.AWARDS: {
			next.phase = Phase.OFFSEASON;
			const newSeason = next.season + 1;
			// Everyone gets a year older, then the old ones may retire.
			next.people = next.people.map((p) => (p.tid === RETIRED ? p : developPerson(p, newSeason)));
			next.people = next.people.map((p) => (p.tid !== RETIRED && shouldRetire(p) ? { ...p, tid: RETIRED } : p));
			// Feuds cool or end, the tabloids start new ones (see rivalries.ts).
			drama = stageBonds(next);
			// New asking prices for the new season.
			next.people = next.people.map((p) =>
				p.tid === RETIRED ? p : { ...p, contract: genContract(ovr(p.attrs, p.role), newSeason) },
			);
			// A rival may buy the rights to a famous IP.
			aiBuyLicenses(next);
			// Rivals may also come knocking with offers for your IPs.
			aiMakeOffers(next);
			// Streaming contracts pay out, end or renew; platforms may make offers for your free films.
			const streamNotes = streamingOffseason(next);
			if (streamNotes.length) next.notice = [next.notice, ...streamNotes].filter(Boolean).join(" ");
			// Brand deals pay, resolve and make new offers (see brands.ts).
			const brandWork = brandOffseason(next);
			drama.push(...brandWork.drafts);
			if (brandWork.notes.length) next.notice = [next.notice, ...brandWork.notes].filter(Boolean).join(" ");
			// New invented talent arrives every year (from RANDOM_TALENT_START_SEASON), so the pool is replenished
			// while the real generation ages. Then the pool is topped up to the minimum sizes.
			if (newSeason >= RANDOM_TALENT_START_SEASON) {
				const taken = new Set(next.people.map((p) => p.name));
				const newActors = randInt(NEW_ACTORS_PER_YEAR[0], NEW_ACTORS_PER_YEAR[1]);
				const newDirectors = randInt(NEW_DIRECTORS_PER_YEAR[0], NEW_DIRECTORS_PER_YEAR[1]);
				for (let i = 0; i < newActors; i++) next.people.push(genPerson(next.nextPid++, "actor", newSeason, randInt(20, 30), taken));
				for (let i = 0; i < newDirectors; i++) next.people.push(genPerson(next.nextPid++, "director", newSeason, randInt(26, 40), taken));
				const active = (role: Person["role"]) => next.people.filter((p) => p.role === role && p.tid !== RETIRED).length;
				while (active("actor") < TARGET_ACTORS) {
					next.people.push(genPerson(next.nextPid++, "actor", newSeason, randInt(20, 30), taken));
				}
				while (active("director") < TARGET_DIRECTORS) {
					next.people.push(genPerson(next.nextPid++, "director", newSeason, randInt(26, 40), taken));
				}
			}
			break;
		}
		case Phase.OFFSEASON: {
			next.season += 1;
			next.phase = Phase.DEVELOPMENT;
			next.awardRace = undefined;
			next.deals = undefined; // talks start fresh every year
			next.pitches = undefined; // and every actor can be pitched again
			next.offers = undefined; // rival offers only last for one off-season
			next.streamOffers = undefined; // so do streaming offers
			next.brandOffers = undefined; // and brand offers
			// Never let the player get stuck without enough money to make any film.
			const user = studioOf(next.userTid);
			// With the No Bailouts rule the challenge ends here (its rules are lifted), and the usual bailout below keeps the save alive.
			const bust = bankruptcy(next);
			if (user.cash < BAILOUT_BELOW) {
				const given = BAILOUT_BELOW - user.cash;
				user.cash = BAILOUT_BELOW;
				user.reputation = clamp(user.reputation - BAILOUT_REPUTATION_COST);
				next.notice = [bust, `Investors covered ${fmtMoney(given)} to keep the studio open. Your reputation dropped by ${BAILOUT_REPUTATION_COST}.`].filter(Boolean).join(" ");
			}
			addDirectorPitches(next); // new directors bring new pitches (after the bailout, so they judge the reputation you start with)
			addScripts(next); // the writers' market for the new season
			break;
		}
	}
	// Challenge goal: won the moment it is reached, lost when the last season is over (see challenges.ts).
	const verdict = settleChallenge(next);
	if (verdict) next.notice = [next.notice, verdict].filter(Boolean).join(" ");
	makeNews(state, next, drama); // one issue of the news feed per phase change
	return next;
};

