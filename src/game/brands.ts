import { brandById, BRANDS, brandsOf, CATEGORY_LABEL } from "./brandData";
import type { Brand, BrandCategory, BrandKind } from "./brandData";
import { brandDealsOn, brandOpts, FEE_LEVEL } from "./features";
import { franchiseIdOf, installmentOf } from "./franchise";
import { fmtMoney } from "./format";
import { GENRE_LABEL } from "./format";
import type { Draft } from "./news/util";
import { mTok } from "./news/util";
import { clamp, gauss } from "./random";
import type { BrandDeal, BrandOffer, BrandOfferKind, BrandPick, BrandPlacement, BrandTier, FilmGenre, GameState, Movie } from "./types";

// ═════════════════════════════════════════════════════════════
// Brand Deals: sponsors, product placement, merchandise, video games, TV spin-offs and studio partners.
// Switched on and off by features.ts (the Studio GM Toolkit "Brand Deals" mod flips the same switch).
//
//   AT THE GREENLIGHT   up to 3 product placements + 1 presenting sponsor pay part of the cost (planBrands).
//   AT THE RELEASE      the brands cost critic points and lift the gross; a sequel gets the franchise's heat (applyBrandRelease).
//   AFTER THE RELEASE   hit bonus or make-good, brand relationships move (settleBrands).
//   EVERY OFF-SEASON    merchandise, games, TV and studio partners pay or resolve, and new offers arrive (brandOffseason).
//
// Money is in thousands of $. Everything is optional on the save, so older saves load unchanged.
// ═════════════════════════════════════════════════════════════

// ── tuning ───────────────────────────────────────────────────

export const MAX_PLACEMENTS = 3;
export const MAX_SPONSORS = 1;
export const SPONSOR_MIN_BUDGET = 30000;
export const MAX_FUNDING_SHARE = 0.15; // brands never pay more than this share of budget + marketing
export const MAX_STUDIO_DEALS = 3;
export const MAX_OFFERS = 5;
export const CRITIC_CAP = 10; // the most critic points brands can cost one film
export const PROMO_CAP = 0.1; // the most gross they can add
export const HEAT_GROSS = 0.1; // a sequel's gross gets up to +14% from a franchise at heat 100
export const HEAT_DECAY = 0.9; // heat kept every off-season
export const HIT_RATIO = 2.0; // gross / (budget + marketing) at which brands pay a bonus
export const FLOP_RATIO = 0.6; // below this they ask for a make-good
export const HIT_BONUS = 0.3; // share of the fees paid as a bonus
export const MAKE_GOOD = 0.25; // share of the fees owed back

const TIERS: Record<BrandTier, { cash: number; critic: number; promo: number }> = {
	placement: { cash: 0.009, critic: 2, promo: 0.004 },
	sponsor: { cash: 0.028, critic: 4.5, promo: 0.009 },
};

/** How much a film of this genre suffers from products in the frame (1 = average). Action shrugs it off, drama does not. */
export const GENRE_SENS: Record<FilmGenre, number> = {
	action: 0.6,
	adventure: 0.6,
	comedy: 0.7,
	sciFiFantasy: 0.7,
	thriller: 1.1,
	romance: 1.1,
	horror: 1.2,
	crime: 1.2,
	drama: 1.4,
};

// ── small helpers ────────────────────────────────────────────

const round10 = (n: number): number => Math.round(n / 10) * 10;
const user = (state: GameState) => state.studios.find((s) => s.tid === state.userTid)!;

/** A number in [0, 1) that is the same for the same text, so a brand's mood does not change when you re-open the page. */
const hash = (text: string): number => {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) / 4294967296;
};
const mood = (brandId: string, season: number): number => 0.92 + 0.16 * hash(`${brandId}|${season}`);

export const relOf = (state: GameState, brandId: string): number => state.brandRel?.[brandId] ?? 50;
export const heatOf = (state: GameState, fid: number): number => state.brandHeat?.[fid] ?? 0;
const addRel = (state: GameState, brandId: string, delta: number): void => {
	state.brandRel = { ...(state.brandRel ?? {}), [brandId]: clamp(relOf(state, brandId) + delta) };
};
const addHeat = (state: GameState, fid: number, delta: number): void => {
	const heat = clamp(heatOf(state, fid) + delta);
	state.brandHeat = { ...(state.brandHeat ?? {}) };
	if (heat <= 0) delete state.brandHeat[fid];
	else state.brandHeat[fid] = Math.round(heat * 10) / 10;
};

