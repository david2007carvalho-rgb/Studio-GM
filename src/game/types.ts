// ─────────────────────────────────────────────────────────────
// types.ts — the "shape" of all the data in the game.
// In TypeScript, a `type` describes what an object looks like.
// Nothing here runs; it only helps the editor catch mistakes.
// ─────────────────────────────────────────────────────────────

import type { Ip } from "./ipData";

// The 9 attributes, shared by actors and directors.
// `as const` makes this a fixed list, so TypeScript knows the exact strings.
export const ATTRIBUTE_KEYS = [
	"charisma",
	"immersion",
	"humour",
	"versatility",
	"vision",
	"technique",
	"emotionalRange",
	"originality",
	"audienceConnection",
] as const;

// "charisma" | "immersion" | ...  (built automatically from the list above)
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

// An object with one number (0-100) for each attribute.
export type ProductionRatings = Record<AttributeKey, number>;

export type Gender = "male" | "female";

export type ProductionRole = "actor" | "director";

export const GENRES = [
	"comedy",
	"drama",
	"thriller",
	"romance",
	"action",
	"horror",
	"crime",
	"sciFiFantasy",
	"adventure",
] as const;
export type FilmGenre = (typeof GENRES)[number];

export type Specialty =
	| "comedy"
	| "dramatic"
	| "romantic"
	| "character"
	| "action"
	| "auteur"
	| "visualStorytelling"
	| "experimental"
	| "commercial"
	| "versatile";

// Billing of an actor in one specific film. The same person can be a lead in one film
// and a supporting actor in the next.
export type CastRole = "lead" | "supporting";

/**
 * Personality traits (see traits.ts). They feed the drama engine: who you cast changes which events happen on your films.
 * A person's traits are hidden at first; they come out through the news, or by working with them.
 */
export const TRAIT_IDS = ["diva", "workaholic", "injuryProne", "loyal", "scandalProne", "mentor", "peacemaker", "darling"] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

/**
 * Scripts (see scripts.ts). Every film starts from one. Each has a style with its own strengths, and a quality (its own stat, 0-100).
 */
export const SCRIPT_STYLES = ["highConcept", "characterDriven", "crowdPleaser", "riskyOriginal"] as const;
export type ScriptStyle = (typeof SCRIPT_STYLES)[number];

/** A script on the market this season (GameState.scripts). Pick one when you greenlight a film. */
export type Script = {
	id: number;
	season: number;
	genre: FilmGenre;
	style: ScriptStyle;
	quality: number; // 0-100: how good the pages are
	price: number; // thousands of $, paid on top of the budget
	writer: string;
	logline: string;
};

/** The script a film was made from (Movie.script). */
export type ScriptInfo = {
	style: ScriptStyle;
	quality: number; // what the pages read like when you bought it
	writer: string;
	logline: string;
	landed?: number; // how it turned out on the shoot (a risky script swings far from `quality`). Filled in when production is simulated
	own?: boolean; // the director's own script that came with a funded pitch (no fee)
};

/**
 * A lasting relationship between two people (see rivalries.ts). Born in the drama (a feud on set, a cast clash) or in the tabloids,
 * it follows them from season to season. A feud costs a film that casts both; frenemies make it better.
 */
export type BondKind = "feud" | "frenemies";
export type Bond = {
	a: number; // pid (the smaller one)
	b: number; // pid
	kind: BondKind;
	heat: number; // 0-100: how intense it is. Cools down when they do not work together
	since: number; // season it began
	last: number; // last season it flared up or they worked together
};
/** What a bond did to one film (Movie.tension). */
export type Tension = { a: number; b: number; kind: BondKind; prod: number };

export type Contract = {
	amount: number; // salary per movie, in thousands of dollars
	exp: number; // last season the contract is valid for
};

