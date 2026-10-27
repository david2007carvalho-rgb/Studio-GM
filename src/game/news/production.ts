import { GENRES } from "../types";
import { fmtMoney } from "../format";
import { continuityOf, franchiseName, installmentOf } from "../franchise";
import { propertyById, propertyStats } from "../ip";
import { movieProfit, teamRating } from "../movie";
import { ovr } from "../ovr";
import { average } from "../random";
import { RETIRED } from "../constants";
import type { Movie, Person } from "../types";
import type { Room } from "./room";
import { type Draft, andList, chance, nth, num, pick, plural, an, poss, aNum } from "./util";
import { GENRE_NOUN, GENRE_WORD } from "./voice";

// ═════════════════════════════════════════════════════════════
// News when the cameras roll (Development -> Production) and when they stop (Production -> Post-production).
// ═════════════════════════════════════════════════════════════

const money = fmtMoney;

/** The slate: how big the year is, the biggest bet, the smallest budget, what is missing. */
const slate = (r: Room) => {
	const movies = r.films();
	if (movies.length < 3) return;
	const sc = r.voice.scope();
	const byBudget = [...movies].sort((a, b) => b.budget - a.budget);
	const big = byBudget[0];
	const small = byBudget[byBudget.length - 1];
	const total = movies.reduce((sum, m) => sum + m.budget, 0);
	const counts = new Map<string, number>();
	for (const m of movies) counts.set(m.genre, (counts.get(m.genre) ?? 0) + 1);
	const [topGenre, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
	const missing = GENRES.filter((g) => !counts.has(g));

	const body = [
		`${r.sn(big.tid)} is making the biggest bet of the year: ${sc.film(big)}, ${an(GENRE_NOUN[big.genre])} with a ${money(big.budget)} budget, directed by ${sc.ref(r.director(big), { post: true })}. Across the industry, ${num(movies.length)} films are shooting with a combined ${money(total)} in budgets.`,
		`At the other end, ${sc.film(small)} is the leanest production of the season at ${money(small.budget)}.`,
	];
	const trend: string[] = [];
	const topWord = GENRE_WORD[topGenre as keyof typeof GENRE_WORD];
	if (topCount >= 3) trend.push(`${num(topCount)} ${topWord} films on the calendar make ${topWord} the genre of the year`);
	if (missing.length > 0 && missing.length <= 3) trend.push(`not a single ${andList(missing.map((g) => GENRE_WORD[g])).replace(" and ", " or ")} film is in production`);
	if (trend.length) body.push(`${trend.join(", while ")}.`.replace(/^./, (c) => c.toUpperCase()));

	r.add({
		kind: "production",
		rank: 3,
		headline: pick([
			`${num(movies.length)} films start shooting as the ${r.next.season} season gets underway`,
			`The ${r.next.season} slate is set: ${num(movies.length)} films, ${money(total)} in budgets, one crowded calendar`,
			`Cameras roll on ${num(movies.length)} films, with ${r.sn(big.tid)} making the loudest noise`,
		]),
		body,
		tags: ["SLATE"],
	});
};

/** The player's own film. */
const yourFilm = (r: Room) => {
	const m = r.films().find((x) => r.isMine(x));
	if (!m) return;
	const sc = r.voice.scope();
	const dir = r.director(m);
	const leads = r.leads(m);
	const supporting = r.supporting(m);
	const rating = (x: Movie) => teamRating(x, r.director(x), r.cast(x));
	const ranked = [...r.films()].sort((a, b) => rating(b) - rating(a));
	const place = ranked.findIndex((x) => x.mid === m.mid) + 1;
	const n = ranked.length;

	const body = [
		`${r.sn(m.tid)} has put ${money(m.budget)} behind the ${GENRE_NOUN[m.genre]} (plus ${money(m.marketing ?? 0)} for marketing), with ${sc.ref(dir, { post: true })} in the director's chair.`,
		`${leads.length ? `Leading the cast: ${andList(leads.map((p) => sc.ref(p)))}.` : ""}${supporting.length ? ` In support: ${andList(supporting.map((p) => sc.ref(p)))}.` : ""}`.trim(),
	];
	if (r.next.hideRatings) {
		// no hint about how the package rates on paper
	} else if (place <= 2) body.push(pick(["Early word from industry insiders puts it among the most promising projects of the year.", "Analysts who have seen the package on paper rank it near the top of this year's slate.", "On paper, this is one of the strongest teams anyone has assembled this season."]));
	else if (place > n - 3) body.push(pick(["Industry watchers are less convinced: on paper, the package looks like one of the weaker ones of the season.", "Insiders say the film will need the shoot to go very well to stand out from the pack.", "Few analysts have it on their lists of movies to watch, but it has surprised people before."]));
	else body.push(pick(["On paper it is a solid package, neither the favorite nor an afterthought.", "Insiders call it a respectable, mid-pack project that could break either way.", "It is the kind of film that lives or dies on the shoot, analysts say."]));
	if (m.prequelMid !== undefined) body.push(`It is the ${nth(installmentOf(m))} chapter in a franchise that audiences already know.`);
	if (m.release && m.release !== "wide") body.push(m.release === "streaming" ? "It is headed straight to streaming." : "The plan is a limited run built around festivals and awards season.");

	r.add({
		kind: "production",
		rank: 4,
		headline: pick([`Cameras roll on ${sc.film(m)}`, `${r.sn(m.tid)} begins shooting ${sc.film(m)}`, `Lights, camera: ${sc.film(m)} is a go`]),
		body: body.filter(Boolean),
		tags: ["YOUR FILM"],
		mine: true,
		tone: "neutral",
	});
};

/** The film with the best cast on the slate (by rating, or by track record when ratings are hidden). */
const starPower = (r: Room) => {
	const movies = r.films();
	const hidden = !!r.next.hideRatings;
	// With ratings hidden the cast is judged on what it has done: box office and awards so far.
	const proven = (p: Person) => {
		const s = r.voice.stat(p);
		return s.gross + 100000 * (s.leadWins.length + s.suppWins.length + s.dirWins.length) + 30000 * s.noms;
	};
	const score = (m: Movie) => (hidden ? r.cast(m).reduce((sum, p) => sum + proven(p), 0) : average(r.cast(m).map((p) => ovr(p.attrs, p.role))));
	const best = [...movies].sort((a, b) => score(b) - score(a))[0];
	if (!best || (hidden && score(best) <= 0)) return;
	const sc = r.voice.scope();
	const stars = [...r.cast(best)].sort((a, b) => (hidden ? proven(b) - proven(a) : ovr(b.attrs, b.role) - ovr(a.attrs, a.role)));
	const names = stars.map((p) => sc.tok(p));
	r.add({
		kind: "production",
		rank: 3,
		headline: hidden
			? pick([`The most proven cast of the year: ${andList(names)} board ${sc.film(best)}`, `${sc.film(best)} brings together ${andList(names)}, a cast with serious credits`])
			: pick([
					`Star power: ${sc.film(best)} lines up ${andList(names)}`,
					`${andList(names)} headline ${sc.film(best)}, the best-cast film of the year`,
					`${sc.film(best)} assembles the cast everyone is talking about`,
				]),
		body: [
			`${r.sn(best.tid)} has gathered ${andList(stars.map((p) => sc.ref(p)))} for ${sc.film(best)}, ${an(GENRE_NOUN[best.genre])} directed by ${sc.ref(r.director(best), { post: true })}. ${hidden ? "No other cast this season has as much box office and awards history behind it." : "No other film this season can match its average star rating."}`,
			pick(["Agents say the cast came together faster than anyone expected.", "The studio is already planning a marketing campaign built on the ensemble.", "Rivals call it the cast to beat."]),
		],
		tags: ["CAST"],
		mine: r.isMine(best),
		tone: r.isMine(best) ? "good" : undefined,
	});
};

/** People who already worked together coming back for more. */
const reunions = (r: Room) => {
	type Reunion = { m: Movie; a: Person; b: Person; films: Movie[]; dirActor: boolean; avg: number };
	const found: Reunion[] = [];
	for (const m of r.films()) {
		const dir = r.director(m);
		const cast = r.cast(m);
		let best: Reunion | null = null;
		const consider = (a: Person, b: Person, dirActor: boolean) => {
			const films = r.together(a.pid, b.pid);
			if (films.length === 0) return;
			if (!dirActor && films.length < 2) return; // two actors meeting a second time is not news
			const avg = average(films.map((f) => f.criticScore ?? 0));
			if (!best || films.length > best.films.length || (films.length === best.films.length && avg > best.avg)) best = { m, a, b, films, dirActor, avg };
		};
		for (const actor of cast) consider(dir, actor, true);
		for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) consider(cast[i], cast[j], false);
		if (best) found.push(best);
	}
	found.sort((x, y) => y.films.length - x.films.length || y.avg - x.avg);
	const allCritics = r.prior.map((f) => f.criticScore ?? 0).sort((a, b) => a - b);
	const goodBar = allCritics.length ? allCritics[Math.floor(allCritics.length * 0.65)] : 75;
	const weakBar = allCritics.length ? allCritics[Math.floor(allCritics.length * 0.3)] : 55;

	for (const x of found.slice(0, 2)) {
		const sc = r.voice.scope();
		const k = x.films.length;
		const first = x.films[0];
		const last = x.films[k - 1];
		const gross = x.films.reduce((sum, f) => sum + (f.boxOffice ?? 0), 0);
		const prizes = r.awardsWon(x.films.map((f) => f.mid));
		const hit = x.avg >= goodBar;
		const flopped = x.avg <= weakBar;
		const headline = flopped
			? pick([`Why are ${sc.tok(x.a)} and ${sc.tok(x.b)} getting back together for ${sc.film(x.m)}?`, `Second chance: ${sc.tok(x.a)} and ${sc.tok(x.b)} try again with ${sc.film(x.m)}`])
			: k === 1
				? pick([`${sc.tok(x.a)} and ${sc.tok(x.b)} reunite on ${sc.film(x.m)}`, `Back together: ${sc.tok(x.a)} and ${sc.tok(x.b)} team up again for ${sc.film(x.m)}`])
				: pick([
						`The ${nth(k + 1)} time: ${sc.tok(x.a)} and ${sc.tok(x.b)} make ${sc.film(x.m)}`,
						`${sc.tok(x.a)} and ${sc.tok(x.b)} go for a ${nth(k + 1)} film together${hit ? ", and critics are already excited" : ""}`,
						`${sc.film(x.m)} brings the band back together: ${sc.tok(x.a)} and ${sc.tok(x.b)}`,
					]);
		const body = [
			`${sc.ref(x.a, { post: x.dirActor })} and ${sc.ref(x.b)} ${x.dirActor ? `first teamed up on ${sc.film(first)} in ${first.season}` : `have already shared the screen in ${plural(k, "film")}, starting with ${sc.film(first)}`}. Their ${k > 1 ? `${num(k)} earlier films` : "earlier film"} averaged ${Math.round(x.avg)} with critics and earned ${money(gross)} combined${prizes > 0 ? `, picking up ${plural(prizes, "award")} along the way` : ""}.`,
			hit
				? pick([`${r.sn(x.m.tid)} is betting the magic holds for ${sc.film(x.m)}. "Some pairs just work," one agent told us.`, `Their last outing, ${sc.film(last)}, was a favorite with critics, and ${r.sn(x.m.tid)} is hoping for the same.`])
				: flopped
					? pick([`Not everyone is convinced: their previous work together left critics cold, and some wonder if ${r.sn(x.m.tid)} is repeating a mistake.`, `Their last film together, ${sc.film(last)}, did little for either career. ${r.sn(x.m.tid)} insists the new script is "a different animal."`])
					: `${r.sn(x.m.tid)} hopes familiarity breeds quality on ${sc.film(x.m)}, ${an(GENRE_NOUN[x.m.genre])}. The pair already know each other's rhythms.`,
		];
		r.add({ kind: "duo", rank: hit && k >= 2 ? 3 : 2, headline, body, tags: ["REUNION"], mine: r.isMine(x.m) });
	}
};

