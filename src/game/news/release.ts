import { fmtMoney } from "../format";
import { franchiseName, installmentOf } from "../franchise";
import { propertyById } from "../ip";
import { movieCost, movieProfit } from "../movie";
import { average } from "../random";
import { platformById } from "../streamingData";
import type { Movie, Person } from "../types";
import type { Room } from "./room";
import { type Draft, andList, nth, num, percentile, pick, plural, an, poss, aNum } from "./util";
import { GENRE_NOUN } from "./voice";

// ═════════════════════════════════════════════════════════════
// News when the films come out (Post-production -> Distribution): the weekend, the records, the reviews,
// the flops, the partnerships that keep delivering. Everything is judged against the films of earlier seasons.
// ═════════════════════════════════════════════════════════════

const money = fmtMoney;
const MIN_HISTORY = 10; // records only mean something once this many films came before

const released = (r: Room) => r.films().filter((m) => m.boxOffice !== undefined && m.criticScore !== undefined);

/** The weekend: the top openings as a card, plus the story of the winner. */
const weekend = (r: Room, movies: Movie[]) => {
	const withOpening = movies.filter((m) => m.opening !== undefined).sort((a, b) => (b.opening ?? 0) - (a.opening ?? 0));
	if (withOpening.length < 3) return;
	const sc = r.voice.scope();
	const top = withOpening[0];
	const second = withOpening[1];
	const total = withOpening.reduce((sum, m) => sum + (m.opening ?? 0), 0);
	const margin = (top.opening ?? 0) / Math.max(1, second.opening ?? 1);
	r.add({
		kind: "boxoffice",
		rank: 4,
		headline: margin >= 1.8
			? pick([`${sc.film(top)} runs away with the box office: ${money(top.opening ?? 0)} opening`, `Nobody else came close: ${sc.film(top)} opens to ${money(top.opening ?? 0)}`])
			: margin <= 1.12
				? pick([`Photo finish: ${sc.film(top)} edges ${sc.film(second)} at the box office`, `${sc.film(top)} and ${sc.film(second)} separated by a whisker on opening weekend`])
				: pick([`${sc.film(top)} tops the box office with a ${money(top.opening ?? 0)} opening`, `${sc.film(top)} takes the weekend crown`]),
		body: [
			`${poss(r.sn(top.tid))} ${GENRE_NOUN[top.genre]}, directed by ${sc.ref(r.director(top), { post: true })}, led all ${num(withOpening.length)} openers with ${money(top.opening ?? 0)}, ahead of ${sc.film(second)} (${money(second.opening ?? 0)}). Together the openings brought in ${money(total)}.`,
			`Critics gave ${sc.film(top)} ${aNum(top.criticScore)}; audiences scored it ${top.audienceScore ?? "n/a"}.`,
		],
		tags: ["BOX OFFICE"],
		mine: r.isMine(top),
		card: {
			kind: "boxoffice",
			title: "Opening weekend",
			rows: withOpening.slice(0, 5).map((m, i) => ({
				label: `#${i + 1}`,
				text: `${sc.film(m)} · ${r.sn(m.tid)}`,
				note: `${money(m.opening ?? 0)}`,
				mine: r.isMine(m),
			})),
		},
	});
};

type Metric = {
	name: string; // "highest-grossing opening"
	get: (m: Movie) => number | undefined;
	show: (x: number) => string;
	rank: number;
};

