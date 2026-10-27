import {
	AUDIENCE_GENRE_ATTRS,
	AUDIENCE_NOISE,
	AUDIENCE_WEIGHTS,
	AUDIENCE_WOM,
	CAST_SHARE,
	CRITIC_NOISE,
	BASE_PRODUCTION_COST,
	DEFAULT_MARKETING_RATIO,
	DIRECTOR_SHARE,
	EXTRA_BUDGET_MAX_BONUS,
	IP_OPENING_RUSH,
	EXTRA_BUDGET_SCALE,
	MARKET_BASE,
	POST_NOISE,
	PRODUCTION_NOISE,
} from "./constants";
import { chemistryBonus } from "./chemistry";
import { genreOvr, specialtyBonus } from "./ovr";
import { average, clamp, gauss } from "./random";
import { landScript, scriptFx } from "./scripts";
import { FRENEMY, FRENEMY_GROSS, FRENEMY_GROSS_HEAT, teamTension } from "./rivalries";
import type { AttributeKey, Bond, Movie, Person } from "./types";

// ═════════════════════════════════════════════════════════════
// The "GameSim" of the game. No play-by-play: a few formulas + luck.
//
// Order of a movie's life (see phase.ts):
//   simProduction -> simPost -> simDistribution, then criticScore for awards.
// Units: money is in thousands of $ (1000 = $1M). Quality is 0-100.
// ═════════════════════════════════════════════════════════════

// ── helpers ──────────────────────────────────────────────────

/** A person's rating for this movie's genre, plus a specialty bonus (+3 matching genre, else +1 if Versatile). */
const personRating = (person: Person, movie: Movie): number => {
	const base = genreOvr(person.attrs, person.role, movie.genre);
	return clamp(base + specialtyBonus(person.specialties, movie.genre));
};

/** How well the whole team fits the movie's genre (0-100). No randomness. */
export const teamRating = (movie: Movie, director: Person, cast: Person[]): number =>
	DIRECTOR_SHARE * personRating(director, movie) +
	CAST_SHARE * average(cast.map((p) => personRating(p, movie)));

/** Average of one attribute across a list of people. */
const avgAttr = (people: Person[], key: AttributeKey): number =>
	average(people.map((p) => p.attrs[key]));

/** Final quality of the film = shoot (65%) + post (35%). Throws if not shot yet. */
export const finalQuality = (movie: Movie): number => {
	if (movie.productionQuality === undefined || movie.postQuality === undefined) {
		throw new Error(`Movie "${movie.title}" has not finished production + post yet.`);
	}
	return 0.65 * movie.productionQuality + 0.35 * movie.postQuality;
};

/** Budget = everyone's salary + base production cost + any extra money (thousands of $). */
export const movieBudget = (
	people: Person[],
	extraBudget = 0,
	pay: (p: Person) => number = (p) => p.contract.amount, // what each person is actually paid (pitch premiums included)
): number => people.reduce((sum, p) => sum + pay(p), 0) + BASE_PRODUCTION_COST + extraBudget;

/** What a film costs the studio up front: budget + marketing + the licence fee for a licensed IP + the script fee, minus what a streaming platform pays towards it. */
export const movieCost = (movie: Movie): number =>
	movie.budget + (movie.marketing ?? movie.budget * DEFAULT_MARKETING_RATIO) + (movie.licenseFee ?? 0) + (movie.scriptFee ?? 0) - (movie.financing ?? 0) - (movie.platformMarketing ?? 0) - (movie.brandFunding ?? 0);

/** Money the studio makes or loses on a finished movie (thousands of $). */
export const movieProfit = (movie: Movie): number =>
	(movie.boxOffice ?? 0) - movieCost(movie) - (movie.backendPaid ?? 0) + (movie.brandBonus ?? 0);

/**
 * Opening-weekend gross (thousands of $), a share of the final box office.
 * Heavy marketing, sequels and licensed IPs are front-loaded (bigger share); well-reviewed films are leggy (smaller share).
 * Call after boxOffice and criticScore are final (franchise blend included).
 */
export const simOpening = (movie: Movie): number => {
	const total = movie.boxOffice ?? 0;
	const marketing = movie.marketing ?? movie.budget * DEFAULT_MARKETING_RATIO;
	const critics = movie.criticScore ?? 50;
	const sequelRush = (movie.installment ?? 1) > 1 ? 0.04 : 0;
	const ipRush = movie.ipId ? IP_OPENING_RUSH : 0; // fans of a licensed IP show up on day one
	const share = clamp(0.32 + 0.12 * clamp(marketing / MARKET_BASE, 0, 1) + sequelRush + ipRush - 0.003 * (critics - 50) + gauss(0, 0.04), 0.15, 0.55);
	return Math.round(total * share);
};

// ── the four sims ────────────────────────────────────────────

/**
 * Production quality (0-100): how good is the shoot?
 * Team fit for the genre (director 40%, cast 60%) + the script (see scripts.ts) + production value bought with
 * extra budget (diminishing returns) + chemistry from people who worked together before
 * (bigger for films that are already good, see chemistry.ts) + a little luck.
 * `history` = the films made so far, used to find returning duos. Records the bonus on movie.chemistry.
 */
