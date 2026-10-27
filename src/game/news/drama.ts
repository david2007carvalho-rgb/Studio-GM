import { isLead } from "../cast";
import { fmtMoney } from "../format";
import { clamp } from "../random";
import { GATED, TRAITS, causeOf, chooseSubject, concerned, hasTrait, outcomeTilt, reveal, revealsOnEvent, stageHeat, traitOdds } from "../traits";
import { bondBetween, heatWord, mendBond, setBond, tensionOdds } from "../rivalries";
import type { Bond, BondKind, DramaRecord, GameState, Movie, Person, TraitId } from "../types";
import type { Voice } from "./voice";
import { type Draft, between, chance, he, him, his, pick, studioName, an, poss } from "./util";
import { RETIRED } from "../constants";

// ═════════════════════════════════════════════════════════════
// Drama: the feuds, injuries, leaks and scandals that happen around films.
//
// A film can have something happen at three moments: during the SHOOT, in POST-production, and just before RELEASE.
// Each event has several possible outcomes, and only some of them change anything:
//   - hurt:   the film gets worse (or more expensive, or earns less)
//   - helped: the trouble makes the film better (friction, buzz, a standing ovation)
//   - none:   it was just talk, and nothing changed
// What changed is written on the film (`Movie.drama`), shown on its page, and reported in the news.
// Shoot and post events change production / post quality when they happen. Anything that touches the
// box office or the critics (`gross`, `critic`) is applied when the film is released (see releaseEffect).
// Personality traits (traits.ts) tilt all of this: who is on the film changes how often it has an event (`stageHeat`),
// which event it is (`traitOdds`), who it is about (`chooseSubject`) and how it turns out (`outcomeTilt`). A trait that
// causes an event is named in the article, which is how hidden traits are discovered. A few events exist only because of a trait.
// Tuning: STAGE_CHANCE (how often a film has an event) and the numbers inside each event.
// ═════════════════════════════════════════════════════════════

export type DramaStage = DramaRecord["stage"];

/** Chance that a given film has an event at each stage. About 10 films a season: ~1.7 events on the shoot, ~1.3 in post, ~1.3 at release. */
const STAGE_CHANCE: Record<DramaStage, number> = { production: 0.17, post: 0.13, release: 0.13 };
/** At most this many events are reported per stage (the rest never happen), so the news never drowns. */
const STAGE_MAX = 3;
/** However much stacks up, a film's box office and critics cannot be moved further than this by drama. */
const GROSS_RANGE = [0.8, 1.3] as const;
const CRITIC_RANGE = 5;

type Fx = Partial<Pick<DramaRecord, "prod" | "post" | "cost" | "gross" | "critic">>;

/** Everything an article about the event can say. Getters introduce the person (with an epithet) the first time and use the surname after. */
type T = {
	f: string; // the film
	s: string; // the studio
	genre: string;
	dn: string; // director, plain name (for headlines)
	an: string; // main actor, plain name
	bn: string; // second actor, plain name
	d: string; // director with an epithet
	a: string;
	b: string;
	cameo: string; // a star who is not in the film (only for the cameo event)
	he: string;
	his: string;
	him: string;
	dhe: string;
	dhis: string;
	over: (fx: Fx) => string; // the extra cost in dollars
};

/** What an outcome does to the lasting relationship between the two people in the story (see rivalries.ts). "mend" calms an existing bond. */
type BondFx = { kind: BondKind | "mend"; heat: [number, number]; pair: "director" | "actors" };

type Outcome = {
	w: number;
	bond?: BondFx;
	effect: DramaRecord["effect"];
	fx: () => Fx;
	note: string; // shown on the film's page
	headline: (t: T) => string[];
	body: (t: T, fx: Fx) => string[];
};

type Cx = { m: Movie; director: Person; cast: Person[]; avgBudget: number; medianBudget: number; star: Person | null; bonds: Bond[] };

type Def = {
	key: string;
	stage: DramaStage;
	label: string;
	tag?: string;
	weight: (c: Cx) => number; // 0 = cannot happen to this film
	actor?: (c: Cx) => Person; // who the story is about (default: a castmate, usually a lead and often one whose traits fit)
	partner?: (c: Cx, actor: Person) => Person; // the second person in the story (default: another castmate)
	outcomes: Outcome[];
};

const range = (a: number, b: number) => () => Math.round(between(a, b) * 10) / 10;
const pct = (a: number, b: number) => () => Math.round(between(a, b) * 100) / 100;
const pickOf = <X,>(list: X[]): X => list[Math.floor(Math.random() * list.length)];
/** Who clashes in a cast clash: the pair with the hottest lasting bond among the actors, else a trouble-prone castmate and another. */
const clashPair = (c: Cx): [Person, Person] => {
	let best: { k: Bond; a: Person; b: Person } | null = null;
	for (const k of c.bonds) {
		const a = c.cast.find((p) => p.pid === k.a);
		const b = c.cast.find((p) => p.pid === k.b);
		if (a && b && (!best || k.heat > best.k.heat)) best = { k, a, b };
	}
	if (best) return [best.a, best.b];
	const weights = c.cast.map((p) => traitOdds("castClash", [p]));
	let r = Math.random() * weights.reduce((x, y) => x + y, 0);
	let first = c.cast[c.cast.length - 1];
	for (let i = 0; i < c.cast.length; i++) if ((r -= weights[i]) <= 0) { first = c.cast[i]; break; }
	return [first, pickOf(c.cast.filter((p) => p !== first))];
};
/** Is `q` a young actor next to the veteran `mentor`? (for the mentorship event) */
const youngerThan = (q: Person, mentor: Person): boolean => q.pid !== mentor.pid && q.role === "actor" && q.age <= 31 && q.age + 8 <= mentor.age;

