import { RETIRED } from "./constants";
import { ovr } from "./ovr";
import { clamp } from "./random";
import { hasTrait, traitOdds } from "./traits";
import type { Bond, BondKind, GameState, Person, Tension } from "./types";

// ═════════════════════════════════════════════════════════════
// Rivalries and feuds: lasting relationships between two people.
//
// A Bond is a FEUD or FRENEMIES between two people (director + actor, or two actors), with a heat from 0 to 100.
// Bonds are born in the drama (news/drama.ts: on-set feuds, walkouts, cast clashes) and in the tabloids (every off-season),
// and they stay: the news keeps reporting them, they make new clashes likelier, and they hit your films.
//   - FEUD: when both are on one film the shoot suffers (`FEUD_DIRECTOR` / `FEUD_ACTORS` production points at full heat) and
//     the chemistry from earlier films together shrinks (`CHEM_KILL`). A Peacemaker on the film halves the damage.
//   - FRENEMIES: they push each other. The shoot gains up to `FRENEMY` points, and the buzz adds a little at the box office.
// Feuds cool when the two do not work together (`COOL`), and may end in a reconciliation. Frenemies fade faster, since a friendly rivalry needs fresh sparks.
// The greenlight panel and the talent list flag hostile pairs before you commit. Tuning: the numbers below.
// ═════════════════════════════════════════════════════════════

export const FEUD_DIRECTOR = 5; // production points lost, at heat 100, when a director and an actor in a feud work together
export const FEUD_ACTORS = 4; // the same for two actors
export const FEUD_CAP = 10; // the most feuds can cost one film
export const FRENEMY = 3; // production points gained per frenemy pair at heat 100
export const FRENEMY_CAP = 5;
export const FRENEMY_GROSS = 1.03; // box-office buzz when a frenemy pair (heat 40+) is on a film
export const FRENEMY_GROSS_HEAT = 40;
export const CHEM_KILL = 0.6; // share of a film's chemistry bonus that a feud at heat 100 wipes out
export const CALM = 0.5; // a Peacemaker on the film multiplies the feud damage by this
export const COOL = { feud: 8, frenemies: 10 }; // heat lost each off-season when they did not work together
export const RECONCILE_BELOW = 30; // a cooled feud under this heat may end...
export const RECONCILE_CHANCE = 0.25; // ...with this chance each off-season
export const DROP_BELOW = 12; // a bond that cool is forgotten
export const SEED_FEUDS = 4; // bonds already in the air when a game starts
export const SEED_FRIENDS = 2;
export const SEED_DIRECTOR = 2; // of the seeded feuds, director-vs-actor ones are added on top
export const TABLOID_PER_OFFSEASON = [1, 2] as const;

export const keyOf = (a: number, b: number): [number, number] => (a < b ? [a, b] : [b, a]);

export const bondBetween = (bonds: Bond[] | undefined, a: number, b: number): Bond | undefined => {
	const [x, y] = keyOf(a, b);
	return bonds?.find((k) => k.a === x && k.b === y);
};

export const bondsOf = (bonds: Bond[] | undefined, pid: number): Bond[] => (bonds ?? []).filter((k) => k.a === pid || k.b === pid);
export const otherOf = (k: Bond, pid: number): number => (k.a === pid ? k.b : k.a);

/** "simmering", "open feud", "bitter" / "friendly rivalry", "sparring", "inseparable". */
export const heatWord = (kind: BondKind, heat: number): string =>
	kind === "feud" ? (heat >= 70 ? "bitter feud" : heat >= 45 ? "open feud" : "simmering feud") : heat >= 70 ? "inseparable frenemies" : heat >= 45 ? "frenemies" : "friendly rivals";

/**
 * Start, renew or change a bond. Mutates `state`. Returns the bond and what was there before (if anything).
 * Same kind: the heat goes up. A feud met by creative friction becomes frenemies; frenemies who fall out become a feud.
 */
export const setBond = (state: GameState, a: number, b: number, kind: BondKind, heat: number): { bond: Bond; before?: Bond } => {
	const [x, y] = keyOf(a, b);
	state.bonds ??= [];
	const before = state.bonds.find((k) => k.a === x && k.b === y);
	if (!before) {
		const bond: Bond = { a: x, b: y, kind, heat: clamp(Math.round(heat)), since: state.season, last: state.season };
		state.bonds.push(bond);
		return { bond };
	}
	const prior = { ...before };
	before.heat = clamp(Math.round(before.kind === kind ? before.heat + heat * 0.5 : kind === "feud" ? Math.max(heat, before.heat) : heat));
	before.kind = kind;
	before.last = state.season;
	return { bond: before, before: prior };
};