/** The reputation a brand wants from a studio before it signs anything. */
export const minRep = (brand: Brand): number => 5 + brand.prestige * 8;

const inGame = (brand: Brand): boolean => brand.category !== "alcohol" || brandOpts().alcohol;
/** Brands that can appear in this game (beer and spirits can be switched off in the toolkit). */
export const visibleBrands = (kind: BrandKind): Brand[] => brandsOf(kind).filter(inGame);

const fees = (): number => FEE_LEVEL[brandOpts().fees];

// ── studio partners ──────────────────────────────────────────

export const activeDeals = (state: GameState, kind?: BrandOfferKind): BrandDeal[] => (state.brandDeals ?? []).filter((d) => d.status === "active" && (!kind || d.kind === kind));

/** Your studio partners: category -> brand id. A partner locks its category: no rival brand of that category on your films. */
export const studioPartners = (state: GameState): Map<BrandCategory, string> => {
	const map = new Map<BrandCategory, string>();
	for (const d of activeDeals(state, "studio")) {
		const brand = brandById(d.brandId);
		if (brand) map.set(brand.category, brand.id);
	}
	return map;
};

// ── quotes at the greenlight ─────────────────────────────────

export type QuoteCtx = { genre: FilmGenre; budget: number; marketing: number; prequelMid?: number | null };

export type Quote = {
	brand: Brand;
	tier: BrandTier;
	ok: boolean;
	refusal?: string;
	cash: number; // what it pays towards the budget (placement fee, or the sponsor's share)
	cover: number; // sponsors also pay part of the marketing
	critic: number; // critic points it costs (positive number = points lost), before the cap
	gross: number; // gross it adds (0.04 = +4%)
	love: boolean; // the product belongs in this genre
	returning: boolean; // it was in the film you are making a sequel to
	partner: boolean; // your studio partner (pays a little more)
};

const prequelOf = (state: GameState, ctx: QuoteCtx): Movie | undefined =>
	ctx.prequelMid === null || ctx.prequelMid === undefined ? undefined : state.movies.find((m) => m.mid === ctx.prequelMid);

export const quote = (state: GameState, brand: Brand, tier: BrandTier, ctx: QuoteCtx): Quote => {
	const rep = user(state).reputation;
	const rel = relOf(state, brand.id);
	const prequel = prequelOf(state, ctx);
	const love = brand.loves.includes(ctx.genre);
	const returning = !!prequel?.brands?.some((b) => b.brandId === brand.id);
	const partner = studioPartners(state).get(brand.category) === brand.id;
	const heat = prequel ? heatOf(state, franchiseIdOf(prequel)) : 0;

	let refusal: string | undefined;
	if (!brand.kinds.includes(tier)) refusal = `${brand.name} does not do ${tier === "sponsor" ? "presenting sponsorships" : "product placement"}.`;
	else if (!inGame(brand)) refusal = "Not in this game (switched off in the Brand Deals options).";
	else if (brand.avoids.includes(ctx.genre)) refusal = `Will not appear in a ${GENRE_LABEL[ctx.genre].toLowerCase()} film.`;
	else if (tier === "sponsor" && ctx.budget < SPONSOR_MIN_BUDGET) refusal = `Only presents films with a budget of ${fmtMoney(SPONSOR_MIN_BUDGET)} or more.`;
	else if (rep < minRep(brand)) refusal = `Wants a studio with reputation ${minRep(brand)}+ (yours is ${Math.round(rep)}).`;
	else if (rel < 15) refusal = "Still sore about your last film together.";

	const t = TIERS[tier];
	const pm = 0.7 + 0.2 * brand.prestige;
	const k =
		(0.8 + 0.4 * (clamp(rep) / 100)) * // a famous studio gets more
		(0.85 + 0.3 * (rel / 100)) * // a good relationship gets more
		(love ? 1.25 : 1) *
		(returning ? 1.12 : 1) *
		(partner ? 1.15 : 1) *
		(1 + (0.12 * heat) / 100) * // a hot franchise sells itself
		mood(brand.id, state.season) *
		fees();
	const cash = round10(ctx.budget * t.cash * pm * k);
	const cover = tier === "sponsor" ? round10(ctx.marketing * clamp(0.02 + 0.02 * brand.prestige, 0, 0.14) * k) : 0;
	return {
		brand,
		tier,
		ok: !refusal,
		refusal,
		cash,
		cover,
		critic: Math.round(t.critic * GENRE_SENS[ctx.genre] * (love ? 0.5 : 1) * 10) / 10,
		gross: brand.promo * t.promo * (love ? 1.2 : 1),
		love,
		returning,
		partner,
	};
};

