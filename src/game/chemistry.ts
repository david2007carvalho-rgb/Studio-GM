import {
	CHEMISTRY_ACTOR_ACTOR,
	CHEMISTRY_CAP_UNITS,
	CHEMISTRY_DIRECTOR_ACTOR,
	CHEMISTRY_GATE,
	CHEMISTRY_MAX,
} from "./constants";
import { clamp } from "./random";
import type { Movie } from "./types";

// ═════════════════════════════════════════════════════════════
// Chemistry: people who have made films together before work better together.
//   1. Find the pairs on this film who already shared earlier released films.
//   2. Each pair adds units (director+actor counts more than actor+actor, with diminishing returns).
//   3. Units -> a bonus of up to CHEMISTRY_MAX quality points...
//   4. ...scaled by how good the film already is (the "gate"), so it rewards good teams
//      and does almost nothing for a bad one.
// ═════════════════════════════════════════════════════════════

export type Duo = {
	a: number; // pid (the director for a director-actor duo)
	b: number; // pid
	kind: "director-actor" | "actor-actor";
	films: number; // earlier films they made together
	units: number;
};

/** Pairs on this film that have worked together on earlier, released films. */
export const returningDuos = (
	directorPid: number | null,
	castPids: number[],
	season: number,
	movies: Movie[],
): Duo[] => {
	const before = movies.filter((m) => m.season < season && m.boxOffice !== undefined);
	const duos: Duo[] = [];
	const add = (a: number, b: number, kind: Duo["kind"], weight: number, together: (m: Movie) => boolean) => {
		const films = before.filter(together).length;
		if (films > 0) duos.push({ a, b, kind, films, units: weight * (1 - Math.pow(0.5, films)) });
	};
	if (directorPid !== null) {
		for (const pid of castPids) {
			add(directorPid, pid, "director-actor", CHEMISTRY_DIRECTOR_ACTOR, (m) => m.directorPid === directorPid && m.castPids.includes(pid));
		}
	}
	for (let i = 0; i < castPids.length; i++) {
		for (let j = i + 1; j < castPids.length; j++) {
			const [x, y] = [castPids[i], castPids[j]];
			add(x, y, "actor-actor", CHEMISTRY_ACTOR_ACTOR, (m) => m.castPids.includes(x) && m.castPids.includes(y));
		}
	}
	return duos;
};

/** The most chemistry could add to this film's quality, before looking at how good the film is. */
export const chemistryPotential = (duos: Duo[]): number =>
	CHEMISTRY_MAX * Math.min(1, duos.reduce((sum, d) => sum + d.units, 0) / CHEMISTRY_CAP_UNITS);

/** 0-1: how much of the potential applies. Rises with the film's quality (team fit + production value). */
export const chemistryGate = (quality: number): number =>
	clamp((quality - CHEMISTRY_GATE.low) / (CHEMISTRY_GATE.high - CHEMISTRY_GATE.low), 0, 1);

/** Quality points chemistry adds to a film whose quality (before luck) is `quality`. */
export const chemistryBonus = (movie: Movie, quality: number, history: Movie[]): number =>
	chemistryPotential(returningDuos(movie.directorPid, movie.castPids, movie.season, history)) * chemistryGate(quality);
