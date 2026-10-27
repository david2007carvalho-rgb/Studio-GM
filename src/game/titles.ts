import { choice } from "./random";
import type { FilmGenre } from "./types";

// ── Word pools ───────────────────────────────────────────────
// Shared words work for any genre. Each genre adds its own flavour.

const ADJ = [
	"Silent", "Midnight", "Golden", "Broken", "Hidden", "Paper", "Electric", "Distant", "Burning", "Hollow",
	"Crimson", "Wild", "Forgotten", "Quiet", "Endless", "Fragile", "Borrowed", "Restless", "Velvet", "Iron",
	"Winter", "Lonely", "Secret", "Glass", "Faded", "Savage", "Gentle", "Final", "Rising", "Falling",
	"Counterfeit", "Salt", "Neon", "Ashen", "Wandering", "Stolen", "Bitter", "Scarlet", "Sunken", "Brave",
	"Amber", "Cobalt", "Tangled", "Luminous", "Patient", "Reckless", "Unwritten", "Hungry",
	"Moonlit", "Gilded", "Brittle", "Dusty", "Sacred", "Tropical", "Feral", "Radiant",
	"Rusted", "Shattered", "Smoldering", "Thunderous", "Vanishing", "Weightless", "Wicked", "Ivory",
	"Saffron", "Indigo", "Copper", "Opal", "Bright", "Sleepless",
];

const NOUN = [
	"Orchard", "Harbor", "Letters", "Summer", "Frontier", "Signal", "Garden", "Empire", "Promise", "Machine",
	"Lighthouse", "Mirror", "River", "Crown", "Season", "Archive", "Compass", "Window", "Kingdom", "Passage",
	"Echo", "Horizon", "Carnival", "Bridge", "Station", "Island", "Ledger", "Tide", "Voyage", "Canyon",
	"Orchestra", "Reckoning", "Inheritance", "Confession", "Alibi", "Parade", "Fortune", "Silence", "Debt", "Gospel",
	"Furnace", "Lantern", "Marketplace", "Monsoon", "Carousel", "Cathedral", "Courtyard", "Meridian",
	"Pilgrim", "Riverbank", "Rooftop", "Sanctuary", "Tapestry", "Threshold", "Vineyard", "Wildflower",
	"Atlas", "Balcony", "Blueprint", "Caravan", "Dynasty", "Embassy", "Foundry", "Gallery",
	"Harvest", "Jukebox", "Kiln", "Labyrinth", "Manuscript", "Mosaic", "Observatory", "Pavilion",
	"Quarry", "Refuge", "Souvenir", "Telegram", "Underground", "Vigil", "Workshop", "Zenith",
];

const PLACES = [
	"Lisbon", "Marseille", "Kyoto", "Cairo", "Reykjavik", "Havana", "Odessa", "Santorini", "Nairobi", "Detroit",
	"Montauk", "Bruges", "Tangier", "Oaxaca", "Yokohama", "Casablanca", "Vienna", "Memphis", "Valparaíso", "Tbilisi",
	"the Valley", "the Delta", "the Badlands", "the Coast", "the North", "the Rooftops", "the Docks", "the Old Quarter",
	"Mumbai", "Lagos", "Buenos Aires", "Seoul", "Istanbul", "Accra", "Cartagena", "Hanoi",
	"Marrakech", "Dubrovnik", "Johannesburg", "Kingston", "Lima", "Naples", "Oslo", "Porto",
	"Sapporo", "Tallinn", "Zanzibar", "Addis Ababa", "Beirut", "Bogotá", "Dakar", "Goa",
	"Havana Heights", "Jaipur", "Kampala", "Manila", "Medellín", "Montevideo", "Tehran Road", "Ulaanbaatar",
	"Cusco", "Edinburgh", "Rotterdam", "Sicily", "Patagonia", "Bali", "Cape Town", "the Highlands",
	"the Riviera", "the Outback", "the Steppe",
];