export type Person = {
	pid: number; // unique id ("player id" in ZenGM)
	name: string;
	role: ProductionRole;
	gender: Gender;
	age: number;
	attrs: ProductionRatings; // current attributes
	specialties: Specialty[]; // labels derived from attrs (see genSpecialties)
	traits?: TraitId[]; // personality (see traits.ts). Missing in older saves: assigned when the save is loaded
	knownTraits?: TraitId[]; // the traits the player has discovered (a trait can be known to everyone from the start, or come out in the news)
	mentoring?: Partial<Record<Specialty, number>>; // hidden progress (0-1) towards learning a specialty from castmates (see mentor.ts)
	pot: number; // estimated potential (overall rating they may reach)
	contract: Contract;
	tid: number; // which studio employs them. FREE_AGENT (-1) = nobody
	peak?: { ovr: number; attrs: ProductionRatings }; // best overall they ever had, with the attributes of that moment (see peakOf in develop.ts). Missing in older saves: starts tracking from the next off-season
	history?: { season: number; ovr: number }[]; // overall rating at the start of each season, for the career graph. Missing in older saves: starts recording from the next off-season
	real?: boolean; // true for people from the real-world starting roster (realTalent.ts)
};

export type Movie = {
	mid: number;
	tid: number; // studio that makes the film
	title: string;
	genre: FilmGenre;
	season: number;
	budget: number; // thousands of $, salaries included
	marketing?: number; // thousands of $; defaults to 30% of budget
	directorPid: number;
	castPids: number[];
	backend?: { pid: number; pct: number }[]; // backend deals signed for this film (see negotiate.ts): each person gets pct % of the box office
	backendPaid?: number; // thousands of $ paid out once the film grossed
	leadPids?: number[]; // the members of castPids who play leads; the others are supporting. Missing in older saves = everyone is a lead
	// Filled in as the movie moves through phases:
	productionQuality?: number;
	postQuality?: number;
	boxOffice?: number;
	criticScore?: number;
	audienceScore?: number; // what regular audiences thought, 0-100 (see audienceScore in movie.ts). Missing in older saves
	// Franchise (see franchise.ts). All optional: a film with none of these is a standalone original.
	prequelMid?: number; // the film this one continues
	franchiseId?: number; // mid of the first film in the franchise (missing on that first film itself)
	installment?: number; // 2 = first sequel, 3 = second sequel... (missing = 1)
	chemistry?: number; // production-quality points added by returning duos (see chemistry.ts)
	continuity?: number; // 0-1: share of the prequel's director + cast that came back
	standaloneBoxOffice?: number; // what it would have made with no franchise link (for display)
	standaloneCritic?: number;
	opening?: number; // opening-weekend gross, thousands of $ (see simOpening in movie.ts). Missing in older saves
	// Licensed IP (see ip.ts). All optional: a film with none of these is made from an original idea.
	ipId?: string; // the universe, e.g. "marvel"
	propertyId?: string; // the hero or story inside it, e.g. "marvel:spider-man"
	licenseFee?: number; // thousands of $ paid to the rights holder for this film
	pitchExtra?: number; // thousands of $ of the budget that is pitch premiums paid to actors (salary, not production value)
	directorPitchId?: number; // the director's pitch this film came from (see directorPitches.ts). Missing = not a pitched film
	passedPitch?: boolean; // a rival made this film after you turned the pitch down (the one that got away)
	ipResult?: IpResult; // filled in at release: boost, fan reaction, reputation
	// Streaming partner (see streaming.ts). All optional: a film with none of these has no platform behind it and is released wide.
	streamPlatformId?: string; // the platform that backs this film from the greenlight on
	release?: ReleaseMode; // how it is released (missing = wide theatrical)
	financing?: number; // thousands of $ of the budget the platform pays (subtracted from what the film costs you)
	platformMarketing?: number; // thousands of $ of the marketing the platform pays
	awardsDelta?: number; // points its release mode added to (or took off) its awards score (see streaming.ts)
	streamTerms?: StreamTerms; // the contract it will sign when the film is released (annual is the base: it is scaled by the audience score)
	script?: ScriptInfo; // the script it was made from (see scripts.ts). Missing in older saves = a neutral script
	tension?: Tension[]; // feuds and frenemies among its director and cast, and what each did to the shoot (see rivalries.ts). Missing = none
	scriptFee?: number; // thousands of $ paid for the script, on top of the budget
	drama?: DramaRecord[]; // things that went on during the making and release of the film (see news/drama.ts). Missing = a quiet film
	// Brand deals (see brands.ts). All optional: a film with none of these has no sponsors.
	brands?: BrandPlacement[]; // the brands that placed products in the film or presented it
	brandFunding?: number; // thousands of $ the brands pay towards the cost when production starts (subtracted in movieCost)
	brandBonus?: number; // thousands of $ settled after release: a hit bonus (positive) or a make-good you owe (negative)
	brandFx?: { critic: number; gross: number; heat: number }; // what the brands did at release: critic points (negative = lost), gross multiplier (1.04 = +4%), franchise-heat multiplier
};

