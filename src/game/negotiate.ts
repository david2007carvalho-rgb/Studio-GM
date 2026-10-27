import { PITCH_MAX_GAP, RETIRED } from "./constants";
import { GENRE_LABEL, fmtMoney } from "./format";
import { negotiationOf, reputationGap, signedDeal } from "./hiring";
import { ovr, specialtyBonus } from "./ovr";
import { clamp } from "./random";
import { STYLES } from "./scripts";
import { GENRES, Phase, SCRIPT_STYLES } from "./types";
import type { DealTerms, FilmGenre, GameState, Movie, Person, ScriptStyle } from "./types";

// ═════════════════════════════════════════════════════════════
// Advanced negotiations. With the toggle on, "Hire" and "Pitch" in the talent list become "Negotiate".
// You offer a salary and a backend share, and may promise a genre, a script style, a director and co-stars.
// Every person asks for a fair price and makes demands. Both grow with how famous they are and with how far
// their reputation requirement is above yours. Lesser-known people are easy: cheaper, fewer demands, and they
// say yes to worse contracts more often. What you sign is enforced when you greenlight (promises) and when the
// film is released (backend).
// ═════════════════════════════════════════════════════════════

export const NEG_ROUNDS = 3; // offers you may make to one person per season
export const NEG_ASK_PER_GAP = 0.05; // asking price grows this much per missing reputation point
export const NEG_DISCOUNT_MAX = 0.3; // the least famous people work for up to 30% under their market price
export const NEG_SLOPE = 5; // how fast the chance of a yes climbs with a better offer
export const NEG_KEEN = 0.2; // extra score the least famous people give any offer (they take worse contracts more often)
export const NEG_PATIENCE = 0.06; // chance lost for every earlier offer they turned down
export const NEG_INSULT = 0.55; // an offer worth under this share of their ask ends the talks
export const NEG_BACKEND_MAX = 15; // % of box office you can offer
export const NEG_BACKEND_STEPS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15];
export const NEG_PESSIMISM = 0.7; // they value a backend share at this much of what a film like yours would gross
export const NEG_MAX_COSTARS = 2;
const DEMAND_WEIGHT = { backend: 0.3, genre: 0.4, style: 0.3, director: 0.4, costar: 0.4 };
const DESPERATE_FORGIVENESS = 0.6; // the least famous care this much less about each unmet demand

/** 0 = nobody has heard of them, 1 = a global star. */
export const prestige = (p: Person): number => clamp((ovr(p.attrs, p.role) - 55) / 35, 0, 1);

export type Demand =
	| { kind: "backend"; pct: number }
	| { kind: "genre"; genres: FilmGenre[] }
	| { kind: "style"; styles: ScriptStyle[] }
	| { kind: "director"; minOvr: number }
	| { kind: "costar"; minOvr: number };

export const emptyTerms = (salary: number): DealTerms => ({ salary, backend: 0, genre: null, style: null, director: null, costars: [] });