const DEFS: Def[] = [
	// ───────── during the shoot ─────────
	{
		key: "feud",
		stage: "production",
		label: "On-set feud",
		weight: (c) => (c.m.chemistry ? 0.45 : 1) * (c.director.attrs.vision >= 85 ? 1.25 : 1),
		outcomes: [
			{
				w: 0.52,
				effect: "hurt",
				bond: { kind: "feud", heat: [45, 70], pair: "director" },
				fx: () => ({ prod: -range(2, 5)() }),
				note: "Director and star clashed on set; the shoot suffered.",
				headline: (t) => [`Trouble on set: ${t.dn} and ${t.an} clash during ${t.f} shoot`, `${t.f} set rocked by feud between ${t.dn} and ${t.an}`, `Egos collide on ${t.f}: ${t.dn} and ${t.an} reportedly not speaking`],
				body: (t) => [
					`${t.d} and ${t.a} have been at odds since the second week of shooting on ${t.f}, according to people close to the production. A disagreement over ${pick(["how a pivotal scene should be played", "the film's tone", "a last-minute script change", "the shooting schedule"])} reportedly shut the set down for two days while ${t.s} executives stepped in to mediate.`,
					`${t.s} insists it is "business as usual." Crew members describe a different atmosphere, and it may show on screen.`,
				],
			},
			{
				w: 0.28,
				effect: "none",
				bond: { kind: "mend", heat: [25, 40], pair: "director" },
				fx: () => ({}),
				note: "A rumored feud between director and star was patched up.",
				headline: (t) => [`${t.dn} and ${t.an} bury the hatchet on ${t.f}`, `Feud? What feud? ${t.dn} and ${t.an} close ranks on ${t.f}`],
				body: (t) => [
					`After a tense week that had the ${t.genre} film's set buzzing with rumors, ${t.d} and ${t.a} appeared together to put the talk to rest. Shooting resumed on schedule, and ${t.s} says no days were lost.`,
				],
			},
			{
				w: 0.2,
				effect: "helped",
				bond: { kind: "frenemies", heat: [40, 60], pair: "director" },
				fx: () => ({ prod: range(2, 3)() }),
				note: "Friction between director and star pushed the work to a higher level.",
				headline: (t) => [`Creative friction: ${t.dn} and ${t.an} are pushing each other on ${t.f}`, `Tension on the set of ${t.f} is producing the film's best work, insiders say`],
				body: (t) => [
					`${t.d} and ${t.a} have clashed repeatedly over ${t.f}, yet crew members say the arguments are making the film better. "They're both obsessed. Every take is a fight, and every take is better," one told us.`,
					`${t.s} is reportedly in no hurry to calm things down.`,
				],
			},
		],
	},
	{
		key: "injury",
		stage: "production",
		label: "Injury on set",
		weight: (c) => ({ action: 2.6, adventure: 1.9, horror: 1, sciFiFantasy: 1, thriller: 0.8 })[c.m.genre as string] ?? 0.35,
		outcomes: [
			{
				w: 0.5,
				effect: "hurt",
				fx: () => ({ prod: -range(1, 4)(), cost: pct(0.02, 0.05)() }),
				note: "A star was injured and the shoot was paused.",
				headline: (t) => [`${t.an} injured on the set of ${t.f}`, `Production on ${t.f} halted after ${t.an} injury scare`],
				body: (t, fx) => [
					`${t.a} was hurt during a ${pick(["stunt", "fight sequence", "night shoot", "chase scene"])} on ${t.f} and is recovering. Production paused for several days while the schedule was reworked, and ${t.s} is expected to absorb ${t.over(fx)} in extra costs.`,
					`${t.s} says ${t.he} is expected to make a full recovery.`,
				],
			},
			{
				w: 0.5,
				effect: "none",
				fx: () => ({}),
				note: "A scare on set turned out to be minor.",
				headline: (t) => [`${t.an} shrugs off scare on ${t.f} set`, `Close call on ${t.f}: ${t.an} back to work after mishap`],
				body: (t) => [`${t.a} was briefly taken to hospital after a mishap on the set of ${t.f}, but was back in front of the cameras within a day. "Just a scratch," ${t.he} told reporters.`],
			},
		],
	},
	{
		key: "overrun",
		stage: "production",
		label: "Over budget",
		weight: (c) => Math.min(2.2, Math.max(0.5, c.m.budget / c.avgBudget)) * (c.m.genre === "sciFiFantasy" ? 1.4 : 1),
		outcomes: [
			{
				w: 0.6,
				effect: "hurt",
				fx: () => ({ cost: pct(0.08, 0.22)() }),
				note: "Costs spiralled and the studio had to pay more.",
				headline: (t) => [`${t.f} is running over budget`, `Costs spiral on ${t.f} as ${t.s} writes a bigger check`],
				body: (t, fx) => [
					`${t.s} has had to find an extra ${t.over(fx)} to keep ${t.f} on track, a number that has made accountants nervous. ${t.d} reportedly refused to cut ${pick(["a pricey set piece", "a second unit", "the planned location shoot", "the extra week of rehearsal"])}.`,
				],
			},
			{
				w: 0.25,
				effect: "helped",
				fx: () => ({ cost: pct(0.1, 0.2)(), prod: range(1, 3)() }),
				note: "The studio spent more, and it shows on screen.",
				headline: (t) => [`${t.s} opens the vault for ${t.f}`, `More money, more movie: ${t.s} backs ${t.dn} on ${t.f}`],
				body: (t, fx) => [`${t.d} asked for more money and got it: ${t.over(fx)} on top of the original budget. People who have seen the dailies say every dollar is on the screen.`],
			},
			{
				w: 0.15,
				effect: "hurt",
				fx: () => ({ cost: pct(0.15, 0.3)(), prod: -range(1, 2)() }),
				note: "A runaway shoot cost far more than planned and hurt the film.",
				headline: (t) => [`Runaway production: ${t.f} is bleeding money`],
				body: (t, fx) => [`The shoot of ${t.f} has become a cautionary tale, with ${t.over(fx)} in overruns and no end in sight. ${t.d} has not commented. ${t.s} executives have reportedly been on set daily.`],
			},
		],
	},
	{
		key: "method",
		stage: "production",
		label: "Method acting",
		weight: (c) => (Math.max(...c.cast.map((p) => p.attrs.immersion)) >= 75 ? 1 : 0),
		actor: (c) => c.cast.reduce((best, p) => (p.attrs.immersion > best.attrs.immersion ? p : best)),
		outcomes: [
			{
				w: 0.62,
				effect: "helped",
				fx: () => ({ prod: range(2, 4)() }),
				note: "A star's total commitment lifted the whole shoot.",
				headline: (t) => [`${t.an} goes deep method for ${t.f}`, `Total immersion: ${t.an} refuses to break character on ${t.f}`],
				body: (t) => [
					`${t.a} has reportedly ${pick(["refused to break character for the entire shoot", "lost a dramatic amount of weight for the role", "spent three months living the part before cameras rolled", "insisted on being addressed by the character's name on set"])}. Castmates are divided ("unnerving, but you can't look away") and ${t.dn} says the performance is "unlike anything I've captured."`,
				],
			},
			{
				w: 0.25,
				effect: "none",
				fx: () => ({}),
				note: "A star's method antics were the talk of the set, nothing more.",
				headline: (t) => [`Method madness on ${t.f}: genius or gimmick?`],
				body: (t) => [`${poss(t.a)} commitment has become the talk of the set of ${t.f}. ${t.s} says it has not affected the schedule, and nobody can say yet whether it will show up on screen.`],
			},
			{
				w: 0.13,
				effect: "hurt",
				fx: () => ({ prod: -range(1, 3)() }),
				note: "A star's method approach wore down the cast and the schedule.",
				headline: (t) => [`Castmates push back on ${t.an}'s method approach on ${t.f}`],
				body: (t) => [`After weeks of in-character behavior, some of ${poss(t.a)} co-stars asked ${t.dn} to step in. The shoot of ${t.f} is now behind schedule.`],
			},
		],
	},
	{
		key: "weather",
		stage: "production",
		label: "Location trouble",
		weight: (c) => ({ sciFiFantasy: 1.5, adventure: 1.7, action: 1.1 })[c.m.genre as string] ?? 0.7,
		outcomes: [
			{
				w: 0.7,
				effect: "hurt",
				fx: () => ({ prod: -range(1, 3)(), cost: pct(0.03, 0.08)() }),
				note: "Bad luck on location cost the film time and money.",
				headline: (t) => [`Weather wrecks ${t.f} shoot`, `${t.f} crew battles the elements`],
				body: (t, fx) => [
					`A ${pick(["freak storm", "record heat wave", "string of permit problems on location", "flooded set"])} has thrown the shoot of ${t.f} off course. ${t.d} has been forced to rework key sequences on the fly, and ${t.s} is paying ${t.over(fx)} for the delay.`,
				],
			},
			{
				w: 0.3,
				effect: "none",
				fx: () => ({}),
				note: "A storm threatened the shoot but passed.",
				headline: (t) => [`${t.f} dodges disaster as storm passes`],
				body: (t) => [`${t.d} reports that ${t.f} lost only a day to the weather, and that the crew used the downtime to get ahead on the next sequence. "We got lucky," ${t.dhe} said.`],
			},
		],
	},
	{
		key: "walkout",
		stage: "production",
		label: "Star walks off set",
		weight: () => 0.5,
		outcomes: [
			{
				w: 0.6,
				effect: "hurt",
				bond: { kind: "feud", heat: [35, 60], pair: "director" },
				fx: () => ({ prod: -range(3, 6)(), cost: pct(0.02, 0.04)() }),
				note: "A star walked off set mid-shoot; the damage to the schedule and the mood showed.",
				headline: (t) => [`${t.an} walks off the set of ${t.f}`, `${t.an} storms off ${t.f}: shoot in limbo`],
				body: (t) => [
					`${t.a} left the set of ${t.f} amid a reported dispute over ${pick(["billing", "pay", "creative control", "the direction of the character"])}, leaving ${t.dn} to shoot around ${t.him} for days. ${t.he[0].toUpperCase()}${t.he.slice(1)} eventually returned, but sources say the damage to the schedule, and the mood, was done.`,
				],
			},
			{
				w: 0.4,
				effect: "none",
				fx: () => ({}),
				note: "A star walked off set but returned after talks.",
				headline: (t) => [`${t.an} returns to ${t.f} after brief walkout`],
				body: (t) => [`The rumored walkout of ${t.a} turned out to be a misunderstanding about the schedule, ${t.s} says. ${t.he[0].toUpperCase()}${t.he.slice(1)} was back on set the next morning and the film lost no time.`],
			},
		],
	},
	{
		key: "rewrite",
		stage: "production",
		label: "Mid-shoot rewrite",
		weight: (c) => (c.director.attrs.originality >= 80 ? 1.3 : 0.8),
		outcomes: [
			{
				w: 0.5,
				effect: "helped",
				fx: () => ({ prod: range(2, 4)() }),
				note: "A bold mid-shoot rewrite paid off.",
				headline: (t) => [`Late rewrite on ${t.f}: ${t.dn} tears up the third act`],
				body: (t) => [`With cameras already rolling, ${t.d} ripped up the ending of ${t.f} and rewrote it over a weekend. Early reaction from the cast is rapturous: "It finally makes sense," one said.`],
			},
			{
				w: 0.5,
				effect: "hurt",
				fx: () => ({ prod: -range(2, 4)() }),
				note: "Panicked rewrites left the shoot without a clear script.",
				headline: (t) => [`Panic rewrite: ${t.f} script in flux mid-shoot`],
				body: (t) => [`Cast and crew of ${t.f} were handed new pages the night before shooting, and not for the first time. "Nobody knows what movie we're making," one crew member told us. ${t.s} calls it "a normal part of the process."`],
			},
		],
	},
	{
		key: "perfectionist",
		stage: "production",
		label: "Perfectionist director",
		weight: (c) => (c.director.attrs.technique >= 85 ? 1.4 : 0.8),
		outcomes: [
			{
				w: 0.75,
				effect: "helped",
				fx: () => ({ prod: range(2, 3)(), cost: pct(0.04, 0.09)() }),
				note: "A director's perfectionism cost money and produced stunning footage.",
				headline: (t) => [`${t.dn} demands 100 takes on ${t.f}`, `Perfectionism pays? ${t.dn} drives ${t.f} crew to the limit`],
				body: (t, fx) => [
					`${t.d} is shooting ${t.f} the hard way: ${pick(["dozens of takes on every setup", "the same scene thirty times", "nights of retakes on a single sequence"])}. The crew is exhausted and ${poss(t.s)} accountants are worse (${t.over(fx)} over), but the dailies are said to be extraordinary.`,
				],
			},
			{
				w: 0.25,
				effect: "hurt",
				fx: () => ({ cost: pct(0.04, 0.08)() }),
				note: "A perfectionist shoot ran over budget.",
				headline: (t) => [`${t.f} falls behind as ${t.dn} chases perfection`],
				body: (t, fx) => [`The shoot of ${t.f} is running ${t.over(fx)} over, with ${t.d} refusing to move on until every shot is right. Whether it pays off is anyone's guess.`],
			},
		],
	},
	{
		key: "romance",
		stage: "production",
		label: "Romance rumors",
		tag: "RUMOR",
		weight: (c) => (c.cast.length >= 2 ? (c.m.genre === "romance" ? 2 : 0.7) : 0),
		actor: (c) => c.cast[0],
		outcomes: [
			{
				w: 1,
				effect: "helped",
				fx: () => ({ gross: pct(1.02, 1.05)() }),
				note: "Romance rumors about the cast generated free buzz.",
				headline: (t) => [`Are ${t.an} and ${t.bn} more than co-stars? ${t.f} fans want to know`],
				body: (t) => [`Rumors of an off-screen romance between ${t.a} and ${t.b} have followed ${t.f} since a photo from the set went viral. Neither has commented, and ${t.s} has done nothing to dampen the buzz.`],
			},
		],
	},
	{
		key: "thinIce",
		stage: "production",
		label: "Director on thin ice?",
		tag: "RUMOR",
		weight: () => 0.6,
		outcomes: [
			{
				w: 1,
				effect: "none",
				fx: () => ({}),
				note: "Rumors that the director might be replaced were denied.",
				headline: (t) => [`Is ${t.dn} on thin ice at ${t.s}?`],
				body: (t) => [`Industry chatter suggests ${t.s} executives are unhappy with early footage of ${t.f}. ${t.s} calls the reports "pure fiction" and says it has "complete faith" in ${t.d}.`],
			},
		],
	},
	{
		key: "cursed",
		stage: "production",
		label: "'Cursed' set",
		tag: "RUMOR",
		weight: (c) => (c.m.genre === "horror" ? 2.2 : 0.12),
		outcomes: [
			{
				w: 1,
				effect: "helped",
				fx: () => ({ gross: pct(1.02, 1.06)() }),
				note: "Stories of a 'cursed' set made fans curious.",
				headline: (t) => [`Strange happenings on the set of ${t.f}, or a very good marketing campaign?`],
				body: (t) => [`${t.s} is leaning into the legend: ${pick(["lights that flicker on cue", "a props room that nobody will enter after dark", "a script supervisor who swears she heard a voice on the set mic", "equipment that keeps failing at the same hour"])}. Horror fans are eating it up.`],
			},
		],
	},

	{
		key: "castClash",
		stage: "production",
		label: "Cast clash",
		weight: (c) => (c.cast.length >= 2 ? 0.6 : 0),
		// two actors: the pair with a lasting bond if there is one, otherwise a castmate likely to cause trouble and one of the others
		actor: (c) => clashPair(c)[0],
		partner: (c) => clashPair(c)[1],
		outcomes: [
			{
				w: 0.5,
				effect: "hurt",
				bond: { kind: "feud", heat: [40, 65], pair: "actors" },
				fx: () => ({ prod: -range(1, 4)() }),
				note: "Two actors clashed on set and it showed on screen.",
				headline: (t) => [`${t.an} and ${t.bn} are not speaking on ${t.f}`, `Cold war on the ${t.f} set: ${t.an} vs ${t.bn}`],
				body: (t) => [`${t.a} and ${t.b} have reportedly stopped speaking off camera on ${t.f}, after a disagreement over ${pick(["a scene they both wanted to own", "billing", "improvised dialogue", "who gets the last word in the finale"])}. ${t.dn} has been forced to stage scenes to keep them apart.`],
			},
			{
				w: 0.3,
				effect: "helped",
				bond: { kind: "frenemies", heat: [40, 60], pair: "actors" },
				fx: () => ({ prod: range(1, 3)() }),
				note: "Rivalry between two actors made both bring their best.",
				headline: (t) => [`${t.an} and ${t.bn}: a rivalry that is good for ${t.f}`, `Frenemies ${t.an} and ${t.bn} steal every scene on ${t.f}`],
				body: (t) => [`${t.a} and ${t.b} spend every break needling each other and every take trying to outdo each other. "It's a competition, and the film wins," ${t.dn} told us.`],
			},
			{
				w: 0.2,
				effect: "none",
				bond: { kind: "mend", heat: [25, 40], pair: "actors" },
				fx: () => ({}),
				note: "Tension between two actors blew over.",
				headline: (t) => [`${t.an} and ${t.bn} patch things up on ${t.f}`],
				body: (t) => [`A tense week between ${t.a} and ${t.b} ended with a dinner arranged by ${t.dn}. ${t.s} says it was "a misunderstanding."`],
			},
		],
	},

	// Events that only a trait can cause: they are how Diva, Mentor, Loyal and Workaholic show themselves.
	{
		key: "divaDemands",
		stage: "production",
		label: "Star demands",
		weight: (c) => (c.cast.some((p) => hasTrait(p, "diva")) ? 1.1 : 0),
		actor: (c) => pickOf(c.cast.filter((p) => hasTrait(p, "diva"))),
		outcomes: [
			{
				w: 0.6,
				effect: "hurt",
				fx: () => ({ prod: -range(1, 2)(), cost: pct(0.03, 0.07)() }),
				note: "A star's demands drove up costs and rattled the crew.",
				headline: (t) => [`${t.an} makes demands on ${t.f}: ${t.s} gives in`, `The ${t.an} rider: inside the demands on the ${t.f} set`],
				body: (t, fx) => [
					`${t.a} has reportedly asked for ${pick(["a private trailer the size of a house", "a bigger name on the poster", "a personal entourage on the payroll", "approval over every promotional photo"])} on ${t.f}, and ${t.s} has agreed, to the tune of ${t.over(fx)}. The crew is not amused.`,
				],
			},
			{
				w: 0.25,
				effect: "none",
				fx: () => ({}),
				note: "A star's demands were met quietly; nothing came of it.",
				headline: (t) => [`${t.s} quietly meets ${t.an}'s demands on ${t.f}`],
				body: (t) => [`${t.a} asked for a long list of extras on ${t.f}, and ${t.s} agreed to most of it without fuss. "It's the price of a movie star," one executive said.`],
			},
			{
				w: 0.15,
				effect: "helped",
				fx: () => ({ prod: range(1, 2)() }),
				note: "A star's exacting standards raised the whole shoot.",
				headline: (t) => [`${t.an} is hard to please on ${t.f}, and the film is better for it`],
				body: (t) => [`${t.a} has sent back ${pick(["costumes", "dialogue", "camera setups", "the lighting"])} more than once on ${t.f}. Crew members grumble, but the dailies tell a different story.`],
			},
		],
	},
	{
		key: "mentorship",
		stage: "production",
		label: "A mentor on set",
		weight: (c) => (c.cast.some((p) => hasTrait(p, "mentor") && c.cast.some((q) => youngerThan(q, p))) ? 1 : 0),
		actor: (c) => pickOf(c.cast.filter((p) => hasTrait(p, "mentor") && c.cast.some((q) => youngerThan(q, p)))),
		partner: (c, a) => pickOf(c.cast.filter((q) => youngerThan(q, a))),
		outcomes: [
			{
				w: 0.8,
				effect: "helped",
				fx: () => ({ prod: range(1, 3)() }),
				note: "A veteran took a young castmate under their wing and the whole shoot gained.",
				headline: (t) => [`${t.an} takes ${t.bn} under ${t.his} wing on ${t.f}`, `Passing the torch: ${t.an} and ${t.bn} on the set of ${t.f}`],
				body: (t) => [`${t.a} has spent ${pick(["every break", "the rehearsal weeks", "the long night shoots"])} coaching ${t.b} on ${t.f}. "${t.he[0].toUpperCase()}${t.he.slice(1)} makes everybody better," one crew member told us. ${t.dn} says the scenes between them are the best in the film.`],
			},
			{
				w: 0.2,
				effect: "none",
				fx: () => ({}),
				note: "A veteran's guidance of a younger co-star was a nice story, nothing more.",
				headline: (t) => [`${t.bn} credits ${t.an} for advice on ${t.f}`],
				body: (t) => [`${t.b} spoke warmly of ${t.a} on the set of ${t.f}: "${t.he[0].toUpperCase()}${t.he.slice(1)} taught me more in a week than I learned in years." ${t.s} says it was a nice moment, and nothing more.`],
			},
		],
	},
	{
		key: "rallies",
		stage: "production",
		label: "A star rallies the crew",
		weight: (c) => (c.cast.some((p) => hasTrait(p, "loyal")) ? 0.9 : 0),
		actor: (c) => pickOf(c.cast.filter((p) => hasTrait(p, "loyal"))),
		outcomes: [
			{
				w: 0.75,
				effect: "helped",
				fx: () => ({ prod: range(1, 3)() }),
				note: "A loyal star rallied the crew through a rough patch.",
				headline: (t) => [`${t.an} rallies the ${t.f} crew through a rough patch`, `${t.an} backs ${t.dn} as ${t.f} hits trouble`],
				body: (t) => [`When ${t.f} hit a rough stretch, ${t.a} ${pick(["gave a speech to the crew", "took a cut of the overtime", "stayed for the reshoots without being asked", "flew back from a family event to save the schedule"])}. ${t.s} calls it "exactly the kind of person you want on a set."`],
			},
			{
				w: 0.25,
				effect: "none",
				fx: () => ({}),
				note: "A star's goodwill kept the mood up on a rough shoot.",
				headline: (t) => [`${t.an} keeps the mood up on ${t.f}`],
				body: (t) => [`${t.f} has had a bumpy shoot, but ${t.a} has kept the mood up, according to people on set. "Everyone wants to work with ${t.him}," one said.`],
			},
		],
	},
	{
		key: "marathon",
		stage: "production",
		label: "Marathon shoot",
		weight: (c) => (c.cast.some((p) => hasTrait(p, "workaholic")) ? 1 : 0),
		actor: (c) => pickOf(c.cast.filter((p) => hasTrait(p, "workaholic"))),
		outcomes: [
			{
				w: 0.6,
				effect: "helped",
				fx: () => ({ prod: range(2, 3)() }),
				note: "A workaholic star pushed the shoot ahead of schedule.",
				headline: (t) => [`${t.an} works around the clock on ${t.f}`, `${t.f} wraps ahead of schedule thanks to ${t.an}'s marathon days`],
				body: (t) => [`${t.a} has been ${pick(["first to arrive and last to leave", "on set for eighteen hours a day", "rehearsing between takes, and after them"])} on ${t.f}. The shoot is ahead of schedule, and ${t.dn} says the work shows.`],
			},
			{
				w: 0.25,
				effect: "hurt",
				fx: () => ({ prod: -range(1, 3)(), cost: pct(0.02, 0.04)() }),
				note: "A punishing schedule left the cast and crew burned out.",
				headline: (t) => [`${t.f} crew burned out as ${t.an} sets a punishing pace`],
				body: (t, fx) => [`${t.a} never stops, and ${t.f} has paid for it: several crew members are on sick leave and the schedule had to be reworked, costing ${t.s} ${t.over(fx)}.`],
			},
			{
				w: 0.15,
				effect: "none",
				fx: () => ({}),
				note: "A workaholic star's long days were the talk of the set.",
				headline: (t) => [`Does ${t.an} ever sleep? The ${t.f} set wonders`],
				body: (t) => [`${t.a} is reportedly the first on set and the last off it on ${t.f}. ${t.s} says it has changed nothing about the schedule.`],
			},
		],
	},

	// ───────── in post-production ─────────
	{
		key: "finalCut",
		stage: "post",
		label: "Final-cut war",
		weight: () => 1,
		outcomes: [
			{
				w: 0.4,
				effect: "hurt",
				fx: () => ({ post: -range(3, 6)() }),
				note: "The studio took the film away from its director.",
				headline: (t) => [`Final-cut war: ${t.dn} loses battle with ${t.s} over ${t.f}`],
				body: (t) => [`${t.s} has taken ${t.f} out of ${poss(t.d)} hands after a dispute over its running time and tone. A shorter, more commercial cut is now in the works, and the director is said to be furious.`],
			},
			{
				w: 0.35,
				effect: "helped",
				fx: () => ({ post: range(2, 4)() }),
				note: "The director won the fight for final cut.",
				headline: (t) => [`${t.dn} wins final cut on ${t.f}`],
				body: (t) => [`After a tense standoff, ${t.s} blinked: ${t.d} gets to finish ${t.f} as intended. "I got the film I wanted to make," ${t.dhe} said.`],
			},
			{
				w: 0.25,
				effect: "none",
				fx: () => ({}),
				note: "The director and studio compromised on the cut.",
				headline: (t) => [`${t.dn} and ${t.s} reach truce on ${t.f} cut`],
				body: (t) => [`The fight over the final cut of ${t.f} ended in a compromise. Both sides claim victory; the film is expected to be released on time.`],
			},
		],
	},
	{
		key: "reshoots",
		stage: "post",
		label: "Reshoots",
		weight: () => 1,
		outcomes: [
			{
				w: 0.6,
				effect: "helped",
				fx: () => ({ post: range(2, 4)(), cost: pct(0.04, 0.09)() }),
				note: "Test screenings led to reshoots that improved the film.",
				headline: (t) => [`Test screenings send ${t.f} back for reshoots`],
				body: (t, fx) => [`Audiences loved the first half of the ${t.genre} film but ${pick(["were lost by", "rejected", "were cold on"])} the ending. ${t.d} is back on set for ${pick(["five days", "two weeks"])} of reshoots at ${poss(t.s)} expense (${t.over(fx)}), and insiders say the new ending is a big improvement.`],
			},
			{
				w: 0.25,
				effect: "hurt",
				fx: () => ({ post: -range(1, 3)(), cost: pct(0.05, 0.09)() }),
				note: "Expensive reshoots did not fix the film.",
				headline: (t) => [`Reshoots on ${t.f}: rescue or ruin?`],
				body: (t, fx) => [`${t.s} spent ${t.over(fx)} on emergency reshoots for ${t.f}, but people who have seen the new footage are not convinced it solved anything.`],
			},
			{
				w: 0.15,
				effect: "none",
				fx: () => ({ cost: pct(0.03, 0.05)() }),
				note: "A short round of reshoots changed little.",
				headline: (t) => [`Quiet reshoots for ${t.f}: ${t.s} says it is routine`],
				body: (t, fx) => [`A week of pickup shots for ${t.f} cost ${t.over(fx)}. ${t.s} calls it "standard housekeeping."`],
			},
		],
	},
	{
		key: "rapture",
		stage: "post",
		label: "Test screenings soar",
		weight: () => 0.8,
		outcomes: [
			{
				w: 1,
				effect: "helped",
				fx: () => ({ post: range(1, 3)(), gross: pct(1.02, 1.05)() }),
				note: "Test screenings were among the best the studio has seen.",
				headline: (t) => [`Test screenings for ${t.f} blow the roof off`],
				body: (t) => [`Test audiences gave ${t.f} some of the highest scores ${t.s} has seen, according to people at the screenings. Comment cards read "${pick(["Loved it", "Best film I've seen this year", "Go see this", "I want to watch it again"])}."`],
			},
		],
	},
	{
		key: "composer",
		stage: "post",
		label: "Celebrated composer",
		weight: () => 0.6,
		outcomes: [
			{
				w: 1,
				effect: "helped",
				fx: () => ({ post: range(1, 2)(), critic: 1 }),
				note: "A celebrated composer elevated the film.",
				headline: (t) => [`Acclaimed composer boards ${t.f}`],
				body: (t) => [`A celebrated composer has signed on to score ${t.f}, and ${t.d} calls the music "the film's second lead." Early listeners describe a score that lifts every scene.`],
			},
		],
	},
	{
		key: "leak",
		stage: "post",
		label: "Footage leak",
		weight: () => 0.8,
		outcomes: [
			{
				w: 0.5,
				effect: "helped",
				fx: () => ({ gross: pct(1.03, 1.07)() }),
				note: "Leaked footage was a hit online and boosted interest.",
				headline: (t) => [`${t.f} footage leaks online, and fans love it`],
				body: (t) => [`A clip from ${t.f} appeared online this week and has been viewed millions of times. ${t.s} is "investigating the leak," though its marketing team looks delighted.`],
			},
			{
				w: 0.5,
				effect: "hurt",
				fx: () => ({ gross: pct(0.93, 0.97)() }),
				note: "A spoiler leak took the edge off the release.",
				headline: (t) => [`Spoilers: the ending of ${t.f} leaks`],
				body: (t) => [`The twist of ${t.f} is all over social media after a leak from a screening. ${t.s} is furious, and fears the damage to opening-weekend interest.`],
			},
		],
	},
	{
		key: "meddling",
		stage: "post",
		label: "Studio meddling",
		weight: () => 0.7,
		outcomes: [
			{
				w: 0.7,
				effect: "hurt",
				fx: () => ({ post: -range(2, 4)(), critic: -1 }),
				note: "Studio interference damaged the edit.",
				headline: (t) => [`${t.s} executives accused of meddling with ${t.f}`],
				body: (t) => [`Sources say ${t.s} ordered recuts of ${t.f} against ${poss(t.d)} wishes, trimming ${pick(["a key subplot", "the quieter scenes", "the original ending"])} for pace. The director's camp is "disappointed," the studio "pleased with the result."`],
			},
			{
				w: 0.3,
				effect: "none",
				fx: () => ({}),
				note: "Reports of studio interference were denied.",
				headline: (t) => [`${t.s} denies interfering with ${t.f}`],
				body: (t) => [`Reports that ${t.s} meddled with the edit of ${t.f} are "completely false," the studio says, and ${t.d} backed that up in a statement. Skeptics are not convinced.`],
			},
		],
	},

	// ───────── just before release ─────────
	{
		key: "controversy",
		stage: "release",
		label: "Controversy",
		weight: (c) => (c.m.ipId ? 1.5 : 1),
		outcomes: [
			{
				w: 0.55,
				effect: "hurt",
				fx: () => ({ gross: pct(0.9, 0.96)() }),
				note: "A controversy before release hurt the box office.",
				headline: (t) => [`${t.f} lands in controversy ahead of release`, `Calls to boycott ${t.f} grow as release nears`],
				body: (t) => [`Critics of ${t.f}, ${an(t.genre)} film from ${t.s}, have taken issue with ${pick(["its portrayal of a real-life figure", "a casting choice", "a sequence that leaked on social media", "remarks made by a member of the cast"])}. ${t.s} has defended ${poss(t.d)} vision, but the noise has hurt the film's momentum.`],
			},
			{
				w: 0.45,
				effect: "helped",
				fx: () => ({ gross: pct(1.04, 1.1)() }),
				note: "A controversy backfired and made people want to see the film.",
				headline: (t) => [`Backlash backfires: controversy makes ${t.f} must-see`],
				body: (t) => [`The more critics complained about ${t.f}, the more people wanted to see it for themselves. Advance ticket sales are up sharply, and ${t.s} is not complaining.`],
			},
		],
	},
	{
		key: "scandal",
		stage: "release",
		label: "Star scandal",
		weight: () => 0.7,
		outcomes: [
			{
				w: 0.65,
				effect: "hurt",
				fx: () => ({ gross: pct(0.92, 0.97)() }),
				note: "An off-screen scandal involving a star hurt the release.",
				headline: (t) => [`${t.an} scandal casts a shadow over ${t.f}`],
				body: (t) => [`${t.s} is working to protect ${t.f} after reports about ${t.a} dominated headlines this week. The studio has pulled ${t.him} from the press tour; audiences will decide whether it matters.`],
			},
			{
				w: 0.35,
				effect: "none",
				fx: () => ({}),
				note: "A scandal around a star was contained.",
				headline: (t) => [`${t.s} weathers ${t.an} controversy: ${t.f} release unaffected`],
				body: (t) => [`Damage control worked: after a rough few days for ${t.a}, early numbers suggest ${t.f} is carrying on as planned.`],
			},
		],
	},
	{
		key: "viral",
		stage: "release",
		label: "Viral moment",
		weight: (c) => ({ comedy: 1.6, horror: 1.6, romance: 1.4 })[c.m.genre as string] ?? 1,
		outcomes: [
			{
				w: 1,
				effect: "helped",
				fx: () => ({ gross: pct(1.05, 1.14)() }),
				note: "A viral moment turned the release into an event.",
				headline: (t) => [`${t.f} goes viral: the internet cannot stop talking about it`],
				body: (t) => [`A ${pick(["scene", "line of dialogue", "soundtrack cue", "trailer moment"])} from ${t.f} has taken over social media, turning ${an(t.genre)} release into an event. ${poss(t.s)} marketing team could not have planned it better.`],
			},
		],
	},
	{
		key: "boycott",
		stage: "release",
		label: "Boycott campaign",
		weight: () => 0.5,
		outcomes: [
			{
				w: 0.7,
				effect: "hurt",
				fx: () => ({ gross: pct(0.88, 0.95)() }),
				note: "An organized boycott dented the opening.",
				headline: (t) => [`Organized boycott targets ${t.f}`],
				body: (t) => [`An online campaign urging moviegoers to skip ${t.f} has gathered momentum in the days before release. ${t.s} says the film "speaks for itself"; analysts say the effect on opening weekend could be real.`],
			},
			{
				w: 0.3,
				effect: "none",
				fx: () => ({}),
				note: "A boycott campaign fizzled out.",
				headline: (t) => [`Boycott of ${t.f} fizzles out`],
				body: (t) => [`The campaign against ${t.f} lost steam within days, and ${t.s} reports no change in ticket sales.`],
			},
		],
	},
	{
		key: "cameo",
		stage: "release",
		label: "Surprise cameo",
		weight: (c) => (c.star ? 0.6 : 0),
		outcomes: [
			{
				w: 1,
				effect: "helped",
				fx: () => ({ gross: pct(1.04, 1.08)() }),
				note: "A surprise star cameo had fans talking.",
				headline: (t) => [`Surprise cameo sends fans wild for ${t.f}`],
				body: (t) => [`The secret is out: ${t.cameo} turns up in a brief but memorable role in ${t.f}. Fans who spotted the name in early screenings have spread the word, and ${t.s} has quietly put it in the trailer.`],
			},
		],
	},
	{
		key: "festival",
		stage: "release",
		label: "Festival premiere",
		weight: (c) => (c.m.budget < c.medianBudget ? 2 : 0.4),
		outcomes: [
			{
				w: 0.65,
				effect: "helped",
				fx: () => ({ critic: Math.round(between(1, 3)) }),
				note: "A rapturous festival premiere lifted the reviews.",
				headline: (t) => [`${t.f} gets standing ovation at festival premiere`],
				body: (t) => [`The first audiences at the premiere of ${t.f} stood and applauded for ${pick(["six", "seven", "eight", "nine"])} minutes. Early reviews are glowing, and ${t.d} was visibly moved.`],
			},
			{
				w: 0.35,
				effect: "hurt",
				fx: () => ({ critic: -Math.round(between(1, 3)) }),
				note: "A divisive premiere cost the film some of its reviews.",
				headline: (t) => [`Walkouts reported at ${t.f} premiere`],
				body: (t) => [`${t.f} divided the first audiences: some were enthralled, others left early. The reviews that followed were harsher than ${t.s} had hoped.`],
			},
		],
	},
	{
		key: "reviewBomb",
		stage: "release",
		label: "Review-bombing",
		weight: () => 0.5,
		outcomes: [
			{
				w: 0.8,
				effect: "hurt",
				fx: () => ({ gross: pct(0.96, 0.98)() }),
				note: "Online review-bombing took a small bite out of the box office.",
				headline: (t) => [`Review-bombing hits ${t.f}`],
				body: (t) => [`Thousands of one-star ratings arrived for ${t.f} before most people had seen it. ${t.s} is asking review sites to step in; the effect on the box office is expected to be small, but real.`],
			},
			{
				w: 0.2,
				effect: "none",
				fx: () => ({}),
				note: "Review-bombing was cleaned up quickly.",
				headline: (t) => [`Review sites clean up ${t.f} bombing`],
				body: (t) => [`An attempt to sink the ratings of ${t.f} was caught and removed within hours, ${t.s} says.`],
			},
		],
	},
];