/** Why this brand cannot be added next to the picks you already have (null = it can). */
export const pickBlocker = (state: GameState, picks: BrandPick[], brand: Brand, tier: BrandTier): string | null => {
	const others = picks.filter((p) => p.brandId !== brand.id);
	if (tier === "placement" && others.filter((p) => p.tier === "placement").length >= MAX_PLACEMENTS) return `A film has room for ${MAX_PLACEMENTS} product placements.`;
	if (tier === "sponsor" && others.some((p) => p.tier === "sponsor")) return "A film can only be presented by one sponsor.";
	const rival = others.find((p) => brandById(p.brandId)?.category === brand.category);
	if (rival) return `${brandById(rival.brandId)?.name} already has the ${CATEGORY_LABEL[brand.category].toLowerCase()} slot.`;
	const partner = studioPartners(state).get(brand.category);
	if (partner && partner !== brand.id) return `${brandById(partner)?.name} is your studio partner: no rival ${CATEGORY_LABEL[brand.category].toLowerCase()} brands.`;
	return null;
};

export type BrandPlan = { ok: true; picks: BrandPlacement[]; funding: number; critic: number; gross: number; scaled: boolean } | { ok: false; error: string };

/** Check the picks, price them, and cap what they pay (they never fund more than MAX_FUNDING_SHARE of the cost). Used by the form and by the greenlight. */
export const planBrands = (state: GameState, picks: BrandPick[] | undefined, ctx: QuoteCtx): BrandPlan => {
	const list = picks ?? [];
	if (list.length === 0) return { ok: true, picks: [], funding: 0, critic: 0, gross: 0, scaled: false };
	if (!brandDealsOn()) return { ok: false, error: "Brand Deals is switched off." };
	if (new Set(list.map((p) => p.brandId)).size !== list.length) return { ok: false, error: "The same brand cannot be added twice." };
	const quotes: Quote[] = [];
	for (const p of list) {
		const brand = brandById(p.brandId);
		if (!brand) return { ok: false, error: "That brand does not exist." };
		const clash = pickBlocker(state, list, brand, p.tier);
		if (clash) return { ok: false, error: clash };
		const q = quote(state, brand, p.tier, ctx);
		if (!q.ok) return { ok: false, error: `${brand.name}: ${q.refusal}` };
		quotes.push(q);
	}
	const total = quotes.reduce((sum, q) => sum + q.cash + q.cover, 0);
	const cap = MAX_FUNDING_SHARE * (ctx.budget + ctx.marketing);
	const scale = total > cap ? cap / total : 1;
	const placed: BrandPlacement[] = quotes.map((q) => ({
		brandId: q.brand.id,
		tier: q.tier,
		fee: Math.floor(((q.cash + q.cover) * scale) / 10) * 10,
		...(q.love && { love: true }),
	}));
	const fx = filmEffects(placed, ctx.genre);
	return { ok: true, picks: placed, funding: placed.reduce((sum, p) => sum + p.fee, 0), critic: fx.critic, gross: fx.gross - 1, scaled: scale < 1 };
};

// ── release ──────────────────────────────────────────────────

/** What a film's brands do to its critic score (negative) and its gross (a multiplier). Diminishing returns on the critic cost. */
const filmEffects = (placements: BrandPlacement[], genre: FilmGenre): { critic: number; gross: number } => {
	let raw = 0;
	let promo = 0;
	for (const p of placements) {
		const brand = brandById(p.brandId);
		if (!brand) continue;
		raw += TIERS[p.tier].critic * GENRE_SENS[genre] * (p.love ? 0.5 : 1);
		promo += brand.promo * TIERS[p.tier].promo * (p.love ? 1.2 : 1);
	}
	return { critic: -Math.round(CRITIC_CAP * (1 - Math.exp(-raw / CRITIC_CAP))), gross: 1 + Math.min(PROMO_CAP, promo) };
};

/** Franchise heat -> the gross multiplier a sequel gets. */
export const heatMultiplier = (state: GameState, m: Movie): number =>
	m.prequelMid === undefined ? 1 : 1 + (HEAT_GROSS * heatOf(state, m.franchiseId ?? franchiseIdOf(m))) / 100;

/**
 * At the release, before the sequel blend and the IP boost (like the other multipliers): the brands cost critic points and lift the gross,
 * and a sequel gets its franchise's heat. Records what happened on movie.brandFx.
 */
