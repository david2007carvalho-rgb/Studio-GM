import type { FilmGenre, Perk, ReleaseMode } from "./types";

// ═════════════════════════════════════════════════════════════
// The streaming platforms. Each has its own wallet, taste and quirks (see streaming.ts for the maths).
// Money is in thousands of $. The platforms are real services; their numbers here are invented for the game.
// ═════════════════════════════════════════════════════════════

/** What a platform insists on before it will even talk about a film. Everything is optional. */
export type Demands = {
	minCritic?: number;
	minAudience?: number;
	minGross?: number; // box office, thousands of $
	maxGross?: number; // too big a hit for a small platform's budget
	minBudget?: number;
	maxBudget?: number;
	avoidGenres?: FilmGenre[];
	onlyGenres?: FilmGenre[];
};

/** What strings a platform likes to attach to a contract. Each entry is the chance it shows up (see genTerms in streaming.ts). */
export type DemandStyle = {
	exclusive?: number;
	quota?: { genres: FilmGenre[]; count: [number, number]; chance: number };
	wideCap?: { max: number; chance: number };
	wideMin?: { min: number; chance: number };
	reputation?: { min: number; chance: number };
};

export type Platform = {
	id: string;
	name: string;
	emoji: string;
	tagline: string;
	quirk: string; // one line on what makes this platform different
	scale: number; // how deep its pockets are: multiplies what it pays (1 = average)
	reach: number; // 0-1: how big its audience is. Drives the yearly viewership bonus
	prestige: number; // 0-1: how much a deal with it does for your studio's reputation
	criticWeight: number; // 0-1: share of its verdict that comes from critics (the rest is the audience score)
	genres: Partial<Record<FilmGenre, number>>; // price multiplier per genre (missing = 1)
	franchiseLove?: number; // price multiplier for sequels and licensed-IP films (missing = 1)
	festivalPush?: number; // 0-1: how hard it campaigns your film at festivals (see streaming.ts)
	demands: Demands; // for a film that is already released (licence offers)
	// ── the greenlight side: backing a film before it is made ──
	theatrical: number; // -1..1: how much it likes cinemas. Shapes financing, box office and the yearly payment for each release mode
	favoured: ReleaseMode; // the release it likes best
	releaseNote: string; // one line on what it thinks of cinemas
	financeShare: number; // share of a film's budget it pays for a film it backs (before the release mode)
	pitch: { minRep: number; minFit: number }; // studio reputation and team fit for the genre it wants before it backs a film
	perks: Partial<Record<Perk["kind"], number>>; // how likely each perk is in its contracts (relative weights)
	style: DemandStyle;
};

