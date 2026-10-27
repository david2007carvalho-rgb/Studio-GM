import { RETIRED } from "../constants";
import { fmtMoney } from "../format";
import { actorLegacies, directorLegacies } from "../legacy";
import { ipById } from "../ip";
import { movieProfit } from "../movie";
import { ovr } from "../ovr";
import type { Person } from "../types";
import type { Room } from "./room";
import { andList, nth, num, pick, plural, an } from "./util";
import { GENRE_NOUN } from "./voice";

// ═════════════════════════════════════════════════════════════
// News for the off-season (Awards -> Off-season): who retires, who arrives, who is rising and falling,
// the year in review; and for the start of the next season (Off-season -> Development): the preview.
// `r.voice` here describes people as of the end of the year (the ceremony has happened).
// ═════════════════════════════════════════════════════════════

const money = fmtMoney;

const retirements = (r: Room) => {
	const before = new Map(r.prev.people.map((p) => [p.pid, p]));
	const gone = r.next.people.filter((p) => p.tid === RETIRED && before.get(p.pid)?.tid !== RETIRED);
	const rated = gone
		.map((p) => {
			const s = r.voice.stat(p);
			const wins = s.dirWins.length + s.leadWins.length + s.suppWins.length;
			return { p, s, wins, weight: wins * 10 + s.films.length + s.gross / 200000 };
		})
		.sort((a, b) => b.weight - a.weight);
	for (const { p, s, wins } of rated.slice(0, 3)) {
		if (s.films.length < 2 && wins === 0) continue; // nobody noticed
		const sc = r.voice.scope();
		const best = [...s.films].sort((a, b) => (b.criticScore ?? 0) - (a.criticScore ?? 0))[0];
		const legend = wins >= 2 || s.films.length >= 12;
		r.add({
			kind: "people",
			rank: wins >= 2 ? 5 : 4,
			headline: legend
				? pick([`End of an era: ${sc.ref(p, { short: true })} retires at ${p.age}`, `${sc.tok(p)} calls it a career`, `Farewell to ${sc.tok(p)}: ${p.role === "director" ? "a director" : "an actor"} who defined a generation`])
				: pick([`${sc.tok(p)} retires at ${p.age}`, `${sc.tok(p)} steps away from the business`]),
			body: [
				`${sc.ref(p, { post: true })} has retired after ${plural(s.films.length, "film")}, ${money(s.gross)} at the box office${wins ? ` and ${plural(wins, "major award")}` : ""}${s.noms > wins ? ` (${num(s.noms)} nominations in all)` : ""}.`,
				best ? `The high point: ${sc.film(best)} (${best.season}), which critics scored ${best.criticScore}. "${pick(["They made everyone around them better", "A once-in-a-generation presence", "We will not see their like again", "They never phoned it in"])}," one former collaborator said.` : "",
			].filter(Boolean),
			tags: legend ? ["LEGEND RETIRES"] : ["RETIREMENT"],
		});
	}
};

const newcomers = (r: Room) => {
	const known = new Set(r.prev.people.map((p) => p.pid));
	const fresh = r.next.people.filter((p) => !known.has(p.pid) && p.tid !== RETIRED);
	if (fresh.length === 0) return;
	const hidden = !!r.next.hideRatings; // do not hint at potential either
	const best = hidden ? [...fresh].sort(() => Math.random() - 0.5).slice(0, 3) : [...fresh].sort((a, b) => b.pot - a.pot).slice(0, 3);
	const sc = r.voice.scope();
	const tier = (p: Person) => (p.pot >= 88 ? "touted as a once-in-a-generation talent" : p.pot >= 80 ? "already being called a star in the making" : "a promising name to watch");
	r.add({
		kind: "people",
		rank: !hidden && best[0].pot >= 88 ? 4 : 2,
		headline: !hidden && best[0].pot >= 88 ? `A new name to know: ${sc.tok(best[0])} arrives with huge expectations` : pick([`Fresh faces: ${andList(best.map((p) => sc.tok(p)))} join the business`, `${plural(fresh.length, "newcomer")} arrive${fresh.length === 1 ? "s" : ""} in town`]),
		body: best.map((p) => `${sc.tok(p)}, ${p.age}, ${p.role === "director" ? "a director" : p.gender === "female" ? "an actress" : "an actor"}${hidden ? " with a lot to prove" : ` ${tier(p)}`}.`),
		tags: ["NEWCOMERS"],
	});
};