const NAMES = [
	"Eleanor", "Marcus", "Josephine", "Ruben", "Odette", "Callum", "Marisol", "Teodor", "Winnie", "Abel",
	"Saoirse", "Dmitri", "Lucille", "Hector", "Priya", "Augustin", "Delphine", "Cormac", "Imogen", "Silas",
	"Yasmin", "Gideon", "Noor", "Felix", "Rosalind", "Anselm", "Beatriz", "Jonas", "Clementine", "Wendell",
	"Amara", "Kofi", "Mei", "Rashid", "Ingrid", "Santiago", "Anya", "Tariq",
	"Lucía", "Haruto", "Nadia", "Emeka", "Soledad", "Aroha", "Matteo", "Zainab",
	"Dariusz", "Isadora", "Kwame", "Leila", "Mateus", "Ottoline", "Rohan", "Svetlana",
	"Tobias", "Ximena", "Yuki", "Zora", "Arjun", "Bao", "Chioma", "Dalia",
];

const TIMES = [
	"Midnight", "Dawn", "Sunday", "the Last Summer", "Tomorrow", "Yesterday", "Winter", "the Long Weekend",
	"Closing Time", "the Morning After", "Monsoon Season", "Rush Hour", "the Eleventh Hour", "Christmas Eve",
	"Monsoon", "the Harvest Moon", "Carnival Week", "the Last Ferry", "Low Tide", "the Dry Season", "New Year's Day", "the Blue Hour",
	"Market Day", "the Wet Season", "Kickoff",
];

const ABSTRACT = [
	"Mercy", "Glory", "Hunger", "Grace", "Vengeance", "Longing", "Chaos", "Fortune", "Innocence", "Silence",
	"Redemption", "Obsession", "Betrayal", "Folly", "Thunder", "Memory", "Gravity", "Devotion", "Doubt", "Wonder",
	"Courage", "Pride", "Hope", "Envy", "Fury", "Loyalty", "Mischief", "Solitude",
	"Ambition", "Penance", "Reverence", "Nostalgia", "Surrender", "Temptation", "Valor", "Serenity",
	"Rapture", "Vanity",
];

const ONE_WORD = [
	"Ember", "Tether", "Undertow", "Halcyon", "Meridian", "Wildfire", "Parallax", "Lantern", "Gravity", "Overture",
	"Afterglow", "Static", "Mirage", "Threshold", "Cinder", "Solstice", "Vertigo", "Aperture", "Fathom", "Relic",
	"Saffron", "Monsoon", "Ferment", "Kintsugi", "Mosaic", "Zenith", "Estuary", "Tinderbox",
	"Paragon", "Reverie", "Cascade", "Obsidian", "Nocturne", "Halo", "Ledger", "Marrow",
	"Quarry", "Sundial", "Brimstone", "Compass",
];

type GenrePool = {
	adj: string[];
	noun: string[];
	/** Short phrases that stand alone as a whole title. */
	whole: string[];
	/** Things that "do" things, for patterns like "The X Who Y". */
	people: string[];
};