export const applyBrandRelease = (state: GameState, m: Movie): void => {
	const heat = heatMultiplier(state, m);
	const placements = m.brands ?? [];
	if (placements.length === 0 && heat === 1) return;
	const fx = filmEffects(placements, m.genre);
	m.criticScore = clamp((m.criticScore ?? 0) + fx.critic);
	m.boxOffice = Math.round((m.boxOffice ?? 0) * fx.gross * heat);
	m.brandFx = { critic: fx.critic, gross: Math.round(fx.gross * 1000) / 1000, heat: Math.round(heat * 1000) / 1000 };
};

const names = (list: string[]): string => (list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

/**
 * After the release, once the gross is final: a hit pays a bonus, a flop owes a make-good, relationships move, and a film
 * that is all advert costs studio reputation. Returns the news. Call before the reputation change so the profit counts.
 */
export const settleBrands = (state: GameState, m: Movie): Draft[] => {
	const placed = m.brands ?? [];
	if (placed.length === 0) return [];
	const studio = user(state);
	const paid = placed.reduce((sum, p) => sum + p.fee, 0);
	const ratio = (m.boxOffice ?? 0) / Math.max(1, m.budget + (m.marketing ?? 0));
	const label = names(placed.map((p) => brandById(p.brandId)?.name ?? "?"));
	let bonus = 0;
	let rel = 0;
	let tone: "good" | "bad" = "good";
	if (ratio >= HIT_RATIO) {
		bonus = round10(paid * HIT_BONUS);
		rel = 6;
	} else if (ratio < FLOP_RATIO) {
		bonus = -round10(paid * MAKE_GOOD);
		rel = -8;
		tone = "bad";
	} else rel = ratio >= 1 ? 3 : -2;
	for (const p of placed) addRel(state, p.brandId, rel + (p.love ? 1 : 0));
	m.brandBonus = bonus;
	studio.cash += bonus;

	const out: Draft[] = [];
	const critic = m.brandFx?.critic ?? 0;
	if (critic <= -5) studio.reputation = clamp(studio.reputation + critic / 5); // all advert, no film
	if (bonus > 0) {
		out.push({
			kind: "studio",
			rank: 3,
			mine: true,
			tone,
			tags: ["SPONSORS"],
			headline: `Sponsors cash in on ${mTok(m.mid, m.title)}`,
			body: [`${label} paid ${fmtMoney(paid)} to be part of ${mTok(m.mid, m.title)}. With ${fmtMoney(m.boxOffice ?? 0)} at the box office they were delighted, and sent a bonus of ${fmtMoney(bonus)}.`],
		});
	} else if (bonus < 0) {
		out.push({
			kind: "studio",
			rank: 3,
			mine: true,
			tone,
			tags: ["SPONSORS"],
			headline: `Sponsors want money back on ${mTok(m.mid, m.title)}`,
			body: [`${label} backed ${mTok(m.mid, m.title)} with ${fmtMoney(paid)}. After a ${fmtMoney(m.boxOffice ?? 0)} run their lawyers invoked the make-good clause: the studio owes ${fmtMoney(-bonus)}.`],
		});
	}
	if (critic <= -4) {
		out.push({
			kind: "reviews",
			rank: 2,
			mine: true,
			tone: "bad",
			tags: ["PLACEMENT"],
			headline: `Critics count the logos in ${mTok(m.mid, m.title)}`,
			body: [`Reviewers noticed ${placed.length} brands on screen in ${mTok(m.mid, m.title)}${critic <= -5 ? " and called it \"a feature-length advert\"" : ""}. Product placement cost the film roughly ${-critic} points with the critics.`],
		});
	}
	return out;
};

// ── accepting and declining offers ───────────────────────────

export type BrandResult = { ok: true; state: GameState; message: string } | { ok: false; error: string };

export const pendingOffers = (state: GameState): BrandOffer[] => state.brandOffers ?? [];

export const acceptBrandOffer = (state: GameState, id: number): BrandResult => {
	const offer = pendingOffers(state).find((o) => o.id === id);
	if (!offer) return { ok: false, error: "That offer is gone." };
	const brand = brandById(offer.brandId);
	if (!brand) return { ok: false, error: "That brand does not exist." };
	if (offer.kind === "studio") {
		if (activeDeals(state, "studio").length >= MAX_STUDIO_DEALS) return { ok: false, error: `You can have at most ${MAX_STUDIO_DEALS} studio partners.` };
		if (studioPartners(state).has(brand.category)) return { ok: false, error: `You already have a ${CATEGORY_LABEL[brand.category].toLowerCase()} partner.` };
	} else if (dealTaken(state, offer.kind, offer.mid)) {
		return { ok: false, error: "That film already has one of those deals." };
	}
	const next = structuredClone(state);
	const deal: BrandDeal = {
		...offer,
		status: "active",
		signed: next.season,
		paid: offer.upfront,
		seasonsPaid: 0,
		log: [`Signed in ${next.season}: ${fmtMoney(offer.upfront)} upfront.`],
	};
	next.brandDeals = [...(next.brandDeals ?? []), deal];
	next.brandOffers = pendingOffers(next).filter((o) => o.id !== id);
	user(next).cash += offer.upfront;
	addRel(next, brand.id, 3);
	return { ok: true, state: next, message: `Signed with ${brand.name}: ${fmtMoney(offer.upfront)} upfront.` };
};

export const declineBrandOffer = (state: GameState, id: number): GameState => {
	const next = structuredClone(state);
	next.brandOffers = pendingOffers(next).filter((o) => o.id !== id);
	return next;
};

// ── the off-season ───────────────────────────────────────────

/** A film gets one merchandise line at a time, and only ever one game and one series. */
const dealTaken = (state: GameState, kind: BrandOfferKind, mid: number | undefined): boolean =>
	(state.brandDeals ?? []).some((d) => d.kind === kind && d.mid === mid && (d.status === "active" || kind === "game" || kind === "tv"));

const filmOf = (state: GameState, mid: number | undefined): Movie | undefined => (mid === undefined ? undefined : state.movies.find((m) => m.mid === mid));

const endDeal = (state: GameState, d: BrandDeal, note: string): void => {
	d.status = "ended";
	d.endNote = note;
	d.endedSeason = state.season;
	d.log.push(note);
};

/** Games and TV shows are scored 0-100 like films: the brand's pedigree, the film's reviews and the franchise's heat, plus luck. */
const rollQuality = (brand: Brand, film: Movie | undefined, heat: number, base: number, critWeight: number, heatWeight: number, spread: number): number =>
	clamp(Math.round(gauss(base + (brand.prestige - 3) * 5 + ((film?.criticScore ?? 60) - 60) * critWeight + heat * heatWeight, spread)));

/** Run the yearly clock for every signed deal. Returns the news and notes. */
const settleDeals = (state: GameState): { drafts: Draft[]; notes: string[] } => {
	const drafts: Draft[] = [];
	const notes: string[] = [];
	const studio = user(state);
	for (const d of state.brandDeals ?? []) {
		if (d.status !== "active" || d.signed >= state.season) continue;
		const brand = brandById(d.brandId);
		const film = filmOf(state, d.mid);
		const fid = film ? film.franchiseId ?? film.mid : undefined;
		const heat = fid === undefined ? 0 : heatOf(state, fid);
		const pay = (amount: number) => {
			studio.cash += amount;
			d.paid += amount;
		};
		if (!brand) {
			endDeal(state, d, "The brand no longer exists.");
			continue;
		}

		if (d.kind === "studio") {
			pay(d.annual);
			d.seasonsPaid += 1;
			addRel(state, brand.id, 2);
			d.log.push(`${state.season}: ${fmtMoney(d.annual)} partnership fee.`);
			notes.push(`${brand.name} paid ${fmtMoney(d.annual)} as your studio partner.`);
			if (d.seasonsPaid >= d.years) endDeal(state, d, `Ran its ${d.years} years. The ${CATEGORY_LABEL[brand.category].toLowerCase()} slot is free again.`);
		} else if (d.kind === "merch") {
			// Sales fade every year; heat and luck move them.
			const roll = 0.6 + Math.random() * 0.9;
			const amount = round10(d.annual * Math.pow(0.78, d.seasonsPaid) * roll * (0.85 + heat / 330));
			pay(amount);
			d.seasonsPaid += 1;
			if (fid !== undefined) addHeat(state, fid, d.seasonsPaid === 1 ? 6 : 3);
			d.log.push(`${state.season}: ${brand.product ?? "merchandise"} paid ${fmtMoney(amount)} in royalties.`);
			notes.push(`${d.title}: ${fmtMoney(amount)} in royalties.`);
			if (d.seasonsPaid >= d.years) endDeal(state, d, `The ${brand.product ?? "line"} ran its ${d.years} years and went to the clearance shelf.`);
		} else if (d.kind === "game") {
			const score = rollQuality(brand, film, heat, 50, 0.35, 0.08, 13);
			const sold = clamp((score - 30) / 35, 0.15, 2);
			const royalty = round10(d.annual * sold);
			pay(royalty);
			d.quality = score;
			d.released = true;
			d.seasonsPaid = 1;
			const verdict = score >= 80 ? "a critical and commercial smash" : score >= 65 ? "sold well" : score >= 45 ? "got mixed reviews" : "was savaged as shovelware";
			if (fid !== undefined) addHeat(state, fid, score >= 80 ? 12 : score >= 65 ? 5 : score < 45 ? -8 : 0);
			if (score >= 80) studio.reputation = clamp(studio.reputation + 1.5);
			if (score < 35) studio.reputation = clamp(studio.reputation - 1.5);
			addRel(state, brand.id, score >= 65 ? 5 : score < 45 ? -6 : 0);
			endDeal(state, d, `Released to a score of ${score}: it ${verdict}. Royalties ${fmtMoney(royalty)}.`);
			notes.push(`${d.title} ${verdict} (${score}): ${fmtMoney(royalty)} in royalties.`);
			if (score >= 80 || score < 40) {
				drafts.push({
					kind: "franchise",
					rank: 3,
					mine: true,
					tone: score >= 80 ? "good" : "bad",
					tags: ["VIDEO GAME"],
					headline: score >= 80 ? `${brand.name}'s ${d.title} is a hit` : `${d.title} is a flop for ${brand.name}`,
					body: [
						score >= 80
							? `The tie-in to ${mTok(film?.mid ?? 0, film?.title ?? "the film")} scored ${score} with the reviewers and flew off the shelves. The studio collects ${fmtMoney(royalty)} in royalties, and the fans cannot wait for the sequel.`
							: `The tie-in to ${mTok(film?.mid ?? 0, film?.title ?? "the film")} scored just ${score} and players called it a rushed cash-in. The studio collects ${fmtMoney(royalty)} and some bad feeling.`,
					],
				});
			}
		} else if (d.kind === "tv") {
			const prev = d.quality ?? rollQuality(brand, film, heat, 48, 0.4, 0.06, 12);
			const score = d.released ? clamp(Math.round(gauss(prev * 0.5 + (46 + (brand.prestige - 3) * 5 + ((film?.criticScore ?? 60) - 60) * 0.4 + heat * 0.06) * 0.5, 10))) : prev;
			const season = d.seasonsPaid + 1;
			pay(d.annual);
			d.quality = score;
			d.released = true;
			d.seasonsPaid = season;
			if (fid !== undefined) addHeat(state, fid, score >= 75 ? 7 : score >= 55 ? 3 : score < 40 ? -5 : 0);
			if (score >= 80) studio.reputation = clamp(studio.reputation + 1);
			if (score < 35) studio.reputation = clamp(studio.reputation - 1);
			addRel(state, brand.id, score >= 65 ? 3 : score < 45 ? -4 : 0);
			d.log.push(`${state.season}: season ${season} scored ${score}. ${fmtMoney(d.annual)} episode order.`);
			notes.push(`${d.title}, season ${season}: ${score}. ${brand.name} paid ${fmtMoney(d.annual)}.`);
			if (score < 38 && season >= 1 && season < d.years) {
				endDeal(state, d, `Cancelled after ${season} season${season > 1 ? "s" : ""} (last score ${score}).`);
				drafts.push({
					kind: "franchise",
					rank: 2,
					mine: true,
					tone: "bad",
					tags: ["TV"],
					headline: `${brand.name} cancels ${d.title}`,
					body: [`After season ${season} (score ${score}) ${brand.name} pulled the plug on the spin-off from ${mTok(film?.mid ?? 0, film?.title ?? "the film")}.`],
				});
			} else if (score >= 80 && season >= d.years && d.years < 5) {
				d.years += 1;
				d.log.push(`Renewed for season ${d.years}.`);
				drafts.push({
					kind: "franchise",
					rank: 3,
					mine: true,
					tone: "good",
					tags: ["TV"],
					headline: `${d.title} renewed by ${brand.name}`,
					body: [`Season ${season} of the ${mTok(film?.mid ?? 0, film?.title ?? "the film")} spin-off scored ${score} and ${brand.name} has ordered another season.`],
				});
			} else if (season >= d.years) endDeal(state, d, `Finished after ${season} season${season > 1 ? "s" : ""} (last score ${score}).`);
		}
	}
	return { drafts, notes };
};

const weighted = <T,>(items: { item: T; weight: number }[]): T | undefined => {
	const total = items.reduce((sum, i) => sum + i.weight, 0);
	if (total <= 0) return undefined;
	let r = Math.random() * total;
	for (const i of items) {
		r -= i.weight;
		if (r <= 0) return i.item;
	}
	return items[items.length - 1]?.item;
};

const MERCH_GENRE: Record<FilmGenre, number> = { adventure: 1, action: 1, sciFiFantasy: 1, comedy: 0.9, horror: 0.45, thriller: 0.45, crime: 0.35, drama: 0.2, romance: 0.3 };
const GAME_GENRE: Record<FilmGenre, number> = { action: 1, adventure: 1, sciFiFantasy: 1, thriller: 0.7, horror: 0.7, crime: 0.7, comedy: 0.15, drama: 0.05, romance: 0.05 };
const TV_GENRE: Record<FilmGenre, number> = { drama: 1, crime: 1, thriller: 1, sciFiFantasy: 1, comedy: 0.9, adventure: 0.9, action: 0.8, horror: 0.8, romance: 0.8 };

/** The chance a released film attracts an offer of this kind (before the dice). 0 = it does not qualify. */
export const offerChance = (state: GameState, m: Movie, kind: "merch" | "game" | "tv"): number => {
	const gross = m.boxOffice ?? 0;
	const critic = m.criticScore ?? 0;
	const heat = heatOf(state, m.franchiseId ?? m.mid);
	const age = state.season - m.season;
	if (age < 0 || age > 3) return 0;
	const fresh = [1, 0.4, 0.2, 0.1][age];
	const extra = (installmentOf(m) > 1 ? 0.2 : 0) + (m.ipId ? 0.2 : 0) + heat / 500;
	let p = 0;
	if (kind === "merch") p = gross < 30000 ? 0 : clamp((gross - 30000) / 110000, 0, 0.85) * MERCH_GENRE[m.genre] + extra;
	if (kind === "game") p = gross < 40000 || critic < 45 ? 0 : clamp((gross - 40000) / 130000, 0, 0.8) * GAME_GENRE[m.genre] + extra * 0.7;
	if (kind === "tv") p = gross < 35000 || critic < 62 ? 0 : clamp(0.18 + (critic - 62) / 70 + extra, 0, 0.85) * TV_GENRE[m.genre];
	return clamp(p * fresh, 0, 0.9);
};

/** Pick a brand that fits the film: it must like the genre and the studio, and brands that love the genre come up more often. */
const pickBrand = (state: GameState, kind: BrandKind, film: Movie, skip: Set<string>): Brand | undefined => {
	const rep = user(state).reputation;
	return weighted(
		visibleBrands(kind)
			.filter((b) => !skip.has(b.id) && !b.avoids.includes(film.genre) && rep >= minRep(b) - 10 && relOf(state, b.id) >= 15)
			.map((b) => ({ item: b, weight: (b.loves.includes(film.genre) ? 2.2 : 1) * (0.6 + relOf(state, b.id) / 100) })),
	);
};

const buildOffer = (state: GameState, kind: BrandOfferKind, brand: Brand, film: Movie | undefined): Omit<BrandOffer, "id"> => {
	const pm = 0.7 + 0.2 * brand.prestige;
	const lvl = fees();
	const love = film && brand.loves.includes(film.genre) ? 1.2 : 1;
	const gross = film?.boxOffice ?? 0;
	if (kind === "studio") {
		const annual = round10((250 + user(state).reputation * 18) * pm * lvl * mood(brand.id, state.season));
		return { kind, brandId: brand.id, title: `${brand.name}: official ${CATEGORY_LABEL[brand.category].toLowerCase()} partner`, upfront: round10(annual * 0.5), annual, years: 3 + Math.floor(Math.random() * 2), category: brand.category };
	}
	const f = film!;
	const k = pm * lvl * love * mood(brand.id, state.season);
	if (kind === "merch") return { kind, brandId: brand.id, mid: f.mid, title: `${f.title} ${brand.product ?? "toys"}`, upfront: round10(gross * 0.006 * k), annual: round10(gross * 0.005 * k), years: 3 };
	if (kind === "game") return { kind, brandId: brand.id, mid: f.mid, title: `${f.title}: The Game`, upfront: round10(gross * 0.007 * k), annual: round10(gross * 0.011 * k), years: 1 };
	return { kind, brandId: brand.id, mid: f.mid, title: `${f.title}: The Series`, upfront: round10(gross * 0.005 * k), annual: round10(gross * 0.009 * k), years: 1 + Math.floor(Math.random() * 3) };
};

const OFFER_KINDS: { kind: "merch" | "game" | "tv"; brand: BrandKind }[] = [
	{ kind: "merch", brand: "merch" },
	{ kind: "game", brand: "game" },
	{ kind: "tv", brand: "tv" },
];

/** New offers for your released films, and one or two studio partners. They last until the new season starts. */
const makeOffers = (state: GameState): BrandOffer[] => {
	const offers: BrandOffer[] = [];
	let next = state.nextBrandId ?? 0;
	const add = (o: Omit<BrandOffer, "id">) => offers.push({ ...o, id: next++ });
	const taken = (kind: BrandOfferKind, mid: number) => dealTaken(state, kind, mid);

	const films = state.movies.filter((m) => m.tid === state.userTid && m.boxOffice !== undefined && m.criticScore !== undefined).sort((a, b) => b.season - a.season);
	for (const film of films) {
		for (const { kind, brand: brandKind } of OFFER_KINDS) {
			if (offers.length >= MAX_OFFERS - 1 || taken(kind, film.mid) || offers.some((o) => o.kind === kind && o.mid === film.mid)) continue;
			if (Math.random() >= offerChance(state, film, kind)) continue;
			const brand = pickBrand(state, brandKind, film, new Set());
			if (brand) add(buildOffer(state, kind, brand, film));
		}
	}

	// Studio partners: a famous studio gets approached. A category you already have a partner in is closed.
	const locked = studioPartners(state);
	if (activeDeals(state, "studio").length < MAX_STUDIO_DEALS) {
		const rep = user(state).reputation;
		const candidates = visibleBrands("studio").filter((b) => !locked.has(b.category) && rep >= minRep(b) + 8 && relOf(state, b.id) >= 30);
		const tries = Math.random() < 0.35 + rep / 200 ? 2 : 1;
		const used = new Set<string>();
		for (let i = 0; i < tries && offers.length < MAX_OFFERS; i++) {
			const brand = weighted(candidates.filter((b) => !used.has(b.id) && !used.has(`cat:${b.category}`)).map((b) => ({ item: b, weight: 0.5 + relOf(state, b.id) / 100 })));
			if (!brand || Math.random() > 0.55 + rep / 250) continue;
			used.add(brand.id);
			used.add(`cat:${brand.category}`);
			add(buildOffer(state, "studio", brand, undefined));
		}
	}
	state.nextBrandId = next;
	return offers;
};

/**
 * Called when the awards are over (Awards -> Off-season). Pays and settles every running deal, cools the franchises' heat,
 * and makes the offers for the new year. Returns the news and a note for the notice bar.
 */
export const brandOffseason = (state: GameState): { drafts: Draft[]; notes: string[] } => {
	const on = brandDealsOn();
	if (!on && activeDeals(state).length === 0) return { drafts: [], notes: [] };
	for (const key of Object.keys(state.brandHeat ?? {})) addHeat(state, Number(key), -(heatOf(state, Number(key)) * (1 - HEAT_DECAY)));
	const result = settleDeals(state);
	const offers = on ? makeOffers(state) : [];
	state.brandOffers = offers;
	const notes = result.notes.length ? [`Brand money: ${result.notes.join(" ")}`] : [];
	if (offers.length) notes.push(`${offers.length} brand offer${offers.length > 1 ? "s are" : " is"} waiting on the Brands page.`);
	return { drafts: result.drafts, notes };
};

// ── numbers for the pages ────────────────────────────────────

/** What a signed deal is still going to pay (an estimate: merchandise fades, games are a roll of the dice). */
export const expectedIncome = (state: GameState): number =>
	activeDeals(state).reduce((sum, d) => {
		const left = Math.max(0, d.years - d.seasonsPaid);
		if (d.kind === "studio" || d.kind === "tv") return sum + d.annual * left;
		if (d.kind === "game") return sum + (d.released ? 0 : d.annual * 0.9);
		let total = 0;
		for (let i = d.seasonsPaid; i < d.years; i++) total += d.annual * Math.pow(0.78, i) * 1.05;
		return sum + total;
	}, 0);

export const totalEarned = (state: GameState): number => (state.brandDeals ?? []).reduce((sum, d) => sum + d.paid, 0) + state.movies.filter((m) => m.tid === state.userTid).reduce((sum, m) => sum + (m.brandFunding ?? 0) + (m.brandBonus ?? 0), 0);

/** The franchises with some heat, hottest first. */
export const hotFranchises = (state: GameState): { fid: number; title: string; heat: number }[] =>
	Object.entries(state.brandHeat ?? {})
		.map(([fid, heat]) => ({ fid: Number(fid), title: state.movies.find((m) => m.mid === Number(fid))?.title ?? "?", heat }))
		.filter((f) => f.heat >= 1)
		.sort((a, b) => b.heat - a.heat);

export const allBrandIds = BRANDS.map((b) => b.id);
