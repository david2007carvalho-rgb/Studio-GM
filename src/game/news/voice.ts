import { RETIRED } from "../constants";
import { filmLegacies } from "../legacy";
import { ovr } from "../ovr";
import { average } from "../random";
import type { FilmGenre, GameState, Movie, Person, SeasonAwards } from "../types";
import { chance, lastName, mTok, nTime, pTok, percentile } from "./util";

// ═════════════════════════════════════════════════════════════
// The newsroom's voice: how a person or a film is introduced.
// "two-time Best Actor winner Timothée Chalamet", "last year's Best Director Paul Thomas Anderson",
// "the critically acclaimed Greta Gerwig", "audience sweetheart Zendaya"...
//
// Every description is read from the game's history (awards, nominations, box office, critics, ratings),
// and the adjectives are PERCENTILES ("top 10% of everyone with 2+ films"), so they mean something
// whether the save is two seasons or thirty seasons old.
// Facts only count up to `asOf` (the season whose ceremony has not happened yet), so a story about this
// year's films describes people as they were going in.
// ═════════════════════════════════════════════════════════════

export type CatKey = "bestDirector" | "bestActor" | "bestActress" | "bestSupportingActor" | "bestSupportingActress";
export const PERSON_CATS: { key: CatKey; label: string; group: "dir" | "lead" | "supp" }[] = [
	{ key: "bestDirector", label: "Best Director", group: "dir" },
	{ key: "bestActor", label: "Best Actor", group: "lead" },
	{ key: "bestActress", label: "Best Actress", group: "lead" },
	{ key: "bestSupportingActor", label: "Best Supporting Actor", group: "supp" },
	{ key: "bestSupportingActress", label: "Best Supporting Actress", group: "supp" },
];

/** One way of introducing someone. `noun` works alone before the name, `adj` needs a noun or "the", `post` is an aside after the name. */
export type Desc = { text: string; kind: "adj" | "noun" | "post"; score: number };

export type PStats = {
	films: Movie[]; // released before asOf
	gross: number;
	avgCritics: number | null;
	avgAudience: number | null;
	dirWins: number[]; // seasons of Best Director wins
	leadWins: number[];
	suppWins: number[];
	noms: number; // nominations, wins included
	pictureWins: number; // Best Picture winners they directed
	lastWin?: { season: number; label: string };
	topGenre?: { genre: FilmGenre; n: number; avg: number };
};

export type RefOpts = {
	desc?: boolean; // false = just the name
	short?: boolean; // one short epithet at most (for headlines)
	post?: boolean; // the person may be introduced with an aside after the name
};

export type Scope = {
	/** The person's name as a clickable token, with an epithet the first time they appear in this article. Later mentions are the surname. */
	ref(p: Person, o?: RefOpts): string;
	tok(p: Person): string;
	last(p: Person): string;
	film(m: Movie, o?: { desc?: boolean }): string;
};

export type Voice = {
	asOf: number;
	/** A fresh scope per article, so each person is only introduced once. */
	scope(): Scope;
	stat(p: Person): PStats;
	descs(p: Person): Desc[];
	/** 1 = the best-rated active person of their kind (men and women separately for actors). 999 for the retired. */
	ovrRank(p: Person): number;
	/** The all-time great films so far (empty in the first seasons). */
	greats: Movie[];
	/** Share (0-1) of everyone with 2+ films whose average critic score is at or below this person's. null = fewer than 2 films. */
	critPct(p: Person): number | null;
};

export const GENRE_NOUN: Record<FilmGenre, string> = {
	comedy: "comedy",
	drama: "drama",
	thriller: "thriller",
	romance: "romance",
	action: "action film",
	horror: "horror film",
	crime: "crime drama",
	sciFiFantasy: "sci-fi epic",
	adventure: "adventure",
};
export const GENRE_WORD: Record<FilmGenre, string> = {
	comedy: "comedy",
	drama: "drama",
	thriller: "thriller",
	romance: "romance",
	action: "action",
	horror: "horror",
	crime: "crime",
	sciFiFantasy: "sci-fi",
	adventure: "adventure",
};

