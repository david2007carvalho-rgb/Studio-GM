import { heatWord } from "../rivalries";
import type { BondNote } from "../rivalries";
import type { GameState, Person } from "../types";
import type { Voice } from "./voice";
import { type Draft, pick } from "./util";

// ─────────────────────────────────────────────────────────────
// News about lasting feuds and friendships (rivalries.ts): the off-season gossip, reconciliations and fading quarrels.
// The on-set events that start or renew them are written by drama.ts.
// ─────────────────────────────────────────────────────────────

/** Articles for what happened to the bonds in the off-season. */
export const bondDrafts = (state: GameState, notes: BondNote[], voice: Voice): Draft[] => {
	const byId = new Map(state.people.map((p) => [p.pid, p]));
	const mineThisYear = (...pids: number[]) => state.movies.some((m) => m.tid === state.userTid && m.season === state.season && pids.some((pid) => m.directorPid === pid || m.castPids.includes(pid)));
	const out: Draft[] = [];
	for (const n of notes) {
		const a = byId.get(n.a) as Person | undefined;
		const b = byId.get(n.b) as Person | undefined;
		if (!a || !b) continue;
		const sc = voice.scope();
		const mine = mineThisYear(a.pid, b.pid);
		const since = n.type === "tabloid" ? state.season : n.since;
		const years = Math.max(1, state.season - since);
		if (n.type === "tabloid") {
			const feud = n.kind === "feud";
			out.push({
				kind: "rumor",
				rank: 3,
				headline: feud
					? pick([`${sc.tok(a)} and ${sc.tok(b)} trade barbs in public`, `War of words: ${sc.tok(a)} vs ${sc.tok(b)}`, `${sc.tok(a)} takes a shot at ${sc.tok(b)}`])
					: pick([`${sc.tok(a)} and ${sc.tok(b)}: friends, rivals, or both?`, `The ${sc.last(a)}-${sc.last(b)} rivalry is the industry's favorite sport`]),
				body: feud
					? [
							`${sc.ref(a, { post: true })} and ${sc.ref(b, { post: true })} are not speaking, if the ${pick(["trade papers", "tabloids", "interviews this month"])} are to be believed. ${sc.last(a)} reportedly said ${pick(["\"some people confuse fame with talent\"", "\"I don't do sequels to bad ideas\"", "\"we are not friends, and that's all I'll say\""])}.`,
							`Any studio that casts both should expect fireworks.`,
						]
					: [
							`${sc.ref(a, { post: true })} and ${sc.ref(b, { post: true })} cannot stop needling each other in public, and fans love it. Insiders say each pushes the other to be better.`,
							`A studio that casts both might get the best of both.`,
						],
				tags: [feud ? "FEUD" : "FRENEMIES"],
				mine,
				tone: mine ? "neutral" : undefined,
			});
		} else if (n.type === "reconcile") {
			out.push({
				kind: "drama",
				rank: 3,
				headline: pick([`${sc.tok(a)} and ${sc.tok(b)} bury the hatchet`, `After ${years} ${years === 1 ? "year" : "years"}, ${sc.tok(a)} and ${sc.tok(b)} make peace`]),
				body: [`${sc.ref(a, { post: true })} and ${sc.ref(b, { post: true })} have ended their feud, which began in ${since}. "Life is too short," one said in a joint statement.`, `Studios that avoided casting them together may now think again.`],
				tags: ["RECONCILED"],
				mine,
				tone: mine ? "good" : undefined,
			});
		}
		// "cooled": a quarrel that simply faded is not news
	}
	return out;
};

export { heatWord };