/**
 * One piece of drama on a film's road to the screen (a feud, an injury, a leaked trailer...). Some change the film, some are only gossip.
 * Production and post-production events change the quality of the film when they happen; `gross` and `critic` are applied at release.
 */
export type DramaRecord = {
	key: string; // which kind of event
	stage: "production" | "post" | "release";
	label: string; // short name for the film page, e.g. "On-set feud"
	effect: "hurt" | "helped" | "none"; // what it did to the film
	note: string; // one line for the film page
	prod?: number; // production-quality points added (negative = lost)
	post?: number; // post-production-quality points
	who?: number; // pid of the person the event was about
	bond?: BondKind; // the feud or friendship this event started, renewed or (for "none") calmed
	trait?: TraitId; // the trait of theirs that made it likelier (shown on the film page once the trait is known)
	cost?: number; // fraction of the budget the studio had to pay on top (0.1 = 10%)
	gross?: number; // box-office multiplier at release (1.05 = +5%)
	critic?: number; // critic-score points at release
};

/** How a film reaches its audience. Streaming platforms care a lot about this (see streaming.ts). */
export type ReleaseMode = "wide" | "limited" | "streaming";

/** What a licensed IP did for (or to) a film when it was released. */
export type IpResult = {
	boost: number; // box-office multiplier the IP gave (1.4 = +40%)
	lift: number; // thousands of $ the boost added
	expectCritic: number; // critic score the fans expected
	expectGross: number; // box office the fans expected, thousands of $
	reaction: number; // fan reaction on the gross: below 1 = backlash, above 1 = acclaim
	reputation: number; // studio reputation points gained or lost because of expectations
	goodwillDelta: number; // change in fan goodwill for this IP
	metCritic: boolean;
	metGross: boolean;
};

/** A studio owns the rights to one IP. Rights are exclusive: only one studio can hold each IP. */
export type License = {
	ipId: string;
	tid: number;
	since: number; // season bought
	goodwill: number; // 0-100 fan goodwill. Starts neutral; hits raise it, flops lower it. Scales the boost.
};

/**
 * Talks between you and one rival about the rights to one IP (see trade.ts).
 * `side` is what YOU are doing: "buy" = you want the rival's rights, "sell" = you offer yours to the rival.
 */
export type Deal = {
	ipId: string;
	rivalTid: number;
	side: "buy" | "sell";
	round: number; // offers made so far; the rival walks away after TRADE_ROUNDS
	step: number; // how many times the rival has given ground (a lowball uses up a round without moving them)
	blockedUntil?: number; // the rival walked away: no talks again before this season
};

/** A rival's unprompted offer for one of your IPs. Offers only last for the off-season they were made in. */
export type IpOffer = {
	id: number;
	ipId: string;
	fromTid: number;
	price: number; // thousands of $
};

/** A benefit a streaming contract gives you while it runs (see streaming.ts). */
export type Perk =
	| { kind: "slatePromo"; pct: number } // the platform promotes your studio: +pct% box office on your new wide or limited releases
	| { kind: "prestige"; points: number } // reputation points every off-season
	| { kind: "awardsPush"; points: number } // an awards campaign: +points on this film's awards score
	| { kind: "franchise"; pct: number } // a sequel to this film earns +pct% box office
	| { kind: "ipDiscount"; pct: number } // pct% off the licence fee of your licensed-IP films
	| { kind: "talentAccess"; points: number }; // talent judges your studio as if its reputation were this much higher