/** Did any film this season break a record, or climb into the all-time top 3? */
const records = (r: Room, movies: Movie[]) => {
	if (r.prior.length < MIN_HISTORY) return;
	const metrics: Metric[] = [
		{ name: "opening weekend", get: (m) => m.opening, show: money, rank: 5 },
		{ name: "box office", get: (m) => m.boxOffice, show: money, rank: 5 },
		{ name: "critics' score", get: (m) => m.criticScore, show: (x) => String(x), rank: 4 },
		{ name: "audience score", get: (m) => m.audienceScore, show: (x) => String(x), rank: 4 },
		{ name: "profit", get: (m) => movieProfit(m), show: money, rank: 4 },
	];
	for (const mt of metrics) {
		const now = movies.filter((m) => mt.get(m) !== undefined).sort((a, b) => mt.get(b)! - mt.get(a)!);
		const pastList = r.prior.filter((m) => mt.get(m) !== undefined).sort((a, b) => mt.get(b)! - mt.get(a)!);
		if (!now.length || !pastList.length) continue;
		const top = now[0];
		const value = mt.get(top)!;
		const old = pastList[0];
		const sc = r.voice.scope();
		const soFar = pastList.filter((m) => mt.get(m)! > value).length + 1; // its all-time place among earlier films, if it were added
		const tied = value === mt.get(old);
		if (value > mt.get(old)!) {
			const isCritics = mt.name.includes("score");
			r.add({
				kind: "record",
				rank: mt.rank,
				headline: isCritics
					? `Record-breaker: ${sc.film(top)} earns the highest ${mt.name} in the game's history (${mt.show(value)})`
					: pick([`Record shattered: ${sc.film(top)} posts the biggest ${mt.name} ever (${mt.show(value)})`, `History made: ${sc.film(top)} sets a new ${mt.name} record`]),
				body: [
					`${sc.film(top)}, from ${r.sn(top.tid)} and director ${sc.ref(r.director(top), { post: true })}, now holds the all-time mark for ${mt.name}: ${mt.show(value)}. The previous record belonged to ${sc.film(old)} (${old.season}), at ${mt.show(mt.get(old)!)}.`,
					pick([`${r.sn(top.tid)} will not be shy about it.`, "Analysts say the number is likely to stand for a while.", "Rivals are already studying how it was done."]),
				],
				tags: ["RECORD"],
				mine: r.isMine(top),
				tone: r.isMine(top) ? "good" : undefined,
			});
		} else if (tied && mt.name.includes("score")) {
			r.add({
				kind: "record",
				rank: 3,
				headline: `${sc.film(top)} ties the record for ${mt.name} (${mt.show(value)})`,
				body: [`It matches ${sc.film(old)} (${old.season}) at the top of the all-time list, ${r.sn(top.tid)} announced.`],
				tags: ["RECORD"],
				mine: r.isMine(top),
			});
		} else if (soFar <= 3 && (mt.name === "box office" || mt.name === "opening weekend")) {
			r.add({
				kind: "record",
				rank: 3,
				headline: `${sc.film(top)} climbs to No. ${soFar} on the all-time ${mt.name} list`,
				body: [`With ${mt.show(value)}, ${sc.film(top)} lands behind only ${andList(pastList.slice(0, soFar - 1).map((m) => sc.film(m)))} in the record books.`.replace("behind only  in the record books", "near the top of the record books")],
				tags: ["ALL-TIME TOP 3"],
				mine: r.isMine(top),
			});
		}
	}

	// the biggest flop ever
	const flops = (list: Movie[]) => list.map((m) => ({ m, loss: -movieProfit(m) })).filter((x) => x.loss > 0).sort((a, b) => b.loss - a.loss);
	const nowFlop = flops(movies)[0];
	const oldFlop = flops(r.prior)[0];
	if (nowFlop && oldFlop && nowFlop.loss > oldFlop.loss) {
		const sc = r.voice.scope();
		const m = nowFlop.m;
		r.add({
			kind: "record",
			rank: 5,
			headline: pick([`Biggest flop in history: ${sc.film(m)} loses ${money(nowFlop.loss)}`, `Disaster of record: ${sc.film(m)} becomes the costliest bomb ever`]),
			body: [
				`${r.sn(m.tid)} will write off ${money(nowFlop.loss)} on ${sc.film(m)}, ${an(GENRE_NOUN[m.genre])} directed by ${sc.ref(r.director(m), { post: true })}. It beats the old record, held by ${sc.film(oldFlop.m)}, by ${money(nowFlop.loss - oldFlop.loss)}.`,
				"The studio declined to comment.",
			],
			tags: ["RECORD", "FLOP"],
			mine: r.isMine(m),
			tone: r.isMine(m) ? "bad" : undefined,
		});
	}
};

