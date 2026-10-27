import type { FilmGenre } from "./types";

// ═════════════════════════════════════════════════════════════
// The catalogue of real-world IPs (franchises) a studio can license.
// Data only. The rules that use it live in ip.ts.
//
// Each IP ("universe") has:
//   price        one-time cost of the rights, $k
//   filmFee      what the rights holder charges for every film you make, $k (scaled by the property's heat)
//   boost        box-office multiplier for an average property at neutral fan goodwill
//   expectCritic critic score the fans expect. Miss it and you get backlash.
//   expectGross  box office the fans expect, $k. Miss it and the film is a "disappointment".
//   severity     how hard fans punish a miss (0.7 forgiving ... 1.5 ruthless)
// Each property (a hero, a story) has a `heat`: 1.0 is average, a flagship hero is ~1.3, a niche one ~0.75.
// Heat scales the boost, the fee and the expectations, so the big names are worth more and demand more.
// ═════════════════════════════════════════════════════════════

export type IpProperty = {
	id: string;
	name: string; // also the title of the first film
	genre: FilmGenre;
	heat: number;
	sequels?: string[]; // real titles for part 2, 3, ... (after that the game numbers them)
	teamUp?: boolean; // crossover event: unlocks after TEAMUP_UNLOCK films in the same universe
};

export type Ip = {
	id: string;
	name: string;
	emoji: string;
	tagline: string;
	price: number;
	filmFee: number;
	boost: number;
	expectCritic: number;
	expectGross: number;
	severity: number;
	/** Points the awards voters knock off this universe's films (see awards.ts). Big popcorn franchises are admired but rarely crowned; 0 = judged like any other film. Missing (homegrown IPs) = 0. */
	awardsPenalty?: number;
	properties: IpProperty[];
	/** Set only on IPs born from a studio's own sequel franchise (trade.ts). `fid` = franchise id (mid of its first film). */
	custom?: { fid: number; originTid: number; season: number };
};

/**
 * How much the awards voters discount each universe, in critic points on the Best Picture score
 * (Best Director gets 60% of it, the acting awards 40%: see AWARDS_PENALTY_WEIGHT).
 * Superhero and popcorn franchises are admired but rarely crowned; prestige universes (Middle-earth, Dune) are judged like any film.
 */
const AWARDS_PENALTY: Record<string, number> = {
	transformers: 11,
	fastfurious: 10,
	monsterverse: 9,
	marvel: 8,
	dc: 8,
	jurassic: 8,
	pirates: 7,
	starwars: 6,
	mi: 6,
	harrypotter: 5,
	bond: 5,
	johnwick: 5,
	startrek: 4,
	indy: 4,
	avatar: 3,
	matrix: 3,
	alien: 3,
	apes: 2,
	dune: 0,
	lotr: 0,
};

type G = FilmGenre;
// [name, genre, heat, sequels?, teamUp?]
type Row = [string, G, number, string[]?, boolean?];

const slug = (s: string): string =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const make = (
	id: string,
	meta: Omit<Ip, "id" | "properties">,
	rows: Row[],
): Ip => ({
	id,
	...meta,
	awardsPenalty: AWARDS_PENALTY[id] ?? 0,
	properties: rows.map(([name, genre, heat, sequels, teamUp]) => ({
		id: `${id}:${slug(name)}`,
		name,
		genre,
		heat,
		...(sequels && { sequels }),
		...(teamUp && { teamUp }),
	})),
});