/** What a platform demands from you while the contract runs. Broken demands cost money and the renewal. */
export type Demand =
	| { kind: "exclusive" } // no new deals or financing from any other platform while it runs
	| { kind: "quota"; genres: FilmGenre[]; count: number } // greenlight at least this many films in these genres during the contract
	| { kind: "wideCap"; max: number } // at most this many wide theatrical releases of yours during the contract
	| { kind: "wideMin"; min: number } // at least this many wide theatrical releases of yours during the contract
	| { kind: "reputation"; min: number }; // keep your studio reputation at or above this, or the yearly payment is withheld

/** The terms of one contract. Money is thousands of $. */
export type StreamTerms = {
	years: number; // how many off-seasons it pays
	upfront: number; // paid when you sign (a licence fee or a renewal bonus; films financed from the greenlight have none, they got financing instead)
	annual: number; // paid every off-season while the contract runs
	perks: Perk[];
	demands: Demand[];
};

/** A streaming contract on one of your films. A film has at most one active contract. When it runs out the rights come back (or you get a renewal offer). */
export type StreamingDeal = StreamTerms & {
	id: number;
	mid: number; // the film
	platformId: string;
	kind: "original" | "licence" | "renewal"; // original = backed from the greenlight, licence = sold after release, renewal = a licence extended
	signed: number; // season signed
	firstPay: number; // first off-season it pays; the last is firstPay + years - 1
	festivals: string[]; // festival prizes the film won because of the platform's festival push
	paidTotal: number;
	withheld: number; // years the payment was withheld because you broke the reputation demand
	renewals: number; // how many times this film's contract has been renewed before this one
	status: "active" | "ended";
	endedSeason?: number;
	endNote?: string; // what happened when it ended
};

/** An offer on the table this off-season: a new licence for a released film, or the renewal of a contract that is running out. Offers expire when the new season starts. */
export type StreamingOffer = StreamTerms & {
	id: number;
	mid: number;
	platformId: string;
	kind: "licence" | "renewal";
	renewals: number;
};

export type AwardWinner = {
	pid?: number; // the person who won (not set for Best Picture, or in older saves)
	name: string; // film title for best picture, person name otherwise
	movieTitle: string;
	mid: number;
	tid: number;
};

export type SeasonAwards = {
	season: number;
	bestPicture: AwardWinner;
	bestDirector: AwardWinner;
	bestActor: AwardWinner | null; // best male lead (null if no male actor was in a film that year)
	bestActress: AwardWinner | null; // best female lead
	bestSupportingActor?: AwardWinner | null; // best male supporting role (missing in older saves)
	bestSupportingActress?: AwardWinner | null; // best female supporting role (missing in older saves)
	nominees?: AwardRace; // the nominees per category, winners included (missing in older saves)
};

/** One nominee in the awards race, with their estimated chance of winning (0-1). */
export type RaceEntry = {
	pid?: number; // the person (not set for Best Picture)
	name: string; // film title for best picture, person name otherwise
	movieTitle: string;
	mid: number;
	tid: number;
	chance: number;
};

/** Top contenders per category, shown in the Distribution phase. An estimate: the final awards are drawn separately. */
export type AwardRace = {
	bestPicture: RaceEntry[];
	bestDirector: RaceEntry[];
	bestActor: RaceEntry[];
	bestActress: RaceEntry[];
	bestSupportingActor: RaceEntry[];
	bestSupportingActress: RaceEntry[];
};

/** A film a director brings you, asking for funding (see directorPitches.ts). They last for one Development phase. */
export type DirectorPitch = {
	id: number;
	season: number;
	directorPid: number;
	title: string;
	genre: FilmGenre;
	pool: number[]; // the actors the director wants (about 10). If you fund the film, the cast comes from this list
	ask: number; // the total film budget the director asks for (salaries + base costs + production), thousands of $
	reserve: number; // hidden, 0-1: the lowest share of the ask the director would still accept
	rounds: number; // counter-offers you have made that were turned down
	status: "open" | "funded" | "declined" | "walked"; // walked = your counter-offers failed and the director left
	agreed?: number; // the budget you funded it at (only when status is "funded")
};

export type Studio = {
	tid: number;
	name: string;
	cash: number;
	reputation: number; // 0-100
};

