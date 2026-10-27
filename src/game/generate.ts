import { FREE_AGENT, SPECIALTY_ATTRIBUTES } from "./constants";
import { estimatePot, growthLeft } from "./develop";
import { maxSpecialties } from "./mentor";
import { genName } from "./names";
import { ovr } from "./ovr";
import { choice, clamp, gauss, randInt } from "./random";
import { genTraits } from "./traits";
import { ATTRIBUTE_KEYS } from "./types";
import type { Gender, Person, ProductionRatings, ProductionRole, Specialty } from "./types";

export const SPECIALTY_THRESHOLD = 75;
export const CONTRACT_GROWTH = 1.09;
export const CONTRACT_ANCHOR_OVR = 60; // this overall earns CONTRACT_ANCHOR_AMOUNT
export const CONTRACT_ANCHOR_AMOUNT = 2000; // thousands of $
export const CONTRACT_MIN = 100;
export const CONTRACT_ROUND = 50;
export const SPECIALTY_CHANCE = 0.6; // chance a new person is born with a specialty
export const SPECIALTY_BOOST = 28;


/**
 * Random attributes for a new person (each 0-100).
 * Some people are specialists: their specialty's attributes get a big boost.
 */
export const genAttributes = (age: number, specialties: Specialty[] = []): ProductionRatings => {
	const experience = clamp((age - 18) * 3, 0, 30); // careers mature by about 28
	const boosted = new Set(specialties.flatMap((s) => SPECIALTY_ATTRIBUTES[s]));
	const attrs = {} as ProductionRatings;
	for (const key of ATTRIBUTE_KEYS) {
		const boost = boosted.has(key) ? SPECIALTY_BOOST : 0;
		attrs[key] = Math.round(clamp(gauss(35 + experience + boost, 15)));
	}
	return attrs;
};

const genBirthSpecialties = (): Specialty[] => {
	if (Math.random() > SPECIALTY_CHANCE) return [];
	const all = Object.keys(SPECIALTY_ATTRIBUTES) as Specialty[];
	const first = choice(all);
	// 20% of specialists have a second specialty
	if (Math.random() < 0.2) {
		const second = choice(all.filter((s) => s !== first));
		return [first, second];
	}
	return [first];
};

export const genSpecialties = (r: ProductionRatings): Specialty[] => {
	const candidates: { specialty: Specialty; score: number }[] = [
		{ specialty: "comedy", score: (r.humour + r.charisma + r.audienceConnection) / 3 },
		{ specialty: "dramatic", score: (r.immersion + r.emotionalRange + r.technique) / 3 },
		{ specialty: "romantic", score: (r.charisma + r.emotionalRange + r.audienceConnection) / 3 },
		{ specialty: "character", score: (r.immersion + r.emotionalRange + r.originality) / 3 },
		{ specialty: "action", score: (r.charisma + r.technique + r.versatility) / 3 },
		{ specialty: "auteur", score: (r.vision + r.originality + r.technique) / 3 },
		{ specialty: "visualStorytelling", score: (r.vision + r.technique + r.immersion) / 3 },
		{ specialty: "experimental", score: (r.originality + r.vision + r.versatility) / 3 },
		{ specialty: "commercial", score: (r.charisma + r.audienceConnection + r.versatility) / 3 },
		{ specialty: "versatile", score: (r.versatility + r.emotionalRange + r.immersion) / 3 },
	];

	// Only specialties supported by genuinely strong attributes qualify.
	const qualified = candidates
		.filter((candidate) => candidate.score >= SPECIALTY_THRESHOLD)
		.sort((a, b) => b.score - a.score);

	// Most people have one or two specialties, not five.
	return qualified.slice(0, maxSpecialties(r)).map((candidate) => candidate.specialty);
};

export const genContract = (overall: number, season: number): Person["contract"] => {
	const rating = Math.max(0, Math.min(100, overall));
	const raw = CONTRACT_ANCHOR_AMOUNT * Math.pow(CONTRACT_GROWTH, rating - CONTRACT_ANCHOR_OVR);
	const amount = Math.max(CONTRACT_MIN, Math.round(raw / CONTRACT_ROUND) * CONTRACT_ROUND);
	return { amount, exp: season + randInt(1, 3) };
};

/**
 * How good newcomers will eventually be (their overall at the age they peak). The real roster is a
 * hand-picked list of legends, so invented people need a real chance of becoming stars too,
 * otherwise the talent pool slowly drains as the real generation retires.
 */
export const NEWCOMER_TIERS: { chance: number; mean: number; sd: number }[] = [
	{ chance: 0.05, mean: 91, sd: 3 }, // once-in-a-generation
	{ chance: 0.19, mean: 84, sd: 4 }, // stars
	{ chance: 0.76, mean: 68, sd: 9 }, // the working majority
];

const genPeakOvr = (): number => {
	let roll = Math.random();
	for (const tier of NEWCOMER_TIERS) {
		if (roll < tier.chance) return clamp(gauss(tier.mean, tier.sd), 40, 98);
		roll -= tier.chance;
	}
	return clamp(gauss(68, 9), 40, 98);
};

/** Shift all attributes by the same amount so the person's overall lands on `target` (specialty shape is kept). */
const shiftTo = (attrs: ProductionRatings, role: ProductionRole, target: number): ProductionRatings => {
	let shaped = attrs;
	for (let pass = 0; pass < 3; pass++) {
		const delta = target - ovr(shaped, role);
		if (Math.abs(delta) < 0.5) break;
		const next = {} as ProductionRatings;
		for (const key of ATTRIBUTE_KEYS) next[key] = Math.round(clamp(shaped[key] + delta));
		shaped = next;
	}
	return shaped;
};

/**
 * Create one new person. `pid` must be unique (the game state keeps a counter).
 */
export const genPerson = (
	pid: number,
	role: ProductionRole,
	season: number,
	age = role === "director" ? randInt(26, 58) : randInt(20, 55),
	takenNames?: Set<string>, // names already in the game, so nobody is created twice
): Person => {
	const gender: Gender = Math.random() < 0.5 ? "female" : "male";
	const born = genBirthSpecialties();
	// Decide how good they will become, then start them lower by the growth still ahead of them.
	const peak = genPeakOvr();
	const attrs = shiftTo(genAttributes(age, born), role, peak - growthLeft(age, role));
	const current = ovr(attrs, role);
	return {
		pid,
		name: genName(gender, takenNames),
		role,
		gender,
		age,
		attrs,
		specialties: genSpecialties(attrs),
		pot: estimatePot(current, age, role),
		contract: genContract(current, season),
		tid: FREE_AGENT,
		...genTraits(role, age, peak), // personality: hidden at first (see traits.ts)
	};
};

export { genSequelTitle, genTitle } from "./titles";