export const simProduction = (movie: Movie, director: Person, cast: Person[], history: Movie[] = [], bonds: Bond[] = []): number => {
	const salaries = [director, ...cast].reduce((sum, p) => sum + p.contract.amount, 0);
	// Pitch premiums are salary, not production value, so they do not count as extra budget.
	const extra = Math.max(0, movie.budget - salaries - (movie.pitchExtra ?? 0) - BASE_PRODUCTION_COST);
	const productionValue = EXTRA_BUDGET_MAX_BONUS * (1 - Math.exp(-extra / EXTRA_BUDGET_SCALE));
	landScript(movie); // the script lands (or misses) on the shoot: see scripts.ts
	// Lasting feuds and friendships among the team (see rivalries.ts): a feud costs quality and chemistry, frenemies push each other.
	const tension = teamTension(bonds, director, cast);
	if (tension.pairs.length) movie.tension = tension.pairs;
	const quality = teamRating(movie, director, cast) + productionValue + scriptFx(movie).prod + tension.prod;
	const chemistry = chemistryBonus(movie, quality, history) * tension.chemMult;
	movie.chemistry = Math.round(chemistry * 10) / 10;
	return Math.round(clamp(quality + chemistry + gauss(0, PRODUCTION_NOISE)));
};

/**
 * Post-production quality (0-100): editing, music, pacing.
 * Almost entirely the director: technique, vision, and a bit of originality.
 * A great editor can partly save a weak shoot because post counts for 35% of final quality.
 */
export const simPost = (movie: Movie, director: Person): number => {
	const a = director.attrs;
	const skill = 0.5 * a.technique + 0.3 * a.vision + 0.2 * a.originality;
	return Math.round(clamp(skill + scriptFx(movie).post + gauss(0, POST_NOISE)));
};

/**
 * Critic score (0-100). Critics value final quality, then vision, originality
 * and emotional range (director and cast count equally). Used for awards.
 */
export const criticScore = (movie: Movie, director: Person, cast: Person[]): number => {
	const all = [director, ...cast];
	const artistry = average([
		avgAttr(all, "vision"),
		avgAttr(all, "originality"),
		avgAttr(all, "emotionalRange"),
	]);
	const score = 0.6 * finalQuality(movie) + 0.4 * artistry + scriptFx(movie).critic; // the script's style: critics love character pieces, shrug at crowd-pleasers
	return Math.round(clamp(score + gauss(0, CRITIC_NOISE)));
};

/**
 * Audience score (0-100): what regular moviegoers thought, as opposed to critics.
 * Quality still matters most, but audiences also love stars they like (charisma, audience connection)
 * and the skills that make the genre work (see AUDIENCE_GENRE_ATTRS). Vision and originality count for much
 * less than with critics, so an art-house film can win critics and lose audiences, and a crowd-pleaser the reverse.
 */
export const audienceScore = (movie: Movie, cast: Person[]): number => {
	const stars = average(cast.map((p) => (p.attrs.charisma + p.attrs.audienceConnection) / 2));
	const feel = average(AUDIENCE_GENRE_ATTRS[movie.genre].map((key) => avgAttr(cast, key)));
	const score = AUDIENCE_WEIGHTS.quality * finalQuality(movie) + AUDIENCE_WEIGHTS.stars * stars + AUDIENCE_WEIGHTS.genreFeel * feel + scriptFx(movie).audience;
	return Math.round(clamp(score + gauss(0, AUDIENCE_NOISE)));
};

/** Word of mouth: the box-office multiplier an audience score earns (a little under or over 1). */
export const wordOfMouth = (score: number): number =>
	clamp(1 + (score - AUDIENCE_WOM.center) / AUDIENCE_WOM.per, AUDIENCE_WOM.min, AUDIENCE_WOM.max);

/**
 * Box office in thousands of $ (revenue the studio receives, simplified).
 *
 * appeal (0-100) = 60% final quality + 40% star power (cast charisma + audience connection)
 * gross = MARKET_BASE * curve(appeal) * marketing * studio reputation * luck
 *   - the budget does NOT multiply revenue: spending more only helps through quality,
 *     star power and marketing
 *   - marketing has diminishing returns (square-root curve)
 *   - luck: usually +/-30%, with a small chance of a sleeper hit or a bomb
 */
export const simDistribution = (movie: Movie, cast: Person[], studioReputation = 30): number => {
	const starPower = average(cast.map((p) => (p.attrs.charisma + p.attrs.audienceConnection) / 2));
	const appeal = 0.6 * finalQuality(movie) + 0.4 * starPower;
	const curve = 0.05 + 3.6 * Math.pow(appeal / 100, 2.2);

	const marketing = movie.marketing ?? movie.budget * DEFAULT_MARKETING_RATIO;
	const marketingFactor = 0.85 + 0.5 * Math.sqrt(clamp(marketing / MARKET_BASE, 0, 1)); // 0.85 .. 1.35
	const reputationFactor = 0.9 + 0.2 * (clamp(studioReputation) / 100);

	let luck = Math.exp(gauss(0, 0.5)); // roughly 0.75x .. 1.3x
	const roll = Math.random();
	if (roll < 0.04) luck *= 1.8 + Math.random() * 1.2; // sleeper hit
	else if (roll < 0.1) luck *= 0.4 + Math.random() * 0.3; // bomb

	return Math.round(MARKET_BASE * curve * marketingFactor * reputationFactor * luck * scriptFx(movie).gross * (movie.tension?.some((t) => t.kind === "frenemies") ? teamBuzz(movie) : 1)); // a high-concept script sells tickets
};

/** Box-office buzz of a film whose cast has frenemies (FRENEMY_GROSS when the pair is hot enough; recorded on the film at production). */
const teamBuzz = (movie: Movie): number => (movie.tension?.some((t) => t.kind === "frenemies" && t.prod >= (FRENEMY * FRENEMY_GROSS_HEAT) / 100) ? FRENEMY_GROSS : 1);
