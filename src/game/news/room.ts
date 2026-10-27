import { isLead } from "../cast";
import type { GameState, Movie, Person } from "../types";
import { type Draft, studioName } from "./util";
import { createVoice, type Voice } from "./voice";

// ─────────────────────────────────────────────────────────────
// The newsroom for one phase change: the game before and after, the voice that introduces people,
// and the articles written so far. Every news writer gets one of these.
// ─────────────────────────────────────────────────────────────

export type Room = {
	prev: GameState; // the game just before the phase change
	next: GameState; // the game after it (the news is about this)
	voice: Voice; // introduces people as they were going into the season
	out: Draft[];
	add: (d: Draft) => void;
	person: (pid: number) => Person;
	sn: (tid: number) => string;
	films: () => Movie[]; // this season's films
	prior: Movie[]; // released in earlier seasons
	isMine: (m: Movie) => boolean;
	director: (m: Movie) => Person;
	cast: (m: Movie) => Person[];
	leads: (m: Movie) => Person[];
	supporting: (m: Movie) => Person[];
	/** Earlier released films a director and an actor made together. */
	together: (a: number, b: number) => Movie[];
	/** Awards (all categories) won by these films. */
	awardsWon: (mids: number[]) => number;
};

export const makeRoom = (prev: GameState, next: GameState, voice?: Voice): Room => {
	const byId = new Map(next.people.map((p) => [p.pid, p]));
	const person = (pid: number): Person => {
		const p = byId.get(pid);
		if (!p) throw new Error(`Person ${pid} not found`);
		return p;
	};
	const prior = next.movies.filter((m) => m.season < next.season && m.boxOffice !== undefined && m.criticScore !== undefined);

	// who worked with whom before this season
	const pairs = new Map<string, Movie[]>();
	const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
	for (const m of [...prior].sort((x, y) => x.season - y.season)) {
		const pids = [m.directorPid, ...m.castPids];
		for (let i = 0; i < pids.length; i++) {
			for (let j = i + 1; j < pids.length; j++) {
				const k = key(pids[i], pids[j]);
				(pairs.get(k) ?? pairs.set(k, []).get(k)!).push(m);
			}
		}
	}

	const winsByMid = new Map<number, number>();
	for (const a of next.awards) {
		for (const w of [a.bestPicture, a.bestDirector, a.bestActor, a.bestActress, a.bestSupportingActor, a.bestSupportingActress]) {
			if (w) winsByMid.set(w.mid, (winsByMid.get(w.mid) ?? 0) + 1);
		}
	}

	const room: Room = {
		prev,
		next,
		voice: voice ?? createVoice(next),
		out: [],
		add: (d) => room.out.push(d),
		person,
		sn: (tid) => studioName(next, tid),
		films: () => next.movies.filter((m) => m.season === next.season),
		prior,
		isMine: (m) => m.tid === next.userTid,
		director: (m) => person(m.directorPid),
		cast: (m) => m.castPids.map(person),
		leads: (m) => m.castPids.filter((pid) => isLead(m, pid)).map(person),
		supporting: (m) => m.castPids.filter((pid) => !isLead(m, pid)).map(person),
		together: (a, b) => pairs.get(key(a, b)) ?? [],
		awardsWon: (mids) => mids.reduce((sum, mid) => sum + (winsByMid.get(mid) ?? 0), 0),
	};
	return room;
};
