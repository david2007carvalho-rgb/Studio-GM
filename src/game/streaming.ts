import { streamingBlocker } from "./challenges";
import {
	STREAM_AGE_DECAY,
	STREAM_AGE_FLOOR,
	STREAM_BASE_FEE,
	STREAM_BREACH_REPUTATION,
	STREAM_BUDGET_SHARE,
	STREAM_DEMAND_PREMIUM,
	STREAM_FESTIVALS_ENTERED,
	STREAM_FESTIVAL_CASH,
	STREAM_FESTIVAL_REPUTATION,
	STREAM_FINANCE_MAX,
	STREAM_FINANCE_SCALE,
	STREAM_FX,
	STREAM_GROSS_SHARE,
	STREAM_LICENCE_ANNUAL,
	STREAM_LICENCE_UPFRONT,
	STREAM_MAX_OFFERS,
	STREAM_MAX_OFFERS_PER_FILM,
	STREAM_MAX_PER_SEASON,
	STREAM_MIN_FEE,
	STREAM_MOOD,
	STREAM_OFFER_CHANCE,
	STREAM_ORIGINAL_ANNUAL_BASE,
	STREAM_ORIGINAL_ANNUAL_BUDGET,
	STREAM_RENEWAL_ANNUAL,
	STREAM_RENEWAL_UPFRONT,
	STREAM_RENEWAL_YEARS,
	STREAM_SLATE_FULL_CHANCE,
	STREAM_YEARS,
	DEFAULT_MARKETING_RATIO,
} from "./constants";
import { fmtMoney, GENRE_LABEL } from "./format";
import { franchiseIdOf } from "./franchise";
import { customIpId, ipById, licenseOf, studioNameOf } from "./ip";
import { clamp } from "./random";
import { FESTIVALS, PLATFORMS, platformById } from "./streamingData";
import type { Platform } from "./streamingData";
import { activeDeals, dealOf, franchiseMult, prestigePoints, slatePromoMult } from "./streamingPerks";
import { Phase } from "./types";
import type { Demand, FilmGenre, GameState, Movie, Perk, ReleaseMode, StreamTerms, StreamingDeal, StreamingOffer } from "./types";

export { dealOf, activeDeals };

// ═════════════════════════════════════════════════════════════
// Streaming platforms, as CONTRACTS.
//
// Two ways to get a platform behind a film:
//   1. BACK IT FROM THE GREENLIGHT. Platforms that are interested in the film you are planning (reputation, team fit, genre, budget,
//      room on their slate) pay part of its budget and offer a contract. You also pick HOW it is released: wide in cinemas, a limited
//      run, or a streaming premiere. Each platform has its own view of cinemas (`theatrical`), which moves the financing, the box office
//      and the yearly payment up or down (see releaseFx).
//   2. SELL A FILM THAT IS ALREADY OUT. You cannot go to a page and sell it: platforms come to YOU in the off-season with offers.
//
// A contract runs 4-5 off-seasons (3-4 for a renewal). While it runs it pays a yearly sum and gives PERKS (box-office promotion,
// reputation, an awards campaign, sequel bonuses, IP discounts, easier talent) but attaches DEMANDS (a genre quota, caps or minimums
// on wide releases, exclusivity, a reputation floor). When it ends, the platform either offers to renew (on different terms) or
// the rights come back to you. Breaking a demand costs money and reputation and kills the renewal.
//
// Money is thousands of $. Terms are generated from a seeded random so the same plan shows the same terms every time you look.
// ═════════════════════════════════════════════════════════════

const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

const hash = (s: string): number => {
	let h = 2166136261;
	for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return h >>> 0;
};

/** A stable number between 0 and 1 for one key: re-asking never rerolls it. */
const mood = (key: string): number => (hash(key) % 10000) / 10000;

