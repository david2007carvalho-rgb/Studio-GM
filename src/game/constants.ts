import type { AttributeKey, Difficulty, FilmGenre, Specialty } from "./types";

export const FREE_AGENT = -1;
export const RETIRED = -3;

export const PHASE_NAMES = [
	"Development",
	"Production",
	"Post-production",
	"Distribution",
	"Awards",
	"Off-season",
];

// Which attributes define each specialty. Used both to generate people
// (genAttributes boosts these) and to label them (genSpecialties).
export const SPECIALTY_ATTRIBUTES: Record<Specialty, AttributeKey[]> = {
	comedy: ["humour", "charisma", "audienceConnection"],
	dramatic: ["immersion", "emotionalRange", "technique"],
	romantic: ["charisma", "emotionalRange", "audienceConnection"],
	character: ["immersion", "emotionalRange", "originality"],
	action: ["charisma", "technique", "versatility"],
	auteur: ["vision", "originality", "technique"],
	visualStorytelling: ["vision", "technique", "immersion"],
	experimental: ["originality", "vision", "versatility"],
	commercial: ["charisma", "audienceConnection", "versatility"],
	versatile: ["versatility", "emotionalRange", "immersion"],
};

// Relative importance of the director vs. the cast when a movie is made.
export const DIRECTOR_SHARE = 0.4;
export const CAST_SHARE = 0.6;
export const CAST_SIZE = 3;
// Every film needs at least this many leads and this many supporting actors.
// With CAST_SIZE 3 that leaves 1 lead + 2 supporting, or 2 leads + 1 supporting.
export const MIN_LEADS = 1;
export const MIN_SUPPORTING = 1;

// Specialties that help in each genre.
export const GENRE_SPECIALTIES: Record<FilmGenre, Specialty[]> = {
	comedy: ["comedy", "commercial"],
	drama: ["dramatic", "character"],
	thriller: ["auteur", "visualStorytelling"],
	romance: ["romantic", "character"],
	action: ["action", "commercial"],
	horror: ["visualStorytelling", "experimental"],
	crime: ["dramatic", "auteur"],
	sciFiFantasy: ["experimental", "visualStorytelling"],
	adventure: ["action", "commercial"],
};

// ── Movie-sim tuning knobs (movie.ts) ──
export const SPECIALTY_GENRE_BONUS = 3; // rating points when a specialty matches the genre
export const VERSATILE_GENRE_BONUS = 1; // rating points in EVERY genre for the Versatile specialty (a matching specialty's +3 takes priority)
// ── Hidden mentor mechanic (mentor.ts) ──
export const MENTOR_GAIN = 0.25; // progress (0-1) a young actor makes per film: about 4 films to learn a specialty
export const MENTOR_START_AGE = 25; // from this age on, learning slows down
export const MENTOR_AGE_SLOWDOWN = 0.07; // extra slowness per year of age past MENTOR_START_AGE
export const MENTOR_MAX_AGE_FACTOR = 3; // the oldest actors learn 3x slower (about 12 films)
export const MENTOR_ATTR_BOOST = 8; // attribute points picked up per 1.0 of progress, towards the teacher's level
export const MENTOR_LEARNED_FLOOR = 70; // attributes of a newly learned specialty are at least this
export const MENTOR_DECAY = 0.85; // progress kept each off-season if they don't keep working with the teacher
export const MENTOR_PRUNE = 0.03; // progress below this is forgotten
// ── Audience score (movie.ts) ──
// Audiences care less about vision and originality than critics do: they want stars they like,
// and the skills that make the genre work (laughs for a comedy, spectacle for an action film).
export const AUDIENCE_WEIGHTS = { quality: 0.45, stars: 0.25, genreFeel: 0.3 };
export const AUDIENCE_NOISE = 4;
export const AUDIENCE_GENRE_ATTRS: Record<FilmGenre, AttributeKey[]> = {
	comedy: ["humour", "charisma"],
	drama: ["emotionalRange", "immersion"],
	thriller: ["immersion", "technique"],
	romance: ["charisma", "emotionalRange"],
	action: ["charisma", "technique"],
	horror: ["immersion", "originality"],
	crime: ["immersion", "technique"],
	sciFiFantasy: ["vision", "originality"],
	adventure: ["charisma", "versatility"],
};
// Word of mouth: a film audiences love earns a little more, one they dislike a little less.
export const AUDIENCE_WOM = { center: 60, per: 400, min: 0.9, max: 1.1 };