const GENRE: Record<FilmGenre, GenrePool> = {
	comedy: {
		adj: ["Awkward", "Accidental", "Unlikely", "Reluctant", "Ridiculous", "Slightly Haunted", "Extremely Average", "Surprise", "Questionable", "Overbooked", "Chaotic", "Passive-Aggressive", "Last-Minute", "Totally Normal", "Barely Legal", "Suspiciously Cheap"],
		noun: ["Wedding", "Roommate", "Road Trip", "Reunion", "Vacation", "Sleepover", "Potluck", "Intervention", "Bake-Off", "Group Chat", "Landlord", "Open Mic", "Surprise Party", "Book Club", "Time Share", "Dating App", "Family Reunion", "Karaoke Night", "Moving Day", "Yoga Retreat", "Wedding Toast", "Block Party"],
		whole: ["Plus One", "Fake It Till Tuesday", "Oops, We Eloped", "Dad Joke", "Out of Office", "No Refunds", "Wrong Number, Right Girl", "The Neighbors Are Fine", "Everybody Pitch In", "Sorry, Wrong Funeral", "Brunch Is Cancelled", "Three Cousins and a Goat", "We Need to Talk About Gary", "Everything Is Fine, Mom", "The Great Auntie Heist"],
		people: ["Plumber", "Bridesmaid", "Substitute Teacher", "Best Man", "Intern", "Stepdad", "Magician", "Tour Guide", "Wedding Planner", "Life Coach", "Uber Driver", "Mother-in-Law", "Roommate", "Influencer"],
	},
	drama: {
		adj: ["Quiet", "Unspoken", "Fading", "Tender", "Weathered", "Uneasy", "Ordinary", "Late", "Unfinished", "Heavy", "Bitter", "Distant", "Borrowed", "Silent", "Humble", "Aching"],
		noun: ["Lullaby", "Homecoming", "Testimony", "Sacrifice", "Family Dinner", "Funeral", "Winter Coat", "Apology", "Inheritance", "Long Goodbye", "Kitchen Table", "Verdict", "Harvest", "Exile", "Letter Home", "Reckoning", "Wake", "Crossing", "Summer House", "Promise", "Mourning", "Reunion Dinner"],
		whole: ["What We Carried", "The Weight of Rain", "Small Mercies", "All the Years Between", "A Room for Mother", "Things We Don't Say", "Still Waters", "The Year Mother Left", "Bread and Salt", "What the River Took", "A Name for the Wind", "Where Children Go", "The Long Way Home"],
		people: ["Widow", "Piano Teacher", "Stranger", "Son", "Understudy", "Caretaker", "Daughter", "Shepherd", "Midwife", "Fisherman", "Teacher", "Immigrant", "Seamstress", "Father"],
	},
	thriller: {
		adj: ["Cold", "Silent", "Watched", "Deadly", "Blind", "Dark", "Missing", "Perfect", "Unmarked", "Wired", "Fatal", "Hidden", "Twisted", "Sleepless", "Anonymous", "Final"],
		noun: ["Witness", "Deadline", "Trap", "Suspect", "Stakeout", "Lockdown", "Informant", "Blackout", "Cipher", "Hostage", "Wire", "Paper Trail", "Dossier", "Decoy", "Cover Story", "Safe Word", "Manhunt", "Surveillance", "Countdown", "Leak", "Turncoat", "Breach"],
		whole: ["Don't Look Down", "Six Minutes to Midnight", "No Way Out", "The Last Call", "Under Surveillance", "Trust No One", "Dead Drop", "Breaking Point", "The Thirteenth Floor", "Last Seen at Midnight", "Nobody Gets Out", "The Quiet Hours", "Line of Fire", "A Name in the Ledger"],
		people: ["Courier", "Stranger", "Analyst", "Defector", "Witness", "Handler", "Insomniac", "Alibi", "Whistleblower", "Fixer", "Mole", "Hacker", "Detective", "Negotiator"],
	},
	romance: {
		adj: ["Sweet", "Stolen", "Starry", "Second", "Tender", "Longing", "Summer", "Borrowed", "Accidental", "Perfect", "Gentle", "Fated", "Midsummer", "Blushing", "Hopeful", "Wistful"],
		noun: ["Kiss", "Valentine", "Serenade", "Love Letter", "First Dance", "Proposal", "Rendezvous", "Heartbeat", "Slow Dance", "Afternoon", "Wedding Date", "Lighthouse Keeper", "Postcard", "Café", "Waltz", "Promise Ring", "Love Song", "Sunrise", "Toast", "Dance Card", "Long Distance", "Honeymoon"],
		whole: ["Love in Translation", "Forever, Maybe", "Meet Me at Midnight", "Come Home to Me", "When Autumn Came", "One More Summer", "Written in the Stars", "Say Yes to Tuesday", "Two Tickets to Paris", "The Only Yes", "Hold My Hand in Lisbon", "Because It Was You", "Dear Stranger", "Once Upon a Spring"],
		people: ["Baker", "Stranger", "Pen Pal", "Florist", "Cellist", "Tourist", "Neighbor", "Sailor", "Violinist", "Chef", "Translator", "Matchmaker", "Bookseller", "Barista"],
	},
	action: {
		adj: ["Rogue", "Maximum", "Lethal", "Armored", "Explosive", "Relentless", "Furious", "Supersonic", "Overdrive", "Hard", "Ruthless", "Blazing", "Turbo", "Nuclear", "Savage", "Unstoppable"],
		noun: ["Protocol", "Strike", "Vendetta", "Pursuit", "Showdown", "Payload", "Convoy", "Takedown", "Mercenary", "Detonation", "Fury", "Fallout", "Ambush", "Gauntlet", "Breakout", "Manhunt", "Crossfire", "Rampage", "Siege", "Blitz", "Showdown", "Escape"],
		whole: ["Full Throttle", "Point of Impact", "Kill Switch", "Zero Hour", "Hard Target", "Last Stand at the Docks", "Burn Rate", "Code Red Dawn", "Ricochet", "Run, Don't Walk", "Dead Heat", "Last Man Standing", "Iron Curtain Fall", "Maximum Velocity", "Armed and Dangerous"],
		people: ["Mercenary", "Operative", "Smuggler", "Bounty Hunter", "Getaway Driver", "Sergeant", "Enforcer", "Marshal", "Assassin", "Commando", "Stuntman", "Pilot", "Ranger", "Bodyguard"],
	},
	horror: {
		adj: ["Haunted", "Bleeding", "Cursed", "Pale", "Whispering", "Rotting", "Restless", "Starving", "Hollow", "Black", "Unholy", "Screaming", "Shadowed", "Buried", "Wretched", "Moaning"],
		noun: ["Nursery", "Cellar", "Sermon", "Séance", "Scarecrow", "Basement", "Lullaby", "Attic", "Ritual", "Mannequin", "Vigil", "Doll", "Crypt", "Asylum", "Hex", "Possession", "Harvest Moon", "Lodge", "Well", "Specter", "Mask", "Swamp"],
		whole: ["Don't Answer the Door", "Something in the Walls", "The House Remembers", "Do Not Wake Her", "It Follows the Rain", "Hush, Little Thing", "Down in the Hollow", "Nobody Leaves Hollow Creek", "The Door Under the Stairs", "Eyes in the Cornfield", "Say Her Name", "What Lives in the Lake", "Count the Knocks"],
		people: ["Caretaker", "Tenant", "Sleepwalker", "Hitchhiker", "Babysitter", "Undertaker", "Priest", "Lamplighter", "Exorcist", "Medium", "Gravedigger", "Nanny", "Innkeeper", "Collector"],
	},
	crime: {
		adj: ["Dirty", "Crooked", "Honest", "Clean", "Smooth", "Cold-Blooded", "Quiet", "Bad", "Hard-Boiled", "Dead", "Bent", "Sleazy", "Slick", "Notorious", "Shady", "Rotten"],
		noun: ["Heist", "Syndicate", "Racket", "Alibi", "Getaway", "Ledger", "Informant", "Fix", "Dealer", "Con", "Payoff", "Safehouse", "Kingpin", "Stash", "Hit", "Crew", "Scam", "Shakedown", "Underworld", "Laundromat", "Casino", "Turf War"],
		whole: ["Ten Dollars Short", "The Long Con", "Honor Among Thieves", "A Clean Getaway", "Paid in Full", "One Last Job", "Every Man Has a Price", "Blood Money Boulevard", "Little Italy Burning", "Fast Money", "The Last Honest Cop", "Smoke and Mirrors", "Three Strikes", "Cash Only"],
		people: ["Fixer", "Accountant", "Cleaner", "Godfather", "Bookie", "Safecracker", "Detective", "Forger", "Kingpin", "Hustler", "Rookie Cop", "Smuggler", "Counterfeiter", "Snitch"],
	},
	sciFiFantasy: {
		adj: ["Quantum", "Lunar", "Eternal", "Fallen", "Astral", "Synthetic", "Starborn", "Obsidian", "Ancient", "Infinite", "Cosmic", "Cybernetic", "Enchanted", "Feral", "Radiant", "Void"],
		noun: ["Protocol", "Exodus", "Dominion", "Singularity", "Relic", "Wayfarer", "Dragon", "Archive", "Colony", "Prophecy", "Nebula", "Gateway", "Realm", "Cyborg", "Spire", "Wormhole", "Grimoire", "Terraform", "Citadel", "Rift", "Starforge", "Sorcerer"],
		whole: ["Beyond the Last Star", "The Hundredth Moon", "Orbit Zero", "Children of the Cinder Sun", "Memory of Machines", "The Thirteenth Realm", "Echoes of Andromeda", "The Last Starport", "Songs of the Sunken City", "Ashes of the Moon King", "Dreams of Electric Rain", "A Crown of Stars", "The Clockwork Prince"],
		people: ["Cartographer", "Android", "Wizard", "Starship Captain", "Time Traveler", "Last Dragon", "Archivist", "Oracle", "Sorceress", "Space Pirate", "Cyborg", "Dragonrider", "Terraformer", "Alchemist"],
	},
	adventure: {
		adj: ["Lost", "Uncharted", "Legendary", "Sunlit", "Untamed", "Far", "Fabled", "Golden", "Jungle", "Wayward", "Daring", "Perilous", "Sun-Scorched", "Windswept", "Mythic", "Treacherous"],
		noun: ["Expedition", "Treasure", "Odyssey", "Map", "Summit", "Safari", "Quest", "Rapids", "Caravan", "Ruins", "Voyage", "Temple", "Pilgrimage", "Raft", "Trail", "Tomb", "Lagoon", "Frontier", "Stampede", "Reef", "Wilderness", "Flotilla"],
		whole: ["Across the Great Divide", "The Map Beneath the Sea", "Into the Wild Blue", "Edge of the World", "Chasing the Sunrise", "Beyond the Red Mountains", "Hunt for the Silver Key", "The Compass Never Lies", "River of a Thousand Stars", "Race to the Red Sea", "Across the Burning Sands", "The Last Great Journey", "Mountain of Echoes"],
		people: ["Cartographer", "Explorer", "Castaway", "Navigator", "Pilot", "Treasure Hunter", "Stowaway", "Guide", "Mountaineer", "Sailor", "Archaeologist", "Nomad", "Ranger", "Smuggler Queen"],
	},
};