/** A small seeded random generator (mulberry32). */
const rngFrom = (key: string): (() => number) => {
	let a = hash(key) || 1;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const isReleased = (m: Movie): boolean => m.boxOffice !== undefined && m.criticScore !== undefined;
const userStudio = (state: GameState) => state.studios.find((s) => s.tid === state.userTid)!;
const lastPayOf = (d: StreamingDeal): number => d.firstPay + d.years - 1;

/** Last season whose off-season pays. The renewal decision happens in that off-season. */
export const dealEnd = lastPayOf;

// ── release modes ────────────────────────────────────────────

export const RELEASE_LABEL: Record<ReleaseMode, string> = {
	wide: "Wide theatrical release",
	limited: "Limited run + festivals",
	streaming: "Streaming premiere",
};

export type ReleaseFx = {
	mode: ReleaseMode;
	financeMult: number; // x the platform's usual share of the budget
	annualMult: number; // x the yearly payment
	boxMult: number; // x the simulated box office (streaming: the viewership payout)
	marketingCover: number; // share (0-1) of the marketing the platform pays, up to 30% of the budget
	criticDelta: number; // critic points
	awardsDelta: number; // awards-score points
	repMult: number; // scales reputation GAINS from the film
	festivalMult: number;
};

/** What a release mode does for one platform. The platform's view of cinemas (`theatrical`, -1..1) drives it. */
export const releaseFx = (p: Platform, mode: ReleaseMode): ReleaseFx => {
	const s = p.theatrical;
	const F = STREAM_FX;
	const fx: ReleaseFx = { mode, financeMult: 1, annualMult: 1, boxMult: 1, marketingCover: 0, criticDelta: 0, awardsDelta: 0, repMult: 1, festivalMult: 1 };
	if (mode === "wide") {
		fx.financeMult = 1 + F.wideFinance * s;
		fx.boxMult = 1 + F.wideBox * s;
		fx.annualMult = 1 + F.wideAnnual * s;
		fx.marketingCover = Math.max(0, s) * F.wideMarketing;
	} else if (mode === "limited") {
		fx.financeMult = 1 + F.limitedFinance * s;
		fx.boxMult = F.limitedBox;
		fx.annualMult = 1 + F.limitedAnnual * s;
		fx.marketingCover = F.limitedMarketing;
		fx.criticDelta = Math.round(1 + 2 * p.prestige);
		fx.awardsDelta = F.limitedAwards;
		fx.festivalMult = F.limitedFestival;
	} else {
		fx.financeMult = 1 - F.streamingFinance * s;
		fx.annualMult = 1 - F.streamingAnnual * s;
		fx.boxMult = F.streamingPayout[0] + F.streamingPayout[1] * p.reach;
		fx.marketingCover = 1;
		fx.awardsDelta = F.streamingAwards;
		fx.repMult = F.streamingRep;
	}
	if (p.favoured === mode) {
		fx.financeMult *= F.favouredFinance;
		fx.annualMult *= F.favouredAnnual;
	}
	fx.financeMult = Math.max(0.3, fx.financeMult);
	fx.annualMult = Math.max(0.3, fx.annualMult);
	return fx;
};

export type FxLine = { text: string; good: boolean | null };

const pct = (x: number): string => `${x >= 1 ? "+" : "−"}${Math.round(Math.abs(x - 1) * 100)}%`;

/** The effects of a release mode as short lines for the screen. */
export const describeFx = (p: Platform, fx: ReleaseFx): FxLine[] => {
	const lines: FxLine[] = [];
	lines.push({ text: `Financing ${pct(fx.financeMult)} vs. its usual share`, good: fx.financeMult > 1.02 ? true : fx.financeMult < 0.98 ? false : null });
	lines.push({ text: `Yearly payment ${pct(fx.annualMult)}`, good: fx.annualMult > 1.02 ? true : fx.annualMult < 0.98 ? false : null });
	if (fx.mode === "streaming") {
		lines.push({ text: `No box office: the platform pays a viewership payout of about ${Math.round(fx.boxMult * 100)}% of what a wide release would gross`, good: false });
	} else if (fx.mode === "limited") {
		lines.push({ text: `Box office about ${Math.round(fx.boxMult * 100)}% of a wide release`, good: false });
	} else if (Math.abs(fx.boxMult - 1) >= 0.02) {
		lines.push({ text: `Box office ${pct(fx.boxMult)} (${fx.boxMult > 1 ? `${p.name} promotes the release` : `${p.name} does not push cinemas`})`, good: fx.boxMult > 1 });
	}
	if (fx.marketingCover > 0.01) lines.push({ text: `${p.name} pays ${Math.round(fx.marketingCover * 100)}% of the marketing (up to ${Math.round(DEFAULT_MARKETING_RATIO * 100)}% of the budget)`, good: true });
	if (fx.criticDelta) lines.push({ text: `Critics +${fx.criticDelta} (festival buzz)`, good: true });
	if (fx.awardsDelta > 0) lines.push({ text: `Awards +${fx.awardsDelta}`, good: true });
	if (fx.awardsDelta < 0) lines.push({ text: `Awards ${fx.awardsDelta}: voters snub films that skip cinemas`, good: false });
	if (fx.repMult < 1) lines.push({ text: `Reputation gains from the film ×${fx.repMult}`, good: false });
	if (fx.festivalMult > 1) lines.push({ text: "Likelier to win festival prizes", good: true });
	return lines;
};

// ── describing terms ─────────────────────────────────────────

export const describePerk = (perk: Perk): string => {
	switch (perk.kind) {
		case "slatePromo":
			return `Promotes your studio: +${perk.pct}% box office on your new wide and limited releases`;
		case "prestige":
			return `Reputation +${perk.points} every off-season`;
		case "awardsPush":
			return `Awards campaign: +${perk.points} on this film's awards score`;
		case "franchise":
			return `Sequels to this film earn +${perk.pct}% box office`;
		case "ipDiscount":
			return `${perk.pct}% off the licence fee of your licensed-IP films`;
		case "talentAccess":
			return `Talent treats your studio as if its reputation were ${perk.points} higher`;
	}
};

const genreList = (genres: FilmGenre[]): string => genres.map((g) => GENRE_LABEL[g]).join(" / ");
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export const describeDemand = (d: Demand): string => {
	switch (d.kind) {
		case "exclusive":
			return "Exclusive: no new deals or financing from other platforms while it runs";
		case "quota":
			return `Greenlight ${plural(d.count, "film")} in ${genreList(d.genres)} during the contract`;
		case "wideCap":
			return d.max === 0 ? "No wide theatrical releases during the contract" : `At most ${plural(d.max, "wide theatrical release")} of yours during the contract`;
		case "wideMin":
			return `At least ${plural(d.min, "wide theatrical release")} of yours during the contract`;
		case "reputation":
			return `Keep your studio reputation at ${d.min}+ or the yearly payment is withheld`;
	}
};

// ── generating terms ─────────────────────────────────────────

type TermsCtx = {
	kind: "original" | "licence" | "renewal";
	seed: string;
	quality: number; // 0-100: team fit before release, reception after
	annualBase: number; // yearly money before release mode and demand premiums
	upfrontBase: number;
	fx?: ReleaseFx; // originals: the release mode
	previous?: StreamTerms; // renewals: the terms being replaced (the new ones lean away from them)
	renewals?: number; // renewals this contract is, counting itself (renewals only)
};

const perkOf = (kind: Perk["kind"], p: Platform, q: number): Perk => {
	switch (kind) {
		case "slatePromo":
			return { kind, pct: Math.max(2, Math.round((4 + 6 * p.reach) * q)) };
		case "prestige":
			return { kind, points: Math.max(0.3, Math.round((0.5 + p.prestige) * q * 10) / 10) };
		case "awardsPush":
			return { kind, points: Math.max(1, Math.round((2 + 4 * p.prestige) * q)) };
		case "franchise":
			return { kind, pct: Math.max(5, Math.round((8 + 40 * ((p.franchiseLove ?? 1) - 1)) * q)) };
		case "ipDiscount":
			return { kind, pct: clamp(Math.round((8 + 8 * p.scale) * q), 5, 30) };
		case "talentAccess":
			return { kind, points: Math.max(2, Math.round((3 + 4 * p.prestige) * q)) };
	}
};

/** One set of terms: how long, how much, which perks and which demands. Same context = same terms. */
export const genTerms = (p: Platform, ctx: TermsCtx): StreamTerms => {
	const rnd = rngFrom(ctx.seed);
	const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
	const years = ctx.kind === "renewal" ? between(STREAM_RENEWAL_YEARS[0], STREAM_RENEWAL_YEARS[1]) : between(STREAM_YEARS[0], STREAM_YEARS[1]);
	const q = clamp((ctx.quality - 45) / 40, 0.4, 1.25);
	const good = ctx.quality >= 70;

	// Perks: weighted draw without replacement. A renewal leans away from what the last contract gave, so it is not a copy.
	const perkCount = ctx.kind === "renewal" ? 2 : ctx.kind === "original" ? (good ? 3 : 2) : good ? 2 : 1;
	const before = new Set(ctx.previous?.perks.map((x) => x.kind));
	const pool = (Object.entries(p.perks) as [Perk["kind"], number][]).map(([kind, w]) => ({ kind, w: w * (before.has(kind) ? 0.12 : 1) }));
	const perks: Perk[] = [];
	for (let i = 0; i < perkCount && pool.length > 0; i++) {
		const total = pool.reduce((sum, x) => sum + x.w, 0);
		let roll = rnd() * total;
		let at = pool.findIndex((x) => (roll -= x.w) <= 0);
		if (at < 0) at = pool.length - 1;
		perks.push(perkOf(pool[at].kind, p, q));
		pool.splice(at, 1);
	}

	// Demands, in priority order. Renewals are tighter than the first contract.
	const st = p.style;
	const tighter = ctx.kind === "renewal";
	const demands: Demand[] = [];
	const lean = (kind: Demand["kind"]) => (ctx.previous?.demands.some((d) => d.kind === kind) ? 0.5 : 1); // a renewal tends to swap its strings
	if (st.quota && rnd() < st.quota.chance * (tighter ? lean("quota") : 1))
		demands.push({ kind: "quota", genres: st.quota.genres, count: between(st.quota.count[0], st.quota.count[1]) });
	if (st.wideCap && rnd() < st.wideCap.chance * (tighter ? lean("wideCap") : 1)) demands.push({ kind: "wideCap", max: Math.max(0, st.wideCap.max - (tighter ? 1 : 0)) });
	if (st.wideMin && rnd() < st.wideMin.chance * (tighter ? lean("wideMin") : 1)) demands.push({ kind: "wideMin", min: st.wideMin.min });
	if (st.reputation && rnd() < st.reputation.chance) demands.push({ kind: "reputation", min: st.reputation.min + (tighter ? 3 : 0) });
	if (st.exclusive && rnd() < st.exclusive * (tighter ? 1.3 : 1)) demands.push({ kind: "exclusive" });
	const maxDemands = tighter ? 3 : 2;
	let kept = demands.slice(0, maxDemands);
	if (kept.length === 0) {
		// every platform attaches at least one string
		if (st.quota) kept = [{ kind: "quota", genres: st.quota.genres, count: st.quota.count[0] }];
		else if (st.wideCap) kept = [{ kind: "wideCap", max: st.wideCap.max }];
		else if (st.wideMin) kept = [{ kind: "wideMin", min: st.wideMin.min }];
		else if (st.reputation) kept = [{ kind: "reputation", min: st.reputation.min }];
		else kept = [{ kind: "exclusive" }];
	}

	const premium = kept.reduce((m, d) => m * STREAM_DEMAND_PREMIUM[d.kind], 1);
	const annual = roundTo(ctx.annualBase * (ctx.fx?.annualMult ?? 1) * premium, 100);
	const bonus = ctx.kind === "renewal" ? 1 + 0.1 * Math.max(0, (ctx.renewals ?? 1) - 1) : 1;
	return { years, upfront: roundTo(ctx.upfrontBase * bonus, 100), annual, perks, demands: kept };
};

// ── what a film is worth to one platform (films already released) ─────────

export type DemandCheck = { label: string; ok: boolean };

/** The platform's demands for a RELEASED film, and whether this film meets them. */
export const demandChecks = (movie: Movie, p: Platform): DemandCheck[] => {
	const d = p.demands;
	const critic = movie.criticScore ?? 0;
	const audience = movie.audienceScore ?? critic;
	const gross = movie.boxOffice ?? 0;
	const out: DemandCheck[] = [];
	if (d.minCritic !== undefined) out.push({ label: `Critics ${d.minCritic}+ (this film: ${critic})`, ok: critic >= d.minCritic });
	if (d.minAudience !== undefined) out.push({ label: `Audience score ${d.minAudience}+ (this film: ${audience})`, ok: audience >= d.minAudience });
	if (d.minGross !== undefined) out.push({ label: `Box office ${fmtMoney(d.minGross)}+ (this film: ${fmtMoney(gross)})`, ok: gross >= d.minGross });
	if (d.maxGross !== undefined) out.push({ label: `Box office under ${fmtMoney(d.maxGross)} (this film: ${fmtMoney(gross)})`, ok: gross <= d.maxGross });
	if (d.minBudget !== undefined) out.push({ label: `Budget ${fmtMoney(d.minBudget)}+ (this film: ${fmtMoney(movie.budget)})`, ok: movie.budget >= d.minBudget });
	if (d.maxBudget !== undefined) out.push({ label: `Budget under ${fmtMoney(d.maxBudget)} (this film: ${fmtMoney(movie.budget)})`, ok: movie.budget <= d.maxBudget });
	if (d.avoidGenres?.length)
		out.push({ label: `No ${d.avoidGenres.map((g) => GENRE_LABEL[g]).join(" or ")} (this film: ${GENRE_LABEL[movie.genre]})`, ok: !d.avoidGenres.includes(movie.genre) });
	if (d.onlyGenres?.length)
		out.push({ label: `Only ${d.onlyGenres.map((g) => GENRE_LABEL[g]).join(", ")} (this film: ${GENRE_LABEL[movie.genre]})`, ok: d.onlyGenres.includes(movie.genre) });
	return out;
};

/** How the platform rates the film's reception (0-100): critics and audience weighted to its taste. */
const verdict = (movie: Movie, p: Platform): number => {
	const critic = movie.criticScore ?? 0;
	const audience = movie.audienceScore ?? critic; // films from older saves have no audience score
	return p.criticWeight * critic + (1 - p.criticWeight) * audience;
};

/** The film's own streaming worth before any platform's taste: a base, plus shares of its gross and budget, fading as it ages. */
export const filmWorth = (state: GameState, movie: Movie): number => {
	const age = Math.max(0, state.season - movie.season);
	const ageFactor = Math.max(STREAM_AGE_FLOOR, 1 - STREAM_AGE_DECAY * age);
	return (STREAM_BASE_FEE + STREAM_GROSS_SHARE * (movie.boxOffice ?? 0) + STREAM_BUDGET_SHARE * movie.budget) * ageFactor;
};

/** Multiplier from the platform's taste: reception, genre, and sequel/IP love. */
export const tasteFactor = (movie: Movie, p: Platform): number => {
	const reception = clamp(0.55 + (verdict(movie, p) - 50) / 60, 0.45, 1.6);
	const genre = p.genres[movie.genre] ?? 1;
	const brand = movie.prequelMid !== undefined || movie.ipId ? (p.franchiseLove ?? 1) : 1;
	return reception * genre * brand;
};

/** What the platform would pay in total for a released film (before it is split into an upfront sum and yearly payments). */
const worthTo = (state: GameState, movie: Movie, p: Platform): number =>
	filmWorth(state, movie) * p.scale * tasteFactor(movie, p) * (STREAM_MOOD.min + STREAM_MOOD.span * mood(`${movie.mid}|${p.id}|${state.season}|pay`));

/**
 * If the film is built on an IP (a licensed universe, or your own franchise sold on as an IP) whose rights
 * now belong to another studio, the film cannot be licensed to a platform any more. Null = no such problem.
 */
export const soldRightsBlocker = (state: GameState, movie: Movie): string | null => {
	const ipIds = [movie.ipId, state.customIps?.some((ip) => ip.custom?.fid === franchiseIdOf(movie)) ? customIpId(franchiseIdOf(movie)) : undefined];
	for (const ipId of ipIds) {
		if (!ipId) continue;
		const owner = licenseOf(state, ipId);
		if (owner && owner.tid !== movie.tid) {
			const name = ipById(state, ipId)?.name ?? "this IP";
			return `You sold the rights to ${name} to ${studioNameOf(state, owner.tid)}, so this film can no longer be sold to a platform.`;
		}
	}
	return null;
};

/** The platform that holds you exclusively right now, if any. */
export const exclusiveHolder = (state: GameState): StreamingDeal | undefined => activeDeals(state).find((d) => d.demands.some((x) => x.kind === "exclusive"));

/** Why this platform cannot do a new deal with you because of an exclusive contract elsewhere (null = free to). */
export const exclusiveBlocker = (state: GameState, platformId: string): string | null => {
	const holder = exclusiveHolder(state);
	if (!holder || holder.platformId === platformId) return null;
	const name = platformById(holder.platformId)?.name ?? "A platform";
	return `${name} holds you exclusively until ${lastPayOf(holder)}: no new deals or financing from other platforms.`;
};

const dealsThisSeason = (state: GameState, platformId: string): number =>
	(state.streamDeals ?? []).filter((d) => d.platformId === platformId && d.signed === state.season && d.kind !== "original").length;

/** Your released films with no running contract, newest first. They can only be sold through offers. */
export const freeFilms = (state: GameState): Movie[] =>
	state.movies
		.filter((m) => m.tid === state.userTid && isReleased(m) && !dealOf(state, m.mid))
		.sort((a, b) => b.season - a.season || b.mid - a.mid);

/** Why a platform would not make an offer for this released film at all (null = it might). */
export const platformRefusal = (state: GameState, movie: Movie, p: Platform): string | null => {
	if (movie.tid !== state.userTid) return "That is not your film.";
	if (!isReleased(movie)) return "The film is not released yet.";
	if (dealOf(state, movie.mid)) return "This film is under contract.";
	const sold = soldRightsBlocker(state, movie);
	if (sold) return sold;
	const lock = exclusiveBlocker(state, p.id);
	if (lock) return lock;
	const failed = demandChecks(movie, p).find((c) => !c.ok);
	if (failed) return `${p.name} wants: ${failed.label}.`;
	if (dealsThisSeason(state, p.id) >= STREAM_MAX_PER_SEASON) return `${p.name} has taken all it will from you this season.`;
	if (worthTo(state, movie, p) < STREAM_MIN_FEE) return `${p.name} is not interested: the film is worth too little to it.`;
	return null;
};

// ── backing a film from the greenlight ───────────────────────

export type PitchContext = {
	genre: FilmGenre;
	budget: number; // salaries + base + extra, thousands of $
	marketing: number;
	fit: number | null; // team fit for the genre (null = no team yet)
};

export type StreamPitch = {
	platform: Platform;
	checks: DemandCheck[];
	refusal: string | null; // null = the platform is interested
	fx: ReleaseFx;
	financing: number;
	marketingCover: number;
	terms: StreamTerms | null; // null when it is not interested
};

/** Does this platform have room for a new original this season? Fixed for the platform and season. */
export const hasSlate = (state: GameState, platformId: string): boolean => mood(`${platformId}|${state.season}|slate`) >= STREAM_SLATE_FULL_CHANCE;

/** What one platform would do for the film you are planning: whether it is interested, the financing, and the contract. */
export const streamPitch = (state: GameState, p: Platform, ctx: PitchContext, mode: ReleaseMode): StreamPitch => {
	const reputation = Math.round(userStudio(state).reputation);
	const d = p.demands;
	const checks: DemandCheck[] = [];
	checks.push({ label: `Studio reputation ${p.pitch.minRep}+ (yours: ${reputation})`, ok: reputation >= p.pitch.minRep });
	checks.push({
		label: state.hideRatings
			? ctx.fit === null
				? `A team that suits ${GENRE_LABEL[ctx.genre]} (hire your team to see)`
				: `A team that suits ${GENRE_LABEL[ctx.genre]}`
			: ctx.fit === null
				? `Team fit ${p.pitch.minFit}+ for ${GENRE_LABEL[ctx.genre]} (hire your team to see)`
				: `Team fit ${p.pitch.minFit}+ for ${GENRE_LABEL[ctx.genre]} (yours: ${Math.round(ctx.fit)})`,
		ok: ctx.fit !== null && ctx.fit >= p.pitch.minFit,
	});
	if (d.avoidGenres?.length) checks.push({ label: `No ${d.avoidGenres.map((g) => GENRE_LABEL[g]).join(" or ")} (this film: ${GENRE_LABEL[ctx.genre]})`, ok: !d.avoidGenres.includes(ctx.genre) });
	if (d.onlyGenres?.length) checks.push({ label: `Only ${d.onlyGenres.map((g) => GENRE_LABEL[g]).join(", ")}`, ok: d.onlyGenres.includes(ctx.genre) });
	if (d.minBudget !== undefined) checks.push({ label: `Budget ${fmtMoney(d.minBudget)}+ (this film: ${fmtMoney(ctx.budget)})`, ok: ctx.budget >= d.minBudget });
	if (d.maxBudget !== undefined) checks.push({ label: `Budget under ${fmtMoney(d.maxBudget)} (this film: ${fmtMoney(ctx.budget)})`, ok: ctx.budget <= d.maxBudget });
	checks.push({ label: "Room on its slate this season", ok: hasSlate(state, p.id) });
	const lock = exclusiveBlocker(state, p.id);
	if (lock) checks.push({ label: lock, ok: false });

	const failed = checks.find((c) => !c.ok);
	const refusal = failed ? (failed.label.startsWith("Room on") ? `${p.name} has no room on its slate this season.` : lock && failed.label === lock ? lock : `${p.name} wants: ${failed.label}.`) : null;
	const fx = releaseFx(p, mode);
	const empty = { platform: p, checks, refusal, fx, financing: 0, marketingCover: 0, terms: null };
	if (refusal || ctx.fit === null) return empty;

	const fitFactor = clamp(0.85 + (ctx.fit - p.pitch.minFit) / 100, 0.85, 1.2);
	const share = clamp(p.financeShare * STREAM_FINANCE_SCALE * fx.financeMult * fitFactor, 0, STREAM_FINANCE_MAX);
	const financing = roundTo(ctx.budget * share, 100);
	const coverable = Math.min(ctx.marketing, ctx.budget * DEFAULT_MARKETING_RATIO);
	const marketingCover = roundTo(coverable * fx.marketingCover, 100);
	const annualBase = (STREAM_ORIGINAL_ANNUAL_BASE + STREAM_ORIGINAL_ANNUAL_BUDGET * ctx.budget) * p.scale * clamp(0.8 + (ctx.fit - 60) / 100, 0.8, 1.2);
	const terms = genTerms(p, { kind: "original", seed: `${p.id}|${state.season}|original`, quality: ctx.fit, annualBase, upfrontBase: 0, fx });
	return { ...empty, financing, marketingCover, terms };
};

// ── releasing the film ───────────────────────────────────────

/**
 * Applies what the platform behind a film (and your other running contracts) does to its release. Mutates `m`; `state` is the state
 * before this film's own contract exists. Call after the box office and critic score are final. Returns how much of the film's
 * reputation GAIN is kept (1 = all).
 */
export const applyStreamingRelease = (state: GameState, m: Movie): number => {
	let box = m.boxOffice ?? 0;
	let repMult = 1;
	const p = m.streamPlatformId ? platformById(m.streamPlatformId) : undefined;
	const mode = p && m.release ? m.release : "wide";
	if (p && m.release) {
		const fx = releaseFx(p, m.release);
		box *= fx.boxMult;
		m.criticScore = Math.round(clamp((m.criticScore ?? 0) + fx.criticDelta));
		m.awardsDelta = fx.awardsDelta;
		repMult = fx.repMult;
	}
	if (mode !== "streaming") box *= slatePromoMult(state);
	box *= franchiseMult(state, m.prequelMid);
	m.boxOffice = Math.round(box);
	return repMult;
};

let festivalDraw: () => number = Math.random;
/** Lets tests fix the festival dice. */
export const setFestivalDice = (f: () => number): void => {
	festivalDraw = f;
};

/** The platform enters the film in festivals. Likelier for well-reviewed, small films. Pays prize money and reputation. Returns the prizes. */
const festivalPush = (studio: { cash: number; reputation: number }, movie: Movie, p: Platform, mult: number): string[] => {
	const prizes: string[] = [];
	if (!p.festivalPush) return prizes;
	const critic = movie.criticScore ?? 0;
	const small = 1 + 0.6 * clamp((30000 - movie.budget) / 30000, 0, 1);
	const chance = clamp(p.festivalPush * mult * clamp((critic - 55) / 35, 0, 1) * small, 0, 0.9);
	const pool = [...FESTIVALS].sort(() => festivalDraw() - 0.5).slice(0, STREAM_FESTIVALS_ENTERED);
	for (const f of pool) if (festivalDraw() < chance) prizes.push(`${f.name}: ${f.prize}`);
	studio.cash += prizes.length * STREAM_FESTIVAL_CASH;
	studio.reputation = clamp(studio.reputation + prizes.length * STREAM_FESTIVAL_REPUTATION);
	return prizes;
};

const newDealId = (state: GameState): number => {
	const id = state.nextStreamId ?? 1;
	state.nextStreamId = id + 1;
	return id;
};

const termsSummary = (t: StreamTerms, p: Platform): string =>
	`${t.years} years, ${fmtMoney(t.annual)} a year${t.upfront > 0 ? ` and ${fmtMoney(t.upfront)} up front` : ""}`.replace(/^/, `${p.name}: `);

/**
 * Release time: the film you backed from the greenlight now signs its contract with the platform. Mutates `next`.
 * The yearly payment follows how the audience took the film. Returns a line for the notice.
 */
export const signOriginalDeal = (next: GameState, movie: Movie): string => {
	const p = movie.streamPlatformId ? platformById(movie.streamPlatformId) : undefined;
	const terms = movie.streamTerms;
	if (!p || !terms) return "";
	const studio = userStudio(next);
	const critic = movie.criticScore ?? 0;
	const audience = movie.audienceScore ?? critic;
	const annual = roundTo(terms.annual * clamp(audience / 70, 0.6, 1.4), 100);
	const festivals = festivalPush(studio, movie, p, releaseFx(p, movie.release ?? "wide").festivalMult);
	const deal: StreamingDeal = { ...terms, annual, upfront: 0, id: newDealId(next), mid: movie.mid, platformId: p.id, kind: "original", signed: next.season, firstPay: next.season, festivals, paidTotal: 0, withheld: 0, renewals: 0, status: "active" };
	next.streamDeals = [...(next.streamDeals ?? []), deal];
	const bits = [`${RELEASE_LABEL[movie.release ?? "wide"].toLowerCase()} on ${p.name}`, termsSummary({ ...terms, annual }, p).replace(`${p.name}: `, "")];
	if (festivals.length) bits.push(`festival prizes: ${festivals.join("; ")}`);
	return `“${movie.title}”: ${bits.join(", ")}.`;
};

// ── following a contract: progress and breaches ──────────────

export type DemandStatus = { demand: Demand; text: string; state: "ok" | "pending" | "broken" };

/** Your films released in the contract window (after the season it was signed, up to its last season). */
const windowFilms = (state: GameState, d: StreamingDeal): Movie[] =>
	state.movies.filter((m) => m.tid === state.userTid && m.season > d.signed && m.season <= lastPayOf(d));

const isWide = (m: Movie): boolean => (m.release ?? "wide") === "wide";

/** How you are doing against each demand of a contract. */
export const demandStatus = (state: GameState, d: StreamingDeal): DemandStatus[] => {
	const films = windowFilms(state, d);
	const rep = Math.round(userStudio(state).reputation);
	return d.demands.map((demand): DemandStatus => {
		const text = describeDemand(demand);
		switch (demand.kind) {
			case "exclusive":
				return { demand, text, state: "ok" };
			case "quota": {
				const n = films.filter((m) => demand.genres.includes(m.genre)).length;
				return { demand, text: `${text} (${n}/${demand.count})`, state: n >= demand.count ? "ok" : "pending" };
			}
			case "wideCap": {
				const n = films.filter(isWide).length;
				return { demand, text: `${text} (${n} so far)`, state: n > demand.max ? "broken" : "ok" };
			}
			case "wideMin": {
				const n = films.filter(isWide).length;
				return { demand, text: `${text} (${n}/${demand.min})`, state: n >= demand.min ? "ok" : "pending" };
			}
			case "reputation":
				return { demand, text: `${text} (yours: ${rep})`, state: rep >= demand.min ? "ok" : "broken" };
		}
	});
};

/** Demands broken for good when the contract ends. */
const breachesAtEnd = (state: GameState, d: StreamingDeal): string[] =>
	demandStatus(state, d)
		.filter((s) => s.demand.kind !== "reputation" && s.demand.kind !== "exclusive" && s.state !== "ok")
		.map((s) => s.text);

/** Money still to come from running contracts. */
export const pendingPayments = (state: GameState): number =>
	activeDeals(state).reduce((sum, d) => {
		const from = Math.max(d.firstPay, state.phase >= Phase.OFFSEASON ? state.season + 1 : state.season);
		return sum + d.annual * Math.max(0, lastPayOf(d) - from + 1);
	}, 0);

// ── offers (the only way to sell a released film) ────────────

export type StreamResult = { ok: false; error: string } | { ok: true; state: GameState; message: string };

const makeOfferTerms = (state: GameState, movie: Movie, p: Platform, kind: "licence" | "renewal", previous?: StreamingDeal): StreamTerms => {
	const worth = worthTo(state, movie, p);
	const upfront = kind === "renewal" ? STREAM_RENEWAL_UPFRONT : STREAM_LICENCE_UPFRONT;
	const annual = (kind === "renewal" ? STREAM_RENEWAL_ANNUAL : STREAM_LICENCE_ANNUAL) * (0.75 + 0.5 * p.reach);
	return genTerms(p, {
		kind,
		seed: `${p.id}|${movie.mid}|${state.season}|${kind}`,
		quality: verdict(movie, p),
		annualBase: worth * annual,
		upfrontBase: worth * upfront,
		previous,
		renewals: kind === "renewal" ? (previous?.kind ? ((previous as StreamingDeal).renewals ?? 0) + 1 : 1) : undefined,
	});
};

/** Signs a deal from an offer. Mutates `next`. Returns a line about it. */
const signFromOffer = (next: GameState, movie: Movie, p: Platform, offer: StreamingOffer): string => {
	const studio = userStudio(next);
	studio.cash += offer.upfront;
	const festivals = offer.kind === "licence" ? festivalPush(studio, movie, p, 1) : [];
	const deal: StreamingDeal = {
		years: offer.years,
		upfront: offer.upfront,
		annual: offer.annual,
		perks: offer.perks,
		demands: offer.demands,
		id: newDealId(next),
		mid: movie.mid,
		platformId: p.id,
		kind: offer.kind,
		signed: next.season,
		firstPay: next.season + 1,
		festivals,
		paidTotal: offer.upfront,
		withheld: 0,
		renewals: offer.renewals,
		status: "active",
	};
	next.streamDeals = [...(next.streamDeals ?? []), deal];
	// The film is taken: other offers for it are gone. An exclusive contract also closes the door on every other platform.
	const exclusive = offer.demands.some((d) => d.kind === "exclusive");
	next.streamOffers = (next.streamOffers ?? []).filter((o) => o.mid !== movie.mid && !(exclusive && o.platformId !== p.id));
	const bits = [termsSummary(offer, p).replace(`${p.name}: `, "")];
	if (festivals.length) bits.push(`festival prizes: ${festivals.join("; ")}`);
	return bits.join(", ");
};

export const acceptStreamOffer = (state: GameState, offerId: number): StreamResult => {
	const ruled = streamingBlocker(state);
	if (ruled) return { ok: false, error: ruled };
	const offer = state.streamOffers?.find((o) => o.id === offerId);
	if (!offer) return { ok: false, error: "That offer is no longer on the table." };
	const p = platformById(offer.platformId);
	const movie = state.movies.find((m) => m.mid === offer.mid);
	if (!p || !movie) return { ok: false, error: "That offer is no longer valid." };
	if (dealOf(state, movie.mid)) return { ok: false, error: "This film is already under contract." };
	const sold = soldRightsBlocker(state, movie);
	if (sold) return { ok: false, error: sold };
	const lock = exclusiveBlocker(state, p.id);
	if (lock) return { ok: false, error: lock };
	const next = structuredClone(state);
	const summary = signFromOffer(next, movie, p, offer);
	const verb = offer.kind === "renewal" ? "renewed" : "signed";
	const prev = offer.kind === "renewal" ? next.streamDeals?.find((d) => d.mid === movie.mid && d.status === "ended" && d.platformId === p.id && d.endNote?.startsWith("Renewal offered")) : undefined;
	if (prev) prev.endNote = `Renewed for ${offer.years} more years.`;
	return { ok: true, state: next, message: `You ${verb} “${movie.title}” with ${p.name}: ${summary}.` };
};

export const declineStreamOffer = (state: GameState, offerId: number): GameState => {
	const offer = state.streamOffers?.find((o) => o.id === offerId);
	const next = structuredClone(state);
	next.streamOffers = (next.streamOffers ?? []).filter((o) => o.id !== offerId);
	if (offer?.kind === "renewal") {
		const prev = next.streamDeals?.find((d) => d.mid === offer.mid && d.status === "ended" && d.endNote?.startsWith("Renewal offered"));
		if (prev) prev.endNote = "You turned down the renewal. The rights are yours again.";
	}
	return next;
};

// ── the off-season: payments, perks, endings, renewals, new offers ──

/**
 * Off-season: every running contract pays its yearly sum (unless you broke the reputation demand) and its prestige perk; contracts in their
 * last year end, with a renewal offer or the rights coming back; then platforms may make new offers for your films that are free.
 * Mutates `state` (a copy). Returns lines for the notice.
 */
export const streamingOffseason = (state: GameState): string[] => {
	const notes: string[] = [];
	const studio = userStudio(state);
	state.streamOffers = [];
	if (streamingBlocker(state)) return notes; // No Streaming challenge: no contracts can exist, and no offers are made
	let offerId = 1;
	const justEnded = new Set<number>();
	let paid = 0;

	for (const d of state.streamDeals ?? []) {
		if (d.status !== "active" || d.firstPay > state.season) continue;
		const p = platformById(d.platformId);
		const movie = state.movies.find((m) => m.mid === d.mid);
		if (!p || !movie) continue;

		// the yearly payment
		const floor = d.demands.find((x) => x.kind === "reputation");
		if (floor && floor.kind === "reputation" && studio.reputation < floor.min) {
			d.withheld += 1;
			notes.push(`${p.name} withheld the yearly payment for “${movie.title}”: your reputation (${Math.round(studio.reputation)}) is below the ${floor.min} it demands.`);
		} else {
			studio.cash += d.annual;
			d.paidTotal += d.annual;
			paid += d.annual;
			const points = prestigePoints(d);
			if (points > 0) studio.reputation = clamp(studio.reputation + points);
		}

		// the contract runs out
		if (state.season < lastPayOf(d)) continue;
		justEnded.add(d.mid);
		d.status = "ended";
		d.endedSeason = state.season;
		const breaches = breachesAtEnd(state, d);
		if (breaches.length > 0) {
			const fine = d.annual * breaches.length;
			studio.cash -= fine;
			studio.reputation = clamp(studio.reputation - STREAM_BREACH_REPUTATION * breaches.length);
			d.endNote = `Ended with ${plural(breaches.length, "broken demand")}: ${breaches.join("; ")}. You paid ${fmtMoney(fine)} and ${p.name} will not renew.`;
			notes.push(`${p.name}'s contract on “${movie.title}” ended with ${plural(breaches.length, "broken demand")}: you paid a ${fmtMoney(fine)} penalty (reputation −${(STREAM_BREACH_REPUTATION * breaches.length).toFixed(1)}) and it will not renew.`);
			continue;
		}
		const blocker = soldRightsBlocker(state, movie);
		const happiness = 0.55 + 0.35 * clamp((verdict(movie, p) - 55) / 35, -1, 1) + Math.min(0.15, 0.05 * d.renewals) - 0.1 * d.withheld;
		const roll = mood(`${d.id}|${state.season}|renew`);
		if (!blocker && roll < clamp(happiness, 0.15, 0.92)) {
			const terms = makeOfferTerms(state, movie, p, "renewal", d);
			state.streamOffers.push({ ...terms, id: offerId++, mid: movie.mid, platformId: p.id, kind: "renewal", renewals: d.renewals + 1 });
			d.endNote = "Renewal offered";
			notes.push(`${p.name}'s contract on “${movie.title}” is up, and it offers to renew on new terms.`);
		} else {
			d.endNote = blocker ?? `${p.name} let the contract run out. The rights are yours again.`;
			notes.push(`${p.name}'s contract on “${movie.title}” ran out and it did not renew. The rights are yours again.`);
		}
	}
	if (paid > 0) notes.unshift(`Streaming contracts paid ${fmtMoney(paid)}.`);

	// New offers for films that are free (and were not just let go by their platform).
	const films = freeFilms(state).filter((m) => !justEnded.has(m.mid));
	const perPlatform = new Map<string, number>();
	const perFilm = new Map<number, number>();
	let made = 0;
	const platforms = [...PLATFORMS].sort(() => Math.random() - 0.5);
	for (const p of platforms) {
		for (const m of [...films].sort(() => Math.random() - 0.5)) {
			if (made >= STREAM_MAX_OFFERS) break;
			if ((perFilm.get(m.mid) ?? 0) >= STREAM_MAX_OFFERS_PER_FILM) continue;
			if (Math.random() > STREAM_OFFER_CHANCE) continue;
			if ((perPlatform.get(p.id) ?? 0) + dealsThisSeason(state, p.id) >= STREAM_MAX_PER_SEASON) break;
			if (platformRefusal(state, m, p)) continue;
			const terms = makeOfferTerms(state, m, p, "licence");
			state.streamOffers.push({ ...terms, id: offerId++, mid: m.mid, platformId: p.id, kind: "licence", renewals: 0 });
			perFilm.set(m.mid, (perFilm.get(m.mid) ?? 0) + 1);
			perPlatform.set(p.id, (perPlatform.get(p.id) ?? 0) + 1);
			made++;
		}
	}
	const licence = state.streamOffers.filter((o) => o.kind === "licence").length;
	if (licence > 0) notes.push(`${licence === 1 ? "A streaming platform has" : "Streaming platforms have"} made an offer for your films. See the Streaming page.`);
	return notes;
};
