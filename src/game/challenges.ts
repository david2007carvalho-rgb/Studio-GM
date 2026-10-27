import { BAILOUT_BELOW } from "./constants";
import { fmtMoney } from "./format";
import { Phase } from "./types";
import type { ChallengeRun, GameState, GoalId, Movie, Person, RuleId } from "./types";

// ═════════════════════════════════════════════════════════════
// Challenges. A game can be started with RULES (handicaps the game enforces) and/or a GOAL (something to achieve before a deadline).
//
// Enforcement lives in the game logic, not only in the buttons: greenlightMovie, buyLicense, the IP trades and acceptStreamOffer
// all ask this file first, so a rule cannot be skipped by any screen. The UI only explains the rules and greys out what they forbid.
//
// While the run is "active" the rules are enforced. When the goal is won or lost the run is over and the rules are lifted
// (the save carries on as a normal game). A challenge with rules and no goal stays active for the whole save.
// Old saves have no `challenge` and play exactly as before.
// ═════════════════════════════════════════════════════════════

// ── dials (money is thousands of $) ──────────────────────────
export const SHOESTRING_CAP = 60000; // most one film may cost you all-in (budget + marketing + licence fee - platform money)
export const FRESH_FACES_MAX_AGE = 30; // oldest an actor can be
export const REPERTORY_MIN = 2; // people from your previous film that must come back
export const BILLION = 1_000_000;
export const PRESTIGE_TARGET = 90;
export const DYNASTY_TARGET = 5; // Best Picture wins
export const FRANCHISE_TARGET = 5; // installments

// ── definitions ──────────────────────────────────────────────

export type RuleDef = { id: RuleId; emoji: string; name: string; summary: string; rules: string[] };

export const RULES: RuleDef[] = [
	{
		id: "noStreaming",
		emoji: "📵",
		name: "No Streaming",
		summary: "No platform money, ever.",
		rules: [
			"Streaming platforms cannot back a film at the greenlight (no financing, no marketing cover).",
			"You cannot accept licence or renewal offers, and platforms stop making them.",
		],
	},
	{
		id: "noLicensedIp",
		emoji: "🚫",
		name: "No Licensed IP",
		summary: "Every idea is your own.",
		rules: ["You cannot buy, sell or trade IP rights, and you cannot make licensed films.", "Your own sequels are still allowed."],
	},
	{
		id: "noSequels",
		emoji: "🆕",
		name: "No Sequels",
		summary: "Every film is a brand new story.",
		rules: ["A film cannot continue one of your earlier films (licensed series count as sequels after the first film)."],
	},
	{
		id: "shoestring",
		emoji: "🪙",
		name: "Shoestring",
		summary: `No film may cost more than ${fmtMoney(SHOESTRING_CAP)}.`,
		rules: [`Budget + marketing + licence fee, minus any platform money, must stay at or under ${fmtMoney(SHOESTRING_CAP)} for each film.`],
	},
	{
		id: "repertory",
		emoji: "🎭",
		name: "Repertory Company",
		summary: "Loyalty to your people.",
		rules: [
			`From your second film on, at least ${REPERTORY_MIN} people from your previous film (director or cast) must come back.`,
			"People who retired or would refuse you do not count against you.",
		],
	},
	{
		id: "freshFaces",
		emoji: "🌱",
		name: "Fresh Faces",
		summary: `Only actors aged ${FRESH_FACES_MAX_AGE} or younger.`,
		rules: [`Every actor in your films must be ${FRESH_FACES_MAX_AGE} or younger when you greenlight. Directors can be any age.`],
	},
	{
		id: "noBailouts",
		emoji: "🧨",
		name: "No Bailouts",
		summary: "Go broke and it is over.",
		rules: [`If you start a season with less than ${fmtMoney(BAILOUT_BELOW)} (the point where investors would normally step in), the challenge ends in bankruptcy.`],
	},
];

export type GoalDef = {
	id: GoalId;
	emoji: string;
	name: string;
	summary: string;
	years: number; // seasons you get, the first one included
	conflicts: RuleId[]; // rules that make the goal impossible
};

export const GOALS: GoalDef[] = [
	{ id: "billionaire", emoji: "💰", name: "Billionaire", summary: `Reach ${fmtMoney(BILLION)} in cash.`, years: 15, conflicts: [] },
	{ id: "dynasty", emoji: "🏆", name: "Oscar Dynasty", summary: `Win Best Picture ${DYNASTY_TARGET} times.`, years: 15, conflicts: [] },
	{ id: "prestige", emoji: "⭐", name: "Prestige", summary: `Get your studio reputation to ${PRESTIGE_TARGET}.`, years: 12, conflicts: [] },
	{ id: "franchise", emoji: "🎞️", name: "Franchise Empire", summary: `Release the ${FRANCHISE_TARGET}th film of one franchise.`, years: 12, conflicts: ["noSequels"] },
];