export const PRODUCTION_NOISE = 4; // randomness of the shoot
export const POST_NOISE = 3;
export const CRITIC_NOISE = 3;
export const DEFAULT_MARKETING_RATIO = 0.3; // marketing as a share of budget

// ── Studio / season knobs ──
export const BASE_PRODUCTION_COST = 15000; // sets, crew, equipment: every film pays this
export const STARTING_CASH = 80000;
export const BAILOUT_BELOW = 30000; // if cash is under this at the start of a year, investors step in
export const BAILOUT_REPUTATION_COST = 10;
export const SUPPORTING_AWARD_REPUTATION = 2; // reputation a studio gains for a supporting acting win (lead wins give 3)
export const TARGET_ACTORS = 120; // once random talent is switched on, the pool is topped up to these numbers each off-season
export const TARGET_DIRECTORS = 50;
// Newcomers arriving every off-season (on top of the top-up above), each drawn from NEWCOMER_TIERS in generate.ts.
export const NEW_ACTORS_PER_YEAR = [9, 13] as const; // [min, max]
export const NEW_DIRECTORS_PER_YEAR = [5, 7] as const;

// ── Real talent ──
// The game starts with real actors and directors (realTalent.ts). Invented people only
// start appearing from this season on, so the real generation has time to age and retire first.
export const RANDOM_TALENT_START_SEASON = 2027; // newcomers arrive from the very first off-season, so the pool is replenished while the real generation ages
// Retirement: chance per year = (age - start) * rate, once age > start.
export const RETIRE_START_AGE = { actor: 68, director: 76 };
export const RETIRE_RATE = 0.05;

// ── Economy knobs ──
export const MARKET_BASE = 30000; // revenue of a film with curve = 1.0, regardless of its budget
export const EXTRA_BUDGET_MAX_BONUS = 8; // max production-quality points that extra budget can buy
export const EXTRA_BUDGET_SCALE = 25000; // extra budget at which ~63% of that bonus is reached

// ── Chemistry (chemistry.ts) ──
// People who have already made films together work better together. Each returning pair
// (director + actor, or two actors) adds "chemistry units"; the units become a quality bonus,
// but only in proportion to how good the film already is, so great teams profit the most.
export const CHEMISTRY_MAX = 4; // most production-quality points chemistry can ever add
export const CHEMISTRY_CAP_UNITS = 5; // units for the full bonus: a trio that has made 3 films together is close to it
export const CHEMISTRY_DIRECTOR_ACTOR = 1; // weight of a returning director + actor pair
export const CHEMISTRY_ACTOR_ACTOR = 0.7; // weight of a returning actor + actor pair
// A pair's strength after k shared films is 1 - 0.5^k: 50%, 75%, 87%... (diminishing returns)
// Scaling by film quality: nothing at CHEMISTRY_GATE.low or below, everything at high or above.
export const CHEMISTRY_GATE = { low: 50, high: 90 };