export const IPS: Ip[] = [
	make(
		"marvel",
		{ name: "Marvel", emoji: "🦸", tagline: "The biggest shared universe in cinema. Fans show up in millions and notice every mistake.", price: 260000, filmFee: 20000, boost: 1.55, expectCritic: 87, expectGross: 150000, severity: 1.3 },
		[
			["Spider-Man", "adventure", 1.3],
			["Iron Man", "action", 1.15],
			["Black Panther", "action", 1.1],
			["Deadpool", "comedy", 1.15],
			["Wolverine", "action", 1.1],
			["X-Men", "sciFiFantasy", 1.1],
			["Captain America", "action", 1.05],
			["Thor", "sciFiFantasy", 1.0],
			["Doctor Strange", "sciFiFantasy", 1.0],
			["Guardians of the Galaxy", "adventure", 1.0],
			["Fantastic Four", "sciFiFantasy", 0.95],
			["Hulk", "action", 0.9],
			["Captain Marvel", "sciFiFantasy", 0.9],
			["Black Widow", "action", 0.85],
			["Daredevil", "crime", 0.85],
			["Ant-Man", "comedy", 0.8],
			["Shang-Chi", "action", 0.8],
			["Blade", "horror", 0.8],
			["Moon Knight", "thriller", 0.75],
			["The Avengers", "action", 1.4, undefined, true],
		],
	),
	make(
		"starwars",
		{ name: "Star Wars", emoji: "🌌", tagline: "A galaxy far, far away. The most devoted and most opinionated fans on Earth.", price: 260000, filmFee: 20000, boost: 1.55, expectCritic: 87, expectGross: 150000, severity: 1.4 },
		[
			[
				"Star Wars: A New Hope",
				"sciFiFantasy",
				1.3,
				["The Empire Strikes Back", "Return of the Jedi", "The Phantom Menace", "Attack of the Clones", "Revenge of the Sith", "The Force Awakens", "The Last Jedi", "The Rise of Skywalker"],
			],
			["The Mandalorian", "adventure", 1.1],
			["Darth Vader", "thriller", 1.1],
			["Rogue One", "action", 1.0],
			["Obi-Wan Kenobi", "sciFiFantasy", 0.95],
			["The Clone Wars", "action", 0.9],
			["Han Solo", "adventure", 0.85],
			["Ahsoka", "sciFiFantasy", 0.85],
			["The Old Republic", "sciFiFantasy", 0.85],
			["Heir to the Empire", "sciFiFantasy", 0.8],
			["Boba Fett", "action", 0.8],
			["Yoda", "adventure", 0.8],
			["Lando", "adventure", 0.75],
		],
	),
	make(
		"harrypotter",
		{ name: "Harry Potter", emoji: "⚡", tagline: "The Wizarding World. A global fan base that has grown up with the books and films.", price: 230000, filmFee: 17000, boost: 1.5, expectCritic: 87, expectGross: 140000, severity: 1.3 },
		[
			[
				"Harry Potter and the Philosopher's Stone",
				"sciFiFantasy",
				1.3,
				[
					"Harry Potter and the Chamber of Secrets",
					"Harry Potter and the Prisoner of Azkaban",
					"Harry Potter and the Goblet of Fire",
					"Harry Potter and the Order of the Phoenix",
					"Harry Potter and the Half-Blood Prince",
					"Harry Potter and the Deathly Hallows: Part 1",
					"Harry Potter and the Deathly Hallows: Part 2",
				],
			],
			["Fantastic Beasts", "adventure", 0.95, ["Fantastic Beasts: The Crimes of Grindelwald", "Fantastic Beasts: The Secrets of Dumbledore"]],
			["Voldemort: The Rise of Tom Riddle", "thriller", 1.0],
			["The Marauders", "adventure", 0.9],
			["Hermione Granger", "adventure", 0.9],
			["The Cursed Child", "drama", 0.9],
			["The Founders of Hogwarts", "sciFiFantasy", 0.85],
			["Severus Snape", "drama", 0.85],
			["Hogwarts Legacy", "adventure", 0.8],
			["Ilvermorny", "adventure", 0.75],
		],
	),
	make(
		"dc",
		{ name: "DC", emoji: "🦇", tagline: "Gods and Gotham. Iconic heroes, a restless fan base, and a history of big swings and big misses.", price: 200000, filmFee: 16000, boost: 1.45, expectCritic: 86, expectGross: 140000, severity: 1.4 },
		[
			["Batman", "crime", 1.3],
			["Superman", "sciFiFantasy", 1.2],
			["Joker", "thriller", 1.1],
			["Wonder Woman", "action", 1.0],
			["Aquaman", "adventure", 0.95],
			["The Flash", "sciFiFantasy", 0.9],
			["Suicide Squad", "action", 0.9],
			["Harley Quinn", "comedy", 0.85],
			["Green Lantern", "sciFiFantasy", 0.8],
			["Shazam!", "comedy", 0.8],
			["Nightwing", "action", 0.8],
			["Supergirl", "sciFiFantasy", 0.8],
			["Catwoman", "crime", 0.8],
			["Teen Titans", "adventure", 0.8],
			["Blue Beetle", "sciFiFantasy", 0.75],
			["Justice League", "action", 1.35, undefined, true],
		],
	),
	make(
		"lotr",
		{ name: "Middle-earth", emoji: "💍", tagline: "The Lord of the Rings. Prestige fantasy: audiences love it, and awards voters expect greatness.", price: 210000, filmFee: 15000, boost: 1.4, expectCritic: 89, expectGross: 130000, severity: 1.5 },
		[
			["The Fellowship of the Ring", "adventure", 1.25, ["The Two Towers", "The Return of the King"]],
			["The Hobbit: An Unexpected Journey", "adventure", 1.0, ["The Hobbit: The Desolation of Smaug", "The Hobbit: The Battle of the Five Armies"]],
			["The Silmarillion", "sciFiFantasy", 0.95],
			["Aragorn: Heir of Isildur", "adventure", 0.9],
			["The Hunt for Gollum", "thriller", 0.85],
			["The Rings of Power", "sciFiFantasy", 0.85],
			["The War of the Rohirrim", "action", 0.8],
			["The Children of Húrin", "drama", 0.8],
			["Beren and Lúthien", "romance", 0.8],
			["The Fall of Gondolin", "sciFiFantasy", 0.8],
		],
	),
	make(
		"avatar",
		{ name: "Avatar", emoji: "🌿", tagline: "Pandora. Spectacle on a record-breaking scale; audiences expect a visual event every time.", price: 200000, filmFee: 15000, boost: 1.5, expectCritic: 86, expectGross: 150000, severity: 1.0 },
		[
			["Avatar", "sciFiFantasy", 1.3, ["Avatar: The Way of Water", "Avatar: Fire and Ash"]],
			["Pandora: Origins", "sciFiFantasy", 0.85],
			["The RDA", "action", 0.8],
			["Tulkun", "adventure", 0.75],
		],
	),
	make(
		"dune",
		{ name: "Dune", emoji: "🏜️", tagline: "Frank Herbert's epic. A smaller but fiercely loyal audience, and a very high bar for quality.", price: 190000, filmFee: 14000, boost: 1.4, expectCritic: 89, expectGross: 120000, severity: 1.5 },
		[
			["Dune", "sciFiFantasy", 1.3, ["Dune: Part Two", "Dune: Messiah", "Children of Dune", "God Emperor of Dune"]],
			["The Butlerian Jihad", "sciFiFantasy", 0.9],
			["The Sisterhood", "drama", 0.85],
			["House Atreides", "drama", 0.85],
			["The Golden Path", "sciFiFantasy", 0.85],
			["House Harkonnen", "thriller", 0.8],
			["Lady Jessica", "drama", 0.8],
			["Duncan Idaho", "action", 0.75],
		],
	),
	make(
		"bond",
		{ name: "James Bond 007", emoji: "🕴️", tagline: "Licence to thrill. Six decades of fans who know exactly what a Bond film should be.", price: 150000, filmFee: 12000, boost: 1.35, expectCritic: 87, expectGross: 115000, severity: 1.2 },
		[
			[
				"Dr. No",
				"action",
				1.25,
				[
					"From Russia with Love",
					"Goldfinger",
					"Thunderball",
					"You Only Live Twice",
					"On Her Majesty's Secret Service",
					"Diamonds Are Forever",
					"Live and Let Die",
					"The Man with the Golden Gun",
					"The Spy Who Loved Me",
					"Moonraker",
					"For Your Eyes Only",
					"Octopussy",
					"A View to a Kill",
					"The Living Daylights",
					"Licence to Kill",
					"GoldenEye",
					"Tomorrow Never Dies",
					"The World Is Not Enough",
					"Die Another Day",
					"Casino Royale",
					"Quantum of Solace",
					"Skyfall",
					"Spectre",
					"No Time to Die",
				],
			],
			["Blofeld", "thriller", 0.85],
			["Double-O Section", "action", 0.9],
			["Moneypenny", "thriller", 0.8],
			["Q Branch", "comedy", 0.75],
			["Felix Leiter", "crime", 0.7],
		],
	),
	make(
		"jurassic",
		{ name: "Jurassic Park", emoji: "🦖", tagline: "Life finds a way. Pure popcorn spectacle that families return to again and again.", price: 140000, filmFee: 11000, boost: 1.4, expectCritic: 84, expectGross: 130000, severity: 1.0 },
		[
			[
				"Jurassic Park",
				"adventure",
				1.25,
				["The Lost World: Jurassic Park", "Jurassic Park III", "Jurassic World", "Jurassic World: Fallen Kingdom", "Jurassic World Dominion", "Jurassic World Rebirth"],
			],
			["Ian Malcolm", "adventure", 0.9],
			["Dr. Alan Grant", "adventure", 0.85],
			["Camp Cretaceous", "adventure", 0.8],
			["Site B", "horror", 0.8],
			["The Dino Heist", "crime", 0.75],
		],
	),
	make(
		"pirates",
		{ name: "Pirates of the Caribbean", emoji: "🏴‍☠️", tagline: "Swashbuckling box-office gold. Fans forgive a lot as long as the swagger is there.", price: 110000, filmFee: 9000, boost: 1.32, expectCritic: 82, expectGross: 125000, severity: 0.9 },
		[
			[
				"Pirates of the Caribbean: The Curse of the Black Pearl",
				"adventure",
				1.25,
				["Pirates of the Caribbean: Dead Man's Chest", "Pirates of the Caribbean: At World's End", "Pirates of the Caribbean: On Stranger Tides", "Pirates of the Caribbean: Dead Men Tell No Tales"],
			],
			["Jack Sparrow", "comedy", 1.0],
			["Davy Jones", "adventure", 0.85],
			["Elizabeth Swann", "adventure", 0.85],
			["Barbossa", "adventure", 0.8],
			["Tortuga", "comedy", 0.75],
		],
	),
	make(
		"mi",
		{ name: "Mission: Impossible", emoji: "🎯", tagline: "Practical stunts and a never-failing franchise. Audiences expect jaw-dropping set pieces.", price: 110000, filmFee: 9000, boost: 1.3, expectCritic: 85, expectGross: 115000, severity: 1.0 },
		[
			["Mission: Impossible", "action", 1.1, ["Mission: Impossible 2", "Mission: Impossible III", "Mission: Impossible: Ghost Protocol", "Mission: Impossible: Rogue Nation", "Mission: Impossible: Fallout", "Mission: Impossible: Dead Reckoning", "Mission: Impossible: The Final Reckoning"]],
			["Ilsa Faust", "action", 0.9],
			["Ethan Hunt: Origins", "thriller", 0.9],
			["The Syndicate", "thriller", 0.8],
			["IMF: Black Ops", "thriller", 0.8],
			["Luther & Benji", "comedy", 0.75],
		],
	),
	make(
		"matrix",
		{ name: "The Matrix", emoji: "💊", tagline: "Cyberpunk cult classic. A smart, demanding audience that wants ideas as well as action.", price: 120000, filmFee: 9000, boost: 1.3, expectCritic: 88, expectGross: 105000, severity: 1.4 },
		[
			["The Matrix", "sciFiFantasy", 1.2, ["The Matrix Reloaded", "The Matrix Revolutions", "The Matrix Resurrections"]],
			["Morpheus", "sciFiFantasy", 0.85],
			["Niobe: The Resistance", "action", 0.75],
			["Zion", "action", 0.75],
		],
	),
	make(
		"fastfurious",
		{ name: "Fast & Furious", emoji: "🏎️", tagline: "Family, fast cars and huge global grosses. Fans are forgiving as long as the stunts are bigger than last time.", price: 90000, filmFee: 9000, boost: 1.28, expectCritic: 80, expectGross: 125000, severity: 0.7 },
		[
			[
				"The Fast and the Furious",
				"action",
				1.2,
				["2 Fast 2 Furious", "The Fast and the Furious: Tokyo Drift", "Fast & Furious", "Fast Five", "Fast & Furious 6", "Furious 7", "The Fate of the Furious", "F9", "Fast X"],
			],
			["Hobbs & Shaw", "action", 1.0],
			["Dom Toretto", "action", 1.05],
			["Letty", "action", 0.85],
			["Han Lue: Fast Origins", "crime", 0.8],
			["Roman & Tej", "comedy", 0.75],
			["Race Wars", "adventure", 0.75],
		],
	),
	make(
		"startrek",
		{ name: "Star Trek", emoji: "🖖", tagline: "To boldly go. Smart sci-fi with a fan base that will argue about every detail.", price: 100000, filmFee: 8000, boost: 1.22, expectCritic: 87, expectGross: 100000, severity: 1.4 },
		[
			["Star Trek", "sciFiFantasy", 1.1, ["Star Trek Into Darkness", "Star Trek Beyond"]],
			["Picard", "sciFiFantasy", 1.0],
			["The Wrath of Khan", "thriller", 0.9],
			["Spock", "sciFiFantasy", 0.9],
			["Strange New Worlds", "adventure", 0.85],
			["Section 31", "thriller", 0.8],
			["Deep Space Nine", "drama", 0.8],
			["Lower Decks", "comedy", 0.7],
		],
	),
	make(
		"indy",
		{ name: "Indiana Jones", emoji: "🤠", tagline: "Fortune and glory. Nostalgic adventure; fans expect heart as well as whip-cracking.", price: 100000, filmFee: 8000, boost: 1.28, expectCritic: 88, expectGross: 105000, severity: 1.2 },
		[
			["Raiders of the Lost Ark", "adventure", 1.2, ["Indiana Jones and the Temple of Doom", "Indiana Jones and the Last Crusade", "Indiana Jones and the Kingdom of the Crystal Skull", "Indiana Jones and the Dial of Destiny"]],
			["The Young Indiana Jones", "adventure", 0.8],
			["Marion Ravenwood", "adventure", 0.75],
			["Mutt Williams", "adventure", 0.7],
			["Short Round", "comedy", 0.7],
		],
	),
	make(
		"alien",
		{ name: "Alien & Predator", emoji: "👽", tagline: "In space no one can hear you scream. Cult horror and sci-fi with a hard-to-impress fan base.", price: 90000, filmFee: 7000, boost: 1.2, expectCritic: 88, expectGross: 95000, severity: 1.3 },
		[
			["Alien", "horror", 1.2, ["Aliens", "Alien 3", "Alien Resurrection", "Alien: Romulus"]],
			["Predator", "action", 1.0, ["Predator 2", "Predators", "The Predator", "Prey"]],
			["Prometheus", "sciFiFantasy", 0.9, ["Alien: Covenant"]],
			["Ripley", "thriller", 0.9],
			["Alien vs. Predator", "action", 0.85],
			["Weyland-Yutani", "thriller", 0.75],
		],
	),
	make(
		"monsterverse",
		{ name: "Godzilla & Kong", emoji: "🦎", tagline: "Giant monsters, giant crowds. Fans come for the destruction, not the dialogue.", price: 80000, filmFee: 7000, boost: 1.22, expectCritic: 80, expectGross: 105000, severity: 0.8 },
		[
			["Godzilla", "action", 1.1, ["Godzilla: King of the Monsters", "Godzilla vs. Kong", "Godzilla x Kong: The New Empire"]],
			["King Kong", "adventure", 1.0],
			["Kong: Skull Island", "adventure", 0.95],
			["Godzilla Minus One", "drama", 0.9],
			["Mechagodzilla", "action", 0.85],
			["Mothra", "sciFiFantasy", 0.8],
			["Monarch: Legacy of Monsters", "sciFiFantasy", 0.8],
		],
	),
	make(
		"apes",
		{ name: "Planet of the Apes", emoji: "🦍", tagline: "Sci-fi with something to say. Critics love it when it's good and notice when it isn't.", price: 75000, filmFee: 6000, boost: 1.18, expectCritic: 87, expectGross: 95000, severity: 1.0 },
		[
			["Planet of the Apes", "sciFiFantasy", 1.1, ["Beneath the Planet of the Apes", "Escape from the Planet of the Apes", "Conquest of the Planet of the Apes", "Battle for the Planet of the Apes"]],
			["Rise of the Planet of the Apes", "sciFiFantasy", 1.05, ["Dawn of the Planet of the Apes", "War for the Planet of the Apes", "Kingdom of the Planet of the Apes"]],
			["Caesar", "drama", 0.85],
			["Noa", "adventure", 0.8],
			["Cornelius & Zira", "drama", 0.7],
		],
	),
	make(
		"transformers",
		{ name: "Transformers", emoji: "🤖", tagline: "Robots in disguise. A huge global audience that is happy with big, loud and shiny.", price: 70000, filmFee: 6000, boost: 1.2, expectCritic: 78, expectGross: 110000, severity: 0.7 },
		[
			["Transformers", "action", 1.1, ["Transformers: Revenge of the Fallen", "Transformers: Dark of the Moon", "Transformers: Age of Extinction", "Transformers: The Last Knight", "Transformers: Rise of the Beasts"]],
			["Bumblebee", "adventure", 0.95],
			["Optimus Prime", "sciFiFantasy", 0.9],
			["Megatron", "action", 0.85],
			["Beast Wars", "action", 0.8],
			["Cybertron", "sciFiFantasy", 0.8],
		],
	),
	make(
		"johnwick",
		{ name: "John Wick", emoji: "🐕", tagline: "Stylish, bloody and tightly made. A lean franchise with fans who want craft over scale.", price: 70000, filmFee: 6000, boost: 1.2, expectCritic: 86, expectGross: 90000, severity: 1.0 },
		[
			["John Wick", "action", 1.2, ["John Wick: Chapter 2", "John Wick: Chapter 3 – Parabellum", "John Wick: Chapter 4"]],
			["Ballerina", "action", 0.9],
			["The Continental", "crime", 0.85],
			["Caine", "action", 0.8],
			["Winston", "crime", 0.7],
		],
	),
];

export const IP_BY_ID: Record<string, Ip> = Object.fromEntries(IPS.map((ip) => [ip.id, ip]));

export const PROPERTY_BY_ID: Record<string, { ip: Ip; prop: IpProperty }> = Object.fromEntries(
	IPS.flatMap((ip) => ip.properties.map((prop) => [prop.id, { ip, prop }] as const)),
);