// ── rolling events ───────────────────────────────────────────

const weightedPick = <X extends { w: number }>(list: X[]): X => {
	let roll = Math.random() * list.reduce((sum, x) => sum + x.w, 0);
	for (const x of list) {
		roll -= x.w;
		if (roll <= 0) return x;
	}
	return list[list.length - 1];
};

/** Describe what an event did, in plain words, for the article and the film page. */
const effectText = (fx: Fx, budget: number): string => {
	const bits: string[] = [];
	if (fx.prod) bits.push(`${fx.prod > 0 ? "+" : "−"}${Math.abs(Math.round(fx.prod))} production quality`);
	if (fx.post) bits.push(`${fx.post > 0 ? "+" : "−"}${Math.abs(Math.round(fx.post))} post-production quality`);
	if (fx.cost) bits.push(`+${fmtMoney(Math.round(budget * fx.cost))} cost`);
	if (fx.gross) bits.push(`${fx.gross > 1 ? "+" : "−"}${Math.abs(Math.round((fx.gross - 1) * 100))}% box office`);
	if (fx.critic) bits.push(`${fx.critic > 0 ? "+" : "−"}${Math.abs(fx.critic)} critics`);
	return bits.join(", ");
};

/**
 * Roll this stage's events for every film of the season and apply what changes right away.
 * Mutates `state` (call it on a copy). Returns the articles; `movie.drama` gets one record per event.
 * Call it after the stage's quality was simulated: production events after simProduction, post events after simPost,
 * release events before the box office is simulated.
 */