const movers = (r: Room) => {
	if (r.next.hideRatings) return; // risers and decliners are told by their ratings
	const before = new Map(r.prev.people.map((p) => [p.pid, p]));
	const deltas = r.next.people
		.filter((p) => p.tid !== RETIRED && before.has(p.pid) && before.get(p.pid)!.tid !== RETIRED)
		.map((p) => ({ p, d: ovr(p.attrs, p.role) - ovr(before.get(p.pid)!.attrs, p.role), now: ovr(p.attrs, p.role) }));
	const up = [...deltas].sort((a, b) => b.d - a.d)[0];
	if (up && up.d >= 5 && up.now >= 68) {
		const sc = r.voice.scope();
		r.add({
			kind: "people",
			rank: 3,
			headline: pick([`Leap forward: ${sc.tok(up.p)} jumps ${up.d} points to ${up.now}`, `${sc.tok(up.p)} is on the rise`]),
			body: [`${sc.ref(up.p)}, ${up.p.age}, has taken a big step this year, rated ${up.now} overall after a ${up.d}-point jump. Studios are taking notice.`],
			tags: ["RISING"],
		});
	}
	const down = [...deltas].filter((x) => x.p.age >= 38).sort((a, b) => a.d - b.d)[0];
	if (down && down.d <= -4) {
		const sc = r.voice.scope();
		r.add({
			kind: "people",
			rank: 2,
			headline: pick([`Is ${sc.tok(down.p)} losing a step?`, `${sc.tok(down.p)} slips ${-down.d} points`]),
			body: [`${sc.ref(down.p)}, ${down.p.age}, has slipped to ${down.now} overall. "Everybody ages," said one agent. "Not everybody ages at the same speed."`],
			tags: ["DECLINE"],
		});
	}
};

const yearInReview = (r: Room) => {
	const S = r.next.season;
	const movies = r.next.movies.filter((m) => m.season === S && m.boxOffice !== undefined);
	if (movies.length < 3) return;
	const sc = r.voice.scope();
	const total = movies.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
	const lastTotal = r.next.movies.filter((m) => m.season === S - 1 && m.boxOffice !== undefined).reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
	const top = [...movies].sort((a, b) => (b.boxOffice ?? 0) - (a.boxOffice ?? 0))[0];
	const best = [...movies].sort((a, b) => (b.criticScore ?? 0) - (a.criticScore ?? 0))[0];
	const byStudio = new Map<number, { gross: number; profit: number }>();
	for (const m of movies) {
		const s = byStudio.get(m.tid) ?? { gross: 0, profit: 0 };
		s.gross += m.boxOffice ?? 0;
		s.profit += movieProfit(m);
		byStudio.set(m.tid, s);
	}
	const rows = [...byStudio.entries()].sort((a, b) => b[1].profit - a[1].profit);
	const change = lastTotal > 0 ? total / lastTotal - 1 : null;
	r.add({
		kind: "studio",
		rank: 4,
		headline: change === null ? `${S} in review: ${money(total)} at the box office` : change >= 0.05 ? `A strong year: ${S} box office up ${Math.round(change * 100)}%` : change <= -0.05 ? `A tougher year: ${S} box office down ${Math.round(-change * 100)}%` : `${S} in review: a steady year at ${money(total)}`,
		body: [
			`The ${num(movies.length)} releases earned ${money(total)} in all. The top earner was ${sc.film(top)} (${money(top.boxOffice ?? 0)}); the best-reviewed was ${sc.film(best)} (${best.criticScore}).`,
			`${r.sn(rows[0][0])} was the most profitable studio, with ${money(rows[0][1].profit)} in profit.${rows.findIndex(([tid]) => tid === r.next.userTid) >= 0 ? ` Your studio ranked ${nth(rows.findIndex(([tid]) => tid === r.next.userTid) + 1)} on profit.` : ""}`,
		],
		tags: ["YEAR IN REVIEW"],
		card: {
			kind: "standings",
			title: `${S}: studios by profit`,
			rows: rows.slice(0, 5).map(([tid, x], i) => ({ label: `#${i + 1}`, text: r.sn(tid), note: `${money(x.profit)} profit`, mine: tid === r.next.userTid })),
		},
	});
};