// Phases of one year. Ordered, like PHASE in ZenGM's constants.ts.
export enum Phase {
	DEVELOPMENT = 0, // pick genre/script, hire director + cast
	PRODUCTION = 1, // shooting
	POST = 2, // editing, music, test screenings
	DISTRIBUTION = 3, // release + box office
	AWARDS = 4,
	OFFSEASON = 5, // contracts expire, aging, new talent, free agency
}

export type Difficulty = "easy" | "normal" | "hard";

/** A pitch to an actor who would otherwise refuse your studio (see hiring.ts). One attempt per actor per season. */
export type Pitch = {
	season: number;
	premium: number; // extra salary offered, as a fraction of their normal price (0.5 = +50%)
	accepted: boolean;
};

/** What you offer a person in an advanced negotiation (see negotiate.ts). Money is in thousands of $. */
export type DealTerms = {
	salary: number; // for the one film
	backend: number; // % of the film's box office, paid to them after release
	genre: FilmGenre | null; // you promise the film is this genre
	style: ScriptStyle | null; // you promise the script is this style
	director: number | null; // actors only: you promise this director (pid)
	costars: number[]; // you promise these people are on the film too (0-2 pids): actors for a director, co-stars for an actor
};

/** Talks with one person this season (GameState.negotiations). Signed terms replace the normal price and are enforced when you greenlight. */
export type Negotiation = {
	season: number;
	rounds: number; // offers made so far
	status: "open" | "signed" | "walked";
	terms?: DealTerms; // the signed terms
};

// ── Brand deals (see brands.ts) ─────────────────────────────

/** A placement is a product in the film. A sponsor presents it (one per film, bigger money, bigger critic cost). */
export type BrandTier = "placement" | "sponsor";
/** What you ask for at the greenlight. */
export type BrandPick = { brandId: string; tier: BrandTier };
/** A brand signed on one film. `fee` is what it pays towards the cost (thousands of $, marketing cover included). */
export type BrandPlacement = { brandId: string; tier: BrandTier; fee: number; love?: boolean };

/** What a brand can offer you in the off-season. */
export type BrandOfferKind = "studio" | "merch" | "game" | "tv";
export type BrandOffer = {
	id: number;
	kind: BrandOfferKind;
	brandId: string;
	mid?: number; // the film it is about (not for a studio partnership)
	title: string; // the product, e.g. "Heat Wave action figures"
	upfront: number; // paid when you sign (thousands of $)
	annual: number; // paid every off-season while it runs (merch, studio, TV) or the expected royalty (game)
	years: number; // seasons it runs (a game: 1 release)
	category?: string; // studio partnerships: the category you lock
};
/** A signed brand offer, running or finished (GameState.brandDeals). */
export type BrandDeal = BrandOffer & {
	status: "active" | "ended";
	signed: number; // season signed
	paid: number; // total paid so far, upfront included
	seasonsPaid: number; // how many yearly payments have been made
	quality?: number; // game or TV show: how good it turned out (0-100), once released
	released?: boolean; // game released / first season aired
	log: string[]; // what happened, newest last
	endNote?: string;
	endedSeason?: number;
};

// ── Challenges (see challenges.ts) ───────────────────────────

/** A handicap the game enforces while the challenge is running. */
export type RuleId = "noStreaming" | "noLicensedIp" | "noSequels" | "shoestring" | "repertory" | "freshFaces" | "noBailouts";

/** What you have to achieve before the deadline. */
export type GoalId = "billionaire" | "dynasty" | "prestige" | "franchise";

/**
 * The challenge a save was started with. Rules are enforced while `status` is "active"; when the goal is won or lost the run is over
 * and the rules are lifted (the save stays playable as a sandbox). A challenge with rules and no goal never ends.
 */
export type ChallengeRun = {
	rules: RuleId[];
	goal?: GoalId;
	startSeason: number;
	status: "active" | "won" | "failed";
	endSeason?: number;
	note?: string; // how it ended, in one line
};