/** Sequels: how the original did, and who came back. */
const sequels = (r: Room) => {
	const list = r.films().filter((m) => m.prequelMid !== undefined && !m.propertyId);
	const mineFirst = [...list].sort((a, b) => Number(r.isMine(b)) - Number(r.isMine(a)));
	for (const m of mineFirst.slice(0, 2)) {
		const prequel = r.next.movies.find((x) => x.mid === m.prequelMid);
		if (!prequel || prequel.boxOffice === undefined) continue;
		const sc = r.voice.scope();
		const back = continuityOf(m.directorPid, m.castPids, prequel);
		const hit = movieProfit(prequel) > 0;
		const part = installmentOf(m);
		const newDirector = m.directorPid !== prequel.directorPid;
		const body = [
			`${franchiseName(r.next, m)} returns for its ${nth(part)} chapter. The original, ${sc.film(prequel)}, earned ${money(prequel.boxOffice)} and ${aNum(prequel.criticScore)} with critics${hit ? "" : ", though it lost money for the studio"}.`,
			back >= 0.99
				? "The entire principal team is back, which is rare and expensive."
				: back <= 0.3
					? `Almost nobody from the first film returns, and the new team${newDirector ? `, led by ${sc.ref(r.director(m), { post: true })},` : ""} will need to win audiences over fresh.`
					: `${newDirector ? `${sc.ref(r.director(m), { post: true })} takes over from ${sc.tok(r.person(prequel.directorPid))}, and ` : ""}${Math.round(back * 4)} of the 4 key names from the first film are back.`,
		];
		r.add({
			kind: "franchise",
			rank: r.isMine(m) ? 3 : 2,
			headline: hit
				? pick([`${r.sn(m.tid)} goes back to the well with ${sc.film(m)}`, `The sequel nobody doubted: ${sc.film(m)} is a go`, `${sc.film(m)}: ${r.sn(m.tid)} bets on a franchise`])
				: pick([`A sequel to a flop? ${r.sn(m.tid)} is making ${sc.film(m)} anyway`, `Can ${sc.film(m)} recapture what ${sc.film(prequel)} missed?`]),
			body,
			tags: [part >= 3 ? "FRANCHISE" : "SEQUEL"],
			mine: r.isMine(m),
		});
	}
};