/** A new all-time leader in the legacy rankings. */
const legacyWatch = (r: Room) => {
	const check = (label: string, before: { person: Person; goat: number }[], after: { person: Person; goat: number }[]) => {
		const b = [...before].sort((x, y) => y.goat - x.goat)[0];
		const a = [...after].sort((x, y) => y.goat - x.goat)[0];
		if (!b || !a || a.person.pid === b.person.pid) return;
		const sc = r.voice.scope();
		r.add({
			kind: "record",
			rank: 4,
			headline: `New all-time ${label}: ${sc.tok(a.person)} overtakes ${sc.tok(b.person)}`,
			body: [`After this year, ${sc.ref(a.person, { post: true })} stands atop the all-time rankings, passing ${sc.tok(b.person)}. The debate over the greatest of all time just got a new chapter.`],
			tags: ["GOAT WATCH"],
		});
	};
	check("great actor", actorLegacies(r.prev), actorLegacies(r.next));
	check("great director", directorLegacies(r.prev), directorLegacies(r.next));
};

const rights = (r: Room) => {
	const had = new Set((r.prev.licenses ?? []).map((l) => l.ipId));
	for (const lic of (r.next.licenses ?? []).filter((l) => !had.has(l.ipId) && l.tid !== r.next.userTid).slice(0, 1)) {
		const ip = ipById(r.next, lic.ipId);
		if (!ip) continue;
		r.add({
			kind: "studio",
			rank: 3,
			headline: `${r.sn(lic.tid)} acquires the ${ip.name} rights for ${money(ip.price)}`,
			body: [`${r.sn(lic.tid)} paid ${money(ip.price)} to take control of ${ip.name}. Fans will be watching closely: they expect critics' scores around ${ip.expectCritic}.`],
			tags: ["RIGHTS"],
		});
	}
};

export const offseasonNews = (r: Room): void => {
	retirements(r);
	legacyWatch(r);
	yearInReview(r);
	movers(r);
	newcomers(r);
	rights(r);
};

// ── the start of the next season ─────────────────────────────