/** Hits, flops and sleepers of the season (not already covered by a record). */
const hitsAndFlops = (r: Room, movies: Movie[]) => {
	const sc = r.voice.scope();
	const roi = (m: Movie) => movieProfit(m) / Math.max(1, movieCost(m));
	const byRoi = [...movies].sort((a, b) => roi(b) - roi(a));
	const sleeper = byRoi.find((m) => roi(m) >= 2 && m.budget <= average(movies.map((x) => x.budget)));
	if (sleeper) {
		r.add({
			kind: "boxoffice",
			rank: 3,
			headline: pick([`Sleeper hit: ${sc.film(sleeper)} earns ${Math.round(roi(sleeper) * 100)}% on its cost`, `Nobody saw it coming: ${sc.film(sleeper)} is the bargain of the year`]),
			body: [`${r.sn(sleeper.tid)} spent ${money(movieCost(sleeper))} making and selling ${sc.film(sleeper)} and has ${money(sleeper.boxOffice ?? 0)} to show for it. "The best return on a small bet we've seen this year," one analyst said of the ${GENRE_NOUN[sleeper.genre]} from ${sc.ref(r.director(sleeper), { post: true })}.`],
			tags: ["SLEEPER"],
			mine: r.isMine(sleeper),
			tone: r.isMine(sleeper) ? "good" : undefined,
		});
	}
	const worst = [...movies].filter((m) => movieProfit(m) < 0).sort((a, b) => movieProfit(a) - movieProfit(b))[0];
	if (worst && -movieProfit(worst) >= movieCost(worst) * 0.3 && !r.out.some((d) => d.tags?.includes("FLOP"))) {
		r.add({
			kind: "boxoffice",
			rank: 3,
			headline: pick([`${sc.film(worst)} bombs: ${money(-movieProfit(worst))} in the red`, `Red ink: ${r.sn(worst.tid)} takes a ${money(-movieProfit(worst))} hit on ${sc.film(worst)}`]),
			body: [`${sc.film(worst)} cost ${money(movieCost(worst))} and earned ${money(worst.boxOffice ?? 0)}. ${worst.criticScore! >= 70 ? "Critics were kind, but audiences did not show up." : "Neither critics nor audiences came to its rescue."} The ${GENRE_NOUN[worst.genre]} was directed by ${sc.ref(r.director(worst), { post: true })}.`],
			tags: ["FLOP"],
			mine: r.isMine(worst),
			tone: r.isMine(worst) ? "bad" : undefined,
		});
	}
	const king = [...movies].sort((a, b) => (b.boxOffice ?? 0) - (a.boxOffice ?? 0))[0];
	if (king && r.prior.length < MIN_HISTORY) {
		r.add({
			kind: "boxoffice",
			rank: 3,
			headline: `${sc.film(king)} is the box-office leader of the year with ${money(king.boxOffice ?? 0)}`,
			body: [`${poss(r.sn(king.tid))} ${GENRE_NOUN[king.genre]} has set the early benchmark for the new era.`],
			tags: ["BOX OFFICE"],
			mine: r.isMine(king),
		});
	}
};