/** A film built on a licensed property: what the fans expect. */
const licensed = (r: Room) => {
	const m = [...r.films()].filter((x) => x.propertyId).sort((a, b) => Number(r.isMine(b)) - Number(r.isMine(a)))[0];
	if (!m?.propertyId) return;
	const found = propertyById(r.next, m.propertyId);
	if (!found) return;
	const sc = r.voice.scope();
	const stats = propertyStats(found.ip, found.prop);
	r.add({
		kind: "franchise",
		rank: r.isMine(m) ? 3 : 2,
		headline: pick([
			`${r.sn(m.tid)} takes on ${found.prop.name}, and the fans are watching`,
			`${found.ip.name} fans put ${r.sn(m.tid)} on notice with ${sc.film(m)}`,
			`${sc.film(m)}: ${r.sn(m.tid)} brings ${found.ip.name} to the screen`,
		]),
		body: [
			`${r.sn(m.tid)} holds the rights to ${found.ip.name} and is putting ${found.prop.name} on screen under ${sc.ref(r.director(m), { post: true })}. ${found.ip.tagline ? `${found.ip.tagline}.` : ""}`,
			`Fans of ${found.ip.name} are ${stats.severity >= 1.4 ? "ruthless" : stats.severity >= 1.15 ? "demanding" : stats.severity >= 0.9 ? "fair judges" : "forgiving"}, and they expect reviews around ${stats.expectCritic} and a gross near ${money(stats.expectGross)}. Miss, and the backlash is real.`,
		],
		tags: ["IP"],
		mine: r.isMine(m),
	});
};

