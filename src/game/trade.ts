import { ipBlocker } from "./challenges";
import {
	FRANCHISE_IP_MIN_FILMS,
	IP_START_GOODWILL,
	TRADE_ASK_LADDER,
	TRADE_BID_LADDER,
	TRADE_BUY_MOOD,
	TRADE_CASH_RATIO,
	TRADE_LOWBALL,
	TRADE_MAX_LICENSES,
	TRADE_MAX_OFFERS,
	TRADE_MIN_INTEREST,
	TRADE_OFFER_CHANCE,
	TRADE_QUICK_SALE,
	TRADE_ROUNDS,
	TRADE_SELL_MOOD,
} from "./constants";
import { franchiseFilms, franchiseIdOf, franchiseName } from "./franchise";
import { fmtMoney } from "./format";
import { customIpId, ipById, licenseOf, licensesOf, reservedCash, studioNameOf, universeFilms } from "./ip";
import type { Ip } from "./ipData";
import { movieProfit } from "./movie";
import { average, clamp } from "./random";
import type { Deal, GameState, Movie } from "./types";

// ═════════════════════════════════════════════════════════════
// Trading IP rights. Three things happen here:
//   1. SELL the rights you own (a catalogue IP or one you bought) to a rival, by negotiating or in a quick sale.
//   2. BUY the rights a rival owns, by negotiating with it.
//   3. SELL YOUR OWN FRANCHISE: a chain of original (unlicensed) sequels can be turned into an IP and sold.
//      The buyer gets the rights to continue it; you can no longer make sequels to it.
// All functions are pure: they return a new state and never touch the one you pass in.
// Prices are thousands of $.
// ═════════════════════════════════════════════════════════════

const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