/** What the critics and the audiences said. */
const reception = (r: Room, movies: Movie[]) => {
	const all = [...r.prior, ...movies].map((m) => m.criticScore ?? 0);
	const sorted = [...movies].sort((a, b) => (b.criticScore ?? 0) - (a.criticScore ?? 0));
	const best = sorted[0];
	const worst = sorted[sorted.length - 1];
	const sc = r.voice.scope();
	if (best && percentile(all, best.criticScore ?? 0) >= 0.85 && !r.out.some((d) => d.kind === "record" && d.headline.includes(best.title))) {
		r.add({
			kind: "reviews",
			rank: 4,
			headline: pick([`Critics rave: ${sc.film(best)} scores ${aNum(best.criticScore)}`, `"A masterpiece"? Reviewers fall for ${sc.film(best)}`, `${sc.film(best)} is the best-reviewed film of the year`]),
			body: [
				`${sc.ref(r.director(best), { post: true })} may have made the film of the year. ${sc.film(best)}, from ${r.sn(best.tid)}, earned ${aNum(best.criticScore)} from critics${best.audienceScore !== undefined ? ` and ${aNum(best.audienceScore)} from audiences` : ""}. Awards-season talk has already begun.`,
				`Its cast, ${andList(r.leads(best).map((p) => sc.ref(p)))}, drew special praise.`,
			],
			tags: ["REVIEWS"],
			mine: r.isMine(best),
			tone: r.isMine(best) ? "good" : undefined,
		});
	}
	if (worst && worst !== best && percentile(all, worst.criticScore ?? 100) <= 0.15 && (worst.criticScore ?? 100) <= 68) {
		r.add({
			kind: "reviews",
			rank: 3,
			headline: pick([`Critics pan ${sc.film(worst)}: "${pick(["a muddle", "joyless", "a missed opportunity", "forgettable"])}"`, `${sc.film(worst)} lands at the bottom of the year's reviews with ${aNum(worst.criticScore)}`]),
			body: [`The ${GENRE_NOUN[worst.genre]} from ${r.sn(worst.tid)} and ${sc.ref(r.director(worst), { post: true })} drew the harshest notices of the season. ${worst.audienceScore !== undefined && worst.audienceScore > (worst.criticScore ?? 0) + 8 ? `Audiences were kinder, giving it ${aNum(worst.audienceScore)}.` : "Audiences were not much happier."}`],
			tags: ["REVIEWS"],
			mine: r.isMine(worst),
			tone: r.isMine(worst) ? "bad" : undefined,
		});
	}
	const split = [...movies].filter((m) => m.audienceScore !== undefined).sort((a, b) => Math.abs((b.audienceScore ?? 0) - (b.criticScore ?? 0)) - Math.abs((a.audienceScore ?? 0) - (a.criticScore ?? 0)))[0];
	if (split && Math.abs((split.audienceScore ?? 0) - (split.criticScore ?? 0)) >= 15) {
		const critsLove = (split.criticScore ?? 0) > (split.audienceScore ?? 0);
		r.add({
			kind: "reviews",
			rank: 2,
			headline: critsLove
				? pick([`Critics adore ${sc.film(split)}; audiences shrug`, `A divide: ${sc.film(split)} wins reviewers (${split.criticScore}) but not crowds (${split.audienceScore})`])
				: pick([`Audiences love ${sc.film(split)} while critics sniff`, `The people's film: ${sc.film(split)} scores ${split.audienceScore} with crowds, ${split.criticScore} with critics`]),
			body: [critsLove ? `${poss(r.sn(split.tid))} ${GENRE_NOUN[split.genre]} is the kind of film critics champion and audiences skip. Expect the awards chatter to be louder than the ticket sales.` : `${sc.ref(r.director(split), { post: true })} has made a film that critics do not respect and crowds cannot get enough of. ${r.sn(split.tid)} is happy to take the money.`],
			tags: ["SPLIT VERDICT"],
			mine: r.isMine(split),
		});
	}
};

/** Your own release in one place. */
const yourRelease = (r: Room, movies: Movie[]) => {
	const m = movies.find((x) => r.isMine(x));
	if (!m) return;
	const sc = r.voice.scope();
	const profit = movieProfit(m);
	const place = [...movies].sort((a, b) => (b.boxOffice ?? 0) - (a.boxOffice ?? 0)).findIndex((x) => x.mid === m.mid) + 1;
	const crit = [...movies].sort((a, b) => (b.criticScore ?? 0) - (a.criticScore ?? 0)).findIndex((x) => x.mid === m.mid) + 1;
	const good = profit > 0 && (m.criticScore ?? 0) >= 60;
	r.add({
		kind: "boxoffice",
		rank: 4,
		headline: profit > movieCost(m) * 0.5
			? pick([`${sc.film(m)} is a hit: ${money(m.boxOffice ?? 0)} and counting`, `Smash for ${r.sn(m.tid)}: ${sc.film(m)} turns a big profit`])
			: profit > 0
				? pick([`${sc.film(m)} makes money, but it is no blockbuster`, `${sc.film(m)} finishes in the black`])
				: pick([`${sc.film(m)} falls short of its cost`, `Rough landing for ${r.sn(m.tid)}: ${sc.film(m)} loses money`]),
		body: [
			`${sc.film(m)} finishes ${nth(place)} among this year's ${num(movies.length)} releases at the box office with ${money(m.boxOffice ?? 0)}${m.opening ? ` (${money(m.opening)} on opening weekend)` : ""}, against a cost of ${money(movieCost(m))}. ${profit >= 0 ? `Profit: ${money(profit)}.` : `Loss: ${money(-profit)}.`}`,
			`Critics scored it ${m.criticScore} (${nth(crit)} of the year) and audiences ${m.audienceScore ?? "n/a"}. ${good && (m.criticScore ?? 0) >= 80 ? "Awards voters will take notice." : ""}`.trim(),
		],
		tags: ["YOUR FILM"],
		mine: true,
		tone: profit > 0 ? "good" : "bad",
	});
};