/** A pitch the player turned down became someone else's film. */
const gotAway = (r: Room) => {
	for (const m of r.films().filter((x) => x.passedPitch).slice(0, 1)) {
		const sc = r.voice.scope();
		r.add({
			kind: "studio",
			rank: 3,
			headline: pick([`The one that got away: ${r.sn(m.tid)} makes ${sc.film(m)}`, `${r.sn(m.tid)} snaps up the film you passed on`]),
			body: [
				`${r.sn(m.tid)} has taken the ${GENRE_NOUN[m.genre]} that ${sc.ref(r.director(m), { post: true })} first pitched to your studio. ${sc.film(m)} is now shooting with a budget of ${money(m.budget)}.`,
				"Whether it was a mistake to pass is a question the box office will answer.",
			],
			tags: ["YOUR PITCH"],
			mine: true,
			tone: "neutral",
		});
	}
};

/** Gossip and spending: the colour of the season. */
const gossip = (r: Room) => {
	const movies = r.films();
	// A big marketing push.
	const loud = [...movies].sort((a, b) => (b.marketing ?? 0) / b.budget - (a.marketing ?? 0) / a.budget)[0];
	if (loud && (loud.marketing ?? 0) / loud.budget >= 0.45) {
		const sc = r.voice.scope();
		r.add({
			kind: "studio",
			rank: 2,
			headline: pick([`Marketing blitz: ${r.sn(loud.tid)} puts ${money(loud.marketing ?? 0)} behind ${sc.film(loud)}`, `${r.sn(loud.tid)} goes all-in on selling ${sc.film(loud)}`]),
			body: [`The marketing budget for ${sc.film(loud)} is a hefty ${Math.round(((loud.marketing ?? 0) / loud.budget) * 100)}% of the film's production budget. Analysts say a campaign this loud usually means a big opening weekend, and sometimes means the studio has doubts about word of mouth.`],
			tags: ["SPENDING"],
			mine: r.isMine(loud),
		});
	}
	// A star who passed on a role.
	const busy = new Set(movies.flatMap((m) => m.castPids));
	const free = r.next.people.filter((p) => p.role === "actor" && p.tid !== RETIRED && !busy.has(p.pid) && r.voice.ovrRank(p) <= 6);
	const target = [...movies].filter((m) => !r.isMine(m)).sort(() => Math.random() - 0.5)[0];
	if (free.length && target && chance(0.7)) {
		const sc = r.voice.scope();
		const star = pick(free);
		r.add({
			kind: "rumor",
			rank: 1,
			headline: pick([`Did ${sc.tok(star)} turn down ${sc.film(target)}?`, `${sc.tok(star)} said to have passed on ${sc.film(target)}`]),
			body: [`${sc.ref(star)} was reportedly offered a major role in ${poss(r.sn(target.tid))} ${GENRE_NOUN[target.genre]} before the part went elsewhere. A representative would only say the actor is "focused on other projects."`],
			tags: ["RUMOR"],
		});
	}
};