// ── Patterns ─────────────────────────────────────────────────
// Each pattern builds one title. Genre words are mixed in on purpose.

const mix = <T,>(general: readonly T[], specific: readonly T[], genreShare = 0.65): T =>
	Math.random() < genreShare ? choice(specific) : choice(general);

type Pattern = (g: GenrePool) => string;

const PATTERNS: { weight: number; make: Pattern }[] = [
	// "Silent Harbor"
	{ weight: 10, make: (g) => `${mix(ADJ, g.adj)} ${mix(NOUN, g.noun)}` },
	// "The Silent Harbor"
	{ weight: 8, make: (g) => `The ${mix(ADJ, g.adj)} ${mix(NOUN, g.noun)}` },
	// "The Cartographer"
	{ weight: 5, make: (g) => `The ${choice(g.people)}` },
	// "The Widow of Lisbon"
	{ weight: 6, make: (g) => `The ${choice(g.people)} of ${choice(PLACES)}` },
	// "Eleanor's Harbor"
	{ weight: 6, make: (g) => `${choice(NAMES)}'s ${mix(NOUN, g.noun)}` },
	// "Marcus and the Lantern"
	{ weight: 3, make: (g) => `${choice(NAMES)} and the ${mix(NOUN, g.noun)}` },
	// "Night of the Mirror" / "Return of the Crown"
	{ weight: 4, make: (g) => `${choice(["Night", "Return", "Rise", "Fall", "Curse", "Secret", "Legend", "Song", "Ballad"])} of the ${mix(NOUN, g.noun)}` },
	// "A Letter to Kyoto"
	{ weight: 4, make: () => `${choice(["A Letter to", "Last Train to", "Midnight in", "Farewell,", "Back to", "Goodbye,", "Escape from", "Four Days in", "Postcards from"])} ${choice(PLACES)}` },
	// "Before Midnight Falls" style
	{ weight: 3, make: () => `${choice(["Before", "After", "Until", "Waiting for", "Beyond", "Through"])} ${choice(TIMES)}` },
	// "Mercy and Thunder"
	{ weight: 4, make: () => { const a = choice(ABSTRACT); let b = choice(ABSTRACT); while (b === a) b = choice(ABSTRACT); return `${a} & ${b}`; } },
	// "The Price of Glory"
	{ weight: 5, make: () => `${choice(["The Price of", "A Taste of", "In Search of", "The Cost of", "Echoes of", "Hunger for", "The Language of", "In Praise of"])} ${choice(ABSTRACT)}` },
	// "Ember"
	{ weight: 3, make: () => choice(ONE_WORD) },
	// whole-title genre phrases ("Zero Hour")
	{ weight: 7, make: (g) => choice(g.whole) },
	// "Where the River Sings"
	{ weight: 4, make: (g) => `${choice(["Where the", "When the", "As the", "While the", "Until the"])} ${mix(NOUN, g.noun)} ${choice(["Sleeps", "Sings", "Burns", "Breaks", "Remembers", "Falls", "Waits", "Wakes", "Turns"])}` },
	// "The Last Orchard on Earth"
	{ weight: 3, make: (g) => `The ${choice(["Last", "First", "Only", "Final", "Lost"])} ${mix(NOUN, g.noun)} ${choice(["on Earth", "of Summer", "in Town", "Standing", "of the Year", "Alive"])}` },
	// "Operation Compass" / "Project Ledger"
	{ weight: 2, make: (g) => `${choice(["Operation", "Project", "Code Name:", "Protocol"])} ${mix(NOUN, g.noun)}` },
	// "Ember Road" style: one-word + place-ish noun
	{ weight: 4, make: () => `${choice(ONE_WORD)} ${choice(["Road", "Hill", "Street", "Row", "Lane", "Point", "Bay", "County", "Falls", "Heights"])}` },
	// "Three Days in Lagos"
	{ weight: 3, make: () => `${choice(["Three Days in", "One Night in", "Summer in", "The Road to", "The Girl from", "The Man from", "Sunrise over", "Rain in", "The Ghosts of", "Lost in"])} ${choice(PLACES)}` },
	// "Amara Wakes the Harbor" style: name + verb phrase
	{ weight: 2, make: (g) => `${choice(NAMES)} ${choice(["Goes Home", "Takes the Stage", "Runs Away", "Knows Too Much", "Is Not Okay", "Comes Back", "Wins Tonight"])}` },
	// "The Girl Who Remembered the Sea"
	{ weight: 2, make: (g) => `The ${choice(["Girl", "Boy", "Woman", "Man", "Stranger", "Daughter", "Brother"])} Who ${choice(["Remembered", "Stole", "Painted", "Outran", "Forgave", "Followed", "Buried", "Counted"])} the ${mix(NOUN, g.noun)}` },
	// "Nobody Knows the Orchard"
	{ weight: 2, make: (g) => `${choice(["Nobody Knows the", "Everybody Loves the", "Somebody Stole the", "Who Killed the", "Don't Trust the", "Remember the", "Beware the"])} ${mix(NOUN, g.noun)}` },
];