export const PLATFORMS: Platform[] = [
	{
		id: "netflix",
		name: "Netflix",
		emoji: "🔴",
		tagline: "The giant. Big films that millions of people actually press play on.",
		quirk: "Pays for audience appeal over critics, loves action and thrillers, and gives the biggest viewership bonuses. Wants films that already proved they can draw a crowd.",
		scale: 1.5,
		reach: 1,
		prestige: 0.45,
		criticWeight: 0.3,
		genres: { action: 1.2, thriller: 1.15, comedy: 1.15, crime: 1.15, romance: 1.1, sciFiFantasy: 1.1, adventure: 1.1, drama: 0.95, horror: 1 },
		franchiseLove: 1.15,
		demands: { minGross: 20000, minAudience: 62 },
		theatrical: -0.6,
		favoured: "streaming",
		releaseNote: "Cinemas are a hard sell: a wide release costs you financing and yearly money and it will not promote it. A streaming premiere gets the most financing and the biggest yearly payment, but voters snub it.",
		financeShare: 0.45,
		pitch: { minRep: 32, minFit: 55 },
		perks: { slatePromo: 1, awardsPush: 2, franchise: 2, ipDiscount: 1, talentAccess: 2, prestige: 0.5 },
		style: { exclusive: 0.25, quota: { genres: ["action", "thriller", "comedy", "crime"], count: [1, 2], chance: 0.7 }, wideCap: { max: 2, chance: 0.8 }, reputation: { min: 40, chance: 0.3 } },
	},
	{
		id: "prime",
		name: "Prime Video",
		emoji: "📦",
		tagline: "A balanced buyer with deep pockets and a taste for thrillers and adventure.",
		quirk: "Looks at critics and audiences equally. Pays a premium for films built on a licensed IP.",
		scale: 1.3,
		reach: 0.85,
		prestige: 0.5,
		criticWeight: 0.5,
		genres: { thriller: 1.15, crime: 1.15, action: 1.1, adventure: 1.1, sciFiFantasy: 1.1, drama: 1, comedy: 0.95 },
		franchiseLove: 1.2,
		demands: { minCritic: 55, minAudience: 55 },
		theatrical: 0.2,
		favoured: "wide",
		releaseNote: "Happy with a proper cinema run and co-funds a little of the marketing. Streaming-first pays a bit less.",
		financeShare: 0.4,
		pitch: { minRep: 38, minFit: 58 },
		perks: { slatePromo: 2, ipDiscount: 3, franchise: 2, talentAccess: 1, awardsPush: 1, prestige: 1 },
		style: { exclusive: 0.15, quota: { genres: ["thriller", "crime", "adventure", "action"], count: [1, 1], chance: 0.6 }, reputation: { min: 45, chance: 0.5 } },
	},
	{
		id: "disney",
		name: "Disney+",
		emoji: "🏰",
		tagline: "Family brand. Adventure, fantasy and franchises are home; horror is not.",
		quirk: "Refuses horror outright and pays little for crime and thrillers, but pays a big premium for sequels and licensed IP.",
		scale: 1.35,
		reach: 0.9,
		prestige: 0.55,
		criticWeight: 0.4,
		genres: { adventure: 1.3, sciFiFantasy: 1.25, action: 1.1, comedy: 1.1, romance: 1, drama: 0.85, thriller: 0.8, crime: 0.7 },
		franchiseLove: 1.3,
		demands: { avoidGenres: ["horror"], minAudience: 58 },
		theatrical: 0.7,
		favoured: "wide",
		releaseNote: "Cinemas are the brand: a wide release gets the most financing, a box-office push and marketing money. Skipping them costs you financing and yearly money.",
		financeShare: 0.4,
		pitch: { minRep: 38, minFit: 55 },
		perks: { slatePromo: 3, franchise: 3, ipDiscount: 3, prestige: 1, awardsPush: 0.5, talentAccess: 1 },
		style: { exclusive: 0.3, quota: { genres: ["adventure", "sciFiFantasy", "comedy"], count: [1, 2], chance: 0.7 }, wideMin: { min: 2, chance: 0.85 }, reputation: { min: 45, chance: 0.4 } },
	},
	{
		id: "max",
		name: "Max",
		emoji: "🟣",
		tagline: "Prestige drama and crime. If critics love it, Max wants it.",
		quirk: "Pays by the critics' verdict and nothing else: demands critics 70+. Small audience, so the viewership bonus is modest.",
		scale: 1.1,
		reach: 0.6,
		prestige: 0.85,
		criticWeight: 0.75,
		genres: { drama: 1.25, crime: 1.25, thriller: 1.1, sciFiFantasy: 1.1, comedy: 0.9, adventure: 0.9 },
		festivalPush: 0.1,
		demands: { minCritic: 70 },
		theatrical: 0.1,
		favoured: "limited",
		releaseNote: "Likes a short prestige run in cinemas: critics notice and it adds to the awards campaign. Neutral on wide releases.",
		financeShare: 0.3,
		pitch: { minRep: 42, minFit: 65 },
		perks: { awardsPush: 3, prestige: 3, talentAccess: 2, franchise: 1, slatePromo: 0.5, ipDiscount: 0.5 },
		style: { exclusive: 0.2, quota: { genres: ["drama", "crime", "thriller"], count: [1, 2], chance: 0.7 }, reputation: { min: 50, chance: 0.6 } },
	},
	{
		id: "apple",
		name: "Apple TV+",
		emoji: "🍎",
		tagline: "The richest wallet in town, spent only on polished, prestigious films.",
		quirk: "Pays the most per film and does the most for your reputation, but only for critics 75+ and a real production budget. Few people watch, so the viewership bonus is small.",
		scale: 1.8,
		reach: 0.45,
		prestige: 1,
		criticWeight: 0.8,
		genres: { drama: 1.2, sciFiFantasy: 1.15, comedy: 1.1, thriller: 1.1, crime: 1.1, romance: 1, action: 0.9, horror: 0.8 },
		festivalPush: 0.1,
		demands: { minCritic: 75, minBudget: 25000 },
		theatrical: 0.3,
		favoured: "limited",
		releaseNote: "Wants a prestige run in a few cinemas, not a blockbuster one: a limited release gets the best financing and a real awards campaign.",
		financeShare: 0.5,
		pitch: { minRep: 55, minFit: 70 },
		perks: { awardsPush: 3, prestige: 3, talentAccess: 3, ipDiscount: 1, slatePromo: 0.5 },
		style: { exclusive: 0.4, quota: { genres: ["drama", "sciFiFantasy", "thriller", "comedy"], count: [1, 1], chance: 0.6 }, reputation: { min: 55, chance: 0.8 }, wideMin: { min: 1, chance: 0.3 } },
	},
	{
		id: "paramount",
		name: "Paramount+",
		emoji: "⛰️",
		tagline: "Sequels, spin-offs and big noisy crowd-pleasers.",
		quirk: "Pays a big premium for sequels and licensed IP. Mostly cares that something is a recognisable brand with a following.",
		scale: 1,
		reach: 0.55,
		prestige: 0.4,
		criticWeight: 0.4,
		genres: { action: 1.2, adventure: 1.2, comedy: 1.1, sciFiFantasy: 1.1, drama: 0.9, romance: 0.9 },
		franchiseLove: 1.25,
		demands: { minGross: 10000 },
		theatrical: 0.6,
		favoured: "wide",
		releaseNote: "Big noisy cinema releases are its thing: wide gets more financing, a box-office push and marketing money. A streaming premiere wastes the brand.",
		financeShare: 0.35,
		pitch: { minRep: 32, minFit: 52 },
		perks: { slatePromo: 3, franchise: 3, ipDiscount: 2, talentAccess: 1, prestige: 0.5, awardsPush: 0.3 },
		style: { exclusive: 0.2, quota: { genres: ["action", "adventure", "comedy"], count: [1, 2], chance: 0.7 }, wideMin: { min: 2, chance: 0.8 } },
	},
	{
		id: "peacock",
		name: "Peacock",
		emoji: "🦚",
		tagline: "Budget-conscious. Comedy and horror on the cheap.",
		quirk: "Will not touch an expensive film (budget up to $45M) but pays well for comedy and horror, and rarely haggles hard.",
		scale: 0.85,
		reach: 0.5,
		prestige: 0.3,
		criticWeight: 0.4,
		genres: { comedy: 1.3, horror: 1.2, crime: 1.1, action: 1, drama: 0.85, sciFiFantasy: 0.9 },
		demands: { maxBudget: 45000 },
		theatrical: -0.3,
		favoured: "streaming",
		releaseNote: "Prefers to skip cinemas, which saves everyone marketing money. A wide release gets less financing and no help.",
		financeShare: 0.3,
		pitch: { minRep: 20, minFit: 48 },
		perks: { slatePromo: 2, talentAccess: 2, ipDiscount: 2, franchise: 1, prestige: 0.5, awardsPush: 0.5 },
		style: { exclusive: 0.1, quota: { genres: ["comedy", "horror", "crime"], count: [1, 2], chance: 0.8 }, wideCap: { max: 3, chance: 0.5 } },
	},
	{
		id: "hulu",
		name: "Hulu",
		emoji: "🟢",
		tagline: "Grown-up comedy, drama, crime and romance.",
		quirk: "Skips kids' adventure and big spectacle, but pays well for adult stories with a following.",
		scale: 0.95,
		reach: 0.6,
		prestige: 0.45,
		criticWeight: 0.5,
		genres: { comedy: 1.2, romance: 1.15, drama: 1.1, crime: 1.1, thriller: 1.05, adventure: 0.7, sciFiFantasy: 0.85 },
		demands: { minAudience: 55 },
		theatrical: -0.4,
		favoured: "streaming",
		releaseNote: "A streaming service first: a premiere on Hulu earns more money and it covers the marketing. It sees little point in a wide release.",
		financeShare: 0.3,
		pitch: { minRep: 28, minFit: 52 },
		perks: { slatePromo: 1.5, awardsPush: 1, talentAccess: 2, franchise: 1, prestige: 1, ipDiscount: 1 },
		style: { exclusive: 0.15, quota: { genres: ["comedy", "drama", "romance", "crime"], count: [1, 2], chance: 0.7 }, wideCap: { max: 2, chance: 0.6 } },
	},
	{
		id: "mubi",
		name: "MUBI",
		emoji: "🎞️",
		tagline: "Small, strange, beautiful films, and a festival circuit that notices them.",
		quirk: "Pays little and wants small films with critics 65+, but campaigns them at festivals: prizes there build your reputation and add bonus money.",
		scale: 0.35,
		reach: 0.12,
		prestige: 0.8,
		criticWeight: 0.9,
		genres: { drama: 1.3, romance: 1.2, horror: 1.1, crime: 1, sciFiFantasy: 1, comedy: 0.8, action: 0.5, adventure: 0.4 },
		festivalPush: 0.5,
		demands: { minCritic: 65, maxBudget: 25000, maxGross: 40000 },
		theatrical: -0.2,
		favoured: "limited",
		releaseNote: "Small art-house runs and festivals are the point: a limited release gets the best deal and critics notice. A wide release is pointless.",
		financeShare: 0.15,
		pitch: { minRep: 20, minFit: 60 },
		perks: { awardsPush: 3, prestige: 3, talentAccess: 2 },
		style: { exclusive: 0.1, quota: { genres: ["drama", "romance", "horror"], count: [1, 1], chance: 0.6 }, wideCap: { max: 1, chance: 0.9 } },
	},
];

export const platformById = (id: string): Platform | undefined => PLATFORMS.find((p) => p.id === id);

/** Festivals a film can be entered in, with the prize it can take. Small festivals first: they are the ones MUBI favours. */
export const FESTIVALS: { name: string; prize: string }[] = [
	{ name: "Locarno", prize: "Golden Leopard" },
	{ name: "Rotterdam", prize: "Tiger Award" },
	{ name: "San Sebastián", prize: "Golden Shell" },
	{ name: "Sundance", prize: "Grand Jury Prize" },
	{ name: "Karlovy Vary", prize: "Crystal Globe" },
	{ name: "Venice Orizzonti", prize: "Best Film" },
	{ name: "Cannes Un Certain Regard", prize: "Jury Prize" },
	{ name: "Tribeca", prize: "Founders Award" },
];