const awardLabel = (key: CatKey): string => PERSON_CATS.find((c) => c.key === key)!.label;

export const createVoice = (state: GameState, opts: { asOf?: number; fresh?: boolean } = {}): Voice => {
	const asOf = opts.asOf ?? state.season;
	const fresh = !!opts.fresh;
	const hide = !!state.hideRatings; // "Hide ratings": no epithet may come from Ovr (top-rated, A-list, rising star...)
	const hasResults = (m: Movie) => m.boxOffice !== undefined && m.criticScore !== undefined;
	const everyFilm = state.movies.filter(hasResults); // for films' own standing, this year's included
	const films = everyFilm.filter((m) => m.season < asOf); // for people's reputations
	const ceremonies: SeasonAwards[] = state.awards.filter((a) => a.season < asOf);
	const byId = new Map(state.people.map((p) => [p.pid, p]));

	// ── who won and was nominated, before asOf ──
	type Record_ = { dir: number[]; lead: number[]; supp: number[]; noms: number; last?: { season: number; key: CatKey } };
	const record = new Map<number, Record_>();
	const rec = (pid: number): Record_ => {
		let r = record.get(pid);
		if (!r) record.set(pid, (r = { dir: [], lead: [], supp: [], noms: 0 }));
		return r;
	};
	for (const a of ceremonies) {
		for (const c of PERSON_CATS) {
			const w = a[c.key];
			const nominated = new Set<number>();
			for (const e of a.nominees?.[c.key] ?? []) if (e.pid !== undefined) nominated.add(e.pid);
			if (w?.pid !== undefined) {
				nominated.add(w.pid);
				const r = rec(w.pid);
				(c.group === "dir" ? r.dir : c.group === "lead" ? r.lead : r.supp).push(a.season);
				if (!r.last || a.season >= r.last.season) r.last = { season: a.season, key: c.key };
			}
			for (const pid of nominated) rec(pid).noms++;
		}
	}
	const pictureMids = new Set(ceremonies.map((a) => a.bestPicture.mid));

	// ── films per person, then their numbers ──
	const filmsOf = new Map<number, Movie[]>();
	for (const m of films) for (const pid of [m.directorPid, ...m.castPids]) (filmsOf.get(pid) ?? filmsOf.set(pid, []).get(pid)!).push(m);

	const cache = new Map<number, PStats>();
	const stat = (p: Person): PStats => {
		const hit = cache.get(p.pid);
		if (hit) return hit;
		const mine = filmsOf.get(p.pid) ?? [];
		const r = record.get(p.pid);
		const withAud = mine.filter((m) => m.audienceScore !== undefined);
		const genres = new Map<FilmGenre, Movie[]>();
		for (const m of mine) (genres.get(m.genre) ?? genres.set(m.genre, []).get(m.genre)!).push(m);
		let topGenre: PStats["topGenre"];
		for (const [genre, list] of genres) {
			if (!topGenre || list.length > topGenre.n) topGenre = { genre, n: list.length, avg: average(list.map((m) => m.criticScore ?? 0)) };
		}
		const s: PStats = {
			films: mine,
			gross: mine.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0),
			avgCritics: mine.length ? average(mine.map((m) => m.criticScore ?? 0)) : null,
			avgAudience: withAud.length ? average(withAud.map((m) => m.audienceScore ?? 0)) : null,
			dirWins: r?.dir ?? [],
			leadWins: r?.lead ?? [],
			suppWins: r?.supp ?? [],
			noms: r?.noms ?? 0,
			pictureWins: p.role === "director" ? mine.filter((m) => m.directorPid === p.pid && pictureMids.has(m.mid)).length : 0,
			lastWin: r?.last ? { season: r.last.season, label: awardLabel(r.last.key) } : undefined,
			topGenre,
		};
		cache.set(p.pid, s);
		return s;
	};

	// ── league tables for the percentiles ──
	const tables: Record<"dir" | "act", { crit: number[]; gross: number[]; aud: number[] }> = {
		dir: { crit: [], gross: [], aud: [] },
		act: { crit: [], gross: [], aud: [] },
	};
	for (const [pid, list] of filmsOf) {
		const p = byId.get(pid);
		if (!p || list.length < 2) continue;
		const t = tables[p.role === "director" ? "dir" : "act"];
		const s = stat(p);
		t.crit.push(s.avgCritics ?? 0);
		t.gross.push(s.gross);
		if (s.avgAudience !== null) t.aud.push(s.avgAudience);
	}
	const table = (p: Person) => tables[p.role === "director" ? "dir" : "act"];

	const active = state.people.filter((p) => p.tid !== RETIRED);
	const ovrOf = new Map(state.people.map((p) => [p.pid, ovr(p.attrs, p.role)]));
	const starOf = (p: Person) => (p.attrs.charisma + p.attrs.audienceConnection) / 2;
	const ranking = (p: Person) =>
		active.filter((x) => x.role === p.role && (p.role === "director" || x.gender === p.gender)).sort((a, b) => ovrOf.get(b.pid)! - ovrOf.get(a.pid)! || a.pid - b.pid);
	const ranks = new Map<string, Map<number, number>>();
	const ovrRank = (p: Person): number => {
		if (p.tid === RETIRED) return 999;
		const key = p.role === "director" ? "director" : p.gender;
		let m = ranks.get(key);
		if (!m) {
			m = new Map(ranking(p).map((x, i) => [x.pid, i + 1]));
			ranks.set(key, m);
		}
		return m.get(p.pid) ?? 999;
	};
	const actorsActive = active.filter((p) => p.role === "actor");
	const starTable = actorsActive.map(starOf);
	const ovrTable = (role: Person["role"]) => active.filter((p) => p.role === role).map((p) => ovrOf.get(p.pid)!);
	const ovrTables = { actor: ovrTable("actor"), director: ovrTable("director") };

	// ── the all-time greats ──
	const legacies = films.length >= 25 ? filmLegacies({ ...state, movies: films, awards: ceremonies }).sort((a, b) => b.goat - a.goat) : [];
	const greats = legacies.slice(0, 3).map((l) => l.movie);
	const grossKing = films.length >= 20 ? [...films].sort((a, b) => (b.boxOffice ?? 0) - (a.boxOffice ?? 0))[0] : undefined;
	const critTable = everyFilm.map((m) => m.criticScore ?? 0);
	const grossTable = everyFilm.map((m) => m.boxOffice ?? 0);

	const critPct = (p: Person): number | null => {
		const s = stat(p);
		return s.films.length >= 2 && s.avgCritics !== null ? percentile(table(p).crit, s.avgCritics) : null;
	};

	// ── how to introduce a person ──
	const descs = (p: Person): Desc[] => {
		const s = stat(p);
		const out: Desc[] = [];
		const add = (text: string, kind: Desc["kind"], score: number) => out.push({ text, kind, score });
		const actor = p.role === "actor";
		const female = p.gender === "female";
		const L = s.leadWins.length;
		const S = s.suppWins.length;
		const D = s.dirWins.length;
		const wins = actor ? L + S : D;
		const lead = female ? "Best Actress" : "Best Actor";
		const supp = female ? "Best Supporting Actress" : "Best Supporting Actor";
		const t = table(p);
		const crit = critPct(p);
		const gross = s.films.length >= 3 ? percentile(t.gross, s.gross) : null;
		const reign = s.lastWin && s.lastWin.season === asOf - 1 ? s.lastWin.label : null;
		const retired = p.tid === RETIRED;

		// Awards: the strongest introductions.
		if (reign) {
			const lead1 = fresh ? "reigning" : "last year's";
			const times = actor ? L + S : D;
			add(times >= 2 ? `${lead1} ${reign} and ${nTime(times)} winner` : `${lead1} ${reign}`, "noun", times >= 2 ? 118 : 108);
		}
		if (actor) {
			if (L >= 2) add(`${nTime(L)} ${lead} winner`, "noun", 82 + 8 * L);
			else if (L === 1) add(`${lead} winner`, "noun", 66);
			if (L === 0 && S >= 2) add(`${nTime(S)} ${supp} winner`, "noun", 62 + 6 * S);
			else if (L === 0 && S === 1) add(`${supp} winner`, "noun", 54);
			if (L >= 1 && S >= 1) add(`${nTime(L + S)} acting winner`, "noun", 80 + 8 * (L + S));
		} else {
			if (D >= 2) add(`${nTime(D)} Best Director winner`, "noun", 84 + 9 * D);
			else if (D === 1) add("Best Director winner", "noun", 68);
			if (s.pictureWins >= 2) add(`${nTime(s.pictureWins)} Best Picture-winning director`, "noun", 82 + 5 * s.pictureWins);
			else if (s.pictureWins === 1) add("Best Picture-winning director", "noun", 72);
		}
		if (wins >= 3 || (retired && wins >= 2)) add(actor ? "screen legend" : "master filmmaker", "noun", 92);
		if (wins === 0 && s.noms >= 3) add(s.noms >= 5 ? `${nTime(s.noms)} nominee still waiting for a win` : "perennial nominee", "noun", 60 + s.noms);
		if (wins === 0 && s.noms >= 2) add("twice-nominated", "adj", 44);

		// Standing in the industry.
		if (!retired && !hide) {
			const rank = ovrRank(p);
			if (rank === 1) add(actor ? (female ? "top-rated actress" : "top-rated actor") : "top-rated director", "noun", 74);
			else if (rank <= 3 && actor) add("A-list", "adj", 50);
			else if (rank <= 3) add("in-demand", "adj", 48);
			if (p.age >= (actor ? 58 : 64)) add(actor ? "screen veteran" : "veteran filmmaker", "noun", 48);
			const myOvr = ovrOf.get(p.pid)!;
			const ovrPct = percentile(ovrTables[p.role], myOvr);
			if (actor && p.age <= 27 && ovrPct >= 0.7) add("rising star", "noun", 64);
			if (!actor && p.age <= 36 && ovrPct >= 0.75) add("wunderkind director", "noun", 64);
		}
		if (crit !== null && s.films.length >= 3 && crit >= 0.85) add("critically acclaimed", "adj", 66);
		else if (crit !== null && crit >= 0.7) add("critically admired", "adj", 46);
		if (gross !== null && gross >= 0.9) add(actor ? (female ? "box-office queen" : "box-office king") : "blockbuster maestro", "noun", actor ? 70 : 62);
		else if (gross !== null && gross >= 0.75) add(actor ? "box-office draw" : "proven hitmaker", "noun", 50);
		if (actor && !retired) {
			const star = percentile(starTable, starOf(p));
			const aud = s.avgAudience !== null && s.films.length >= 2 ? percentile(t.aud, s.avgAudience) : 0.7;
			if (star >= 0.86 && aud >= 0.55) add(female || chance(0.4) ? "audience sweetheart" : "audience favorite", "noun", 70);
			else if (aud >= 0.85 && (crit ?? 1) < 0.5) add("crowd-pleaser", "noun", 52);
		}

		// What they are known for.
		const has = (sp: Person["specialties"][number]) => p.specialties.includes(sp);
		if (actor) {
			if (has("action")) add("action star", "noun", 50);
			if (has("comedy")) add("comedy favorite", "noun", 50);
			if (has("romantic")) add("romantic lead", "noun", 50);
			if (has("dramatic")) add("dramatic heavyweight", "noun", 52);
			if (has("character")) add("screen chameleon", "noun", 48);
			if (has("experimental")) add("boundary-pusher", "noun", 44);
			if (has("versatile")) add("versatile talent", "noun", 40);
			if (s.topGenre && s.topGenre.genre === "horror" && female && s.topGenre.n >= 2) add("scream queen", "noun", 58);
		} else {
			if (has("auteur")) add("visionary auteur", "noun", 56);
			if (has("visualStorytelling")) add("visual stylist", "noun", 52);
			if (has("experimental")) add("boundary-pushing filmmaker", "noun", 50);
			if (has("action")) add("action maestro", "noun", 50);
			if (has("comedy")) add("comedy specialist", "noun", 46);
			if (has("character")) add("actor's director", "noun", 50);
			if (has("commercial")) add("crowd-pleasing filmmaker", "noun", 48);
			if (has("romantic")) add("romance specialist", "noun", 46);
		}
		if (s.topGenre && s.topGenre.n >= 3 && s.topGenre.avg >= 70) add(actor ? `${GENRE_WORD[s.topGenre.genre]} regular` : `${GENRE_WORD[s.topGenre.genre]} maestro`, "noun", 54);

		// Asides about the one film everyone knows them for.
		const famous = greats.find((m) => (actor ? m.castPids.includes(p.pid) : m.directorPid === p.pid));
		if (famous) {
			add(
				actor ? `the star of arguably one of the best films ever made, ${mTok(famous.mid, famous.title)}` : `the director of arguably one of the best films ever made, ${mTok(famous.mid, famous.title)}`,
				"post",
				80,
			);
		}
		if (grossKing && (actor ? grossKing.castPids.includes(p.pid) : grossKing.directorPid === p.pid)) {
			add(`${actor ? "a star of" : "the filmmaker behind"} the highest-grossing film ever made, ${mTok(grossKing.mid, grossKing.title)}`, "post", 78);
		}
		return out.filter((d) => d.kind === "post" || d.score >= 40);
	};

	// ── how to introduce a film ──
	const filmDesc = (m: Movie): string => {
		const bp = state.awards.some((a) => a.bestPicture.mid === m.mid);
		if (bp) return "Best Picture winner";
		if (greats.some((g) => g.mid === m.mid)) return "all-time classic";
		const sequel = (m.installment ?? 1) > 1;
		const noun = sequel ? `${GENRE_NOUN[m.genre].replace(/ (film|epic)$/, "")} sequel` : GENRE_NOUN[m.genre];
		const critic = m.criticScore !== undefined ? percentile(critTable, m.criticScore) : 0.5;
		const gross = m.boxOffice !== undefined ? percentile(grossTable, m.boxOffice) : 0.5;
		const adj = critic >= 0.9 ? "critically adored" : gross >= 0.9 ? "blockbuster" : critic <= 0.1 ? "critically battered" : critic >= 0.75 ? "well-reviewed" : "";
		if (!adj && !sequel && chance(0.5)) return "";
		return `the ${adj ? adj + " " : ""}${noun}`;
	};

	const scope = (): Scope => {
		const seen = new Set<number>();
		const usedText = new Set<string>(); // epithets already used in this article, so two people are not given the same one
		const tok = (p: Person) => pTok(p.pid, p.name);
		const last = (p: Person) => pTok(p.pid, lastName(p.name));
		return {
			tok,
			last,
			ref(p, o = {}) {
				if (seen.has(p.pid)) return last(p);
				seen.add(p.pid);
				if (o.desc === false) return tok(p);
				const ranked = descs(p)
					.map((d) => ({ d, s: d.score + (Math.random() * 14 - 7) }))
					.sort((a, b) => b.s - a.s)
					.map((x) => x.d);
				const noun = ranked.find((d) => d.kind === "noun" && !usedText.has(d.text));
				const adj = ranked.find((d) => d.kind === "adj" && !usedText.has(d.text));
				if (noun) usedText.add(noun.text);
				const post = !o.short && o.post ? ranked.find((d) => d.kind === "post") : undefined;
				if (post && chance(0.65)) return `${tok(p)}, ${post.text},`;
				if (o.short) return noun && noun.text.length <= 34 ? `${noun.text} ${tok(p)}` : tok(p);
				const useAdj = !!adj && (!noun || (chance(0.35) && !/^(last year's|reigning)/.test(noun.text)));
				if (noun && useAdj) return `${adj!.text} ${noun.text} ${tok(p)}`;
				if (noun) return `${noun.text} ${tok(p)}`;
				if (adj) return `the ${adj.text} ${tok(p)}`;
				return tok(p);
			},
			film(m, o = {}) {
				const t = mTok(m.mid, m.title);
				if (!o.desc) return t;
				const d = filmDesc(m);
				return d ? `${d} ${t}` : t;
			},
		};
	};

	return { asOf, scope, stat, descs, ovrRank, greats, critPct };
};
