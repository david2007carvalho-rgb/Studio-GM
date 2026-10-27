import { useMemo, useState } from "react";
import { CAST_SIZE, PITCH_PREMIUMS } from "../game/constants";
import { ATTRIBUTE_LABEL, ATTRIBUTE_SHORT, GENRE_LABEL, SPECIALTY_LABEL, fmtMoney } from "../game/format";
import { genreOvr, ovr, specialtyBonus } from "../game/ovr";
import type { GreenlightPlan } from "../game/phase";
import { ATTRIBUTE_KEYS } from "../game/types";
import type { Bond, Negotiation, Person, Pitch, ProductionRole, SeasonAwards } from "../game/types";
import { NEG_ROUNDS, termsText } from "../game/negotiate";
import { setNegotiationsOn } from "../game/features";
import { bondBetween, heatWord } from "../game/rivalries";
import { noRecord, trackRecords } from "../game/trackRecord";
import type { Movie } from "../game/types";
import { PersonName } from "./PersonName";
import { TraitChips } from "./TraitChips";
import { useHideRatings } from "./ratingsContext";

type SortKey = "fit" | "ovr" | "price" | "age" | "name" | "match" | "critics" | "genre" | "gross" | "awards" | "films";

type Props = {
	people: Person[]; // only people who have not retired
	bonds?: Bond[]; // lasting feuds and friendships: a person who feuds with someone you already picked is flagged (see rivalries.ts)
	draft: GreenlightPlan;
	selectable: boolean; // true only in the Development phase
	refusal: (p: Person) => string | null; // why this person would refuse you (null = fine)
	locked?: (p: Person) => string | null; // why a challenge rule keeps this person off your films (null = fine). Unlike a refusal, no pitch can change it
	needed: (p: Person) => number; // reputation this person needs from you
	showNeeded: boolean; // only shown on difficulties where people can refuse
	reputation: number;
	awards: SeasonAwards[]; // past winners, shown as a trophy next to names
	movies: Movie[]; // every film made so far: the track record of each person (used when ratings are hidden)
	onPick: (p: Person) => void;
	onPitch: (p: Person, premium: number) => void; // offer a refusing actor extra salary
	pitch: (p: Person) => Pitch | undefined; // the pitch you already made to this person this season
	pitchChance: (p: Person, premium: number) => number | null; // null = cannot be pitched
	salary: (p: Person) => number; // what they cost you now (pitch premium included)
	notice?: string; // a line above the list, e.g. when only a director's wish list is shown
	negotiating?: boolean; // advanced negotiations are on: Hire and Pitch become Negotiate (see negotiate.ts)
	onNegotiate?: (p: Person) => void;
	negotiation?: (p: Person) => Negotiation | undefined; // talks with this person this season
	negotiateBlocker?: (p: Person) => string | null; // why you cannot negotiate (null = you can)
	describeDeal?: (p: Person) => string; // the signed terms in one line
};

