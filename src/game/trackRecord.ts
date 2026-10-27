import type { FilmGenre, GameState } from "./types";

type Source = Pick<GameState, "movies" | "awards">;

// ═════════════════════════════════════════════════════════════
// Track record: what a person has actually done in this game (released films, reviews, box office, awards).
// It is how talent is judged and sorted when the game was started with "Hide ratings".
// Only released films count, so in the first season nobody has a record yet.
// ═════════════════════════════════════════════════════════════

export type TrackRecord = {
	films: number;
	gross: number; // total box office of their films
	critics: number | null; // average critic score of their films
	genreFilms: number; // films in the chosen genre
	genreCritics: number | null; // average critic score in the chosen genre
	wins: number; // person awards won (Best Director / Actor / Actress / Supporting)
	noms: number; // nominations, wins included
};

const PERSON_CATS = ["bestDirector", "bestActor", "bestActress", "bestSupportingActor", "bestSupportingActress"] as const;

const empty = (): TrackRecord => ({ films: 0, gross: 0, critics: null, genreFilms: 0, genreCritics: null, wins: 0, noms: 0 });

/** The record of everyone who has one, for the chosen genre. People with no record are not in the map (use `empty`-like defaults). */
export const trackRecords = (state: Source, genre: FilmGenre): Map<number, TrackRecord> => {
	const out = new Map<number, TrackRecord>();
	const rec = (pid: number): TrackRecord => out.get(pid) ?? out.set(pid, empty()).get(pid)!;
	const sums = new Map<number, { critics: number; gc: number }>();

	for (const m of state.movies) {
		if (m.boxOffice === undefined || m.criticScore === undefined) continue;
		for (const pid of [m.directorPid, ...m.castPids]) {
			const r = rec(pid);
			const s = sums.get(pid) ?? sums.set(pid, { critics: 0, gc: 0 }).get(pid)!;
			r.films++;
			r.gross += m.boxOffice;
			s.critics += m.criticScore;
			if (m.genre === genre) {
				r.genreFilms++;
				s.gc += m.criticScore;
			}
		}
	}
	for (const [pid, s] of sums) {
		const r = out.get(pid)!;
		r.critics = Math.round(s.critics / r.films);
		r.genreCritics = r.genreFilms ? Math.round(s.gc / r.genreFilms) : null;
	}

	for (const a of state.awards) {
		for (const c of PERSON_CATS) {
			const nominated = new Set<number>();
			for (const e of a.nominees?.[c] ?? []) if (e.pid !== undefined) nominated.add(e.pid);
			const w = a[c]?.pid;
			if (w !== undefined) {
				nominated.add(w);
				rec(w).wins++;
			}
			for (const pid of nominated) rec(pid).noms++;
		}
	}
	return out;
};

export const noRecord = (): TrackRecord => empty();