/** Sequels against their predecessors, and the fans of licensed properties. */
const followUps = (r: Room, movies: Movie[]) => {
	const sc = r.voice.scope();
	const sequels = movies
		.filter((m) => m.prequelMid !== undefined)
		.map((m) => ({ m, prev: r.next.movies.find((x) => x.mid === m.prequelMid)! }))
		.filter((x) => x.prev?.boxOffice)
		.sort((a, b) => Math.abs(Math.log(b.m.boxOffice! / b.prev.boxOffice!)) - Math.abs(Math.log(a.m.boxOffice! / a.prev.boxOffice!)));
	for (const { m, prev } of sequels.slice(0, 1)) {
		const ratio = (m.boxOffice ?? 0) / (prev.boxOffice ?? 1);
		const part = installmentOf(m);
		if (ratio >= 1.2) {
			r.add({
				kind: "franchise",
				rank: 3,
				headline: pick([`Bigger than the original: ${sc.film(m)} outgrosses ${sc.film(prev)} by ${Math.round((ratio - 1) * 100)}%`, `The franchise grows: ${sc.film(m)} tops ${sc.film(prev)}`]),
				body: [`${franchiseName(r.next, m)} now stands at ${plural(part, "film")}, and the latest ${money(m.boxOffice ?? 0)} gross beats ${poss(sc.film(prev))} ${money(prev.boxOffice ?? 0)}. ${r.sn(m.tid)} has no plans to stop.`],
				tags: ["FRANCHISE"],
				mine: r.isMine(m),
				tone: r.isMine(m) ? "good" : undefined,
			});
		} else if (ratio <= 0.75) {
			r.add({
				kind: "franchise",
				rank: 3,
				headline: pick([`Sequel fatigue? ${sc.film(m)} earns ${Math.round((1 - ratio) * 100)}% less than ${sc.film(prev)}`, `The well runs dry: ${sc.film(m)} disappoints`]),
				body: [`${sc.film(m)} brought in ${money(m.boxOffice ?? 0)}, well short of the ${money(prev.boxOffice ?? 0)} earned by ${sc.film(prev)}. ${part >= 3 ? "Part " + part + " is when audiences start to tire." : "Audiences were not as eager the second time around."}`],
				tags: ["FRANCHISE"],
				mine: r.isMine(m),
				tone: r.isMine(m) ? "bad" : undefined,
			});
		}
	}
	const ipFilm = movies.filter((m) => m.ipResult).sort((a, b) => Math.abs(1 - b.ipResult!.reaction) - Math.abs(1 - a.ipResult!.reaction))[0];
	if (ipFilm?.ipResult && ipFilm.propertyId) {
		const found = propertyById(r.next, ipFilm.propertyId);
		const res = ipFilm.ipResult;
		if (found && (res.reaction <= 0.93 || res.reaction >= 1.03)) {
			r.add({
				kind: "franchise",
				rank: 3,
				headline: res.reaction < 1
					? pick([`${found.ip.name} fans revolt over ${sc.film(ipFilm)}`, `Fan backlash: ${found.ip.name} faithful reject ${sc.film(ipFilm)}`])
					: pick([`${found.ip.name} fans cheer ${sc.film(ipFilm)}`, `${sc.film(ipFilm)} wins over the ${found.ip.name} faithful`]),
				body: [
					`Fans wanted a ${res.expectCritic} with critics; they got ${aNum(ipFilm.criticScore)}. ${res.reaction < 1 ? `The box office took a ${Math.round((1 - res.reaction) * 100)}% hit from the backlash.` : `The goodwill added ${Math.round((res.reaction - 1) * 100)}% to the gross.`} ${res.metCritic && res.metGross ? `${r.sn(ipFilm.tid)} met every expectation.` : ""}`.trim(),
				],
				tags: ["FAN REACTION"],
				mine: r.isMine(ipFilm),
				tone: r.isMine(ipFilm) ? (res.reaction < 1 ? "bad" : "good") : undefined,
			});
		}
	}
};

