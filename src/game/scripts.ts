import { genName } from "./names";
import { choice, clamp, gauss } from "./random";
import { seededRandom } from "./traits";
import { GENRES, SCRIPT_STYLES } from "./types";
import type { FilmGenre, GameState, Gender, Movie, Person, Script, ScriptInfo, ScriptStyle } from "./types";

// ═════════════════════════════════════════════════════════════
// Scripts: the story a film starts from, with its own quality stat.
//
// Every Development phase the writers' market offers one script of each STYLE for every genre (4 x 9 = 36 scripts).
// You pick one when you greenlight, and the genre of the film is the genre of the script. A script has
//   - a quality (0-100): how good the pages are. It lifts or drags production quality, post-production and the reviews.
//   - a style with strengths: High concept sells tickets, Character-driven wins critics, Crowd-pleaser wins audiences safely,
//     Risky original swings: it can be a landmark or a mess, and you only find out on the shoot (`landed`).
//   - a genre fit: each style suits some genres better (a character piece in a drama, a high concept in sci-fi).
//   - a price, paid on top of the budget. Better scripts cost much more.
// A director's pitch you fund comes with the director's own script (no fee, quality from the director). Rivals pick the better of
// two scripts. Films from older saves have no script, which counts as a plain 60: no effect either way.
// Tuning: everything is in this file.
// ═════════════════════════════════════════════════════════════

export type StyleDef = {
	label: string;
	blurb: string; // what it is good at, for the player
	gross: number; // box-office multiplier
	critic: number; // critic-score points
	audience: number; // audience-score points
	sd: number; // how far a script of this style can land from its quality on the shoot
	bias: number; // quality of the scripts of this style on the market, on average, relative to 60
	priceMult: number;
	/** 0-100 bars for the picker: Hook (sells tickets), Acclaim (critics and awards), Crowd (audiences), Risk (spread of results). */
	bars: { hook: number; acclaim: number; crowd: number; risk: number };
};

export const STYLES: Record<ScriptStyle, StyleDef> = {
	highConcept: {
		label: "High concept",
		blurb: "A hook you can sell in one line. Sells tickets (+10% box office), critics are a little cooler.",
		gross: 1.1, critic: -1, audience: 0, sd: 4, bias: 0, priceMult: 1.15,
		bars: { hook: 90, acclaim: 45, crowd: 65, risk: 30 },
	},
	characterDriven: {
		label: "Character-driven",
		blurb: "Rich parts for actors. Critics and awards love it (+4 critics), but it earns a little less (-5% box office).",
		gross: 0.95, critic: 4, audience: 1, sd: 4, bias: 0, priceMult: 1,
		bars: { hook: 35, acclaim: 90, crowd: 45, risk: 35 },
	},
	crowdPleaser: {
		label: "Crowd-pleaser",
		blurb: "Built for a full house. Audiences adore it (+4 audience score) and it rarely misses, but critics shrug (-2).",
		gross: 1.04, critic: -2, audience: 4, sd: 2.5, bias: 0, priceMult: 1,
		bars: { hook: 60, acclaim: 35, crowd: 90, risk: 15 },
	},
	riskyOriginal: {
		label: "Risky original",
		blurb: "Nobody has made this before. Cheaper, and critics lean in (+2), but the script can land far above or below its quality on the shoot.",
		gross: 1, critic: 2, audience: -2, sd: 11, bias: 2, priceMult: 0.85,
		bars: { hook: 50, acclaim: 75, crowd: 30, risk: 90 },
	},
};