/** Calm a bond down. Returns true if it ended. Mutates `state`. */
export const mendBond = (state: GameState, a: number, b: number, amount: number): boolean => {
	const k = bondBetween(state.bonds, a, b);
	if (!k) return false;
	k.heat = clamp(Math.round(k.heat - amount));
	k.last = state.season;
	if (k.heat >= DROP_BELOW) return false;
	state.bonds = state.bonds!.filter((x) => x !== k);
	return true;
};

// ── what bonds do to a film ──────────────────────────────────

export type TeamTension = {
	pairs: Tension[]; // every feud and friendship among the team, with what it does
	prod: number; // production-quality points, all pairs together
	chemMult: number; // what is left of the chemistry bonus (1 = all of it)
	gross: number; // box-office multiplier
};

/** The feuds and friendships among one film's director and cast, and what they do. Nobody is hurt by a bond with someone who is not on the film. */
export const teamTension = (bonds: Bond[] | undefined, director: Person | undefined, cast: Person[]): TeamTension => {
	const none: TeamTension = { pairs: [], prod: 0, chemMult: 1, gross: 1 };
	if (!bonds?.length || !director) return none;
	const team = [director, ...cast];
	const calm = team.some((p) => hasTrait(p, "peacemaker")) ? CALM : 1;
	const pairs: Tension[] = [];
	let chemMult = 1;
	let buzz = false;
	for (let i = 0; i < team.length; i++) {
		for (let j = i + 1; j < team.length; j++) {
			const k = bondBetween(bonds, team[i].pid, team[j].pid);
			if (!k) continue;
			const h = k.heat / 100;
			if (k.kind === "feud") {
				const base = i === 0 ? FEUD_DIRECTOR : FEUD_ACTORS;
				pairs.push({ a: k.a, b: k.b, kind: "feud", prod: -Math.round(base * h * calm * 10) / 10 });
				chemMult *= 1 - CHEM_KILL * h * calm;
			} else {
				pairs.push({ a: k.a, b: k.b, kind: "frenemies", prod: Math.round(FRENEMY * h * 10) / 10 });
				if (k.heat >= FRENEMY_GROSS_HEAT) buzz = true;
			}
		}
	}
	const lost = clamp(pairs.filter((p) => p.prod < 0).reduce((s, p) => s + p.prod, 0), -FEUD_CAP, 0);
	const won = clamp(pairs.filter((p) => p.prod > 0).reduce((s, p) => s + p.prod, 0), 0, FRENEMY_CAP);
	return { pairs, prod: lost + won, chemMult: Math.max(0.2, chemMult), gross: buzz ? FRENEMY_GROSS : 1 };
};

/** How much likelier an event is because of existing bonds on the film: feuds with the director feed on-set fights and walkouts, feuds between actors feed cast clashes. */
export const tensionOdds = (key: string, bonds: Bond[] | undefined, director: Person, cast: Person[]): number => {
	if (!bonds?.length || (key !== "feud" && key !== "walkout" && key !== "castClash")) return 1;
	let m = 1;
	for (const k of bonds) {
		const onFilm = (pid: number) => director.pid === pid || cast.some((p) => p.pid === pid);
		if (!onFilm(k.a) || !onFilm(k.b)) continue;
		const withDirector = k.a === director.pid || k.b === director.pid;
		if (withDirector !== (key !== "castClash")) continue;
		m += (k.kind === "feud" ? 2 : 0.8) * (k.heat / 100);
	}
	return m;
};

// ── life of a bond ───────────────────────────────────────────

export type BondNote =
	| { type: "reconcile"; a: number; b: number; since: number }
	| { type: "cooled"; a: number; b: number; since: number } // forgotten
	| { type: "tabloid"; a: number; b: number; kind: BondKind };

/** Pairs who made a film together this season. */
const workedTogether = (state: GameState): Set<string> => {
	const set = new Set<string>();
	for (const m of state.movies.filter((x) => x.season === state.season)) {
		const pids = [m.directorPid, ...m.castPids];
		for (let i = 0; i < pids.length; i++) for (let j = i + 1; j < pids.length; j++) set.add(keyOf(pids[i], pids[j]).join("-"));
	}
	return set;
};