// The same person asks the same things all season (no saving and reloading for a better draw).
const seeded = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
const shuffled = <T,>(list: readonly T[], rnd: () => number): T[] => {
	const out = [...list];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

/** What a film of yours is expected to gross, as the agents see it (thousands of $). */
export const expectedGross = (state: GameState): number => {
	const done = state.movies.filter((m) => m.boxOffice !== undefined);
	const mine = done.filter((m) => m.tid === state.userTid).slice(-3);
	const pool = mine.length ? mine : done;
	if (!pool.length) return 60000;
	return clamp(pool.reduce((s, m) => s + (m.boxOffice ?? 0), 0) / pool.length, 20000, 400000);
};

/** The salary they would sign for with no demands, if you offered no backend. */
export const askingSalary = (state: GameState, p: Person): number => {
	const gap = reputationGap(state, p);
	const cheap = 1 - NEG_DISCOUNT_MAX * (1 - prestige(p));
	return Math.max(50, Math.round((p.contract.amount * (1 + gap * NEG_ASK_PER_GAP) * cheap) / 10) * 10);
};

/** What they insist on. Fixed for the season. More famous or further out of your league = more of it. */
export const demandsOf = (state: GameState, p: Person): Demand[] => {
	const gap = reputationGap(state, p);
	const pr = prestige(p);
	const count = clamp(Math.round(pr * 1.2) + Math.floor(gap / 8), 0, 4);
	if (count === 0) return [];
	const rnd = seeded(p.pid * 7919 + state.season * 104729);
	const kinds = shuffled(["backend", "genre", "castmate", "style"] as const, rnd).slice(0, count);
	const own = ovr(p.attrs, p.role);
	const out: Demand[] = [];
	for (const kind of kinds) {
		if (kind === "backend") {
			out.push({ kind, pct: clamp(Math.round((1 + pr * 4 + gap * 0.1) * 2) / 2, 1, 8) });
		} else if (kind === "genre") {
			const liked = GENRES.filter((g) => specialtyBonus(p.specialties, g) > 0);
			const pool = shuffled(liked.length ? liked : GENRES, rnd);
			out.push({ kind, genres: pool.slice(0, gap >= 16 ? 1 : gap > 0 ? 2 : 3) });
		} else if (kind === "style") {
			out.push({ kind, styles: shuffled(SCRIPT_STYLES, rnd).slice(0, gap >= 16 ? 1 : 2) });
		} else {
			const minOvr = clamp(Math.round(own - 10 + gap * 0.25), 50, 85); // always someone you can reach
			out.push({ kind: p.role === "actor" && rnd() < 0.5 ? "director" : "costar", minOvr });
		}
	}
	return out;
};

const personOvr = (state: GameState, pid: number | null): number | null => {
	const x = pid === null ? undefined : state.people.find((q) => q.pid === pid);
	return x ? ovr(x.attrs, x.role) : null;
};

/** Does your offer give them this? */
export const demandMet = (state: GameState, d: Demand, t: DealTerms): boolean => {
	switch (d.kind) {
		case "backend": return t.backend >= d.pct;
		case "genre": return t.genre !== null && d.genres.includes(t.genre);
		case "style": return t.style !== null && t.style !== undefined && d.styles.includes(t.style);
		case "director": return (personOvr(state, t.director) ?? -1) >= d.minOvr;
		case "costar": return t.costars.some((pid) => (personOvr(state, pid) ?? -1) >= d.minOvr);
	}
};

export const demandText = (d: Demand, hide: boolean): string => {
	switch (d.kind) {
		case "backend": return `A backend of at least ${d.pct}% of the box office`;
		case "genre": return `A promise it is ${d.genres.map((g) => GENRE_LABEL[g]).join(" or ")}`;
		case "style": return `A ${d.styles.map((s) => STYLES[s].label.toLowerCase()).join(" or ")} script`;
		case "director": return hide ? "A top-flight director" : `A director rated ${d.minOvr}+`;
		case "costar": return hide ? "A big name alongside them" : `A castmate rated ${d.minOvr}+`;
	}
};

export type Evaluation =
	| { ok: false; reason: string }
	| { ok: true; chance: number; ask: number; ratio: number; unmet: Demand[]; demands: Demand[]; insulting: boolean };

/** How the offer looks to them, and the chance they sign it. */
export const evaluate = (state: GameState, p: Person, terms: DealTerms, rounds = negotiationOf(state, p.pid)?.rounds ?? 0): Evaluation => {
	if (reputationGap(state, p) > PITCH_MAX_GAP) return { ok: false, reason: `${p.name} will not even take a meeting with a studio this small.` };
	const ask = askingSalary(state, p);
	const desperation = 1 - prestige(p);
	const worth = terms.salary + (terms.backend / 100) * expectedGross(state) * NEG_PESSIMISM;
	const ratio = worth / ask;
	const demands = demandsOf(state, p);
	const unmet = demands.filter((d) => !demandMet(state, d, terms));
	const forgive = 1 - DESPERATE_FORGIVENESS * desperation;
	const penalty = unmet.reduce((s, d) => s + DEMAND_WEIGHT[d.kind] * forgive, 0);
	// Small extras: a genre that suits them, and a castmate or director as good as they are.
	const named = [terms.director, ...terms.costars].filter((x): x is number => x !== null);
	const own = ovr(p.attrs, p.role);
	const bonus = Math.min(0.12, (terms.genre && specialtyBonus(p.specialties, terms.genre) > 0 ? 0.05 : 0) + named.filter((pid) => (personOvr(state, pid) ?? 0) >= own).length * 0.04);
	const score = ratio + bonus - penalty;
	// Unknowns are keener to get the job: the whole curve shifts in your favour for them.
	const chance = clamp(1 / (1 + Math.exp(-(score - 1 + NEG_KEEN * desperation) * NEG_SLOPE)) - rounds * NEG_PATIENCE, 0.02, 0.95);
	return { ok: true, chance, ask, ratio, unmet, demands, insulting: ratio < NEG_INSULT };
};

/** The salary at which they would say yes about 6 times in 10 with the rest of your offer as it is (null = no salary fixes it). */
export const counterSalary = (state: GameState, p: Person, terms: DealTerms): number | null => {
	const chanceAt = (salary: number) => {
		const e = evaluate(state, p, { ...terms, salary });
		return e.ok ? e.chance : 0;
	};
	let hi = askingSalary(state, p) * 6;
	if (chanceAt(hi) < 0.6) return null;
	let lo = 0;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (chanceAt(mid) >= 0.6) hi = mid;
		else lo = mid;
	}
	return Math.ceil(hi / 10) * 10;
};