/** How well each style suits each genre, in points (-5 to +5). Scaled by AFFINITY_SCALE into the script's rating. */
export const AFFINITY: Record<ScriptStyle, Record<FilmGenre, number>> = {
	highConcept: { action: 4, sciFiFantasy: 5, adventure: 4, thriller: 2, horror: 1, comedy: 0, crime: 0, romance: -2, drama: -4 },
	characterDriven: { drama: 5, romance: 3, crime: 3, comedy: 1, thriller: 1, horror: 0, adventure: -2, sciFiFantasy: -2, action: -4 },
	crowdPleaser: { comedy: 5, romance: 4, adventure: 3, action: 3, horror: 1, sciFiFantasy: 0, thriller: 0, drama: -1, crime: -2 },
	riskyOriginal: { horror: 4, sciFiFantasy: 3, thriller: 3, crime: 2, drama: 1, comedy: -1, adventure: -2, action: -3, romance: -3 },
};
export const AFFINITY_SCALE = 2; // rating points per affinity point

/** What the script's rating (around 60 = neutral) does to the film. */
export const SCRIPT_PROD_WEIGHT = 0.3; // production-quality points per rating point above 60
export const SCRIPT_POST_WEIGHT = 0.1; // post-production points (a good script cuts together)

const PRICE_BASE = 500; // thousands of $ for a script of quality PRICE_ANCHOR
const PRICE_ANCHOR = 40;
const PRICE_GROWTH = 1.075;
const PRICE_ROUND = 50;
const PRICE_MIN = 250;
/** A vintage year for a genre: some genres have a richer shelf than others (std dev of the quality shift). */
const VINTAGE_SD = 4;

export const styleLabel = (s: ScriptStyle): string => STYLES[s].label;

/** Fit of a style for a genre as points added to the script's rating. */
export const fitPoints = (style: ScriptStyle, genre: FilmGenre): number => AFFINITY[style][genre] * AFFINITY_SCALE;

/** What a script of this quality costs, in thousands of $. */
export const scriptPrice = (quality: number, style: ScriptStyle): number =>
	Math.max(PRICE_MIN, Math.round((PRICE_BASE * Math.pow(PRICE_GROWTH, quality - PRICE_ANCHOR) * STYLES[style].priceMult) / PRICE_ROUND) * PRICE_ROUND);

/** The rating the sim uses: quality (as it landed, once the shoot has happened) plus the style's fit for the genre. 60 = no effect. */
export const scriptRating = (script: Pick<ScriptInfo, "style" | "quality" | "landed"> | undefined, genre: FilmGenre): number =>
	script ? clamp((script.landed ?? script.quality) + fitPoints(script.style, genre)) : 60;

export type ScriptFx = { prod: number; post: number; gross: number; critic: number; audience: number };

/** Everything a film's script changes in the sims. All zero (gross 1) for a film without one. */
export const scriptFx = (movie: Pick<Movie, "script" | "genre">): ScriptFx => {
	if (!movie.script) return { prod: 0, post: 0, gross: 1, critic: 0, audience: 0 };
	const rating = scriptRating(movie.script, movie.genre);
	const style = STYLES[movie.script.style];
	return { prod: (rating - 60) * SCRIPT_PROD_WEIGHT, post: (rating - 60) * SCRIPT_POST_WEIGHT, gross: style.gross, critic: style.critic, audience: style.audience };
};

/** On the shoot a script lands: a safe style stays near its quality, a risky one can land anywhere. Mutates the film. Returns the landed quality. */
export const landScript = (movie: Movie): number => {
	if (!movie.script) return 60;
	if (movie.script.landed === undefined) movie.script.landed = Math.round(clamp(movie.script.quality + gauss(0, STYLES[movie.script.style].sd)));
	return movie.script.landed;
};

/** "Weak" ... "Superb" for the Hide ratings mode. */
export const qualityWord = (q: number): string => (q >= 85 ? "Superb" : q >= 72 ? "Strong" : q >= 58 ? "Solid" : q >= 45 ? "Shaky" : "Weak");

// ── making scripts ───────────────────────────────────────────

