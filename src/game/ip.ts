import {
	EXTRA_BUDGET_MAX_BONUS,
	EXTRA_BUDGET_SCALE,
	AI_IP_BUY_CHANCE,
	AI_IP_CASH_RATIO,
	AI_IP_FIRST_SEASON,
	IP_ACCLAIM_MAX,
	IP_ACCLAIM_PER_POINT,
	IP_BACKLASH_MAX,
	IP_BACKLASH_PER_POINT,
	IP_BOOST_SCALE,
	IP_GOODWILL_SPAN,
	IP_HEAT_EXPECTATION,
	IP_REP_MAX_LOSS,
	IP_REP_MET,
	IP_START_GOODWILL,
	TEAMUP_UNLOCK,
} from "./constants";
import { ipBlocker } from "./challenges";
import { fmtMoney } from "./format";
import { genSequelTitle } from "./generate";
import { IPS, IP_BY_ID, PROPERTY_BY_ID } from "./ipData";
import type { Ip, IpProperty } from "./ipData";
import { franchiseFilms, franchiseWeights, sequelFatigue } from "./franchise";
import { finalQuality, movieCost, teamRating } from "./movie";
import { average, choice, clamp } from "./random";
import { Phase } from "./types";
import type { GameState, License, Movie, Person, ScriptInfo, Studio } from "./types";
import { scriptFx } from "./scripts";

// ═════════════════════════════════════════════════════════════
// Licensed IPs. A studio buys the rights to a universe (Marvel, Star Wars...) once, then pays a fee
// per film to make movies about its heroes. A licensed film gets
//   + a box-office BOOST (bigger for famous heroes, scaled by the fans' goodwill)
//   + a bigger opening weekend
// but the fans arrive with EXPECTATIONS:
//   - a critic score they expect (miss it -> backlash on the gross)
//   - a box office they expect (miss it -> a "disappointment")
// Meeting both builds reputation and goodwill, missing them costs reputation and goodwill.
// Rights are exclusive: only one studio holds each IP.
// ═════════════════════════════════════════════════════════════

export { IPS, IP_BY_ID, PROPERTY_BY_ID };

const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

// ── lookups ──────────────────────────────────────────────────

/** Id of the IP born from a franchise (see trade.ts). The single property inside it is `${id}:main`. */
export const customIpId = (fid: number): string => `custom-${fid}`;

/**
 * An IP by id. Catalogue IPs are static; custom IPs (a studio's own franchise, sold on) live in the save.
 * `pending` lets trade.ts hand in a franchise that is for sale but has not been bought yet.
 */
export const ipById = (state: GameState, id: string): Ip | undefined => IP_BY_ID[id] ?? state.customIps?.find((ip) => ip.id === id);

export const propertyById = (state: GameState, id: string): { ip: Ip; prop: IpProperty } | undefined => {
	const fixed = PROPERTY_BY_ID[id];
	if (fixed) return fixed;
	for (const ip of state.customIps ?? []) {
		const prop = ip.properties.find((p) => p.id === id);
		if (prop) return { ip, prop };
	}
	return undefined;
};

/** Every IP in the store: the catalogue plus the custom ones. */
export const allIps = (state: GameState): Ip[] => [...IPS, ...(state.customIps ?? [])];

/** Franchise ids that have become IPs. Their films are continued through the licence only, never as a plain sequel. */
export const customFranchiseIds = (state: GameState): Set<number> => new Set((state.customIps ?? []).map((ip) => ip.custom!.fid));

export const licenseOf = (state: GameState, ipId: string): License | undefined =>
	state.licenses?.find((l) => l.ipId === ipId);

export const licensesOf = (state: GameState, tid: number): License[] =>
	(state.licenses ?? []).filter((l) => l.tid === tid);

export const studioNameOf = (state: GameState, tid: number): string =>
	state.studios.find((s) => s.tid === tid)?.name ?? "?";