/** A stable "mood" between 0 and 1 for one studio about one IP in one season: re-asking never rerolls it. */
const mood = (ipId: string, tid: number, season: number, salt: string): number => {
	let h = 2166136261;
	for (const ch of `${ipId}|${tid}|${season}|${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return ((h >>> 0) % 10000) / 10000;
};

// ── your franchises as IPs ───────────────────────────────────

/** The IP a sequel franchise would become, priced from how its released films did. Null if nothing has been released. */
export const franchiseIp = (state: GameState, fid: number): Ip | null => {
	const films = franchiseFilms(state, fid).filter((m) => m.boxOffice !== undefined && m.criticScore !== undefined);
	if (films.length === 0) return null;
	const first = state.movies.find((m) => m.mid === fid) ?? films[0];
	const name = franchiseName(state, first);
	const total = films.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
	const avgGross = total / films.length;
	const avgCritic = average(films.map((m) => m.criticScore ?? 0));

	const heat = clamp(0.75 + avgGross / 400000, 0.75, 1.3);
	const criticFactor = clamp(0.7 + (avgCritic - 60) / 50, 0.6, 1.3);
	const price = clamp(roundTo((0.45 * avgGross + 0.12 * total) * criticFactor, 1000), 15000, 240000);
	const id = customIpId(fid);
	return {
		id,
		name,
		emoji: "🎞️",
		tagline: `A homegrown franchise: ${films.length} films, ${fmtMoney(total)} at the box office, critics averaging ${Math.round(avgCritic)}.`,
		price,
		filmFee: Math.max(500, roundTo((price * 0.075) / heat, 500)),
		boost: 1.08 + 0.2 * clamp((avgCritic - 55) / 30, 0, 1),
		expectCritic: Math.round(clamp(avgCritic - 4 - (heat - 1) * 8, 45, 88)),
		expectGross: roundTo((avgGross * 0.85) / heat, 1000),
		severity: avgCritic >= 78 ? 1.2 : avgCritic >= 65 ? 1.0 : 0.85,
		properties: [{ id: `${id}:main`, name, genre: first.genre, heat }],
		custom: { fid, originTid: first.tid, season: state.season },
	};
};

export type SellableFranchise = {
	fid: number;
	name: string;
	films: Movie[]; // every film of the chain, oldest first
	ip: Ip | null; // what it would be worth as an IP
	blocker: string | null; // why it cannot be sold right now (null = it can)
};

/** Your original sequel franchises (2+ films, no licensed films) that are not already an IP. */
export const sellableFranchises = (state: GameState, tid: number): SellableFranchise[] => {
	const sold = new Set((state.customIps ?? []).map((ip) => ip.custom!.fid));
	const groups = new Map<number, Movie[]>();
	for (const m of state.movies.filter((x) => x.tid === tid)) {
		const fid = franchiseIdOf(m);
		groups.set(fid, [...(groups.get(fid) ?? []), m]);
	}
	const out: SellableFranchise[] = [];
	for (const [fid, films] of groups) {
		if (films.length < 2 || sold.has(fid)) continue;
		const chain = franchiseFilms(state, fid);
		if (chain.some((m) => m.tid !== tid || m.ipId)) continue; // only a purely original, purely yours chain
		const released = chain.filter((m) => m.boxOffice !== undefined && m.criticScore !== undefined);
		const blocker =
			released.length < chain.length
				? "Your newest film in this franchise is not released yet. Sell once it is out."
				: released.length < FRANCHISE_IP_MIN_FILMS
					? `Needs at least ${FRANCHISE_IP_MIN_FILMS} released films.`
					: null;
		out.push({ fid, name: franchiseName(state, chain[0]), films: chain, ip: franchiseIp(state, fid), blocker });
	}
	return out.sort((a, b) => (b.ip?.price ?? 0) - (a.ip?.price ?? 0));
};

/** An IP the studio owns, or one of its franchises that is ready to be sold as an IP. */
export const tradableIp = (state: GameState, ipId: string, userTid: number): { ip: Ip; pending: boolean } | null => {
	const ip = ipById(state, ipId);
	if (ip) return { ip, pending: false };
	if (!ipId.startsWith("custom-")) return null;
	const fid = Number(ipId.slice("custom-".length));
	const match = sellableFranchises(state, userTid).find((f) => f.fid === fid && f.blocker === null);
	return match?.ip ? { ip: match.ip, pending: true } : null;
};

// ── what an IP is worth ──────────────────────────────────────

/** Market value of an IP today: its list price, moved by fan goodwill (x0.7 .. x1.3) and by how its owner's films have paid. */
export const ipValue = (state: GameState, ip: Ip): number => {
	const lic = licenseOf(state, ip.id);
	const goodwill = lic?.goodwill ?? IP_START_GOODWILL;
	const profit = lic ? universeFilms(state, lic.tid, ip.id).reduce((sum, m) => sum + movieProfit(m), 0) : 0;
	const track = clamp(profit * 0.25, -0.2 * ip.price, 0.4 * ip.price);
	return Math.max(5000, roundTo(ip.price * (0.7 + (0.6 * goodwill) / 100) + track, 500));
};

/** What a rival wants for rights it holds: never below this. */
const sellerReserve = (state: GameState, ip: Ip, rivalTid: number): number => {
	const studio = state.studios.find((s) => s.tid === rivalTid);
	const strapped = studio !== undefined && studio.cash < ip.price * 0.5 ? 0.92 : 1; // a studio short of cash sells a little cheaper
	return ipValue(state, ip) * (TRADE_SELL_MOOD.min + TRADE_SELL_MOOD.span * mood(ip.id, rivalTid, state.season, "sell")) * strapped;
};

/** The most a rival would ever pay for rights. */
const buyerBudget = (state: GameState, ip: Ip, rivalTid: number): number => {
	const studio = state.studios.find((s) => s.tid === rivalTid);
	if (!studio) return 0;
	const wants = ipValue(state, ip) * (TRADE_BUY_MOOD.min + TRADE_BUY_MOOD.span * mood(ip.id, rivalTid, state.season, "buy"));
	return Math.min(wants, studio.cash * TRADE_CASH_RATIO);
};

/** Why a rival would not buy these rights at all (null = interested). */
const buyerRefusal = (state: GameState, ip: Ip, rivalTid: number): string | null => {
	if (licensesOf(state, rivalTid).length >= TRADE_MAX_LICENSES) return `Already holds ${TRADE_MAX_LICENSES} IPs.`;
	if (buyerBudget(state, ip, rivalTid) < ipValue(state, ip) * TRADE_MIN_INTEREST) return "Cannot afford it.";
	return null;
};

// ── blockers ─────────────────────────────────────────────────

/** Why the studio that holds these rights cannot trade them now (null = it can). Franchises not yet sold have no such limit. */
export const rightsBlocker = (state: GameState, ip: Ip, ownerTid: number): string | null => {
	const lic = licenseOf(state, ip.id);
	if (!lic) return null;
	if (lic.tid !== ownerTid) return "These rights are held by someone else.";
	if (lic.since >= state.season) return "These rights changed hands this season. They can be traded again next season.";
	if (state.movies.some((m) => m.season === state.season && m.tid === ownerTid && m.ipId === ip.id && m.boxOffice === undefined)) {
		return "A film on this IP is in production. Rights can be traded once it is released.";
	}
	return null;
};

const findDeal = (state: GameState, ipId: string, rivalTid: number, side: Deal["side"]): Deal | undefined =>
	state.deals?.find((d) => d.ipId === ipId && d.rivalTid === rivalTid && d.side === side);

// ── talks with one rival ─────────────────────────────────────

export type Talk = {
	rivalTid: number;
	/** "open": you can make an offer. "closed": not now (see `reason`). */
	status: "open" | "closed";
	reason?: string;
	round: number; // the round your next offer would be (1-based)
	roundsLeft: number;
	/** The price the rival would accept this round: its asking price when you buy, the most it would pay when you sell. */
	position?: number;
};

export const talkStatus = (state: GameState, ipId: string, rivalTid: number, side: Deal["side"], userTid = state.userTid): Talk => {
	const closed = (reason: string, round = 1): Talk => ({ rivalTid, status: "closed", reason, round, roundsLeft: 0 });
	const found = tradableIp(state, ipId, userTid);
	if (!found) return closed("That IP is not for sale.");
	const { ip } = found;
	const deal = findDeal(state, ipId, rivalTid, side);
	const round = (deal?.round ?? 0) + 1;
	const name = studioNameOf(state, rivalTid);
	if (deal?.blockedUntil !== undefined && deal.blockedUntil > state.season) return closed(`${name} walked away from the table. Try again next season.`, round);
	if (round > TRADE_ROUNDS) return closed(`${name} has run out of patience. Try again next season.`, round);

	const step = Math.min(deal?.step ?? 0, TRADE_ROUNDS - 1);
	if (side === "buy") {
		const lic = licenseOf(state, ipId);
		if (!lic || lic.tid !== rivalTid) return closed(`${name} does not own these rights.`, round);
		const blocker = rightsBlocker(state, ip, rivalTid);
		if (blocker) return closed(blocker, round);
		const position = roundTo(sellerReserve(state, ip, rivalTid) * TRADE_ASK_LADDER[step], 500);
		return { rivalTid, status: "open", round, roundsLeft: TRADE_ROUNDS - round + 1, position };
	}
	// side === "sell"
	const lic = licenseOf(state, ipId);
	if (lic && lic.tid !== userTid) return closed("You do not own these rights.", round);
	if (lic) {
		const blocker = rightsBlocker(state, ip, userTid);
		if (blocker) return closed(blocker, round);
	}
	if (rivalTid === userTid || lic?.tid === rivalTid) return closed("Pick another studio.", round);
	const refusal = buyerRefusal(state, ip, rivalTid);
	if (refusal) return closed(`${name}: ${refusal}`, round);
	const position = roundTo(buyerBudget(state, ip, rivalTid) * TRADE_BID_LADDER[step], 500);
	return { rivalTid, status: "open", round, roundsLeft: TRADE_ROUNDS - round + 1, position };
};

/** Move the rights (and the cash) between two studios. Mutates `next`, which must be a copy. */
const completeSale = (next: GameState, ip: Ip, sellerTid: number | null, buyerTid: number, price: number): void => {
	const buyer = next.studios.find((s) => s.tid === buyerTid)!;
	buyer.cash -= price;
	if (sellerTid !== null) next.studios.find((s) => s.tid === sellerTid)!.cash += price;
	const lic = next.licenses?.find((l) => l.ipId === ip.id);
	if (lic) {
		lic.tid = buyerTid;
		lic.since = next.season; // goodwill goes with the IP
	} else {
		// A franchise sold as an IP for the first time: it now exists in the store, owned by the buyer.
		if (ip.custom && !next.customIps?.some((x) => x.id === ip.id)) next.customIps = [...(next.customIps ?? []), ip];
		next.licenses = [...(next.licenses ?? []), { ipId: ip.id, tid: buyerTid, since: next.season, goodwill: IP_START_GOODWILL }];
	}
	next.deals = (next.deals ?? []).filter((d) => d.ipId !== ip.id);
	next.offers = (next.offers ?? []).filter((o) => o.ipId !== ip.id);
};

export type TradeResult =
	| { ok: false; error: string }
	| { ok: true; state: GameState; outcome: "deal" | "counter" | "walk"; message: string };

/**
 * You make an offer to one rival. `side` "buy": you offer `price` for its rights. `side` "sell": you ask `price` for yours.
 * The rival accepts, answers with a counter (and moves a step towards you), or walks away after the last round.
 */
export const makeOffer = (state: GameState, ipId: string, rivalTid: number, side: Deal["side"], price: number): TradeResult => {
	const fail = (error: string): TradeResult => ({ ok: false, error });
	const ruled = ipBlocker(state); // a challenge rule (see challenges.ts)
	if (ruled) return fail(ruled);
	const amount = roundTo(price, 500);
	if (!Number.isFinite(amount) || amount <= 0) return fail("Enter a price.");
	const found = tradableIp(state, ipId, state.userTid);
	if (!found) return fail("That IP is not for sale.");
	const talk = talkStatus(state, ipId, rivalTid, side);
	if (talk.status === "closed" || talk.position === undefined) return fail(talk.reason ?? "No deal possible right now.");
	const name = studioNameOf(state, rivalTid);

	const accepted = side === "buy" ? amount >= talk.position : amount <= talk.position;
	// Offering more than their asking price just pays the asking price.
	const paid = side === "buy" ? Math.min(amount, talk.position) : amount;
	const user = state.studios.find((s) => s.tid === state.userTid)!;
	const spendable = user.cash - reservedCash(state, state.userTid);
	if (accepted && side === "buy" && paid > spendable) {
		return fail(`Not enough cash: ${fmtMoney(paid)} needed, you can spend ${fmtMoney(spendable)}.`);
	}

	const next = structuredClone(state);
	if (accepted) {
		if (side === "buy") completeSale(next, found.ip, rivalTid, next.userTid, paid);
		else completeSale(next, found.ip, next.userTid, rivalTid, paid);
		return {
			ok: true,
			state: next,
			outcome: "deal",
			message:
				side === "buy"
					? `Deal! ${name} sold you the rights to ${found.ip.name} for ${fmtMoney(paid)}.`
					: `Deal! ${name} bought the rights to ${found.ip.name} for ${fmtMoney(paid)}.`,
		};
	}

	// Not accepted: they either dig in (lowball), give ground, or walk away.
	const lowball = side === "buy" ? amount < talk.position * TRADE_LOWBALL : amount > talk.position / TRADE_LOWBALL;
	const old = findDeal(next, ipId, rivalTid, side);
	const deal: Deal = { ipId, rivalTid, side, round: (old?.round ?? 0) + 1, step: (old?.step ?? 0) + (lowball ? 0 : 1) };
	next.deals = [...(next.deals ?? []).filter((d) => d !== old && !(d.ipId === ipId && d.rivalTid === rivalTid && d.side === side)), deal];
	if (deal.round >= TRADE_ROUNDS) {
		deal.blockedUntil = next.season + 1;
		return {
			ok: true,
			state: next,
			outcome: "walk",
			message: `${name} ends the talks and walks away. You can try again next season.`,
		};
	}
	const after = talkStatus(next, ipId, rivalTid, side);
	const counter = after.position !== undefined ? fmtMoney(after.position) : "?";
	const message = lowball
		? side === "buy"
			? `${name} is insulted by ${fmtMoney(amount)} and will not move: still ${counter}. That was one of your ${TRADE_ROUNDS} rounds.`
			: `${name} laughs at ${fmtMoney(amount)} and will not move: still ${counter}. That was one of your ${TRADE_ROUNDS} rounds.`
		: side === "buy"
			? `${name} turns down ${fmtMoney(amount)} but will sell for ${counter}.`
			: `${name} cannot pay ${fmtMoney(amount)}, but would pay ${counter}.`;
	return { ok: true, state: next, outcome: "counter", message };
};

/** Take the price the rival is showing right now (its asking price, or the most it would pay). */
export const acceptPosition = (state: GameState, ipId: string, rivalTid: number, side: Deal["side"]): TradeResult => {
	const talk = talkStatus(state, ipId, rivalTid, side);
	if (talk.status === "closed" || talk.position === undefined) return { ok: false, error: talk.reason ?? "No deal possible right now." };
	return makeOffer(state, ipId, rivalTid, side, talk.position);
};

// ── quick sale ───────────────────────────────────────────────

/** Sell now for a fixed share of the value to whichever interested rival has the most cash. */
export const quickSale = (state: GameState, ipId: string): TradeResult => {
	const ruled = ipBlocker(state);
	if (ruled) return { ok: false, error: ruled };
	const found = tradableIp(state, ipId, state.userTid);
	if (!found) return { ok: false, error: "That IP is not for sale." };
	const { ip } = found;
	const lic = licenseOf(state, ipId);
	if (lic && lic.tid !== state.userTid) return { ok: false, error: "You do not own these rights." };
	const blocker = lic ? rightsBlocker(state, ip, state.userTid) : null;
	if (blocker) return { ok: false, error: blocker };
	const price = roundTo(ipValue(state, ip) * TRADE_QUICK_SALE, 500);
	const buyers = state.studios
		.filter((s) => s.tid !== state.userTid && licensesOf(state, s.tid).length < TRADE_MAX_LICENSES && s.cash * TRADE_CASH_RATIO >= price)
		.sort((a, b) => b.cash - a.cash);
	if (buyers.length === 0) return { ok: false, error: `No rival can afford ${fmtMoney(price)} right now.` };
	const next = structuredClone(state);
	completeSale(next, ip, next.userTid, buyers[0].tid, price);
	return { ok: true, state: next, outcome: "deal", message: `Quick sale: ${buyers[0].name} took the rights to ${ip.name} for ${fmtMoney(price)}.` };
};

// ── rival offers ─────────────────────────────────────────────

/** Off-season: rivals may make unprompted offers for your IPs and sellable franchises. Mutates `state`. */
export const aiMakeOffers = (state: GameState): void => {
	state.offers = [];
	const rivals = state.studios.filter((s) => s.tid !== state.userTid);
	const mine: Ip[] = [
		...(state.licenses ?? []).filter((l) => l.tid === state.userTid).flatMap((l) => ipById(state, l.ipId) ?? []),
		...sellableFranchises(state, state.userTid).flatMap((f) => (f.blocker === null && f.ip ? [f.ip] : [])),
	];
	let nextId = 1;
	for (const ip of mine) {
		if (state.offers.length >= TRADE_MAX_OFFERS) break;
		if (Math.random() > TRADE_OFFER_CHANCE) continue;
		if (licenseOf(state, ip.id) && rightsBlocker(state, ip, state.userTid)) continue;
		const interested = rivals.filter((r) => buyerRefusal(state, ip, r.tid) === null);
		if (interested.length === 0) continue;
		const buyer = interested[Math.floor(Math.random() * interested.length)];
		const price = roundTo(buyerBudget(state, ip, buyer.tid) * (0.85 + Math.random() * 0.15), 500);
		state.offers.push({ id: nextId++, ipId: ip.id, fromTid: buyer.tid, price });
	}
	if (state.offers.length > 0) state.notice = `${state.offers.length === 1 ? "A rival has" : "Rivals have"} made an offer for your IP. See the IP Store.`;
};

export const acceptOffer = (state: GameState, offerId: number): TradeResult => {
	const ruled = ipBlocker(state);
	if (ruled) return { ok: false, error: ruled };
	const offer = state.offers?.find((o) => o.id === offerId);
	if (!offer) return { ok: false, error: "That offer is no longer on the table." };
	const found = tradableIp(state, offer.ipId, state.userTid);
	if (!found) return { ok: false, error: "You can no longer sell that IP." };
	if (licenseOf(state, offer.ipId)) {
		const blocker = rightsBlocker(state, found.ip, state.userTid);
		if (blocker) return { ok: false, error: blocker };
	}
	const buyer = state.studios.find((s) => s.tid === offer.fromTid);
	if (!buyer || buyer.cash < offer.price) return { ok: false, error: "They can no longer afford it." };
	const next = structuredClone(state);
	completeSale(next, found.ip, next.userTid, offer.fromTid, offer.price);
	return { ok: true, state: next, outcome: "deal", message: `Sold: ${buyer.name} paid ${fmtMoney(offer.price)} for the rights to ${found.ip.name}.` };
};

export const declineOffer = (state: GameState, offerId: number): GameState => ({
	...state,
	offers: (state.offers ?? []).filter((o) => o.id !== offerId),
});

