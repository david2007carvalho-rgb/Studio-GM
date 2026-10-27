import { GENRE_SPECIALTIES, SPECIALTY_GENRE_BONUS, VERSATILE_GENRE_BONUS } from "./constants";
import type { FilmGenre, ProductionRatings, ProductionRole, Specialty } from "./types";

/**
 * Rating bonus a person's specialties give in a genre.
 * A specialty matching the genre gives +3 and takes priority; otherwise
 * Versatile gives +1 in every genre. Bonuses never stack.
 */
export const specialtyBonus = (specialties: Specialty[], genre: FilmGenre): number => {
	if (specialties.some((s) => GENRE_SPECIALTIES[genre].includes(s))) return SPECIALTY_GENRE_BONUS;
	if (specialties.includes("versatile")) return VERSATILE_GENRE_BONUS;
	return 0;
};

type Weights = Partial<Record<keyof ProductionRatings, number>>;

// General Overall weights. Each role's weights sum to 1.
const overallWeights: Record<ProductionRole, Weights> = {
	actor: {
		charisma: 0.15,
		immersion: 0.16,
		humour: 0.08,
		versatility: 0.10,
		vision: 0.05,
		technique: 0.13,
		emotionalRange: 0.12,
		originality: 0.08,
		audienceConnection: 0.13,
	},
	director: {
		charisma: 0.05,
		immersion: 0.10,
		humour: 0.05,
		versatility: 0.10,
		vision: 0.18,
		technique: 0.17,
		emotionalRange: 0.10,
		originality: 0.13,
		audienceConnection: 0.12,
	},
};

// Genre-specific importance. Unlisted attributes have zero weight.
// Weights are normalized automatically.
const genreWeights: Record<FilmGenre, Weights> = {
	comedy: { charisma: 0.20, humour: 0.30, technique: 0.15, originality: 0.15, audienceConnection: 0.20 },
	drama: { immersion: 0.25, technique: 0.15, emotionalRange: 0.30, originality: 0.10, audienceConnection: 0.20 },
	thriller: { immersion: 0.20, vision: 0.20, technique: 0.20, originality: 0.20, audienceConnection: 0.20 },
	romance: { charisma: 0.20, immersion: 0.20, versatility: 0.10, emotionalRange: 0.20, audienceConnection: 0.30 },
	action: { charisma: 0.15, versatility: 0.15, vision: 0.15, technique: 0.25, originality: 0.10, audienceConnection: 0.20 },
	horror: { immersion: 0.20, vision: 0.20, technique: 0.20, originality: 0.20, audienceConnection: 0.20 },
	crime: { immersion: 0.20, vision: 0.15, technique: 0.20, emotionalRange: 0.15, originality: 0.15, audienceConnection: 0.15 },
	sciFiFantasy: { versatility: 0.15, vision: 0.25, technique: 0.20, originality: 0.25, audienceConnection: 0.15 },
	adventure: { charisma: 0.15, versatility: 0.15, vision: 0.20, technique: 0.20, originality: 0.10, audienceConnection: 0.20 },
};

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const weightedAverage = (ratings: ProductionRatings, weights: Weights): number => {
	let total = 0;
	let totalWeight = 0;

	for (const key of Object.keys(weights) as (keyof ProductionRatings)[]) {
		const weight = weights[key] ?? 0;
		total += ratings[key] * weight;
		totalWeight += weight;
	}

	return totalWeight === 0 ? 0 : total / totalWeight;
};

/** Calculates the general Overall rating. */
export const ovr = (ratings: ProductionRatings, role: ProductionRole): number => {
	return clamp(Math.round(weightedAverage(ratings, overallWeights[role])), 0, 100);
};

/**
 * Calculates how well a person's attributes fit a film genre.
 * Returns a modifier between -10 and +10.
 */
export const genreFit = (
	ratings: ProductionRatings,
	role: ProductionRole,
	genre: FilmGenre,
): number => {
	const baseRating = weightedAverage(ratings, overallWeights[role]);
	const genreRating = weightedAverage(ratings, genreWeights[genre]);
	return clamp(Math.round(genreRating - baseRating), -10, 10);
};

/** Calculates the effective rating for a specific genre. */
export const genreOvr = (
	ratings: ProductionRatings,
	role: ProductionRole,
	genre: FilmGenre,
): number => {
	return clamp(ovr(ratings, role) + genreFit(ratings, role, genre), 0, 100);
};