/** Released films a studio made from one property, oldest first. */
export const propertyFilms = (state: GameState, tid: number, propertyId: string): Movie[] => {
	// A custom IP is one franchise: the next film continues the last one, whoever made it.
	const custom = state.customIps?.find((ip) => ip.properties.some((p) => p.id === propertyId));
	if (custom) return franchiseFilms(state, custom.custom!.fid).filter((m) => m.boxOffice !== undefined);
	return state.movies
		.filter((m) => m.tid === tid && m.propertyId === propertyId && m.boxOffice !== undefined)
		.sort((a, b) => a.season - b.season || a.mid - b.mid);
};

/** Released films a studio made anywhere in one universe. */
export const universeFilms = (state: GameState, tid: number, ipId: string): Movie[] =>
	state.movies.filter((m) => m.tid === tid && m.ipId === ipId && m.boxOffice !== undefined);

/** Why a crossover event is still locked (null = open, or not a crossover). */
export const lockReason = (state: GameState, tid: number, ip: Ip, prop: IpProperty): string | null => {
	if (!prop.teamUp) return null;
	// Only films about OTHER heroes count: the crossover pays off the universe you built.
	const others = universeFilms(state, tid, ip.id).filter((m) => m.propertyId !== prop.id);
	const distinct = new Set(others.map((m) => m.propertyId)).size;
	return distinct >= TEAMUP_UNLOCK ? null : `Unlocks after ${TEAMUP_UNLOCK} different ${ip.name} heroes have had a film (you have ${distinct}).`;
};

// ── the numbers for one property ─────────────────────────────

export const goodwillFactor = (goodwill: number): number => 1 + ((goodwill - IP_START_GOODWILL) / IP_START_GOODWILL) * IP_GOODWILL_SPAN;

export type PropertyStats = {
	boost: number; // box-office multiplier (1.4 = +40%)
	fee: number; // $k per film
	expectCritic: number;
	expectGross: number; // $k
	severity: number;
};

export const propertyStats = (ip: Ip, prop: IpProperty, goodwill = IP_START_GOODWILL): PropertyStats => ({
	boost: 1 + (ip.boost - 1) * IP_BOOST_SCALE * prop.heat * goodwillFactor(goodwill),
	fee: Math.max(500, roundTo(ip.filmFee * prop.heat, 500)),
	expectCritic: Math.min(96, Math.round(ip.expectCritic + (prop.heat - 1) * IP_HEAT_EXPECTATION)),
	expectGross: roundTo(ip.expectGross * prop.heat, 1000),
	severity: ip.severity,
});

/** How demanding fans are, in words. */
export const severityLabel = (severity: number): string =>
	severity >= 1.4 ? "Ruthless" : severity >= 1.15 ? "Demanding" : severity >= 0.9 ? "Fair" : "Forgiving";

/** Points the awards voters knock off a licensed film's score (0 for originals and homegrown franchises). */
export const awardsPenaltyOf = (state: GameState, m: Movie): number => (m.ipId ? (ipById(state, m.ipId)?.awardsPenalty ?? 0) : 0);

/** How the awards voters feel about a universe, for display. */
export const awardsLabel = (penalty: number): string | null =>
	penalty >= 11 ? "Voters snub it" : penalty >= 7 ? "Voters wary" : penalty >= 3 ? "Voters lukewarm" : null;

export const tierLabel = (ip: Ip): string => (ip.price >= 200000 ? "Mega" : ip.price >= 120000 ? "Major" : ip.price >= 90000 ? "Established" : "Entry");

// ── titles ───────────────────────────────────────────────────

/** Title of part `part` of a property: its own real titles first, then numbered. */
export const propertyTitle = (prop: IpProperty, part: number, taken: Iterable<string> = []): string => {
	if (part <= 1) return prop.name;
	const real = prop.sequels?.[part - 2];
	const used = new Set([...taken].map((t) => t.toLowerCase()));
	if (real && !used.has(real.toLowerCase())) return real;
	return genSequelTitle(prop.name, part, taken);
};

// ── buying ───────────────────────────────────────────────────

export type BuyResult = { ok: true; state: GameState } | { ok: false; error: string };