/** Partnerships: pairs who made films together, and are doing very well (or no longer are). */
const duos = (r: Room, movies: Movie[]) => {
	const critics = [...r.prior, ...movies].map((m) => m.criticScore ?? 0);
	type Duo = { m: Movie; a: Person; b: Person; films: Movie[]; avg: number; dirActor: boolean };
	const found: Duo[] = [];
	for (const m of movies) {
		const dir = r.director(m);
		const cast = r.cast(m);
		const pairs: [Person, Person, boolean][] = [];
		for (const c of cast) pairs.push([dir, c, true]);
		for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) pairs.push([cast[i], cast[j], false]);
		for (const [a, b, dirActor] of pairs) {
			const before = r.together(a.pid, b.pid);
			if (before.length < 1) continue;
			const films = [...before, m];
			found.push({ m, a, b, films, avg: average(films.map((f) => f.criticScore ?? 0)), dirActor });
		}
	}
	found.sort((x, y) => y.films.length - x.films.length || y.avg - x.avg);
	let told = 0;
	for (const d of found) {
		if (told >= 2) break;
		const sc = r.voice.scope();
		const k = d.films.length;
		const pct = percentile(critics, d.avg);
		const latest = d.m.criticScore ?? 0;
		const previousAvg = average(d.films.slice(0, -1).map((f) => f.criticScore ?? 0));
		const gross = d.films.reduce((sum, f) => sum + (f.boxOffice ?? 0), 0);
		const prizes = r.awardsWon(d.films.map((f) => f.mid));
		if (k >= 2 && pct >= 0.75 && latest >= previousAvg - 4) {
			r.add({
				kind: "duo",
				rank: k >= 3 ? 4 : 3,
				headline: pick([
					`${sc.tok(d.a)} and ${sc.tok(d.b)}: ${num(k)} films, ${num(k)} wins with critics`,
					`Golden pair: ${sc.tok(d.a)} and ${sc.tok(d.b)} do it again with ${sc.film(d.m)}`,
					`The ${nth(k)} time is the charm: ${sc.tok(d.a)} and ${sc.tok(d.b)} score with ${sc.film(d.m)}`,
				]),
				body: [
					`${sc.ref(d.a, { post: d.dirActor })} and ${sc.ref(d.b)} have now made ${plural(k, "film")} together, averaging ${Math.round(d.avg)} with critics and earning ${money(gross)}${prizes ? `, with ${plural(prizes, "award")} to show for it` : ""}. ${sc.film(d.m)} scored ${aNum(latest)}.`,
					pick(["Hollywood is taking note: this is the kind of partnership studios try to bottle.", "Agents are already fielding calls from studios hoping to book the pair.", "Few partnerships in the business have been this reliable."]),
				],
				tags: ["GOLDEN DUO"],
				mine: r.isMine(d.m),
				tone: r.isMine(d.m) ? "good" : undefined,
			});
			told++;
		} else if (k >= 2 && latest <= previousAvg - 12) {
			r.add({
				kind: "duo",
				rank: 2,
				headline: pick([`Has the magic faded for ${sc.tok(d.a)} and ${sc.tok(d.b)}?`, `${sc.film(d.m)} stumbles: ${sc.tok(d.a)} and ${sc.tok(d.b)} lose their touch`]),
				body: [`Their first ${num(k - 1)} ${k - 1 === 1 ? "film" : "films"} together averaged ${Math.round(previousAvg)}. ${sc.film(d.m)} managed only ${latest}. ${sc.ref(d.a)} and ${sc.ref(d.b)} have not commented.`],
				tags: ["DUO"],
				mine: r.isMine(d.m),
				tone: r.isMine(d.m) ? "bad" : undefined,
			});
			told++;
		}
	}
};

