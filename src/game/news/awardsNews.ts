import { fmtMoney } from "../format";
import type { AwardRace, AwardWinner, Movie, RaceEntry, SeasonAwards } from "../types";
import type { Room } from "./room";
import { andList, mTok, nth, num, pick, plural, pTok, sample, poss, aNum } from "./util";
import { GENRE_NOUN, type CatKey } from "./voice";

// ═════════════════════════════════════════════════════════════
// Awards coverage. Two special articles with their own tables:
//   - the NOMINATIONS (when the films come out and the race is set), with who is the frontrunner and which races are too close to call
//   - the WINNERS (at the ceremony), with upsets, records, sweeps and shut-outs
// All of it only reads what the awards already decided. Nothing here changes who wins.
// ═════════════════════════════════════════════════════════════

type RaceKey = keyof AwardRace;
const CATS: { key: RaceKey; label: string; person: boolean }[] = [
	{ key: "bestPicture", label: "Best Picture", person: false },
	{ key: "bestDirector", label: "Best Director", person: true },
	{ key: "bestActor", label: "Best Actor", person: true },
	{ key: "bestActress", label: "Best Actress", person: true },
	{ key: "bestSupportingActor", label: "Best Supporting Actor", person: true },
	{ key: "bestSupportingActress", label: "Best Supporting Actress", person: true },
];

const entryText = (e: RaceEntry, person: boolean): string => (person ? `${pTok(e.pid!, e.name)} (${mTok(e.mid, e.movieTitle)})` : mTok(e.mid, e.movieTitle));
const pctText = (x: number) => `${Math.round(x * 100)}%`;

// ── nominations and the race ─────────────────────────────────