const TOTAL_WEIGHT = PATTERNS.reduce((sum, p) => sum + p.weight, 0);

const pickPattern = (): Pattern => {
	let roll = Math.random() * TOTAL_WEIGHT;
	for (const p of PATTERNS) {
		roll -= p.weight;
		if (roll <= 0) return p.make;
	}
	return PATTERNS[0].make;
};

// ── No-repeat memory ─────────────────────────────────────────
// Remembers recent titles AND their opening words, so you don't get
// "Silent Harbor", "Silent Garden", "Silent Signal" back to back.

const RECENT_LIMIT = 60;
const recentTitles: string[] = [];

const firstWord = (title: string): string => title.split(/[\s']/)[0].toLowerCase();

const isTooSimilar = (title: string, taken: Set<string>): boolean => {
	const key = title.toLowerCase();
	if (taken.has(key) || recentTitles.some((t) => t.toLowerCase() === key)) return true;
	// No word twice in one title ("Wired Wire").
	const words = key.split(/[\s']+/).filter((w) => w.length > 3);
	if (new Set(words).size < words.length) return true;
	const lead = firstWord(title);
	// Don't open with the same word as any of the last 12 titles (skip tiny words like "The").
	if (lead.length > 3 && recentTitles.slice(-12).some((t) => firstWord(t) === lead)) return true;
	return false;
};

/**
 * Random film title.
 * @param genre  optional: mixes in words that fit the genre
 * @param taken  optional: titles already in use (e.g. every movie in the game) that must not repeat
 */
export const genTitle = (genre?: FilmGenre, taken: Iterable<string> = []): string => {
	const used = new Set<string>();
	for (const t of taken) used.add(t.toLowerCase());
	const pool = GENRE[genre ?? choice(Object.keys(GENRE) as FilmGenre[])];

	let title = "";
	for (let attempt = 0; attempt < 40; attempt++) {
		title = pickPattern()(pool).replace(/\s+/g, " ").trim();
		if (!isTooSimilar(title, used)) break;
	}
	recentTitles.push(title);
	if (recentTitles.length > RECENT_LIMIT) recentTitles.shift();
	return title;
};

// ── Sequel titles ────────────────────────────────────────────

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const SUBTITLES = [
	"Reckoning", "Rising", "Origins", "Aftermath", "Legacy", "Redemption", "Resurrection", "Revenge",
	"The Next Chapter", "Last Stand", "Reloaded", "Uprising", "Homecoming", "Dark Waters", "No Mercy",
	"The Final Hour", "Judgment", "Retribution", "Awakening", "Beyond", "Fallout", "Endgame",
];

/**
 * Title for a sequel. `baseTitle` is the franchise name (title of the first film).
 * Gives things like "Silent Harbor 2", "Silent Harbor II", "Silent Harbor: Reckoning", "Silent Harbor 3: Legacy".
 */
export const genSequelTitle = (baseTitle: string, installment: number, taken: Iterable<string> = []): string => {
	const used = new Set<string>();
	for (const t of taken) used.add(t.toLowerCase());
	const roman = ROMAN[installment] ?? String(installment);
	const makers: (() => string)[] = [
		() => `${baseTitle} ${installment}`,
		() => `${baseTitle} ${installment}`,
		() => `${baseTitle} ${roman}`,
		() => `${baseTitle}: ${choice(SUBTITLES)}`,
		() => `${baseTitle}: ${choice(SUBTITLES)}`,
		() => `${baseTitle} ${installment}: ${choice(SUBTITLES)}`,
		() => `Return to ${baseTitle}`,
	];
	if (installment === 2) makers.push(() => `${baseTitle} Returns`);
	if (installment === 3) makers.push(() => `${baseTitle} Returns Again`);
	for (let attempt = 0; attempt < 30; attempt++) {
		const title = choice(makers)();
		if (!used.has(title.toLowerCase())) return title;
	}
	return `${baseTitle} ${installment}`;
};
