import { MIN_LEADS, MIN_SUPPORTING } from "./constants";
import type { CastRole, Movie } from "./types";

// ─────────────────────────────────────────────────────────────
// Lead vs. supporting billing. An actor's role belongs to one film,
// not to the person: Movie.leadPids lists who is a lead in that film.
// ─────────────────────────────────────────────────────────────

/** Is this actor a lead in this film? Films from older saves have no leadPids: everyone counts as a lead. */
export const isLead = (movie: Pick<Movie, "leadPids">, pid: number): boolean =>
	movie.leadPids === undefined || movie.leadPids.includes(pid);

export const castRole = (movie: Pick<Movie, "leadPids">, pid: number): CastRole =>
	isLead(movie, pid) ? "lead" : "supporting";

/** The cast split by billing, keeping the original order inside each group. */
export const splitCast = (movie: Pick<Movie, "castPids" | "leadPids">): { leads: number[]; supporting: number[] } => ({
	leads: movie.castPids.filter((pid) => isLead(movie, pid)),
	supporting: movie.castPids.filter((pid) => !isLead(movie, pid)),
});

/** null = the billing is allowed. Otherwise a message for the player. */
export const billingError = (castPids: number[], leadPids: number[]): string | null => {
	const leads = castPids.filter((pid) => leadPids.includes(pid)).length;
	const supporting = castPids.length - leads;
	if (leads < MIN_LEADS) return `Give at least ${MIN_LEADS} actor a lead role.`;
	if (supporting < MIN_SUPPORTING) return `Give at least ${MIN_SUPPORTING} actor a supporting role.`;
	return null;
};