// The whole game in one object. This is what we will save to disk.
export type GameState = {
	difficulty: Difficulty;
	allTime?: boolean; // the All-Time edition: the roster is the greatest actors and directors ever, all aged 18 (see allTimeTalent.ts), and the UI is purple
	challenge?: ChallengeRun; // chosen when the game starts: rules the game enforces and/or a goal with a deadline (see challenges.ts). Missing = a normal game
	hideRatings?: boolean; // chosen when the game starts: hides Ovr, Fit and the attribute numbers; talent is judged by track record instead (see trackRecord.ts)
	season: number;
	phase: Phase;
	userTid: number;
	studios: Studio[];
	people: Person[];
	movies: Movie[];
	awards: SeasonAwards[];
	awardRace?: AwardRace; // contenders for this season, set when films are released
	licenses?: License[]; // who owns which IP (missing in older saves = nobody does yet)
	customIps?: Ip[]; // IPs born from a studio's own sequel franchise once it was sold (see trade.ts). Missing in older saves = none
	deals?: Deal[]; // rights negotiations in progress this season (cleared every new season)
	offers?: IpOffer[]; // rival offers for your IPs, made in the off-season
	streamDeals?: StreamingDeal[]; // films you sold to streaming platforms (missing in older saves = none)
	streamOffers?: StreamingOffer[]; // platform offers for your films, made in the off-season
	nextStreamId?: number;
	pitches?: Record<number, Pitch>; // pitches you made this season, by actor pid (older saves: none)
	negotiations?: Record<number, Negotiation>; // advanced negotiations this season, by pid (see negotiate.ts). Older saves: none
	brandOffers?: BrandOffer[]; // brand offers made in the off-season (merchandise, games, TV, studio partners). They expire when the new season starts (see brands.ts)
	brandDeals?: BrandDeal[]; // the ones you signed
	brandRel?: Record<string, number>; // how each brand feels about you, 0-100 (missing = 50)
	brandHeat?: Record<number, number>; // franchise id -> heat 0-100 from merchandise, games and TV. Lifts the next sequel's gross
	nextBrandId?: number;
	bonds?: Bond[]; // lasting feuds and frenemies between people (see rivalries.ts). Missing in older saves = none yet
	scripts?: Script[]; // the script market for this season's Development phase (see scripts.ts). Older saves: made when the save is loaded
	directorPitches?: DirectorPitch[]; // films directors pitched to you this Development phase (older saves: made when you next open Development)
	nextPitchId?: number;
	nextPid: number;
	nextMid: number;
	notice?: string; // one-off message shown to the player (cleared on the next phase)
	news?: NewsItem[]; // the news feed, newest last (see news/). Missing in older saves = no news yet
	newsIssue?: number; // number of the latest issue (one issue per phase change)
	nextNewsId?: number;
	newsSeen?: number; // the latest issue the player has opened on the News page
};

// ── News feed (see game/news/) ───────────────────────────────

export type NewsKind =
	| "production" // films starting and finishing their shoots
	| "drama" // feuds, injuries, scandals and what they did to the film
	| "boxoffice" // openings, grosses, flops
	| "reviews" // critics and audiences
	| "record" // something in the record books fell
	| "duo" // partnerships that keep delivering (or stop delivering)
	| "awards" // nominations, winners, upsets
	| "race" // who is going to win
	| "people" // retirements, newcomers, rising and falling stars
	| "studio" // studios, rankings, rights
	| "franchise" // sequels and licensed properties
	| "rumor"; // gossip that may or may not matter

/** A small table that goes with an article (the nominees, the winners, the weekend box office, the standings). */
export type NewsCard = {
	kind: "nominees" | "winners" | "boxoffice" | "standings";
	title: string;
	rows: { label: string; text: string; note?: string; won?: boolean; mine?: boolean }[];
};

/**
 * One article. Names and films inside `headline`, `body` and card text are written as tokens,
 * [[p:12|Name]] for a person and [[m:34|Title]] for a film, so the page can make them clickable.
 */
export type NewsItem = {
	id: number;
	issue: number; // the phase change that produced it
	season: number;
	phase: Phase; // the phase the game had just entered
	kind: NewsKind;
	rank: number; // 1 (filler) .. 5 (front page)
	headline: string;
	body: string[]; // paragraphs
	tags?: string[]; // BREAKING, RECORD, RUMOR...
	mine?: boolean; // about your studio
	tone?: "good" | "bad" | "neutral"; // for you, when it is about your studio
	effect?: string; // what a drama item did to the film, in plain words
	card?: NewsCard;
};