export const rollDrama = (state: GameState, stage: DramaStage, voice: Voice): Draft[] => {
	const movies = state.movies.filter((m) => m.season === state.season);
	if (movies.length === 0) return [];
	const byId = new Map(state.people.map((p) => [p.pid, p]));
	const budgets = movies.map((m) => m.budget).sort((a, b) => a - b);
	const avgBudget = budgets.reduce((a, b) => a + b, 0) / budgets.length;
	const medianBudget = budgets[Math.floor(budgets.length / 2)];
	const stars = state.people.filter((p) => p.role === "actor" && p.tid !== RETIRED && !movies.some((m) => m.castPids.includes(p.pid)));
	stars.sort((a, b) => b.attrs.charisma + b.attrs.audienceConnection - (a.attrs.charisma + a.attrs.audienceConnection));
	const bigStars = stars.slice(0, 12);

	// Which films have something happen? Films with trouble-prone people are likelier to, and win the limited slots more often.
	type Hit = { m: Movie; director: Person; cast: Person[]; heat: number; key: number };
	const hits: Hit[] = [];
	for (const m of movies) {
		const director = byId.get(m.directorPid);
		const cast = m.castPids.map((pid) => byId.get(pid)).filter((p): p is Person => !!p);
		if (!director || cast.length === 0) continue;
		const heat = stageHeat(stage, [director, ...cast]);
		if (!chance(STAGE_CHANCE[stage] * heat)) continue;
		hits.push({ m, director, cast, heat, key: Math.pow(Math.random(), 1 / heat) });
	}
	hits.sort((a, b) => b.key - a.key);

	const out: Draft[] = [];
	for (const { m, director, cast } of hits) {
		if (out.length >= STAGE_MAX) break;
		const cx: Cx = { m, director, cast, avgBudget, medianBudget, star: bigStars.length ? bigStars[Math.floor(Math.random() * bigStars.length)] : null, bonds: state.bonds ?? [] };
		const used = new Set((m.drama ?? []).map((d) => d.key));
		// What happens depends on who is on the film: their traits make some events likelier (and others rarer).
		const options = DEFS.filter((d) => d.stage === stage && !used.has(d.key))
			.map((d) => ({ d, w: d.weight(cx) * (d.key in GATED ? 1 : traitOdds(d.key, concerned(d.key, director, cast))) * tensionOdds(d.key, cx.bonds, director, cast) }))
			.filter((x) => x.w > 0);
		if (options.length === 0) continue;
		const def = weightedPick(options).d;

		// who the story is about: the castmate whose traits fit the event best
		const leads = cast.filter((p) => isLead(m, p.pid));
		// a lasting feud with the director makes a castmate the likely troublemaker in on-set fights and walkouts
		const feudWithDirector = (p: Person) => {
			const k = def.key === "feud" || def.key === "walkout" ? bondBetween(cx.bonds, director.pid, p.pid) : undefined;
			return k ? 1 + (k.kind === "feud" ? 3 : 1) * (k.heat / 100) : 1;
		};
		const actor = def.actor ? def.actor(cx) : chooseSubject(def.key, cast, (p) => leads.includes(p), feudWithDirector);
		const other = (def.partner ? def.partner(cx, actor) : cast.find((p) => p.pid !== actor.pid)) ?? actor;
		// ...and how it turns out leans with the personalities of the people it is about
		const subjects = concerned(def.key, director, [actor]);
		const outcome = weightedPick(def.outcomes.map((o) => ({ ...o, w: o.w * (def.key in GATED ? 1 : outcomeTilt(def.key, o.effect, subjects)) })));
		const sc = voice.scope();
		const fx = outcome.fx();
		const budget0 = m.budget; // the budget the extra cost is a share of
		const t: T = {
			f: sc.film(m),
			s: studioName(state, m.tid),
			genre: m.genre === "sciFiFantasy" ? "sci-fi" : m.genre,
			dn: sc.tok(director),
			an: sc.tok(actor),
			bn: sc.tok(other),
			get d() { return sc.ref(director, { post: true }); },
			get a() { return sc.ref(actor); },
			get b() { return sc.ref(other); },
			get cameo() { return cx.star ? sc.ref(cx.star) : "a major star"; },
			he: he(actor),
			his: his(actor),
			him: him(actor),
			dhe: he(director),
			dhis: his(director),
			over: (f) => fmtMoney(Math.round(budget0 * (f.cost ?? 0))),
		};

		// Apply what changes now. Release-time numbers (gross, critic) wait for the release.
		if (stage === "production" && fx.prod) m.productionQuality = clamp(Math.round((m.productionQuality ?? 0) + fx.prod));
		if (stage === "post" && fx.post) m.postQuality = clamp(Math.round((m.postQuality ?? 0) + fx.post));
		if (fx.cost) {
			const extra = Math.round(budget0 * fx.cost);
			m.budget += extra;
			const studio = state.studios.find((s) => s.tid === m.tid);
			if (studio) studio.cash -= extra;
		}
		const effect = effectText(fx, budget0);
		const record: DramaRecord = { key: def.key, stage, label: def.label, effect: outcome.effect, note: outcome.note };
		for (const k of ["prod", "post", "cost", "gross", "critic"] as const) if (fx[k]) record[k] = fx[k];

		// Did someone's personality cause this? Then the film page remembers it, and the article may give them away.
		let cause: { who: Person; id: TraitId } | null = null;
		if (def.key in GATED) cause = { who: actor, id: GATED[def.key] };
		else
			for (const p of subjects) {
				const id = causeOf(def.key, p);
				if (id) {
					cause = { who: p, id };
					break;
				}
			}
		if (cause) {
			record.who = cause.who.pid;
			record.trait = cause.id;
		}

		// A lasting bond between the two people in the story: the event starts, renews or calms it (see rivalries.ts).
		let bondLine: string | null = null;
		let bondTag: string | null = null;
		if (outcome.bond) {
			const x = outcome.bond.pair === "director" ? director : actor;
			const y = outcome.bond.pair === "director" ? actor : other;
			if (x.pid !== y.pid) {
				const heat = between(outcome.bond.heat[0], outcome.bond.heat[1]);
				if (outcome.bond.kind === "mend") {
					const existing = bondBetween(state.bonds, x.pid, y.pid);
					if (existing && existing.kind === "feud") {
						const kind = existing.kind;
						const over = mendBond(state, x.pid, y.pid, heat);
						record.bond = kind;
						bondLine = over ? `The two have been at odds since the old days. Insiders say that is now over.` : `Old wounds between them are slowly healing.`;
						bondTag = over ? "RECONCILED" : null;
					}
				} else {
					const { bond, before } = setBond(state, x.pid, y.pid, outcome.bond.kind, heat);
					record.bond = bond.kind;
					if (before && before.kind === bond.kind) {
						bondLine = bond.kind === "feud" ? `It is not the first time: they have been at odds since ${before.since}, and it is now ${an(heatWord("feud", bond.heat))}.` : `Their rivalry goes back to ${before.since}, and the sparks are still flying.`;
						bondTag = bond.kind === "feud" ? "FEUD RENEWED" : "FRENEMIES";
					} else if (before) {
						bondLine = bond.kind === "frenemies" ? `Once bitter enemies, the two now seem to be something closer to frenemies.` : `Once friendly rivals, the two have now fallen out for real.`;
						bondTag = bond.kind === "feud" ? "FEUD" : "FRENEMIES";
					} else {
						bondLine = bond.kind === "feud" ? `Those close to them say this is no passing quarrel: studios casting both should expect trouble.` : `Insiders say it is a rivalry to watch, and studios that cast both may benefit.`;
						bondTag = bond.kind === "feud" ? "FEUD" : "FRENEMIES";
					}
				}
			}
		}
		(m.drama ??= []).push(record);

		const mine = m.tid === state.userTid;
		const headline = pick(outcome.headline(t));
		const body = outcome.body(t, fx);
		const tags = [def.tag ?? (outcome.effect === "hurt" ? "TROUBLE" : outcome.effect === "helped" ? "BUZZ" : "DRAMA")];
		if (bondLine) body.push(bondLine);
		if (bondTag) tags.push(bondTag);
		if (cause && revealsOnEvent(def.key) && reveal(cause.who, cause.id)) {
			// First time the world hears about it: the article says so.
			const trait = TRAITS[cause.id];
			const name = sc.ref(cause.who);
			const pronoun = he(cause.who);
			body.push(pick([`Nobody who knows ${name} is surprised: ${pronoun} ${trait.tell}.`, `It fits a pattern. ${sc.last(cause.who)} ${trait.tell}.`, `Insiders say it is typical: ${pronoun} ${trait.tell}.`]));
			tags.push(trait.label.toUpperCase());
		}
		out.push({
			kind: def.tag === "RUMOR" ? "rumor" : "drama",
			rank: (outcome.effect === "none" ? 2 : 3) + (mine ? 1 : 0),
			headline,
			body,
			tags,
			mine,
			tone: mine ? (outcome.effect === "hurt" ? "bad" : outcome.effect === "helped" ? "good" : "neutral") : undefined,
			effect: effect ? `${def.label}: ${effect}` : undefined,
		});
	}
	return out;
};

/**
 * What a film's drama does at release: a box-office multiplier and critic points (summed over its events, within limits).
 * Call it right after the film's box office and critic score have been simulated.
 */
export const releaseEffect = (m: Movie): { gross: number; critic: number } => {
	let gross = 1;
	let critic = 0;
	for (const d of m.drama ?? []) {
		if (d.gross) gross *= d.gross;
		if (d.critic) critic += d.critic;
	}
	return {
		gross: clamp(gross, GROSS_RANGE[0], GROSS_RANGE[1]),
		critic: clamp(critic, -CRITIC_RANGE, CRITIC_RANGE),
	};
};