export const seasonPreviewNews = (r: Room): void => {
	const S = r.next.season;
	const active = r.next.people.filter((p) => p.tid !== RETIRED);
	const top = (role: Person["role"], gender?: Person["gender"]) =>
		active.filter((p) => p.role === role && (gender === undefined || p.gender === gender)).sort((a, b) => ovr(b.attrs, b.role) - ovr(a.attrs, a.role))[0];
	const sc = r.voice.scope();
	const lastBp = r.next.awards.find((a) => a.season === S - 1)?.bestPicture;
	const watch = [top("director"), top("actor", "male"), top("actor", "female")].filter((p): p is Person => !!p);
	const lastCeremony = r.next.awards.find((x) => x.season === S - 1);
	const champs = lastCeremony
		? ([
				["Best Director", lastCeremony.bestDirector],
				["Best Actor", lastCeremony.bestActor],
				["Best Actress", lastCeremony.bestActress],
			] as const).filter(([, w]) => w?.pid !== undefined)
		: [];
	const body = r.next.hideRatings
		? [champs.length ? `A new season begins. The reigning champions are ${andList(champs.map(([label, w]) => `${label} ${sc.tok(r.person(w!.pid!))}`))}, and every studio is trying to work out who comes next.` : "A new season begins, and nobody knows yet who the names to beat will be."]
		: [
				`A new season begins, and the talent market looks like this: ${andList(watch.map((p) => `${sc.tok(p)} (${ovr(p.attrs, p.role)})`))} are the best-rated names in the business, and every studio will be chasing them.`,
			];
	if (lastBp) body.push(`${r.sn(lastBp.tid)} enters the year as the reigning Best Picture studio with ${mTokSafe(lastBp.mid, lastBp.name)}, and everyone else is trying to knock it off.`);
	const mineBefore = r.prev.studios.find((s) => s.tid === r.next.userTid)!;
	const mineNow = r.next.studios.find((s) => s.tid === r.next.userTid)!;
	if (mineNow.cash > mineBefore.cash && r.next.notice?.startsWith("Investors")) body.push("Your investors had to step in over the winter to keep the lights on.");
	r.add({ kind: "studio", rank: 3, headline: `${S} preview: the people and studios to watch`, body, tags: ["PREVIEW"] });

	// the pitches on the table
	const pitches = (r.next.directorPitches ?? []).filter((p) => p.status === "open").sort((a, b) => b.ask - a.ask).slice(0, 2);
	for (const p of pitches) {
		const s = r.voice.scope();
		const d = r.person(p.directorPid);
		r.add({
			kind: "rumor",
			rank: 2,
			headline: pick([`${s.tok(d)} is shopping ${an(GENRE_NOUN[p.genre])} called "${p.title}"`, `On the market: ${s.tok(d)}'s "${p.title}"`]),
			body: [`${s.ref(d, { post: true })} has ${an(GENRE_NOUN[p.genre])} ready and is asking ${money(p.ask)} to make it. Rival studios are said to be interested if your studio passes.`],
			tags: ["PITCH"],
			mine: true,
		});
	}

	// sequel talk
	const lastYear = r.next.movies.filter((m) => m.season === S - 1 && m.boxOffice !== undefined && m.tid !== r.next.userTid);
	const hit = [...lastYear].filter((m) => movieProfit(m) > 0).sort((a, b) => movieProfit(b) - movieProfit(a))[0];
	if (hit && Math.random() < 0.8) {
		const s = r.voice.scope();
		r.add({
			kind: "rumor",
			rank: 1,
			headline: pick([`Sequel talk: will ${r.sn(hit.tid)} go back to ${s.film(hit)}?`, `${s.film(hit)} sequel in the works? ${r.sn(hit.tid)} is not saying`]),
			body: [`After earning ${money(hit.boxOffice ?? 0)}, ${s.film(hit)} is the film everyone expects ${r.sn(hit.tid)} to continue. A studio spokesperson would only say "we are always listening to the audience."`],
			tags: ["RUMOR"],
		});
	}

	// reputation table
	const rows = [...r.next.studios].sort((a, b) => b.reputation - a.reputation);
	r.add({
		kind: "studio",
		rank: 2,
		headline: `Power rankings: ${r.sn(rows[0].tid)} has the best reputation in town`,
		body: [`${r.sn(rows[0].tid)} (${Math.round(rows[0].reputation)}) leads the industry on reputation, ahead of ${r.sn(rows[1].tid)} (${Math.round(rows[1].reputation)}). Reputation decides which talent will take your calls.`],
		tags: ["POWER RANKINGS"],
		mine: rows[0].tid === r.next.userTid,
		card: {
			kind: "standings",
			title: "Studio reputation",
			rows: rows.slice(0, 5).map((s, i) => ({ label: `#${i + 1}`, text: s.name, note: `${Math.round(s.reputation)}`, mine: s.tid === r.next.userTid })),
		},
	});
};

const mTokSafe = (mid: number, title: string) => `[[m:${mid}|${title}]]`;