const LOGLINES: Record<ScriptStyle, string[]> = {
	highConcept: [
		"The pitch fits on a poster and sells itself.",
		"A big, simple hook and a bigger set piece.",
		"You can describe it in ten words, and people will buy a ticket.",
		"A killer premise with room for spectacle.",
	],
	characterDriven: [
		"A small story, deep people: the performances are the film.",
		"Quiet, specific and emotionally exact.",
		"The kind of script actors beg to read.",
		"The plot takes a back seat to the people.",
	],
	crowdPleaser: [
		"Warm, funny, built to play to a full house.",
		"Familiar beats, executed with real polish.",
		"Nobody leaves unhappy: a safe, satisfying night out.",
		"Tested on a dozen audiences before a word was shot.",
	],
	riskyOriginal: [
		"Nobody has done this before, maybe for good reason.",
		"Strange, ambitious and impossible to categorise.",
		"Half the readers loved it; half walked out of the meeting.",
		"A bold swing: either a landmark or a mess.",
	],
};

const writerName = (): string => genName(Math.random() < 0.5 ? ("female" as Gender) : ("male" as Gender));

/** One script of this style and genre. `vintage` shifts the quality (a rich or thin year for the genre). */
export const genScript = (season: number, n: number, genre: FilmGenre, style: ScriptStyle, vintage = 0): Script => {
	const quality = Math.round(clamp(gauss(60 + STYLES[style].bias + vintage, 13), 28, 96));
	return { id: season * 1000 + n, season, genre, style, quality, price: scriptPrice(quality, style), writer: writerName(), logline: choice(LOGLINES[style]) };
};

/** The whole market for a season: every style in every genre. */
export const genScriptMarket = (season: number): Script[] => {
	const out: Script[] = [];
	for (const genre of GENRES) {
		const vintage = gauss(0, VINTAGE_SD);
		for (const style of SCRIPT_STYLES) out.push(genScript(season, out.length, genre, style, vintage));
	}
	return out;
};

/** Fill the market for the current season (call it when Development begins). Mutates `state`. */
export const addScripts = (state: GameState): void => {
	state.scripts = genScriptMarket(state.season);
};

export const scriptsFor = (state: Pick<GameState, "scripts" | "season">, genre: FilmGenre): Script[] =>
	(state.scripts ?? []).filter((s) => s.season === state.season && s.genre === genre);

export const infoOf = (s: Script): ScriptInfo => ({ style: s.style, quality: s.quality, writer: s.writer, logline: s.logline });

/** A rival's script: the better of two scripts on the market for the genre. Returns the info and the fee it paid. */
export const aiScript = (season: number, genre: FilmGenre): { info: ScriptInfo; fee: number } => {
	const picks = [0, 1].map((i) => genScript(season, i, genre, choice(SCRIPT_STYLES)));
	const best = picks.sort((a, b) => scriptRating(b, genre) - scriptRating(a, genre))[0];
	return { info: infoOf(best), fee: best.price };
};

/**
 * The director's own script, that comes with a pitch they bring you (no fee). Its style is what the director is good at and its
 * quality comes from their craft. The same director gets the same script for the same pitch (no re-rolling by greenlighting again).
 */
export const directorScript = (director: Person, genre: FilmGenre, season: number): ScriptInfo => {
	const a = director.attrs;
	const rand = seededRandom(`script:${director.pid}:${genre}:${season}`);
	const taste: Record<ScriptStyle, number> = {
		highConcept: (a.vision + a.technique) / 2 + fitPoints("highConcept", genre),
		characterDriven: (a.emotionalRange + a.immersion) / 2 + fitPoints("characterDriven", genre),
		crowdPleaser: (a.audienceConnection + a.humour) / 2 + fitPoints("crowdPleaser", genre),
		riskyOriginal: (a.originality + a.vision) / 2 + fitPoints("riskyOriginal", genre),
	};
	const style = SCRIPT_STYLES.reduce((best, s) => (taste[s] > taste[best] ? s : best), SCRIPT_STYLES[0]);
	const quality = Math.round(clamp(0.5 * a.originality + 0.3 * a.vision + 0.2 * a.emotionalRange + (rand() - 0.5) * 16, 28, 96));
	return { style, quality, writer: director.name, logline: LOGLINES[style][Math.floor(rand() * LOGLINES[style].length)], own: true };
};