export const ruleDef = (id: RuleId): RuleDef => RULES.find((r) => r.id === id)!;
export const goalDef = (id: GoalId): GoalDef => GOALS.find((g) => g.id === id)!;

/** Why this goal and these rules cannot be chosen together (null = fine). */
export const incompatibility = (rules: RuleId[], goal: GoalId | undefined): string | null => {
	if (!goal) return null;
	const clash = goalDef(goal).conflicts.find((r) => rules.includes(r));
	return clash ? `${goalDef(goal).name} cannot be combined with ${ruleDef(clash).name}.` : null;
};

/** The run to store in a new game (null = a normal game). */
export const makeChallenge = (rules: RuleId[], goal: GoalId | undefined, startSeason: number): ChallengeRun | null => {
	const clean = RULES.map((r) => r.id).filter((id) => rules.includes(id)); // known rules only, in the usual order
	if (!goal && clean.length === 0) return null;
	if (incompatibility(clean, goal)) return null;
	return { rules: clean, ...(goal && { goal }), startSeason, status: "active" };
};

/** One line for the save slots. */
export const challengeLabel = (c: ChallengeRun | undefined): string | null => {
	if (!c) return null;
	const parts = [...(c.goal ? [goalDef(c.goal).name] : []), ...c.rules.map((r) => ruleDef(r).name)];
	const state = c.status === "won" ? " (won)" : c.status === "failed" ? " (failed)" : "";
	return parts.join(" + ") + state;
};

// ── is a rule being enforced? ────────────────────────────────

export const isRunning = (state: GameState): boolean => state.challenge?.status === "active";

export const ruleOn = (state: GameState, id: RuleId): boolean => isRunning(state) && !!state.challenge?.rules.includes(id);

const because = (id: RuleId, text: string): string => `${ruleDef(id).name} challenge: ${text}`;

// ── blockers: each returns the reason an action is forbidden, or null ──

export const streamingBlocker = (state: GameState): string | null =>
	ruleOn(state, "noStreaming") ? because("noStreaming", "streaming platforms are off limits in this run.") : null;

export const ipBlocker = (state: GameState): string | null =>
	ruleOn(state, "noLicensedIp") ? because("noLicensedIp", "licensed IP and rights trading are off limits in this run.") : null;

export const sequelBlocker = (state: GameState): string | null =>
	ruleOn(state, "noSequels") ? because("noSequels", "every film must be a new story, no sequels.") : null;

/** Actors this rule keeps off your films (null = fine). Directors are never blocked. */
export const talentBlocker = (state: GameState, p: Person): string | null => {
	if (p.role === "actor" && ruleOn(state, "freshFaces") && p.age > FRESH_FACES_MAX_AGE) {
		return because("freshFaces", `${p.name} is ${p.age}; actors must be ${FRESH_FACES_MAX_AGE} or younger.`);
	}
	return null;
};

/** Your most recent released film from an earlier season (the one the Repertory Company rule looks back at). */
export const previousFilm = (state: GameState): Movie | undefined =>
	state.movies
		.filter((m) => m.tid === state.userTid && m.season < state.season)
		.sort((a, b) => b.season - a.season || b.mid - a.mid)[0];

export type RepertoryStatus = { film: Movie; returning: number[]; required: number; have: number };

/**
 * What the Repertory Company rule asks of this plan. `canWork` says who could really be hired (not retired, not refusing you).
 * Null when the rule is off or there is nobody to bring back yet.
 */
export const repertoryStatus = (state: GameState, directorPid: number | null, castPids: number[], canWork: (pid: number) => boolean): RepertoryStatus | null => {
	if (!ruleOn(state, "repertory")) return null;
	const film = previousFilm(state);
	if (!film) return null;
	const returning = [film.directorPid, ...film.castPids].filter(canWork);
	const required = Math.min(REPERTORY_MIN, returning.length);
	if (required === 0) return null;
	const now = new Set([...(directorPid === null ? [] : [directorPid]), ...castPids]);
	return { film, returning, required, have: returning.filter((pid) => now.has(pid)).length };
};

export type PlanFacts = {
	directorPid: number;
	castPids: number[];
	outlay: number; // what the film costs you all-in
	platform: boolean; // a streaming platform backs it
	licensed: boolean; // made from a licensed property
	sequel: boolean; // continues an earlier film (a licensed series counts)
	canWork: (pid: number) => boolean;
};