/**
 * Off-season: bonds cool unless the pair worked together, feuds may end, and the tabloids start one or two new ones.
 * Mutates `state` (a copy). Returns what happened, for the news.
 */
export const evolveBonds = (state: GameState): BondNote[] => {
	const notes: BondNote[] = [];
	const byId = new Map(state.people.map((p) => [p.pid, p]));
	const together = workedTogether(state);
	const keep: Bond[] = [];
	for (const k of state.bonds ?? []) {
		const a = byId.get(k.a);
		const b = byId.get(k.b);
		if (!a || !b || a.tid === RETIRED || b.tid === RETIRED) continue; // a career ended: so did the quarrel
		if (!together.has(`${k.a}-${k.b}`)) k.heat = clamp(k.heat - COOL[k.kind]);
		else k.last = state.season;
		if (k.heat < DROP_BELOW) {
			notes.push({ type: "cooled", a: k.a, b: k.b, since: k.since });
			continue;
		}
		if (k.kind === "feud" && k.heat < RECONCILE_BELOW && !together.has(`${k.a}-${k.b}`) && Math.random() < RECONCILE_CHANCE) {
			notes.push({ type: "reconcile", a: k.a, b: k.b, since: k.since });
			continue;
		}
		keep.push(k);
	}
	state.bonds = keep;

	// The tabloids: stars who have never worked together trade barbs, or turn out to be friendly rivals.
	const stars = state.people.filter((p) => p.role === "actor" && p.tid !== RETIRED && ovr(p.attrs, p.role) >= 70);
	const [lo, hi] = TABLOID_PER_OFFSEASON;
	const count = lo + (Math.random() < 0.5 ? hi - lo : 0);
	for (let n = 0; n < count && stars.length >= 2; n++) {
		const weight = (p: Person) => traitOdds("castClash", [p]);
		const pickStar = (skip?: Person): Person => {
			const pool = stars.filter((p) => p !== skip);
			let r = Math.random() * pool.reduce((s, p) => s + weight(p), 0);
			for (const p of pool) if ((r -= weight(p)) <= 0) return p;
			return pool[pool.length - 1];
		};
		const x = pickStar();
		const y = pickStar(x);
		if (bondBetween(state.bonds, x.pid, y.pid)) continue;
		const kind: BondKind = Math.random() < 0.65 ? "feud" : "frenemies";
		setBond(state, x.pid, y.pid, kind, 35 + Math.random() * 20);
		notes.push({ type: "tabloid", a: x.pid, b: y.pid, kind });
	}
	return notes;
};

/** A game starts with some rivalries already in the air. They are invented for the game. Mutates `state`. */
export const seedBonds = (state: GameState): void => {
	const actors = state.people.filter((p) => p.role === "actor" && p.tid !== RETIRED).sort((a, b) => ovr(b.attrs, "actor") - ovr(a.attrs, "actor")).slice(0, 60);
	const directors = state.people.filter((p) => p.role === "director" && p.tid !== RETIRED).sort((a, b) => ovr(b.attrs, "director") - ovr(a.attrs, "director")).slice(0, 25);
	const pickWeighted = (pool: Person[]): Person => {
		const w = (p: Person) => traitOdds("castClash", [p]);
		let r = Math.random() * pool.reduce((s, p) => s + w(p), 0);
		for (const p of pool) if ((r -= w(p)) <= 0) return p;
		return pool[pool.length - 1];
	};
	const make = (kind: BondKind, pair: () => [Person, Person]) => {
		for (let tries = 0; tries < 20; tries++) {
			const [x, y] = pair();
			if (x.pid === y.pid || bondBetween(state.bonds, x.pid, y.pid)) continue;
			const { bond } = setBond(state, x.pid, y.pid, kind, 40 + Math.random() * 40);
			bond.since = state.season - 1 - Math.floor(Math.random() * 6);
			bond.last = bond.since;
			return;
		}
	};
	const actorPair = (): [Person, Person] => {
		const x = pickWeighted(actors);
		return [x, pickWeighted(actors.filter((p) => p !== x))];
	};
	for (let i = 0; i < SEED_FEUDS; i++) make("feud", actorPair);
	for (let i = 0; i < SEED_FRIENDS; i++) make("frenemies", actorPair);
	for (let i = 0; i < SEED_DIRECTOR; i++) make("feud", () => [directors[Math.floor(Math.random() * directors.length)], actors[Math.floor(Math.random() * actors.length)]]);
};
