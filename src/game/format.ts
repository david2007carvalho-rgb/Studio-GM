import type { AttributeKey, FilmGenre, Specialty } from "./types";

/** Money is stored in thousands of $. 12500 -> "$12.5M". */
export const fmtMoney = (thousands: number): string => {
	const abs = Math.abs(thousands);
	const sign = thousands < 0 ? "-" : "";
	if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}B`;
	if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 100_000 ? 0 : 1)}M`;
	return `${sign}$${abs}k`;
};

export const GENRE_LABEL: Record<FilmGenre, string> = {
	comedy: "Comedy",
	drama: "Drama",
	thriller: "Thriller",
	romance: "Romance",
	action: "Action",
	horror: "Horror",
	crime: "Crime",
	sciFiFantasy: "Sci-fi / Fantasy",
	adventure: "Adventure",
};

export const SPECIALTY_LABEL: Record<Specialty, string> = {
	comedy: "Comedy",
	dramatic: "Dramatic",
	romantic: "Romantic",
	character: "Character",
	action: "Action",
	auteur: "Auteur",
	visualStorytelling: "Visual storyteller",
	experimental: "Experimental",
	commercial: "Commercial",
	versatile: "Versatile",
};

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
	charisma: "Charisma",
	immersion: "Immersion",
	humour: "Humour",
	versatility: "Versatility",
	vision: "Vision",
	technique: "Technique",
	emotionalRange: "Emotional range",
	originality: "Originality",
	audienceConnection: "Audience connection",
};

export const ATTRIBUTE_SHORT: Record<AttributeKey, string> = {
	charisma: "Cha",
	immersion: "Imm",
	humour: "Hum",
	versatility: "Ver",
	vision: "Vis",
	technique: "Tec",
	emotionalRange: "Emo",
	originality: "Ori",
	audienceConnection: "Aud",
};
