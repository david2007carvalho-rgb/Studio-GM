import type { FilmGenre } from "./types";

// ═════════════════════════════════════════════════════════════
// The brands. Real companies; every number here is invented for the game (see brands.ts for the maths).
//   prestige 1-5: how deep its pockets are and how picky it is (also how much reputation your studio needs)
//   promo    1-5: how much cross-promotion it brings (ads, packaging, in-store tie-ins): lifts the gross
//   loves:  genres where the product belongs naturally (pays more, costs fewer critic points)
//   avoids: genres it will not touch
//   kinds:  what it does with you
//     placement  a product in the film (up to 3 per film)
//     sponsor    "presented by": much more money, much bigger critic cost (one per film)
//     studio     a yearly partnership with your whole studio (locks its category)
//     merch      action figures, toys, collectibles after a hit
//     game       a video game tie-in after a hit
//     tv         a spin-off series after a hit (the streaming services)
// ═════════════════════════════════════════════════════════════

export type BrandKind = "placement" | "sponsor" | "studio" | "merch" | "game" | "tv";
export type BrandCategory = "tech" | "drinks" | "alcohol" | "food" | "cars" | "fashion" | "luxury" | "travel" | "toys" | "games" | "tv";

export type Brand = {
	id: string;
	name: string;
	mark: string; // 1-3 letters for the badge
	color: string; // badge background
	ink: string; // badge text
	category: BrandCategory;
	kinds: BrandKind[];
	prestige: number;
	promo: number;
	loves: FilmGenre[];
	avoids: FilmGenre[];
	line: string; // one line on what they do with a film
	product?: string; // merch: what the line is called ("action figures")
};

const FAMILY_AVOIDS: FilmGenre[] = ["horror", "crime", "thriller", "romance", "drama"];
const DARK: FilmGenre[] = ["horror"];

export const CATEGORY_LABEL: Record<BrandCategory, string> = {
	tech: "Technology",
	drinks: "Soft drinks and coffee",
	alcohol: "Beer and spirits",
	food: "Fast food",
	cars: "Cars",
	fashion: "Sportswear and fashion",
	luxury: "Luxury",
	travel: "Travel",
	toys: "Toys and collectibles",
	games: "Video games",
	tv: "Television",
};

export const KIND_LABEL: Record<BrandKind, string> = {
	placement: "Product placement",
	sponsor: "Presenting sponsor",
	studio: "Studio partner",
	merch: "Merchandise",
	game: "Video game",
	tv: "TV series",
};