export const nominationsNews = (r: Room): void => {
	const race = r.next.awardRace;
	if (!race) return;
	const sc = r.voice.scope();
	const noms = new Map<number, number>();
	const studioNoms = new Map<number, number>();
	for (const c of CATS) {
		for (const e of race[c.key]) {
			noms.set(e.mid, (noms.get(e.mid) ?? 0) + 1);
			studioNoms.set(e.tid, (studioNoms.get(e.tid) ?? 0) + 1);
		}
	}
	const byNoms = [...noms.entries()].sort((a, b) => b[1] - a[1]);
	if (byNoms.length === 0) return;
	const [leaderMid, leaderCount] = byNoms[0];
	const leader = r.next.movies.find((m) => m.mid === leaderMid)!;
	const topStudio = [...studioNoms.entries()].sort((a, b) => b[1] - a[1])[0];
	const mineNoms = studioNoms.get(r.next.userTid) ?? 0;

	// who is the favorite, which races are close
	const note = (list: RaceEntry[]): string | undefined => {
		if (list.length < 2) return undefined;
		const gap = list[0].chance - list[1].chance;
		if (list[0].chance >= 0.55) return `Frontrunner: ${list[0].name}`;
		if (gap <= 0.07) return "Too close to call";
		return undefined;
	};

	// the best-reviewed film left out of the Best Picture race
	const pictureMids = new Set(race.bestPicture.map((e) => e.mid));
	const snub = r.films().filter((m) => !pictureMids.has(m.mid) && m.criticScore !== undefined).sort((a, b) => (b.criticScore ?? 0) - (a.criticScore ?? 0))[0];

	const body = [
		`${sc.film(leader)} leads the field with ${plural(leaderCount, "nomination")}${byNoms[1] && byNoms[1][1] === leaderCount ? `, level with ${sc.film(r.next.movies.find((m) => m.mid === byNoms[1][0])!)}` : ""}. ${topStudio ? `${r.sn(topStudio[0])} is the most-nominated studio with ${topStudio[1]}.` : ""}`,
		mineNoms > 0 ? `Your studio collected ${plural(mineNoms, "nomination")}.` : `Your studio goes into the ceremony without a single nomination.`,
	];
	if (snub && (snub.criticScore ?? 0) >= 70) body.push(`The big snub: ${sc.film(snub)} (critics: ${snub.criticScore}) was left out of the Best Picture field entirely.`);

	r.add({
		kind: "awards",
		rank: 5,
		headline: pick([
			`${r.next.season} nominations: ${sc.film(leader)} leads with ${num(leaderCount)}`,
			`The nominees are in: ${sc.film(leader)} dominates with ${plural(leaderCount, "nod")}`,
			`Awards season begins: ${plural(leaderCount, "nomination")} for ${sc.film(leader)}`,
		]),
		body,
		tags: ["NOMINATIONS"],
		mine: mineNoms > 0,
		tone: mineNoms > 0 ? "good" : "neutral",
		card: {
			kind: "nominees",
			title: `${r.next.season} nominees`,
			rows: CATS.map((c) => ({
				label: c.label,
				text: race[c.key].map((e) => entryText(e, c.person)).join(" · "),
				note: note(race[c.key]),
				mine: race[c.key].some((e) => e.tid === r.next.userTid),
			})),
		},
	});

	// ── who will win? ──
	type Story = { score: number; draft: Parameters<Room["add"]>[0] };
	const stories: Story[] = [];
	for (const c of CATS) {
		const list = race[c.key];
		if (list.length < 2) continue;
		const [a, b] = list;
		const s = r.voice.scope();
		const fa = c.person ? s.ref(r.person(a.pid!)) : s.film(r.next.movies.find((m) => m.mid === a.mid)!);
		const fb = c.person ? s.ref(r.person(b.pid!)) : s.film(r.next.movies.find((m) => m.mid === b.mid)!);
		const gap = a.chance - b.chance;
		const mine = list.some((e) => e.tid === r.next.userTid && e.chance >= 0.2);
		if (gap <= 0.07) {
			stories.push({
				score: 10 - gap * 50 + (mine ? 2 : 0),
				draft: {
					kind: "race",
					rank: 3,
					headline: pick([`${c.label}: ${c.person ? pTok(a.pid!, a.name) : mTok(a.mid, a.movieTitle)} and ${c.person ? pTok(b.pid!, b.name) : mTok(b.mid, b.movieTitle)} locked in a dead heat`, `Too close to call: the ${c.label} race is a coin flip`, `${c.label} is anyone's game`]),
					body: [
						`Forecasters cannot separate ${fa} (${pctText(a.chance)}) and ${fb} (${pctText(b.chance)}) in the ${c.label} race. ${list[2] ? `${c.person ? pTok(list[2].pid!, list[2].name) : mTok(list[2].mid, list[2].movieTitle)} is still within reach.` : ""}`,
						pick(["Campaign teams are working the phones.", "Voters are said to be split down the middle.", "One late push could decide it."]),
					],
					tags: ["TOO CLOSE TO CALL"],
					mine,
				},
			});
		} else if (a.chance >= 0.55) {
			stories.push({
				score: 6 + a.chance * 4 + (mine ? 2 : 0),
				draft: {
					kind: "race",
					rank: 3,
					headline: pick([`${c.person ? pTok(a.pid!, a.name) : mTok(a.mid, a.movieTitle)} is the one to beat for ${c.label}`, `${c.label}: ${c.person ? pTok(a.pid!, a.name) : mTok(a.mid, a.movieTitle)} is the heavy favorite`]),
					body: [
						`${fa} enters the ceremony as the clear favorite for ${c.label}${c.person ? ` for ${mTok(a.mid, a.movieTitle)}` : ""}, with ${fb} the closest challenger. A win would be "the least surprising thing about the night," one columnist wrote.`,
						pick(["But in this business, nothing is certain.", "Upsets happen, though: the real vote is a fresh draw.", "Voters have been known to surprise."]),
					],
					tags: ["FRONTRUNNER"],
					mine,
				},
			});
		}
		// narratives about the nominees themselves
		if (c.person) {
			for (const e of list.slice(0, 3)) {
				const p = r.person(e.pid!);
				const st = r.voice.stat(p);
				const ns = r.voice.scope();
				const wins = p.role === "director" ? st.dirWins.length : st.leadWins.length + st.suppWins.length;
				if (wins === 0 && st.noms >= 3 && e.chance >= 0.12) {
					stories.push({
						score: 5 + st.noms,
						draft: {
							kind: "race",
							rank: 3,
							headline: pick([`Is this finally ${ns.tok(p)}'s year? ${st.noms + 1} nominations, still no win`, `${ns.tok(p)} gets another shot at ${c.label}`]),
							body: [`${ns.ref(p)} has been nominated ${num(st.noms)} times without a win and is up again for ${mTok(e.mid, e.movieTitle)}. The "overdue" narrative is loud this year.`],
							tags: ["OVERDUE?"],
							mine: e.tid === r.next.userTid,
						},
					});
				} else if (wins >= 1 && e.chance >= 0.25) {
					stories.push({
						score: 4 + wins * 2,
						draft: {
							kind: "race",
							rank: 3,
							headline: pick([`Can ${ns.tok(p)} make it ${nth(wins + 1)}?`, `${ns.tok(p)} goes for win No. ${wins + 1}`]),
							body: [`${ns.ref(p, { post: true })} is back in the ${c.label} race for ${mTok(e.mid, e.movieTitle)}. Past winners often face voter fatigue, but ${pctText(e.chance)} is a number nobody is ignoring.`],
							tags: ["REPEAT BID"],
							mine: e.tid === r.next.userTid,
						},
					});
				}
			}
		}
	}
	stories.sort((x, y) => y.score - x.score);
	for (const s of stories.slice(0, 4)) r.add(s.draft);
};

