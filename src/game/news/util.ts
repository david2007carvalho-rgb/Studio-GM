import { choice } from "../random";
import type { GameState, NewsItem, Person } from "../types";

/** An article before it gets its id, issue, season and phase. */
export type Draft = Omit<NewsItem, "id" | "issue" | "season" | "phase">;

// ─────────────────────────────────────────────────────────────
// Small helpers for the news writers. Nothing here touches the game.
// ─────────────────────────────────────────────────────────────

export const pick = choice;
export const chance = (p: number): boolean => Math.random() < p;
export const between = (a: number, b: number): number => a + Math.random() * (b - a);
/** Random whole number between a and b (both included). */
export const rint = (a: number, b: number): number => Math.floor(between(a, b + 1));
/** Round to one decimal. */
export const r1 = (x: number): number => Math.round(x * 10) / 10;

const WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const ORD = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

/** 3 -> "three" (digits above twelve). */
export const num = (n: number): string => WORD[n] ?? String(n);
/** 3 -> "three-time". */
export const nTime = (n: number): string => `${WORD[n] ?? n}-time`;
/** 3 -> "third". */
export const nth = (n: number): string => ORD[n] ?? `${n}th`;
/** "1 film", "2 films". */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export const he = (p: Pick<Person, "gender">): string => (p.gender === "female" ? "she" : "he");
export const his = (p: Pick<Person, "gender">): string => (p.gender === "female" ? "her" : "his");
export const him = (p: Pick<Person, "gender">): string => (p.gender === "female" ? "her" : "him");

/** "a comedy", "an action film". */
export const an = (noun: string): string => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
/** "Aurora Pictures'", "Sunset Row's". */
export const poss = (name: string): string => (stripTokens(name).endsWith("s") ? `${name}'` : `${name}'s`);
/** "an 86", "a 74" (numbers read aloud: eight, eleven, eighteen start with a vowel sound). */
export const aNum = (n: number | string | undefined): string => `${/^(8|11|18)/.test(String(n)) ? "an" : "a"} ${n ?? "n/a"}`;

export const studioName = (state: GameState, tid: number): string => state.studios.find((s) => s.tid === tid)?.name ?? "A rival studio";
export const lastName = (name: string): string => {
	const parts = name.trim().split(/\s+/);
	return parts.length > 1 ? parts[parts.length - 1] : name;
};

// ── name tokens ──────────────────────────────────────────────
// [[p:12|Name]] is a person, [[m:34|Title]] a film. The News page turns them into clickable names.

export const pTok = (pid: number, name: string): string => `[[p:${pid}|${name}]]`;
export const mTok = (mid: number, title: string): string => `[[m:${mid}|${title}]]`;

const TOKEN = /\[\[([pm]):(\d+)\|([^\]]*)\]\]/g;

/** Split text into plain pieces and tokens (the UI uses this too). */
export type Piece = { text: string } | { kind: "p" | "m"; id: number; text: string };
export const parseTokens = (text: string): Piece[] => {
	const out: Piece[] = [];
	let last = 0;
	for (const m of text.matchAll(TOKEN)) {
		if (m.index! > last) out.push({ text: text.slice(last, m.index) });
		out.push({ kind: m[1] as "p" | "m", id: Number(m[2]), text: m[3] });
		last = m.index! + m[0].length;
	}
	if (last < text.length) out.push({ text: text.slice(last) });
	return out;
};

/** The text without the token markup ("Name", "Title"). */
export const stripTokens = (text: string): string => text.replace(TOKEN, "$3");

/**
 * Clean up punctuation after phrases were glued together: ", ." -> ".", ",," -> ",", double spaces.
 * An epithet that is written as an aside ("X, the director of Y,") needs this when it ends a sentence.
 * Tokens are set aside while cleaning so a title can never be touched.
 */
export const tidy = (s: string): string => {
	const held: string[] = [];
	const hidden = s.replace(TOKEN, (t) => `\u0001${held.push(t) - 1}\u0001`);
	const clean = hidden
		.replace(/,(\s*,)+/g, ",")
		.replace(/,\s*([.!?;:)])/g, "$1")
		.replace(/\(\s*,/g, "(")
		.replace(/\s{2,}/g, " ")
		.replace(/\s+([,.!?;:])/g, "$1")
		.replace(/([.!?]["”]?\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()) // a sentence that starts with an epithet
		.trim();
	return clean.replace(/\u0001(\d+)\u0001/g, (_, i) => held[Number(i)]);
};

/** Capital letter at the start (names and films already have one). */
export const cap = (s: string): string => (s.startsWith("[[") || s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));

/** tidy + cap: the final polish for every headline and paragraph. */
export const polish = (s: string): string => cap(tidy(s));

/** Pick a few distinct items from a list. */
export const sample = <T,>(list: readonly T[], n: number): T[] => {
	const copy = [...list];
	const out: T[] = [];
	while (out.length < n && copy.length > 0) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
	return out;
};

/** "A", "A and B", "A, B and C". */
export const andList = (items: string[]): string =>
	items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Share of `values` that are at or below `v` (0..1). */
export const percentile = (values: number[], v: number): number =>
	values.length === 0 ? 0.5 : values.filter((x) => x <= v).length / values.length;
