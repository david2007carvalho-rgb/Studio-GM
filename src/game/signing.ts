import { billingError, isLead } from "./cast";
import { CAST_SIZE, RETIRED } from "./constants";
import { refusalReason } from "./hiring";
import type { GreenlightPlan } from "./phase";
import type { GameState, Movie } from "./types";

export type SigningReport = {
	plan: GreenlightPlan;
	signed: string[]; // names now attached to the plan
	skipped: string[]; // "Name: reason" for everyone who could not come back
};

/**
 * Sign every returning actor and director of `prequel` into the plan.
 * - The prequel's director replaces the current one (if available).
 * - Returning actors keep their billing (lead / supporting) from the prequel.
 * - Anyone retired or refusing your studio is skipped, with the reason.
 * - Actors you had already picked stay if there is room left.
 * Pure: returns a new plan, never changes `state`.
 */
export const signReturningTalent = (state: GameState, prequel: Movie, plan: GreenlightPlan): SigningReport => {
	const signed: string[] = [];
	const skipped: string[] = [];

	const check = (pid: number, role: "director" | "actor") => {
		const p = state.people.find((x) => x.pid === pid && x.role === role);
		if (!p) return null;
		if (p.tid === RETIRED) {
			skipped.push(`${p.name}: retired`);
			return null;
		}
		const reason = refusalReason(state, p);
		if (reason) {
			skipped.push(`${p.name}: refuses your studio`);
			return null;
		}
		return p;
	};

	// Director
	const director = check(prequel.directorPid, "director");
	const directorPid = director ? director.pid : plan.directorPid;
	if (director) signed.push(`${director.name} (director)`);

	// Cast: returning actors first, then whoever was already picked, up to CAST_SIZE
	const returning = prequel.castPids.map((pid) => check(pid, "actor")).filter((p) => p !== null);
	const returningPids = returning.map((p) => p.pid);
	const kept = plan.castPids.filter((pid) => !returningPids.includes(pid));
	const castPids = [...returningPids, ...kept].slice(0, CAST_SIZE);
	returning.forEach((p) => signed.push(`${p.name} (${isLead(prequel, p.pid) ? "lead" : "supporting"})`));

	// Billing: returning actors keep theirs; previously picked actors keep what they had.
	let leadPids = castPids.filter((pid) =>
		returningPids.includes(pid) ? isLead(prequel, pid) : plan.leadPids.includes(pid),
	);
	// Make the billing legal once the cast is full (min 1 lead, min 1 supporting).
	if (castPids.length === CAST_SIZE && billingError(castPids, leadPids)) {
		if (leadPids.length === 0) leadPids = [castPids[0]];
		else if (leadPids.length === castPids.length) leadPids = leadPids.slice(0, -1);
	}

	return { plan: { ...plan, directorPid, castPids, leadPids }, signed, skipped };
};