export const BRANDS: Brand[] = [
	// ── technology
	{ id: "apple", name: "Apple", mark: "", color: "#f5f5f7", ink: "#1d1d1f", category: "tech", kinds: ["placement", "sponsor", "studio"], prestige: 5, promo: 4, loves: ["sciFiFantasy", "thriller", "drama"], avoids: DARK, line: "Every laptop on screen glows white. Very particular about who uses it." },
	{ id: "samsung", name: "Samsung", mark: "S", color: "#1428a0", ink: "#fff", category: "tech", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 4, loves: ["action", "sciFiFantasy", "adventure"], avoids: [], line: "Phones, TVs and a very large marketing department." },
	{ id: "sony", name: "Sony", mark: "SONY", color: "#000", ink: "#fff", category: "tech", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 3, loves: ["action", "sciFiFantasy", "thriller"], avoids: [], line: "Cameras, headphones and TVs. Likes a film it can sell on its own screens." },
	{ id: "microsoft", name: "Microsoft", mark: "MS", color: "#00a4ef", ink: "#fff", category: "tech", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 3, loves: ["sciFiFantasy", "thriller", "drama"], avoids: DARK, line: "Surface laptops and a great deal of patience." },
	{ id: "google", name: "Google", mark: "G", color: "#fff", ink: "#4285f4", category: "tech", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 3, loves: ["comedy", "sciFiFantasy", "adventure"], avoids: DARK, line: "Pixel phones, search scenes and the odd cameo for Maps." },
	{ id: "amazon", name: "Amazon", mark: "a", color: "#ff9900", ink: "#111", category: "tech", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 4, loves: ["comedy", "action", "adventure"], avoids: [], line: "Boxes with a smile on them, delivered to the right doorstep." },
	{ id: "dell", name: "Dell", mark: "DELL", color: "#0076ce", ink: "#fff", category: "tech", kinds: ["placement"], prestige: 2, promo: 2, loves: ["thriller", "crime"], avoids: [], line: "The laptop the hacker uses. Cheap and cheerful." },

	// ── soft drinks and coffee
	{ id: "cocacola", name: "Coca-Cola", mark: "CC", color: "#f40009", ink: "#fff", category: "drinks", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 5, loves: ["comedy", "adventure", "romance"], avoids: ["horror", "crime"], line: "A red can in every hand and a campaign in every country." },
	{ id: "pepsi", name: "Pepsi", mark: "P", color: "#004b93", ink: "#fff", category: "drinks", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 5, loves: ["comedy", "action"], avoids: ["horror", "crime"], line: "The challenger brand. Happy to be in anything Coke is not." },
	{ id: "redbull", name: "Red Bull", mark: "RB", color: "#001e62", ink: "#ffc906", category: "drinks", kinds: ["placement", "sponsor", "studio"], prestige: 3, promo: 4, loves: ["action", "adventure", "thriller"], avoids: ["romance", "drama"], line: "Gives your film wings. Wants stunts, speed and a helmet camera." },
	{ id: "starbucks", name: "Starbucks", mark: "SB", color: "#00704a", ink: "#fff", category: "drinks", kinds: ["placement", "studio"], prestige: 3, promo: 3, loves: ["romance", "comedy", "drama"], avoids: DARK, line: "Somebody has to hold the cup. Names will be spelled wrong." },

	// ── beer and spirits
	{ id: "heineken", name: "Heineken", mark: "H", color: "#008200", ink: "#fff", category: "alcohol", kinds: ["placement", "studio"], prestige: 3, promo: 3, loves: ["comedy", "crime", "thriller"], avoids: ["adventure"], line: "A green bottle on the bar. Prefers adult films." },
	{ id: "budweiser", name: "Budweiser", mark: "BUD", color: "#c8102e", ink: "#fff", category: "alcohol", kinds: ["placement", "studio"], prestige: 3, promo: 4, loves: ["comedy", "action", "crime"], avoids: ["adventure", "romance"], line: "The king of beers wants a king-sized crowd." },

	// ── fast food
	{ id: "mcdonalds", name: "McDonald's", mark: "M", color: "#ffc72c", ink: "#db0007", category: "food", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 5, loves: ["comedy", "adventure", "action"], avoids: ["horror", "crime", "thriller"], line: "Happy Meal toys and a tie-in cup in every restaurant. Family films only." },
	{ id: "pizzahut", name: "Pizza Hut", mark: "PH", color: "#ee3124", ink: "#fff", category: "food", kinds: ["placement", "sponsor"], prestige: 3, promo: 4, loves: ["comedy", "action", "adventure"], avoids: DARK, line: "A delivery box on the doorstep, a deal on the box." },
	{ id: "subway", name: "Subway", mark: "SUB", color: "#009743", ink: "#ffc600", category: "food", kinds: ["placement"], prestige: 2, promo: 3, loves: ["comedy", "action"], avoids: ["horror"], line: "Eat fresh. Will take a small part in your film." },

	// ── cars
	{ id: "bmw", name: "BMW", mark: "BMW", color: "#1c69d4", ink: "#fff", category: "cars", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 3, loves: ["action", "thriller", "crime"], avoids: [], line: "The getaway car. Wants a chase scene and no scratches." },
	{ id: "mercedes", name: "Mercedes-Benz", mark: "MB", color: "#c0c0c0", ink: "#111", category: "cars", kinds: ["placement", "sponsor", "studio"], prestige: 5, promo: 3, loves: ["thriller", "crime", "drama"], avoids: ["horror"], line: "The villain's limousine, the hero's wedding car." },
	{ id: "audi", name: "Audi", mark: "AUDI", color: "#bb0a30", ink: "#fff", category: "cars", kinds: ["placement", "sponsor"], prestige: 4, promo: 3, loves: ["sciFiFantasy", "thriller", "action"], avoids: [], line: "Vorsprung durch Technik, ideally at night, in the rain." },
	{ id: "ford", name: "Ford", mark: "F", color: "#003478", ink: "#fff", category: "cars", kinds: ["placement", "sponsor", "studio"], prestige: 3, promo: 4, loves: ["action", "adventure", "comedy"], avoids: [], line: "Trucks that survive explosions. Built Ford tough." },
	{ id: "tesla", name: "Tesla", mark: "T", color: "#cc0000", ink: "#fff", category: "cars", kinds: ["placement", "sponsor"], prestige: 4, promo: 4, loves: ["sciFiFantasy", "thriller"], avoids: ["horror", "romance"], line: "Silent, fast, and very online." },
	{ id: "astonmartin", name: "Aston Martin", mark: "AM", color: "#00574b", ink: "#e8d28a", category: "cars", kinds: ["placement", "sponsor"], prestige: 5, promo: 2, loves: ["thriller", "action", "crime"], avoids: ["comedy", "romance"], line: "Shaken, not stirred. Will not appear in a comedy." },
	{ id: "porsche", name: "Porsche", mark: "PO", color: "#9c1d28", ink: "#fff", category: "cars", kinds: ["placement"], prestige: 5, promo: 2, loves: ["action", "crime", "drama"], avoids: ["comedy"], line: "Wants the winding mountain road all to itself." },

	// ── sportswear and fashion
	{ id: "nike", name: "Nike", mark: "NIKE", color: "#111", ink: "#fff", category: "fashion", kinds: ["placement", "sponsor", "studio"], prestige: 5, promo: 5, loves: ["action", "drama", "adventure"], avoids: DARK, line: "The swoosh on the hero's shoes, a billboard on every street." },
	{ id: "adidas", name: "Adidas", mark: "ad", color: "#000", ink: "#fff", category: "fashion", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 4, loves: ["action", "comedy", "drama"], avoids: DARK, line: "Three stripes, three scenes, one very long training montage." },
	{ id: "levis", name: "Levi's", mark: "LV", color: "#c41230", ink: "#fff", category: "fashion", kinds: ["placement"], prestige: 3, promo: 3, loves: ["romance", "drama", "comedy"], avoids: DARK, line: "The jeans of every cowboy, rebel and first date." },
	{ id: "rayban", name: "Ray-Ban", mark: "RB", color: "#111", ink: "#e30613", category: "fashion", kinds: ["placement"], prestige: 3, promo: 3, loves: ["thriller", "crime", "action"], avoids: [], line: "Sunglasses worn indoors, at night, by someone dangerous." },

	// ── luxury
	{ id: "rolex", name: "Rolex", mark: "R", color: "#006039", ink: "#c9a227", category: "luxury", kinds: ["placement", "studio"], prestige: 5, promo: 2, loves: ["thriller", "crime", "drama", "action"], avoids: ["comedy", "horror"], line: "Seen for exactly two seconds on a wrist. It will cost you." },
	{ id: "omega", name: "Omega", mark: "Ω", color: "#d4002a", ink: "#fff", category: "luxury", kinds: ["placement"], prestige: 4, promo: 2, loves: ["thriller", "action", "sciFiFantasy"], avoids: ["romance"], line: "Has a long history of saving the day with a wristwatch." },
	{ id: "gucci", name: "Gucci", mark: "GG", color: "#0d3b2e", ink: "#d4af37", category: "luxury", kinds: ["placement"], prestige: 4, promo: 2, loves: ["romance", "drama", "crime"], avoids: ["horror", "action"], line: "Dresses the villain, the widow and the red carpet." },
	{ id: "chanel", name: "Chanel", mark: "CH", color: "#000", ink: "#fff", category: "luxury", kinds: ["placement"], prestige: 5, promo: 2, loves: ["romance", "drama"], avoids: ["horror", "action", "comedy"], line: "Very serious about its bottle. Expect a close-up." },

	// ── travel
	{ id: "emirates", name: "Emirates", mark: "EK", color: "#d71920", ink: "#fff", category: "travel", kinds: ["placement", "sponsor", "studio"], prestige: 4, promo: 3, loves: ["adventure", "romance", "thriller"], avoids: ["horror"], line: "The plane that takes the hero somewhere sunny and dangerous." },
	{ id: "airbnb", name: "Airbnb", mark: "ab", color: "#ff5a5f", ink: "#fff", category: "travel", kinds: ["placement", "studio"], prestige: 3, promo: 3, loves: ["romance", "comedy", "adventure"], avoids: ["horror", "crime"], line: "Lovely loft, great location. The murder was not in the listing." },

	// ── toys and collectibles (merchandise, and LEGO also places and sponsors)
	{ id: "lego", name: "LEGO", mark: "LEGO", color: "#e3000b", ink: "#ffd500", category: "toys", kinds: ["placement", "sponsor", "merch"], prestige: 5, promo: 4, loves: ["adventure", "sciFiFantasy", "comedy", "action"], avoids: FAMILY_AVOIDS, line: "Turns your hit into a set of 1,500 bricks. Family films only.", product: "building sets" },
	{ id: "hasbro", name: "Hasbro", mark: "HAS", color: "#0072ce", ink: "#fff", category: "toys", kinds: ["merch"], prestige: 4, promo: 4, loves: ["action", "sciFiFantasy", "adventure"], avoids: ["romance"], line: "Action figures, play sets and a very detailed spaceship.", product: "action figures" },
	{ id: "mattel", name: "Mattel", mark: "MAT", color: "#e6007e", ink: "#fff", category: "toys", kinds: ["merch"], prestige: 4, promo: 4, loves: ["comedy", "adventure", "romance", "sciFiFantasy"], avoids: ["horror"], line: "Dolls, die-cast cars and a movie-edition everything.", product: "dolls and die-cast cars" },
	{ id: "funko", name: "Funko", mark: "POP", color: "#00aeef", ink: "#fff", category: "toys", kinds: ["merch"], prestige: 2, promo: 3, loves: ["horror", "sciFiFantasy", "comedy", "action"], avoids: ["romance"], line: "Big heads, tiny bodies, and a limited edition every week.", product: "Pop! vinyl figures" },
	{ id: "bandai", name: "Bandai", mark: "BN", color: "#e60012", ink: "#fff", category: "toys", kinds: ["merch"], prestige: 3, promo: 3, loves: ["sciFiFantasy", "action", "adventure"], avoids: ["romance", "drama"], line: "Model kits and collector figures with articulated everything.", product: "model kits and figures" },
	{ id: "spinmaster", name: "Spin Master", mark: "SM", color: "#f7941d", ink: "#111", category: "toys", kinds: ["merch"], prestige: 2, promo: 3, loves: ["adventure", "comedy", "action"], avoids: ["horror", "crime"], line: "Playsets, blind bags and a lot of plastic.", product: "playsets and blind bags" },

	// ── video games
	{ id: "playstation", name: "PlayStation", mark: "PS", color: "#003791", ink: "#fff", category: "games", kinds: ["game"], prestige: 5, promo: 4, loves: ["action", "sciFiFantasy", "adventure", "thriller"], avoids: ["romance", "comedy"], line: "Big budget, big cinematic, big exclusive." },
	{ id: "xbox", name: "Xbox", mark: "X", color: "#107c10", ink: "#fff", category: "games", kinds: ["game"], prestige: 4, promo: 3, loves: ["action", "sciFiFantasy", "horror", "thriller"], avoids: ["romance"], line: "Day-one on Game Pass and a launch trailer to match." },
	{ id: "nintendo", name: "Nintendo", mark: "N", color: "#e60012", ink: "#fff", category: "games", kinds: ["game"], prestige: 5, promo: 4, loves: ["adventure", "sciFiFantasy", "comedy"], avoids: FAMILY_AVOIDS, line: "Pays little, polishes everything. Family films only." },
	{ id: "ubisoft", name: "Ubisoft", mark: "UBI", color: "#0070ff", ink: "#fff", category: "games", kinds: ["game"], prestige: 3, promo: 3, loves: ["adventure", "action", "crime", "sciFiFantasy"], avoids: ["romance"], line: "An open world with 400 icons on the map." },
	{ id: "ea", name: "Electronic Arts", mark: "EA", color: "#ff4747", ink: "#fff", category: "games", kinds: ["game"], prestige: 3, promo: 3, loves: ["action", "sciFiFantasy", "adventure"], avoids: ["romance", "drama"], line: "Quick to market, with some microtransactions." },
	{ id: "activision", name: "Activision", mark: "ATVI", color: "#000", ink: "#fff", category: "games", kinds: ["game"], prestige: 3, promo: 3, loves: ["action", "thriller", "crime", "horror"], avoids: ["romance", "comedy"], line: "Annual release, annual hit." },
	{ id: "epic", name: "Epic Games", mark: "EPIC", color: "#2a2a2a", ink: "#fff", category: "games", kinds: ["game"], prestige: 3, promo: 4, loves: ["sciFiFantasy", "action", "comedy", "adventure"], avoids: ["romance"], line: "Puts your hero in a live event, then in a skin." },

	// ── TV (the streaming services; they commission spin-off series)
	{ id: "tv-netflix", name: "Netflix", mark: "N", color: "#e50914", ink: "#fff", category: "tv", kinds: ["tv"], prestige: 4, promo: 4, loves: ["thriller", "crime", "sciFiFantasy", "horror"], avoids: [], line: "Orders eight episodes and a podcast." },
	{ id: "tv-prime", name: "Prime Video", mark: "prime", color: "#00a8e1", ink: "#fff", category: "tv", kinds: ["tv"], prestige: 4, promo: 4, loves: ["action", "adventure", "sciFiFantasy", "thriller"], avoids: [], line: "Big budgets for big spin-offs." },
	{ id: "tv-disney", name: "Disney+", mark: "D+", color: "#113ccf", ink: "#fff", category: "tv", kinds: ["tv"], prestige: 5, promo: 5, loves: ["adventure", "sciFiFantasy", "comedy", "action"], avoids: ["horror", "crime"], line: "A spin-off for every sidekick." },
	{ id: "tv-max", name: "Max", mark: "max", color: "#002be7", ink: "#fff", category: "tv", kinds: ["tv"], prestige: 5, promo: 3, loves: ["drama", "crime", "thriller", "horror"], avoids: [], line: "Prestige drama. Slow, expensive, award-winning." },
	{ id: "tv-apple", name: "Apple TV+", mark: "tv+", color: "#000", ink: "#fff", category: "tv", kinds: ["tv"], prestige: 5, promo: 3, loves: ["sciFiFantasy", "drama", "comedy", "thriller"], avoids: ["horror"], line: "Pays for quality and does not rush." },
	{ id: "tv-paramount", name: "Paramount+", mark: "P+", color: "#0064ff", ink: "#fff", category: "tv", kinds: ["tv"], prestige: 3, promo: 3, loves: ["action", "adventure", "crime", "sciFiFantasy"], avoids: [], line: "Loves a franchise with a back catalogue." },
	{ id: "tv-peacock", name: "Peacock", mark: "PK", color: "#111", ink: "#fff", category: "tv", kinds: ["tv"], prestige: 3, promo: 3, loves: ["comedy", "crime", "drama"], avoids: [], line: "Gives your comedy its own seasons." },
	{ id: "tv-hulu", name: "Hulu", mark: "hulu", color: "#1ce783", ink: "#111", category: "tv", kinds: ["tv"], prestige: 3, promo: 3, loves: ["comedy", "horror", "drama", "romance"], avoids: [], line: "Wants quirky, binge-able and a bit dark." },
];

const BY_ID = new Map(BRANDS.map((b) => [b.id, b]));
export const brandById = (id: string): Brand | undefined => BY_ID.get(id);
export const brandsOf = (kind: BrandKind): Brand[] => BRANDS.filter((b) => b.kinds.includes(kind));