// ── Franchises (franchise.ts) ──
// A sequel's box office and critic score are a BLEND of its own result and the prequel's:
//   result = (1 - weight) * own + weight * (prequel * installment growth)
// A blend can never snowball: a sequel is always pulled back toward its own quality.
// Bringing back the same director and cast raises the weight (continuity 0 -> min, 1 -> max).
export const FRANCHISE_MONEY_WEIGHT = { min: 0.25, max: 0.45 };
export const FRANCHISE_CRITIC_WEIGHT = { min: 0.15, max: 0.3 };
// How much of the prequel's audience carries over: part 2 = 1.5x, then it fades by 0.2 per part.
export const FRANCHISE_GROWTH_FIRST = 1.5;
export const FRANCHISE_GROWTH_DROP = 0.2;
export const FRANCHISE_GROWTH_FLOOR = 0.7;
export const FRANCHISE_CARRYOVER_CAP = 150000; // at most this much of a prequel's gross carries over ($150M)
// "Sequel fatigue": critics lose this many points per installment after the first, up to the max.
export const FRANCHISE_FATIGUE = 1.5;
export const FRANCHISE_FATIGUE_MAX = 9;
// Rival studios
export const MOVIES_PER_SEASON = 10; // films released each year, yours included (rivals make the rest)
export const MAX_ACTOR_FILMS = 3; // most films one actor can be in per season. Directors can only make one.
export const AI_SEQUEL_CHANCE = 0.35; // chance a rival with a past hit makes a sequel
export const AI_MAX_INSTALLMENTS = 4;

// ── Pitching ──
// An actor who refuses your studio can be pitched: you offer extra salary and they roll the dice, once per season.
//   chance = 0.5 + (premium - gap * PITCH_GAP_COST) * PITCH_SLOPE, kept between PITCH_MIN_CHANCE and PITCH_MAX_CHANCE
// gap = reputation they need - reputation you have. Past PITCH_MAX_GAP they will not even take the meeting.
export const PITCH_PREMIUMS = [0.25, 0.5, 1, 1.5, 2]; // offers you can make, as a share of their normal salary
export const PITCH_GAP_COST = 0.06; // premium that one missing reputation point costs to stay at 50%
export const PITCH_SLOPE = 1.25;
export const PITCH_MIN_CHANCE = 0.02;
export const PITCH_MAX_CHANCE = 0.95;
export const PITCH_MAX_GAP = 35;

// ── Director pitches (directorPitches.ts) ──
// Every Development phase some directors bring you a film and ask for funding: a title, a genre,
// a wish list of actors and a budget. You fund it, counter-offer, or pass.
export const DIRECTOR_PITCHES = [3, 5] as const; // [min, max] pitches per season
export const DIRECTOR_PITCH_POOL = [8, 12] as const; // size of the wish list (about 10)
export const DIRECTOR_PITCH_EXTRA = [0, 25000] as const; // money (thousands) the director wants for sets and effects, on top of salaries and base costs
export const DIRECTOR_PITCH_SLACK = 1.3; // the ask assumes the cast costs this much more than the wish list's average price
export const DIRECTOR_PITCH_RESERVE = [0.7, 0.92] as const; // the lowest share of the ask a director accepts (hidden; shown as flexible / reasonable / firm)
export const DIRECTOR_PITCH_ROUNDS = 2; // counter-offers you may make: after this many refusals the director walks away
export const DIRECTOR_PITCH_RIVAL_CHANCE = 0.5; // chance a rival makes a film you passed on (or lost by haggling)

// ── Difficulty ──
// Refusals: a person needs your studio's reputation to be at least
//   (their overall - refusalFloor) * refusalSlope
// before they agree to work for you. refusalFloor = null means nobody ever refuses.
// Example, hard: an 80-overall star needs reputation (80 - 62) * 2.5 = 45.
export const DIFFICULTY_SETTINGS: Record<
	Difficulty,
	{ label: string; description: string; startingCash: number; refusalFloor: number | null; refusalSlope: number }
> = {
	easy: {
		label: "Easy",
		description: "Start with $150M. Every actor and director will work with you.",
		startingCash: 150000,
		refusalFloor: null,
		refusalSlope: 0,
	},
	normal: {
		label: "Normal",
		description: "Start with $80M. Only the biggest superstars turn down a studio with a weak reputation.",
		startingCash: 80000,
		refusalFloor: 70,
		refusalSlope: 2,
	},
	hard: {
		label: "Hard",
		description: "Start with $50M. Better actors and directors refuse you until your reputation is high enough.",
		startingCash: 50000,
		refusalFloor: 62,
		refusalSlope: 2.5,
	},
};

// Whatever happens, the weakest few of each role always accept, so you can never get stuck.
export const ALWAYS_WILLING = { director: 3, actor: 6 };