/** Cash a studio has already promised to a film it has greenlit but not yet paid for (Development phase only). */
export const reservedCash = (state: GameState, tid: number): number => {
	if (state.phase !== Phase.DEVELOPMENT) return 0;
	const m = state.movies.find((x) => x.season === state.season && x.tid === tid);
	return m ? movieCost(m) : 0;
};

/** Why a studio cannot buy this IP right now (null = it can). */
export const buyBlocker = (state: GameState, ipId: string, tid: number): string | null => {
	if (tid === state.userTid) {
		const ruled = ipBlocker(state); // a challenge rule (see challenges.ts)
		if (ruled) return ruled;
	}
	const ip = ipById(state, ipId);
	if (!ip) return "Unknown IP.";
	const owner = licenseOf(state, ipId);
	if (owner) return owner.tid === tid ? "You already own these rights." : `${studioNameOf(state, owner.tid)} owns these rights.`;
	const studio = state.studios.find((s) => s.tid === tid);
	if (!studio) return "Unknown studio.";
	const reserved = reservedCash(state, tid);
	if (ip.price > studio.cash - reserved) {
		return reserved > 0
			? `Not enough cash: ${fmtMoney(ip.price)} needed, and ${fmtMoney(reserved)} of your ${fmtMoney(studio.cash)} is set aside for the film you greenlit.`
			: `Not enough cash: ${fmtMoney(ip.price)} needed, you have ${fmtMoney(studio.cash)}.`;
	}
	return null;
};

export const buyLicense = (state: GameState, ipId: string, tid: number): BuyResult => {
	const blocker = buyBlocker(state, ipId, tid);
	if (blocker) return { ok: false, error: blocker };
	const next = structuredClone(state);
	const studio = next.studios.find((s) => s.tid === tid)!;
	studio.cash -= ipById(state, ipId)!.price;
	next.licenses = [...(next.licenses ?? []), { ipId, tid, since: next.season, goodwill: IP_START_GOODWILL }];
	return { ok: true, state: next };
};

/** Off-season: at most one rival buys rights, if it can comfortably afford them. Mutates `state`. */
export const aiBuyLicenses = (state: GameState): void => {
	if (state.season < AI_IP_FIRST_SEASON || Math.random() > AI_IP_BUY_CHANCE) return;
	const rivals = state.studios.filter((s) => s.tid !== state.userTid);
	const buyer = choice(rivals);
	if (!buyer || licensesOf(state, buyer.tid).length >= 2) return;
	const affordable = IPS.filter((ip) => !licenseOf(state, ip.id) && ip.price <= buyer.cash * AI_IP_CASH_RATIO);
	if (affordable.length === 0) return;
	const ip = affordable.sort((a, b) => b.price - a.price)[0];
	buyer.cash -= ip.price;
	state.licenses = [...(state.licenses ?? []), { ipId: ip.id, tid: buyer.tid, since: state.season, goodwill: IP_START_GOODWILL }];
};

// ── release: boost, expectations, fan reaction ───────────────

/** Box-office multiplier this film's IP gives it right now (1 for an original). */
export const releaseBoost = (state: GameState, m: Movie): number => {
	if (!m.ipId || !m.propertyId) return 1;
	const found = propertyById(state, m.propertyId);
	const lic = licenseOf(state, m.ipId);
	return found && lic ? propertyStats(found.ip, found.prop, lic.goodwill).boost : 1;
};

/**
 * After the final box office and critic score are known: compare them with what the fans expected.
 * Misses cost box office (backlash) and reputation; hits add a little of each. Updates the IP's goodwill.
 * Mutates `m` (boxOffice, ipResult) and the license. Returns the reputation change for the studio.
 */