// ── the ceremony ─────────────────────────────────────────────

const SPEECH = {
	lead: [
		"“I'm shaking. I don't know what to do with my hands.”",
		"“I owe this to everyone who believed in the script when nobody else would.”",
		"“I forgot to write a speech. I never thought this would happen.”",
		"“To my castmates: you made me better every single day.”",
	],
	supp: [
		"“I only had a few scenes, and this crew made every one count.”",
		"“Supporting roles are where the real acting lives. Thank you.”",
		"“I'm going to need a minute.”",
	],
	director: [
		"“Movies are made by hundreds of people. I just get to stand here.”",
		"“I wanted to make something honest. Tonight, honest won.”",
		"“Thank you to the studio for letting me make the movie I wanted.”",
	],
};

export const winnersNews = (r: Room): void => {
	const season = r.next.season;
	const a: SeasonAwards | undefined = r.next.awards.find((x) => x.season === season);
	if (!a) return;
	const race = r.next.awardRace;
	const past = r.next.awards.filter((x) => x.season < season);
	const prevCeremony = past.find((x) => x.season === season - 1);
	const sc = r.voice.scope();
	const film = (mid: number): Movie => r.next.movies.find((m) => m.mid === mid)!;

	const wins: { key: RaceKey; label: string; person: boolean; w: AwardWinner }[] = [];
	for (const c of CATS) {
		const w = a[c.key];
		if (w) wins.push({ ...c, w });
	}
	const chanceOf = (key: RaceKey, w: AwardWinner): number => race?.[key].find((e) => (w.pid !== undefined ? e.pid === w.pid : e.mid === w.mid))?.chance ?? 0;
	const favorite = (key: RaceKey): RaceEntry | undefined => race?.[key][0];

	// career counts in each category, before tonight
	const priorWinsIn = (key: CatKey, pid: number) => past.filter((x) => x[key]?.pid === pid).length;
	const mostWinsIn = (key: CatKey) => {
		const count = new Map<number, number>();
		for (const x of past) if (x[key]?.pid !== undefined) count.set(x[key]!.pid!, (count.get(x[key]!.pid!) ?? 0) + 1);
		return Math.max(0, ...count.values());
	};

	type Note = { text: string; score: number };
	const noteFor = (c: (typeof wins)[number]): Note => {
		const { key, w } = c;
		const fav = favorite(key);
		const chance = chanceOf(key, w);
		const upset = fav && fav.mid !== w.mid && fav.chance >= 0.35 && chance < 0.15;
		if (!c.person) return upset ? { text: `Upset (was ${pctText(chance)})`, score: 7 } : { text: fav && fav.mid === w.mid ? "Favorite delivers" : "", score: 1 };
		const pk = key as CatKey;
		const n = priorWinsIn(pk, w.pid!) + 1;
		const record = mostWinsIn(pk);
		const back = prevCeremony?.[pk]?.pid === w.pid;
		const parts: string[] = [];
		let score = 1;
		if (n > record && n >= 2) { parts.push(`${nth(n)} win: new record`); score = 9; }
		else if (n === record && n >= 2) { parts.push(`${nth(n)} win: ties record`); score = 7; }
		else if (n >= 2) { parts.push(`${nth(n)} win`); score = 4; }
		if (back) { parts.push("back-to-back"); score += 3; }
		if (upset) { parts.push(`upset (was ${pctText(chance)})`); score += 5; }
		const st = r.voice.stat(r.person(w.pid!));
		if (n === 1 && st.noms >= 3) { parts.push(`finally, after ${num(st.noms)} nominations`); score += 4; }
		return { text: parts.join(", "), score };
	};

	// per-film tally
	const tally = new Map<number, number>();
	for (const c of wins) tally.set(c.w.mid, (tally.get(c.w.mid) ?? 0) + 1);
	const bp = a.bestPicture;
	const bpFilm = film(bp.mid);
	const bpDir = r.person(bpFilm.directorPid);
	const fav = favorite("bestPicture");
	const bpUpset = fav && fav.mid !== bp.mid && fav.chance >= 0.35 && chanceOf("bestPicture", bp) < 0.15;
	const dirDouble = a.bestDirector.mid === bp.mid;
	const mineWins = wins.filter((c) => c.w.tid === r.next.userTid);

	// the winners card
	const notes = new Map(wins.map((c) => [c.key, noteFor(c)]));
	r.add({
		kind: "awards",
		rank: 5,
		headline: pick([
			`${season} awards: ${sc.film(bpFilm)} wins Best Picture${bpUpset ? " in a stunning upset" : ""}`,
			`${sc.film(bpFilm)} takes the top prize at the ${season} awards${tally.get(bp.mid)! >= 3 ? `, with ${num(tally.get(bp.mid)!)} wins in all` : ""}`,
			`And the winner is… ${sc.film(bpFilm)}: ${season} awards roundup`,
		]),
		body: [
			`${poss(r.sn(bp.tid))} ${GENRE_NOUN[bpFilm.genre]}, directed by ${sc.ref(bpDir, { post: true })}, won Best Picture${dirDouble ? " and Best Director in the classic double" : ""}${bpUpset ? `, beating the favorite ${fav ? mTok(fav.mid, fav.movieTitle) : ""}` : ""}. It earned ${fmtMoney(bpFilm.boxOffice ?? 0)} and ${aNum(bpFilm.criticScore)} with critics.`,
			mineWins.length
				? `Your studio went home with ${plural(mineWins.length, "trophy", "trophies")}: ${andList(mineWins.map((c) => c.label))}.`
				: `Your studio went home empty-handed.`,
		],
		tags: ["THE WINNERS"],
		mine: mineWins.length > 0,
		tone: mineWins.length ? "good" : "neutral",
		card: {
			kind: "winners",
			title: `${season} winners`,
			rows: wins.map((c) => ({
				label: c.label,
				text: c.person ? `${pTok(c.w.pid!, c.w.name)} (${mTok(c.w.mid, c.w.movieTitle)})` : mTok(c.w.mid, c.w.movieTitle),
				note: notes.get(c.key)?.text || undefined,
				won: true,
				mine: c.w.tid === r.next.userTid,
			})),
		},
	});

	// individual highlights, most remarkable first
	const ranked = wins.filter((c) => c.person).map((c) => ({ c, n: notes.get(c.key)! })).sort((x, y) => y.n.score - x.n.score);
	for (const { c, n } of ranked.filter((x) => x.n.score >= 4).slice(0, 4)) {
		const p = r.person(c.w.pid!);
		const s = r.voice.scope();
		const pk = c.key as CatKey;
		const total = priorWinsIn(pk, p.pid) + 1;
		const fv = favorite(c.key);
		const st = r.voice.stat(p);
		const upset = fv && fv.pid !== p.pid && fv.chance >= 0.35 && chanceOf(c.key, c.w) < 0.15;
		const back = prevCeremony?.[pk]?.pid === p.pid;
		const finally_ = total === 1 && st.noms >= 3;
		const headline = total > mostWinsIn(pk) && total >= 2
			? `${s.ref(p, { short: true })} makes history: ${nth(total)} ${c.label} win`
			: back
				? `Back-to-back: ${s.ref(p, { short: true })} wins ${c.label} again`
				: finally_
					? `Finally! ${s.tok(p)} wins ${c.label} after ${num(st.noms)} nominations`
					: upset
						? `Shock in ${c.label}: ${s.tok(p)} beats the favorite ${fv?.pid !== undefined ? pTok(fv.pid, fv.name) : ""}`
						: `${s.ref(p, { short: true })} wins ${c.label} for the ${nth(total)} time`;
		const bodyParts = [`${s.ref(p, { post: true })} took ${c.label} for ${mTok(c.w.mid, c.w.movieTitle)}${r.sn(c.w.tid) ? `, a ${r.sn(c.w.tid)} production` : ""}.`];
		if (upset) bodyParts.push(`The favorite ${fv?.pid !== undefined ? pTok(fv.pid, fv.name) : "of the field"} had a ${pctText(fv?.chance ?? 0)} chance; the winner was given ${pctText(chanceOf(c.key, c.w))}.`);
		if (finally_) bodyParts.push(`After ${num(st.noms)} nominations without a trophy, the room rose to its feet.`);
		if (back) bodyParts.push(`It is the second year in a row that ${s.last(p)} has taken the award.`);
		const reigning = prevCeremony?.[pk];
		if (reigning && reigning.pid !== p.pid && race?.[c.key].some((e) => e.pid === reigning.pid)) bodyParts.push(`The reigning champion, ${pTok(reigning.pid!, reigning.name)}, was nominated again and went home without the trophy.`);
		r.add({ kind: "awards", rank: n.score >= 7 ? 5 : 4, headline, body: bodyParts, tags: [n.score >= 9 ? "RECORD" : upset ? "UPSET" : "MILESTONE"], mine: c.w.tid === r.next.userTid, tone: c.w.tid === r.next.userTid ? "good" : undefined });
	}

	// the film that swept the night, and the one that was shut out
	const sweep = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
	if (sweep && sweep[1] >= 3) {
		const m = film(sweep[0]);
		const cats = wins.filter((c) => c.w.mid === m.mid).map((c) => c.label);
		r.add({
			kind: "awards",
			rank: 4,
			headline: pick([`Clean sweep: ${sc.film(m)} wins ${num(sweep[1])} awards`, `${sc.film(m)} owns the night with ${num(sweep[1])} trophies`]),
			body: [`${poss(r.sn(m.tid))} ${GENRE_NOUN[m.genre]} won ${andList(cats)}. ${r.sn(m.tid)} is now the studio to beat in the awards conversation.`],
			tags: ["SWEEP"],
			mine: r.isMine(m),
			tone: r.isMine(m) ? "good" : undefined,
		});
	}
	const nomCount = new Map<number, number>();
	for (const c of CATS) for (const e of race?.[c.key] ?? []) nomCount.set(e.mid, (nomCount.get(e.mid) ?? 0) + 1);
	const shut = [...nomCount.entries()].filter(([mid, n]) => n >= 3 && !tally.has(mid)).sort((x, y) => y[1] - x[1])[0];
	if (shut) {
		const m = film(shut[0]);
		r.add({
			kind: "awards",
			rank: 3,
			headline: pick([`Shut out: ${sc.film(m)} goes ${num(0)} for ${num(shut[1])}`, `Heartbreak for ${sc.film(m)}: ${num(shut[1])} nominations, no wins`]),
			body: [`${r.sn(m.tid)} arrived with ${plural(shut[1], "nomination")} for ${sc.film(m)} and left with nothing. "That's awards season," a studio source shrugged.`],
			tags: ["SHUT OUT"],
			mine: r.isMine(m),
			tone: r.isMine(m) ? "bad" : undefined,
		});
	}

	// the studio of the night
	const byStudio = new Map<number, number>();
	for (const c of wins) byStudio.set(c.w.tid, (byStudio.get(c.w.tid) ?? 0) + 1);
	const topStudio = [...byStudio.entries()].sort((x, y) => y[1] - x[1])[0];
	if (topStudio && topStudio[1] >= 3 && topStudio[0] !== sweep?.[0]) {
		r.add({
			kind: "studio",
			rank: 3,
			headline: `${r.sn(topStudio[0])} is the studio of the night with ${num(topStudio[1])} awards`,
			body: [`From ${andList(wins.filter((c) => c.w.tid === topStudio[0]).map((c) => c.label))}, ${r.sn(topStudio[0])} dominated the evening. The reputation boost will be felt across the industry.`],
			tags: ["STUDIO OF THE NIGHT"],
			mine: topStudio[0] === r.next.userTid,
		});
	}

	// moments: acceptance speeches
	const people = wins.filter((c) => c.person);
	const picked = sample(people, 3);
	if (picked.length) {
		const lines = picked.map((c) => {
			const p = r.person(c.w.pid!);
			const pool = c.key === "bestDirector" ? SPEECH.director : c.key.includes("Supporting") ? SPEECH.supp : SPEECH.lead;
			return `${pTok(p.pid, p.name)} (${c.label}): ${pick(pool)}`;
		});
		r.add({
			kind: "awards",
			rank: 2,
			headline: pick([`The moments everyone is talking about from the ${season} ceremony`, `Speeches, tears and one forgotten script: the night in quotes`]),
			body: lines,
			tags: ["THE NIGHT"],
		});
	}
};