/** Offer people you can still hire (and who are not retired). */
const checkTerms = (state: GameState, p: Person, t: DealTerms): string | null => {
	if (!Number.isFinite(t.salary) || t.salary < 50) return "Offer a salary.";
	if (!(t.backend >= 0 && t.backend <= NEG_BACKEND_MAX)) return `Backend can be 0-${NEG_BACKEND_MAX}%.`;
	if (t.genre !== null && !GENRES.includes(t.genre)) return "That genre does not exist.";
	if (t.style !== null && !SCRIPT_STYLES.includes(t.style)) return "That script style does not exist.";
	if (t.director !== null) {
		if (p.role !== "actor") return "Only actors are promised a director.";
		const d = state.people.find((x) => x.pid === t.director);
		if (!d || d.role !== "director" || d.tid === RETIRED) return "That director is not available.";
	}
	if (t.costars.length > NEG_MAX_COSTARS || new Set(t.costars).size !== t.costars.length) return `Promise at most ${NEG_MAX_COSTARS} different people.`;
	for (const pid of t.costars) {
		const c = state.people.find((x) => x.pid === pid);
		if (!c || c.role !== "actor" || c.tid === RETIRED || pid === p.pid) return "One of the promised actors is not available.";
	}
	return null;
};

export type NegotiationResult =
	| { ok: true; state: GameState; signed: boolean; ended: boolean; message: string; counter: number | null; unmet: Demand[] }
	| { ok: false; error: string };