/** Everything for the start of production. `drama` are the events that just happened on the shoot. */
export const productionNews = (r: Room, drama: Draft[]): void => {
	slate(r);
	yourFilm(r);
	starPower(r);
	reunions(r);
	sequels(r);
	licensed(r);
	gotAway(r);
	gossip(r);
	for (const d of drama) r.add(d);
};

/** The shoots are over: early buzz and trouble. */
export const wrapNews = (r: Room, drama: Draft[]): void => {
	const movies = r.films().filter((m) => m.productionQuality !== undefined);
	if (movies.length < 3) {
		for (const d of drama) r.add(d);
		return;
	}
	const sorted = [...movies].sort((a, b) => (b.productionQuality ?? 0) - (a.productionQuality ?? 0));
	const mine = movies.find((m) => r.isMine(m));

	if (mine) {
		const sc = r.voice.scope();
		const place = sorted.findIndex((m) => m.mid === mine.mid) + 1;
		const notes = (mine.drama ?? []).filter((d) => d.stage === "production" && d.effect !== "none");
		const body = [
			place <= 3
				? pick([`Whispers from the set are glowing: people who have seen footage from ${sc.film(mine)} describe "the look of an event."`, `Crew members on ${sc.film(mine)} are talking about the dailies in hushed, excited tones.`])
				: place > movies.length - 3
					? pick([`The mood around ${sc.film(mine)} is cautious. Insiders say the footage is "fine," a word nobody wants to hear about a film's first cut.`, `Reports from the set of ${sc.film(mine)} are mixed, and post-production has its work cut out.`])
					: pick([`${sc.film(mine)} wrapped on schedule. Early word is positive without being ecstatic.`, `The shoot of ${sc.film(mine)} ended without any major surprises, which in this business is a kind of good news.`]),
		];
		if (notes.length) body.push(`The shoot was not without incident: ${andList(notes.map((d) => d.label.toLowerCase()))} left a mark on the production.`);
		body.push(`The film now goes into editing under ${sc.ref(r.director(mine), { post: true })}.`);
		r.add({
			kind: "production",
			rank: 4,
			headline: pick([`That's a wrap: ${sc.film(mine)} finishes principal photography`, `${sc.film(mine)} wraps, heads into the editing room`]),
			body,
			tags: ["YOUR FILM"],
			mine: true,
			tone: place <= 3 ? "good" : place > movies.length - 3 ? "bad" : "neutral",
		});
	}

	const best = sorted[0];
	if (best && !r.isMine(best)) {
		const sc = r.voice.scope();
		r.add({
			kind: "production",
			rank: 3,
			headline: pick([`Early buzz: ${sc.film(best)} looks like the year's standout`, `Insiders rave about footage from ${sc.film(best)}`]),
			body: [`${poss(r.sn(best.tid))} ${GENRE_NOUN[best.genre]} has people talking before it has even been edited. ${sc.ref(r.director(best), { post: true })} is said to have delivered "the best-looking footage of the year." Rivals are watching closely.`],
			tags: ["BUZZ"],
		});
	}
	const worst = sorted[sorted.length - 1];
	if (worst && !r.isMine(worst) && chance(0.8)) {
		const sc = r.voice.scope();
		r.add({
			kind: "rumor",
			rank: 2,
			headline: pick([`Trouble brewing? ${sc.film(worst)} limps into the editing room`, `Whispers about ${sc.film(worst)} grow louder`]),
			body: [`Several people who have seen assemblies of ${poss(r.sn(worst.tid))} ${GENRE_NOUN[worst.genre]} describe the footage as underwhelming. The studio says the film is "right on track"; editors may have more work to do than planned.`],
			tags: ["RUMOR"],
		});
	}
	for (const d of drama) r.add(d);
};