export const Talent = ({ people, bonds, draft, selectable, refusal, locked, needed, showNeeded, reputation, awards, movies, onPick, onPitch, pitch, pitchChance, salary, notice, negotiating = false, onNegotiate, negotiation, negotiateBlocker, describeDeal }: Props) => {
	const [offers, setOffers] = useState<Record<number, number>>({}); // premium chosen per actor in the pitch box
	const offerOf = (pid: number) => offers[pid] ?? 0.5;
	const [role, setRole] = useState<ProductionRole>("director");
	const hide = useHideRatings(); // "Hide ratings": no Ovr / Fit / attributes, judge people by what they have done
	const [sortKey, setSortKey] = useState<SortKey>(hide ? "match" : "fit");
	const [reversed, setReversed] = useState(false); // false = the column's natural order (best first; youngest / A-Z for Age and Name), true = the opposite
	const [query, setQuery] = useState("");
	const [onlyAvailable, setOnlyAvailable] = useState(false);
	const [showRatings, setShowRatings] = useState(false);
	const [limit, setLimit] = useState(40);

	// Heavy work (ratings, refusals, sorting) only reruns when the list, genre, role, sort or reputation changes,
	// not on every click.
	const records = useMemo(() => trackRecords({ movies, awards }, draft.genre), [movies, awards, draft.genre]);
	const rows = useMemo(
		() =>
			people
				.filter((p) => p.role === role)
				.map((p) => ({
					p,
					ovr: ovr(p.attrs, p.role),
					fit: Math.min(100, genreOvr(p.attrs, p.role, draft.genre) + specialtyBonus(p.specialties, draft.genre)),
					need: needed(p),
					rec: records.get(p.pid) ?? noRecord(),
					match: specialtyBonus(p.specialties, draft.genre) > 0 ? 1 : 0, // has a specialty that suits the genre
				}))
				.sort((a, b) => (reversed ? -1 : 1) * ((a, b) => {
					const n = (x: number | null) => x ?? -1; // people without a record go last in the natural order
					switch (sortKey) {
						case "age": return a.p.age - b.p.age;
						case "name": return a.p.name.localeCompare(b.p.name);
						case "price": return salary(b.p) - salary(a.p);
						case "match": return b.match - a.match || n(b.rec.genreCritics) - n(a.rec.genreCritics) || a.p.name.localeCompare(b.p.name);
						case "critics": return n(b.rec.critics) - n(a.rec.critics) || b.rec.films - a.rec.films;
						case "genre": return n(b.rec.genreCritics) - n(a.rec.genreCritics) || b.rec.genreFilms - a.rec.genreFilms;
						case "gross": return b.rec.gross - a.rec.gross;
						case "awards": return b.rec.wins - a.rec.wins || b.rec.noms - a.rec.noms;
						case "films": return b.rec.films - a.rec.films;
						default: return b[sortKey] - a[sortKey];
					}
				})(a, b)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[people, role, sortKey, reversed, draft.genre, reputation, records],
	);

	const q = query.trim().toLowerCase();
	const filtered = rows.filter(({ p }) => (!q || p.name.toLowerCase().includes(q)) && (!onlyAvailable || isPickedPid(p.pid) || (refusal(p) === null && !locked?.(p))));
	const shown = filtered.slice(0, limit);
	function isPickedPid(pid: number) {
		return draft.directorPid === pid || draft.castPids.includes(pid);
	}
	const isPicked = (p: Person) => draft.directorPid === p.pid || draft.castPids.includes(p.pid);
	const castFull = draft.castPids.length >= CAST_SIZE;
	// Bonds between a candidate and the people already on your team
	const pickedPids = [...(draft.directorPid === null ? [] : [draft.directorPid]), ...draft.castPids];
	const ties = (p: Person) =>
		pickedPids
			.filter((pid) => pid !== p.pid)
			.map((pid) => ({ pid, bond: bondBetween(bonds, p.pid, pid) }))
			.filter((x): x is { pid: number; bond: Bond } => !!x.bond);
	const nameOfPid = (pid: number) => people.find((x) => x.pid === pid)?.name ?? "someone on your team";

	// Click a column to sort by it; click the same column again to flip between ascending and descending.
	const header = (key: SortKey, label: string, title: string) => {
		const naturalAsc = key === "age" || key === "name";
		const ascending = naturalAsc !== reversed;
		return (
			<th
				className={`${key === "name" ? "" : "r"} sortable ${sortKey === key ? "sorted" : ""}`}
				title={`${title}. Click again to reverse the order.`}
				aria-sort={sortKey === key ? (ascending ? "ascending" : "descending") : "none"}
				onClick={() => {
					if (sortKey === key) setReversed((r) => !r);
					else {
						setSortKey(key);
						setReversed(false);
					}
				}}
			>
				{label}
				{sortKey === key ? (ascending ? " ▴" : " ▾") : ""}
			</th>
		);
	};

	return (
		<section className="panel talent-panel">
			<h2>Talent for hire</h2>
			<div className="tabs" role="tablist">
				{(["director", "actor"] as const).map((r) => (
					<button key={r} role="tab" aria-selected={role === r} className="tab" onClick={() => setRole(r)}>
						{r === "director" ? "Directors" : "Actors"}
					</button>
				))}
			</div>
			<div className="talent-tools">
				<input type="search" placeholder="Search by name…" aria-label="Search talent" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(40); }} />
				{showNeeded && (
					<label className="check" title="Hide people who would refuse you at your current reputation">
						<input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> Available only
					</label>
				)}
				<label className="check" title="Replace Hire and Pitch with a negotiation: salary, backend and promises">
					<input type="checkbox" checked={negotiating} onChange={(e) => setNegotiationsOn(e.target.checked)} /> Negotiations
				</label>
				{!hide && (
					<label className="check" title="Show the individual attribute ratings">
						<input type="checkbox" checked={showRatings} onChange={(e) => setShowRatings(e.target.checked)} /> Ratings
					</label>
				)}
			</div>
			{notice && <p className="ok fine" style={{ margin: "0 0 8px" }}>{notice}</p>}
			<p className="muted fine" style={{ margin: "0 0 8px" }}>
				{selectable
					? hide
						? `Ratings are hidden in this game: judge people by what they have done. "Suits ${GENRE_LABEL[draft.genre]}" marks a specialty that fits the genre. Click a column to sort, click it again to reverse.`
						: `Fit = suitability for ${GENRE_LABEL[draft.genre]}. Click a column to sort, click it again to reverse.`
					: "You can hire people again in the next Development phase."}
				{showNeeded && <> Reputation {reputation}: people needing more will refuse you.</>}
			</p>
			<div className="scroll talent-scroll">
				<table className="data">
					<thead>
						<tr>
							{hide ? header("match", "Name", `Sort by specialties that suit ${GENRE_LABEL[draft.genre]}, then by their record in that genre`) : header("name", "Name", "Sort alphabetically")}
							{header("age", "Age", "Sort by age")}
							{hide ? (
								<>
									{header("films", "Films", "Films released so far")}
									{header("critics", "Critics", "Average critics' score of their films")}
									{header("gross", "Box office", "Total box office of their films")}
									{header("genre", GENRE_LABEL[draft.genre], `Average critics' score in ${GENRE_LABEL[draft.genre]} films (and how many)`)}
									{header("awards", "Awards", "Awards won (and nominations)")}
								</>
							) : (
								<>
									{header("ovr", "Ovr", "Overall rating")}
									{header("fit", "Fit", "Rating for the chosen genre, including specialty bonus")}
								</>
							)}
							{header("price", "Price", "Salary for one film")}
							{showNeeded && (
								<th className="r" title="Studio reputation this person needs from you before they accept">
									Needs rep
								</th>
							)}
							{!hide && showRatings && ATTRIBUTE_KEYS.map((k) => (
								<th key={k} className="r" title={ATTRIBUTE_LABEL[k]}>
									{ATTRIBUTE_SHORT[k]}
								</th>
							))}
							{selectable && <th />}
						</tr>
					</thead>
					<tbody>
						{shown.map(({ p, ovr: o, fit, need, rec, match }) => {
							// Looked up on every render (cheap): a pitch can change these without any other input changing.
							const barred = locked?.(p) ?? null;
							const refused = barred ? null : refusal(p);
							const pitched = pitch(p);
							const deal = negotiation?.(p);
							const talks = negotiating ? (negotiateBlocker?.(p) ?? null) : null;
							return (
							<tr key={p.pid} className={isPicked(p) ? "picked" : ""}>
								<td className="namecell">
									<PersonName person={p} awards={awards} /> <span className="muted fine">{p.gender === "female" ? "F" : "M"}</span>
									{hide && match > 0 && <span className="tag" title={`Has a specialty that suits ${GENRE_LABEL[draft.genre]}`}>suits {GENRE_LABEL[draft.genre]}</span>}
									<div className="muted fine spec">{p.specialties.map((s) => SPECIALTY_LABEL[s]).join(", ") || "no specialties"}</div>
									<TraitChips person={p} />
									{!isPicked(p) && ties(p).length > 0 && (
										<div className="trait-row">
											{ties(p).map(({ pid, bond }) => (
												<span key={pid} className={`trait ${bond.kind === "feud" ? "bad" : "good"}`} title={`${p.name} and ${nameOfPid(pid)}: ${heatWord(bond.kind, bond.heat)} since ${bond.since}`}>
													{bond.kind === "feud" ? "⚠ feuds with" : "✦ frenemies with"} {nameOfPid(pid)}
												</span>
											))}
										</div>
									)}
								</td>
								<td className="r num">{p.age}</td>
								{hide ? (
									<>
										<td className="r num">{rec.films || <span className="muted">&ndash;</span>}</td>
										<td className="r num">{rec.critics ?? <span className="muted">&ndash;</span>}</td>
										<td className="r num">{rec.films ? fmtMoney(rec.gross) : <span className="muted">&ndash;</span>}</td>
										<td className="r num">{rec.genreCritics !== null ? `${rec.genreCritics} (${rec.genreFilms})` : <span className="muted">&ndash;</span>}</td>
										<td className="r num">
											{rec.wins > 0 && <span className="gold">🏆{rec.wins} </span>}
											{rec.noms > 0 ? <span className="muted">{rec.noms} nom.</span> : <span className="muted">&ndash;</span>}
										</td>
									</>
								) : (
									<>
										<td className="r num">
											<b>{o}</b>
										</td>
										<td className="r num">{fit}</td>
									</>
								)}
								<td className="r num">
									{negotiating && deal?.status === "signed" && deal.terms ? (
										<span title={describeDeal?.(p)}>
											<b>{fmtMoney(salary(p))}</b>
											{deal.terms.backend > 0 && <span className="muted fine"> +{deal.terms.backend}%</span>}
										</span>
									) : pitched?.accepted ? (
										<span title={`Normal price ${fmtMoney(p.contract.amount)}, +${Math.round(pitched.premium * 100)}% after your pitch`}>
											<b>{fmtMoney(salary(p))}</b>
										</span>
									) : (
										fmtMoney(p.contract.amount)
									)}
								</td>
								{showNeeded && (
									<td className={`r num ${refused ? "loss" : ""}`}>{need === 0 ? <span className="muted">&ndash;</span> : need}</td>
								)}
								{!hide && showRatings && ATTRIBUTE_KEYS.map((k) => (
									<td key={k} className="r num">
										{p.attrs[k]}
									</td>
								))}
								{selectable && (
									<td className="act">
										{negotiating && !isPicked(p) && deal?.status !== "signed" ? (
											<button className="btn quiet" disabled={barred !== null || talks !== null} title={barred ?? talks ?? (deal ? `${deal.rounds} of ${NEG_ROUNDS} offers used` : undefined)} onClick={() => onNegotiate?.(p)}>
												{barred ? "Locked" : talks ? "Talks over" : "Negotiate"}
											</button>
										) : (
										<button
											className="btn quiet"
											disabled={!isPicked(p) && (barred !== null || refused !== null || (role === "actor" && castFull))}
											title={barred ?? refused ?? undefined}
											onClick={() => onPick(p)}
										>
											{isPicked(p) ? "Remove" : barred ? "Locked" : refused ? "Refuses" : deal?.status === "signed" ? "Hire (signed)" : pitched?.accepted ? "Hire (pitched)" : "Hire"}
										</button>
										)}
										{!negotiating && refused !== null && role === "actor" && !isPicked(p) && (
											<div className="pitch">
												{pitched ? (
													<span className="muted">Pitch turned down</span>
												) : pitchChance(p, offerOf(p.pid)) === null ? (
													<span className="muted" title="Too far above your reputation to even take the meeting">No meeting</span>
												) : (
													<>
														<select
															value={offerOf(p.pid)}
															onChange={(e) => setOffers((o) => ({ ...o, [p.pid]: Number(e.target.value) }))}
															title="Extra salary you offer on top of their normal price"
														>
															{PITCH_PREMIUMS.map((x) => (
																<option key={x} value={x}>
																	+{Math.round(x * 100)}% ({fmtMoney(Math.round(p.contract.amount * (1 + x)))}) · {Math.round((pitchChance(p, x) ?? 0) * 100)}%
																</option>
															))}
														</select>
														<button className="btn quiet" onClick={() => onPitch(p, offerOf(p.pid))}>
															Pitch
														</button>
													</>
												)}
											</div>
										)}
									</td>
								)}
							</tr>
							);
						})}
					</tbody>
				</table>
				{filtered.length === 0 && <p className="muted">Nobody matches.</p>}
				{filtered.length > shown.length && (
					<p className="more">
						Showing {shown.length} of {filtered.length}.{" "}
						<button className="btn quiet" onClick={() => setLimit((n) => n + 60)}>
							Show more
						</button>
					</p>
				)}
			</div>
		</section>
	);
};