// ── Licensed IPs (ip.ts, ipData.ts) ──
// How much of an IP's awards penalty (Ip.awardsPenalty in ipData.ts) each award feels. Voters snub blockbusters most for Best Picture, least for acting.
export const AWARDS_PENALTY_WEIGHT = { picture: 1, director: 0.6, acting: 0.4 };

export const IP_START_GOODWILL = 50; // fan goodwill when you buy the rights (0-100)
export const IP_BOOST_SCALE = 0.85; // global dial on every IP's boost (1 = as listed in ipData.ts)
export const IP_GOODWILL_SPAN = 0.4; // boost scales by 0.6 (goodwill 0) .. 1.0 (goodwill 50) .. 1.4 (goodwill 100)
export const IP_HEAT_EXPECTATION = 8; // critic points added to the fans' bar per +1.0 of property heat
export const IP_OPENING_RUSH = 0.05; // extra opening-weekend share for licensed films (fans show up on day one)
export const IP_BACKLASH_PER_POINT = 0.012; // box office lost per critic point below the fans' bar (x severity)
export const IP_BACKLASH_MAX = 0.3;
export const IP_ACCLAIM_PER_POINT = 0.008; // box office gained per critic point above the bar
export const IP_ACCLAIM_MAX = 0.08;
export const IP_REP_MET = 1; // reputation for meeting both expectations
export const IP_REP_MAX_LOSS = 8; // most reputation one disappointing film can cost
export const TEAMUP_UNLOCK = 2; // films you must have released in a universe before its crossover event unlocks
export const AI_IP_FIRST_SEASON = 2028; // rivals start buying rights from this season on
export const AI_IP_CASH_RATIO = 0.6; // a rival only buys if the price is at most this share of its cash
export const AI_IP_BUY_CHANCE = 0.5; // chance per off-season that one rival buys something
export const AI_IP_FILM_CHANCE = 0.5; // chance a rival that owns rights makes a licensed film instead of an original

// ── Trading IP rights (trade.ts) ──
export const TRADE_ROUNDS = 3; // offers you get with one rival per season before they walk away
// A rival that SELLS you rights asks (value x its mood) x one of these, and comes down a step after each miss.
export const TRADE_ASK_LADDER = [1.15, 1.07, 1];
// A rival that BUYS rights offers (its budget) x one of these, and goes up a step after each miss.
export const TRADE_BID_LADDER = [0.88, 0.95, 1];
export const TRADE_SELL_MOOD = { min: 1.05, span: 0.2 }; // reserve price of a rival seller = value x (min + span x its mood)
export const TRADE_BUY_MOOD = { min: 0.8, span: 0.25 }; // most a rival buyer will pay = value x (min + span x its mood)
export const TRADE_CASH_RATIO = 0.8; // a rival never pays more than this share of its cash
export const TRADE_MIN_INTEREST = 0.5; // a rival that can only afford less than this share of the value is not interested
export const TRADE_LOWBALL = 0.75; // an offer below this share of their position (or above 1/this on a sale) insults them
export const TRADE_MAX_LICENSES = 3; // rivals will not hold more IPs than this
export const TRADE_QUICK_SALE = 0.6; // "sell now" pays this share of the value
export const TRADE_OFFER_CHANCE = 0.3; // chance per off-season that a rival makes an unprompted offer for one of your IPs
export const TRADE_MAX_OFFERS = 2;

