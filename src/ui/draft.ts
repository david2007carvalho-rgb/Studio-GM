import { genTitle } from "../game/generate";
import type { GreenlightPlan } from "../game/phase";

/** Empty form for a new film. */
export const newDraft = (): GreenlightPlan => ({
	title: genTitle("drama"),
	genre: "drama",
	sequelOfMid: null,
	propertyId: null,
	directorPid: null,
	castPids: [],
	leadPids: [],
	extraBudget: 0,
	marketingPct: 30,
	platformId: null,
	release: "wide",
	scriptId: null,
	directorPitchId: null,
	brands: [],
});