/** The first challenge rule a greenlight plan breaks (null = it is fine). */
export const planBlocker = (state: GameState, plan: PlanFacts): string | null => {
	if (!isRunning(state)) return null;
	if (plan.platform) {
		const r = streamingBlocker(state);
		if (r) return r;
	}
	if (plan.licensed) {
		const r = ipBlocker(state);
		if (r) return r;
	}
	if (plan.sequel) {
		const r = sequelBlocker(state);
		if (r) return r;
	}
	if (ruleOn(state, "shoestring") && plan.outlay > SHOESTRING_CAP) {
		return because("shoestring", `this film costs ${fmtMoney(plan.outlay)}, the limit is ${fmtMoney(SHOESTRING_CAP)}.`);
	}
	for (const pid of plan.castPids) {
		const p = state.people.find((x) => x.pid === pid);
		const r = p ? talentBlocker(state, p) : null;
		if (r) return r;
	}
	const rep = repertoryStatus(state, plan.directorPid, plan.castPids, plan.canWork);
	if (rep && rep.have < rep.required) {
		return because("repertory", `bring back at least ${rep.required} people from “${rep.film.title}” (director or cast). You have ${rep.have}.`);
	}
	return null;
};

// ── goals ────────────────────────────────────────────────────

/** Last season you can still reach the goal in. */
export const deadlineOf = (c: ChallengeRun): number => c.startSeason + (c.goal ? goalDef(c.goal).years : 0) - 1;

/** Seasons left, this one included (0 once the time is up). */
export const seasonsLeft = (state: GameState): number => {
	const c = state.challenge;
	if (!c?.goal) return 0;
	return Math.max(0, deadlineOf(c) - state.season + 1);
};

const userStudio = (state: GameState) => state.studios.find((s) => s.tid === state.userTid)!;

export type Progress = { value: number; target: number; text: string };

export const goalProgress = (state: GameState): Progress | null => {
	const goal = state.challenge?.goal;
	if (!goal) return null;
	const studio = userStudio(state);
	switch (goal) {
		case "billionaire":
			return { value: studio.cash, target: BILLION, text: `${fmtMoney(studio.cash)} of ${fmtMoney(BILLION)}` };
		case "dynasty": {
			const wins = state.awards.filter((a) => a.bestPicture.tid === state.userTid).length;
			return { value: wins, target: DYNASTY_TARGET, text: `${wins} of ${DYNASTY_TARGET} Best Picture wins` };
		}
		case "prestige": {
			const rep = Math.round(studio.reputation);
			return { value: rep, target: PRESTIGE_TARGET, text: `reputation ${rep} of ${PRESTIGE_TARGET}` };
		}
		case "franchise": {
			const best = state.movies.filter((m) => m.tid === state.userTid && m.boxOffice !== undefined).reduce((n, m) => Math.max(n, m.installment ?? 1), 1);
			return { value: best, target: FRANCHISE_TARGET, text: `longest franchise: ${best} of ${FRANCHISE_TARGET} films` };
		}
	}
};

/** Seasons played so far, this one included once it is under way (a new season in Development has not been played yet). */
const playedSeasons = (state: GameState, c: ChallengeRun): number => Math.max(1, state.season - c.startSeason + (state.phase === Phase.DEVELOPMENT ? 0 : 1));

const finish = (state: GameState, status: "won" | "failed", note: string): string => {
	const c = state.challenge!;
	c.status = status;
	c.endSeason = c.startSeason + playedSeasons(state, c) - 1;
	c.note = note;
	return `${status === "won" ? "Challenge complete!" : "Challenge failed."} ${note} The challenge rules no longer apply: play on as you like.`;
};

/** Investors would step in: with No Bailouts the run ends here instead. Returns a line for the notice, or null. */
export const bankruptcy = (state: GameState): string | null => {
	if (!ruleOn(state, "noBailouts") || userStudio(state).cash >= BAILOUT_BELOW) return null;
	return finish(state, "failed", `Bankrupt: you started ${state.season} with ${fmtMoney(userStudio(state).cash)}.`);
};

/**
 * Checks the goal after a phase change. Mutates `next` (a copy). Returns a line for the notice (null = nothing happened).
 * Winning counts the moment it happens; running out of seasons is decided when the next season starts.
 */
export const settleChallenge = (next: GameState): string | null => {
	const c = next.challenge;
	if (!c || c.status !== "active" || !c.goal) return null;
	const progress = goalProgress(next)!;
	const def = goalDef(c.goal);
	if (progress.value >= progress.target) {
		const taken = playedSeasons(next, c);
		return finish(next, "won", `${def.name} achieved after ${taken === 1 ? "1 season" : `${taken} seasons`} (${next.season}).`);
	}
	if (next.season > deadlineOf(c)) {
		return finish(next, "failed", `${def.name}: time ran out after ${def.years} seasons with ${progress.text}.`);
	}
	return null;
};

// ── what you may still do, for the screens ───────────────────

export const activeRules = (state: GameState): RuleDef[] => (isRunning(state) ? state.challenge!.rules.map(ruleDef) : []);