// ── Streaming (streaming.ts, streamingData.ts) ──
// Worth of a released film to a platform (used for licence and renewal offers).
export const STREAM_BASE_FEE = 2000; // thousands of $: every film is worth at least this before the platform's own scale
export const STREAM_GROSS_SHARE = 0.08; // share of the box office that goes into a film's streaming worth
export const STREAM_BUDGET_SHARE = 0.25; // share of the budget that goes into a film's streaming worth
export const STREAM_MIN_FEE = 300;
export const STREAM_AGE_DECAY = 0.12; // a film loses this share of its streaming worth for every season since release
export const STREAM_AGE_FLOOR = 0.5;
export const STREAM_MOOD = { min: 0.92, span: 0.2 }; // most a platform pays = worth x (min + span x its mood)
// Offers (the only way to sell a film that is already released).
export const STREAM_MAX_PER_SEASON = 2; // most films one platform will take from you in a season
export const STREAM_OFFER_CHANCE = 0.3; // chance per platform and eligible film that an unprompted offer arrives in the off-season
export const STREAM_MAX_OFFERS = 5; // new-licence offers per off-season (renewal offers do not count)
export const STREAM_MAX_OFFERS_PER_FILM = 2; // platforms can bid against each other for one film
export const STREAM_SLATE_FULL_CHANCE = 0.12; // chance that a platform has no room for a new original this season (fixed per platform and season)
// How a licence offer's money is split: share of the film's worth paid up front, and per year.
export const STREAM_LICENCE_UPFRONT = 0.45;
export const STREAM_LICENCE_ANNUAL = 0.1;
export const STREAM_RENEWAL_UPFRONT = 0.2; // a renewal bonus, +10% for each earlier renewal
export const STREAM_RENEWAL_ANNUAL = 0.09;
// Contract length (inclusive random range, in off-seasons).
export const STREAM_YEARS = [4, 5] as const;
export const STREAM_RENEWAL_YEARS = [3, 4] as const; // renewals are shorter
// Contracts for films backed from the greenlight (originals).
export const STREAM_ORIGINAL_ANNUAL_BASE = 500; // yearly payment = (this + share of budget) x the platform's scale, before audience and release mode
export const STREAM_ORIGINAL_ANNUAL_BUDGET = 0.025;
export const STREAM_FINANCE_MAX = 0.7; // a platform never pays more than this share of a budget
export const STREAM_FINANCE_SCALE = 0.75; // global knob: every platform's financing share is multiplied by this
// What each demand adds to the yearly payment (the platform pays more for strings it attaches).
export const STREAM_DEMAND_PREMIUM = { exclusive: 1.2, quota: 1.08, wideCap: 1.05, wideMin: 1.05, reputation: 1 };
export const STREAM_BREACH_REPUTATION = 1.5; // reputation lost for each broken demand when a contract ends
// Release modes (see releaseFx in streaming.ts). `s` is the platform's theatrical stance, -1 (hates cinemas) to +1 (loves them).
export const STREAM_FX = {
	wideFinance: 0.4, // wide release: financing x (1 + this x s)
	wideBox: 0.12, // box office x (1 + this x s): a platform that loves cinemas promotes the release, one that does not neglects it
	wideAnnual: 0.3, // yearly payment x (1 + this x s)
	wideMarketing: 0.3, // share of your marketing a cinema-loving platform co-funds (x s)
	limitedBox: 0.4, // a limited run keeps this share of the wide box office
	limitedFinance: 0.1,
	limitedAnnual: 0.1,
	limitedMarketing: 0.5, // share of your marketing the platform pays for a limited run
	limitedAwards: 1.5, // awards points
	limitedFestival: 1.5, // festival push chance multiplier
	streamingFinance: 0.5, // streaming premiere: financing x (1 - this x s)
	streamingAnnual: 0.5, // yearly payment x (1 - this x s)
	streamingPayout: [0.4, 0.2] as const, // the platform pays this + this x its reach of the simulated gross as a viewership payout
	streamingAwards: -4, // awards voters snub films that skip cinemas
	streamingRep: 0.75, // reputation gains from the film are scaled by this (little buzz without a release)
	favouredFinance: 1.1, // the release mode a platform prefers: financing and yearly payment bonus
	favouredAnnual: 1.05,
};
export const STREAM_FESTIVALS_ENTERED = 3; // festivals a platform enters your film in when it campaigns it
export const STREAM_FESTIVAL_REPUTATION = 0.8; // reputation per festival prize
export const STREAM_FESTIVAL_CASH = 400; // thousands of $ of prize money and sales per festival prize

export const FRANCHISE_IP_MIN_FILMS = 2; // released films a franchise needs before it can be sold as an IP