/** Career bests. */
const careerHighs = (r: Room, movies: Movie[]) => {
	for (const m of [...movies].sort((a, b) => (b.criticScore ?? 0) - (a.criticScore ?? 0))) {
		const dir = r.director(m);
		const before = r.voice.stat(dir).films;
		if (before.length < 3) continue;
		const prevBest = Math.max(...before.map((f) => f.criticScore ?? 0));
		if ((m.criticScore ?? 0) <= prevBest + 2) continue;
		const sc = r.voice.scope();
		r.add({
			kind: "people",
			rank: 2,
			headline: pick([`Career-best reviews for ${sc.tok(dir)} with ${sc.film(m)}`, `${sc.tok(dir)} tops ${sc.last(dir)}'s own best with ${sc.film(m)}`.replace(`${sc.last(dir)}'s own best`, "their previous best")]),
			body: [`${sc.ref(dir, { post: true })} has earned the best notices of ${r.voice.stat(dir).avgCritics !== null ? "a long" : "a"} career: ${aNum(m.criticScore)} for ${sc.film(m)}, up from a previous high of ${prevBest}. They have made ${plural(before.length, "film")} before this one.`],
			tags: ["CAREER HIGH"],
			mine: r.isMine(m),
		});
		break;
	}
};

/** Which studio is winning the year. */
const standings = (r: Room, movies: Movie[]) => {
	const by = new Map<number, { gross: number; films: number; critics: number[] }>();
	for (const m of movies) {
		const s = by.get(m.tid) ?? { gross: 0, films: 0, critics: [] };
		s.gross += m.boxOffice ?? 0;
		s.films++;
		s.critics.push(m.criticScore ?? 0);
		by.set(m.tid, s);
	}
	const rows = [...by.entries()].sort((a, b) => b[1].gross - a[1].gross);
	if (rows.length < 3) return;
	const [first, second] = rows;
	const mine = rows.findIndex(([tid]) => tid === r.next.userTid);
	const close = first[1].gross / Math.max(1, second[1].gross) < 1.1;
	r.add({
		kind: "studio",
		rank: 3,
		headline: close
			? pick([`Tight race for the year: ${r.sn(first[0])} barely ahead of ${r.sn(second[0])}`, `${r.sn(first[0])} and ${r.sn(second[0])} neck and neck in the studio race`])
			: pick([`${r.sn(first[0])} leads the studios with ${money(first[1].gross)}`, `${r.sn(first[0])} is the studio to beat this year`]),
		body: [
			`${r.sn(first[0])} tops the standings with ${money(first[1].gross)} from ${plural(first[1].films, "release")}, ${close ? `just ${money(first[1].gross - second[1].gross)} ahead of ${r.sn(second[0])}` : `well ahead of ${r.sn(second[0])} (${money(second[1].gross)})`}.`,
			mine >= 0 ? `Your studio ranks ${nth(mine + 1)} of ${num(rows.length)}.` : "",
		].filter(Boolean),
		tags: ["STANDINGS"],
		mine: mine === 0,
		card: {
			kind: "standings",
			title: "Studios by box office this year",
			rows: rows.slice(0, 5).map(([tid, s], i) => ({ label: `#${i + 1}`, text: r.sn(tid), note: `${money(s.gross)} · ${plural(s.films, "film")}`, mine: tid === r.next.userTid })),
		},
	});
};

/** Streaming premieres. */
const streaming = (r: Room, movies: Movie[]) => {
	const m = movies.find((x) => x.release === "streaming" && x.streamPlatformId);
	if (!m) return;
	const platform = platformById(m.streamPlatformId!);
	const sc = r.voice.scope();
	r.add({
		kind: "boxoffice",
		rank: 2,
		headline: `${sc.film(m)} skips cinemas and premieres on ${platform?.name ?? "streaming"}`,
		body: [`${poss(r.sn(m.tid))} ${GENRE_NOUN[m.genre]} went straight to ${platform?.name ?? "a streaming platform"}, with ${sc.ref(r.director(m), { post: true })} at the helm. Critics scored it ${m.criticScore}. Theater owners were not thrilled, but the viewership numbers are being called "healthy."`],
		tags: ["STREAMING"],
		mine: r.isMine(m),
	});
};

export const releaseNews = (r: Room, drama: Draft[]): void => {
	const movies = released(r);
	if (movies.length === 0) return;
	weekend(r, movies);
	records(r, movies);
	yourRelease(r, movies);
	hitsAndFlops(r, movies);
	reception(r, movies);
	followUps(r, movies);
	duos(r, movies);
	careerHighs(r, movies);
	streaming(r, movies);
	standings(r, movies);
	for (const d of drama) r.add(d);
};