/** Make one offer. A yes signs the deal for this season; a no uses up a round (and a very low offer ends the talks). */
export const negotiate = (state: GameState, pid: number, terms: DealTerms, hide = false): NegotiationResult => {
	if (state.phase !== Phase.DEVELOPMENT) return { ok: false, error: "You can only negotiate during Development." };
	const p = state.people.find((x) => x.pid === pid && x.tid !== RETIRED);
	if (!p) return { ok: false, error: "That person is not available." };
	const n = negotiationOf(state, pid);
	if (n?.status === "signed") return { ok: false, error: `${p.name} has already signed with you this season.` };
	if (n?.status === "walked" || (n?.rounds ?? 0) >= NEG_ROUNDS) return { ok: false, error: `${p.name} is done talking to you this season.` };
	const bad = checkTerms(state, p, terms);
	if (bad) return { ok: false, error: bad };
	const e = evaluate(state, p, terms);
	if (!e.ok) return { ok: false, error: e.reason };

	const rounds = (n?.rounds ?? 0) + 1;
	const signed = Math.random() < e.chance;
	const ended = !signed && (e.insulting || rounds >= NEG_ROUNDS);
	const next = structuredClone(state);
	next.negotiations = {
		...(next.negotiations ?? {}),
		[pid]: { season: state.season, rounds, status: signed ? "signed" : ended ? "walked" : "open", ...(signed && { terms }) },
	};
	let message: string;
	let counter: number | null = null;
	if (signed) {
		message = `${p.name} signed: ${fmtMoney(terms.salary)}${terms.backend ? ` + ${terms.backend}% of the box office` : ""}.`;
	} else if (e.insulting) {
		message = `${p.name} was insulted by the offer and ended the talks.`;
	} else {
		counter = counterSalary(state, p, terms);
		const wants = [
			e.ratio < 1 && counter !== null ? `more money (around ${fmtMoney(counter)})` : null,
			...e.unmet.map((d) => demandText(d, hide).toLowerCase()),
		].filter(Boolean);
		message = `${p.name} said no${wants.length ? `: they want ${wants.join("; ")}` : ""}.${ended ? " They will not talk to you again this season." : ` ${NEG_ROUNDS - rounds} offer${NEG_ROUNDS - rounds === 1 ? "" : "s"} left.`}`;
	}
	next.notice = message;
	return { ok: true, state: next, signed, ended, message, counter, unmet: e.unmet };
};

/** Why you cannot negotiate with this person right now (null = you can). */
export const negotiateBlocker = (state: GameState, p: Person): string | null => {
	const n = negotiationOf(state, p.pid);
	if (n?.status === "signed") return null;
	if (n?.status === "walked" || (n?.rounds ?? 0) >= NEG_ROUNDS) return "Talks are over for this season.";
	if (reputationGap(state, p) > PITCH_MAX_GAP) return "Too far above your reputation to even take the meeting.";
	return null;
};

/** The promises in the deals you signed with people on this film. null = all kept. Used when you greenlight. */
export const dealBlocker = (state: GameState, director: Person, cast: Person[], genre: FilmGenre, style: ScriptStyle | undefined): string | null => {
	const onFilm = new Set([director.pid, ...cast.map((c) => c.pid)]);
	const name = (pid: number) => state.people.find((x) => x.pid === pid)?.name ?? "someone";
	for (const p of [director, ...cast]) {
		const t = signedDeal(state, p.pid)?.terms;
		if (!t) continue;
		if (t.genre && t.genre !== genre) return `You promised ${p.name} a ${GENRE_LABEL[t.genre]} film, and this one is ${GENRE_LABEL[genre]}.`;
		if (t.style && style && t.style !== style) return `You promised ${p.name} a ${STYLES[t.style].label.toLowerCase()} script, and this one is ${STYLES[style].label.toLowerCase()}.`;
		if (t.director !== null && t.director !== director.pid) return `You promised ${p.name} that ${name(t.director)} would direct.`;
		const missing = t.costars.find((pid) => !onFilm.has(pid));
		if (missing !== undefined) return `You promised ${p.name} that ${name(missing)} would be in the film.`;
	}
	return null;
};

/** The backend shares to snapshot on a film when it is greenlit. */
export const backendFor = (state: GameState, director: Person, cast: Person[]): NonNullable<Movie["backend"]> =>
	[director, ...cast].flatMap((p) => {
		const pct = signedDeal(state, p.pid)?.terms.backend ?? 0;
		return pct > 0 ? [{ pid: p.pid, pct }] : [];
	});

/** A line for a signed deal (talent table tooltip, film page). */
export const termsText = (t: DealTerms, state: GameState): string => {
	const name = (pid: number) => state.people.find((x) => x.pid === pid)?.name ?? "?";
	return [
		fmtMoney(t.salary),
		t.backend ? `${t.backend}% backend` : null,
		t.genre ? GENRE_LABEL[t.genre] : null,
		t.style ? STYLES[t.style].label : null,
		t.director !== null ? `dir. ${name(t.director)}` : null,
		t.costars.length ? `with ${t.costars.map(name).join(", ")}` : null,
	].filter(Boolean).join(" · ");
};