export const settleIp = (state: GameState, m: Movie, boost: number, grossBeforeBoost: number): number => {
	if (!m.ipId || !m.propertyId || m.boxOffice === undefined || m.criticScore === undefined) return 0;
	const found = propertyById(state, m.propertyId);
	const lic = licenseOf(state, m.ipId);
	if (!found || !lic) return 0;
	const stats = propertyStats(found.ip, found.prop, lic.goodwill);
	const critic = m.criticScore;
	const critShort = Math.max(0, stats.expectCritic - critic);

	const reaction =
		critShort > 0
			? 1 - Math.min(IP_BACKLASH_MAX, critShort * IP_BACKLASH_PER_POINT * stats.severity)
			: 1 + Math.min(IP_ACCLAIM_MAX, (critic - stats.expectCritic) * IP_ACCLAIM_PER_POINT);
	m.boxOffice = Math.round(m.boxOffice * reaction);

	const grossShort = Math.max(0, 1 - m.boxOffice / stats.expectGross);
	const metCritic = critShort === 0;
	const metGross = grossShort === 0;
	const reputation =
		metCritic && metGross
			? IP_REP_MET + Math.min(2, (critic - stats.expectCritic) * 0.15)
			: -Math.min(IP_REP_MAX_LOSS, (critShort * 0.25 + grossShort * 8) * stats.severity);
	const goodwillDelta =
		clamp((critic - stats.expectCritic) * 0.9, -10, 10) + clamp((m.boxOffice / stats.expectGross - 1) * 12, -10, 10);
	lic.goodwill = clamp(lic.goodwill + goodwillDelta);

	m.ipResult = {
		boost,
		lift: Math.round(grossBeforeBoost * (boost - 1)),
		expectCritic: stats.expectCritic,
		expectGross: stats.expectGross,
		reaction,
		reputation,
		goodwillDelta,
		metCritic,
		metGross,
	};
	return reputation;
};

/** Films a rival could make about its licensed properties this season (one per universe). */
export const aiLicensedOptions = (state: GameState, studio: Studio): { ip: Ip; prop: IpProperty; prev: Movie | null }[] => {
	const out: { ip: Ip; prop: IpProperty; prev: Movie | null }[] = [];
	for (const lic of licensesOf(state, studio.tid)) {
		const ip = ipById(state, lic.ipId);
		if (!ip) continue;
		if (state.movies.some((m) => m.season === state.season && m.ipId === ip.id)) continue; // one film per universe per year
		for (const prop of ip.properties) {
			if (lockReason(state, studio.tid, ip, prop)) continue;
			const films = propertyFilms(state, studio.tid, prop.id);
			const prev = films.length ? films[films.length - 1] : null;
			if (prev && prev.season >= state.season) continue;
			out.push({ ip, prop, prev });
		}
	}
	return out;
};

// ── preview for the greenlight panel ─────────────────────────

/**
 * A no-luck estimate of the critic score for a planned film, so you can compare it with what the fans expect.
 * Follows the same steps as the real sims (production, post, critics, sequel blend) with the dice set to zero.
 * `extra` = extra production budget ($k), `chemistry` = production-quality points from returning duos.
 */
export const projectedCritic = (
	genre: Movie["genre"],
	director: Person,
	cast: Person[],
	extra: number,
	chemistry: number,
	prequel?: Movie,
	continuity = 0,
	script?: ScriptInfo, // the script you picked (none = a neutral one)
): number => {
	const stub = { genre, script } as Movie;
	const fx = scriptFx(stub);
	const production = clamp(teamRating(stub, director, cast) + EXTRA_BUDGET_MAX_BONUS * (1 - Math.exp(-extra / EXTRA_BUDGET_SCALE)) + chemistry + fx.prod);
	const a = director.attrs;
	const post = clamp(0.5 * a.technique + 0.3 * a.vision + 0.2 * a.originality + fx.post);
	const quality = finalQuality({ productionQuality: production, postQuality: post } as Movie);
	const all = [director, ...cast];
	const mean = (key: "vision" | "originality" | "emotionalRange") => average(all.map((p) => p.attrs[key]));
	const own = 0.6 * quality + 0.4 * average([mean("vision"), mean("originality"), mean("emotionalRange")]) + fx.critic;
	if (!prequel || prequel.criticScore === undefined) return Math.round(clamp(own));
	const w = franchiseWeights(continuity).critic;
	return Math.round(clamp((1 - w) * own + w * prequel.criticScore - sequelFatigue((prequel.installment ?? 1) + 1)));
};
