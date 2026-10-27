import { useEffect } from "react";
import { FREE_AGENT, RETIRED } from "../game/constants";
import { installmentOf } from "../game/franchise";
import { GENRE_LABEL, SPECIALTY_LABEL, fmtMoney } from "../game/format";
import { careerOf, filmography, personNominations, personWins } from "../game/legacy";
import { ovr } from "../game/ovr";
import { TRAITS, knownTraitsOf } from "../game/traits";
import { average } from "../game/random";
import type { GameState, Person } from "../game/types";
import { CareerGraph } from "./CareerGraph";
import { MovieName } from "./MovieName";
import { PersonName } from "./PersonName";
import { bondsOf, heatWord, otherOf } from "../game/rivalries";
import { TraitChip } from "./TraitChips";
import { useHideRatings } from "./ratingsContext";

/** Pop-up with one person's career: every film, critic scores, box office and awards. */
export const Profile = ({ state, pid, onClose }: { state: GameState; pid: number; onClose: () => void }) => {
	const hide = useHideRatings();
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const person: Person | undefined = state.people.find((p) => p.pid === pid);
	if (!person) return null;

	const credits = filmography(state, person);
	const out = credits.filter((c) => c.movie.boxOffice !== undefined && c.movie.criticScore !== undefined);
	const wins = personWins(state, person);
	const noms = personNominations(state, person);
	const hasNomData = state.awards.some((a) => a.nominees);
	const gross = out.reduce((sum, c) => sum + (c.movie.boxOffice ?? 0), 0);
	const avgCritics = out.length === 0 ? null : Math.round(average(out.map((c) => c.movie.criticScore ?? 0)));
	const best = [...out].sort((a, b) => (b.movie.criticScore ?? 0) - (a.movie.criticScore ?? 0))[0];
	const studio = state.studios.find((s) => s.tid === person.tid);
	const status = person.tid === RETIRED ? "Retired" : person.tid === FREE_AGENT ? "Free agent" : (studio?.name ?? "");

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<section className="panel modal" role="dialog" aria-modal="true" aria-label={person.name} onClick={(e) => e.stopPropagation()}>
				<div className="modal-head">
					<div>
						<h2>
							{person.name} {wins.length > 0 && <span className="gold">🏆{wins.length}</span>}
						</h2>
						<div className="modal-sub">
							<span>{person.role === "director" ? "Director" : person.gender === "female" ? "Actress" : "Actor"}</span>
							<span className="sep">·</span>
							<span>Age {person.age}</span>
							{status && (
								<>
									<span className="sep">·</span>
									<span>{status}</span>
								</>
							)}
							{!hide && (
								<>
									<span className="sep">·</span>
									<span>
										Overall <b>{Math.round(ovr(person.attrs, person.role))}</b>
									</span>
								</>
							)}
							{person.specialties.length > 0 && (
								<>
									<span className="sep">·</span>
									<span>{person.specialties.map((s) => SPECIALTY_LABEL[s]).join(", ")}</span>
								</>
							)}
						</div>
					</div>
					<button className="imdb-close" onClick={onClose}>
						<span aria-hidden>✕</span> Close
					</button>
				</div>

				<dl className="kv">
					<dt>Films released</dt>
					<dd>{out.length}</dd>
					<dt>Total box office</dt>
					<dd>{fmtMoney(gross)}</dd>
					<dt>Average critics&rsquo; score</dt>
					<dd>{avgCritics ?? "–"}</dd>
					<dt>Best-reviewed film</dt>
					<dd>{best ? <><MovieName mid={best.movie.mid}>{best.movie.title}</MovieName> ({best.movie.criticScore})</> : "–"}</dd>
					<dt>Awards won</dt>
					<dd>{wins.length}</dd>
					<dt>Nominations</dt>
					<dd>{hasNomData ? noms.length : "–"}</dd>
				</dl>

				<h3>Personality</h3>
				{knownTraitsOf(person).length === 0 ? (
					<p className="muted" style={{ margin: 0 }}>No known traits.</p>
				) : (
					<ul className="plain trait-list">
						{knownTraitsOf(person).map((id) => (
							<li key={id}>
								<TraitChip id={id} /> <span className="muted">{TRAITS[id].blurb}</span>
							</li>
						))}
					</ul>
				)}
				<p className="muted fine" style={{ margin: "6px 0 0" }}>Only the traits you have discovered are listed. The news, and working with someone on a film, can reveal more.{person.real && " Traits are invented for the game and say nothing about the real person."}</p>

				{bondsOf(state.bonds, person.pid).length > 0 && (
					<>
						<h3>Feuds and friendships</h3>
						<ul className="plain trait-list">
							{bondsOf(state.bonds, person.pid).map((k) => {
								const other = state.people.find((x) => x.pid === otherOf(k, person.pid));
								return (
									<li key={`${k.a}-${k.b}`}>
										<span className={`trait ${k.kind === "feud" ? "bad" : "good"}`}>{k.kind === "feud" ? "Feud" : "Frenemies"}</span>{" "}
										{other ? <PersonName person={other} awards={state.awards} /> : "?"}{" "}
										<span className="muted">&middot; {hide ? (k.kind === "feud" ? "a feud" : "frenemies") : heatWord(k.kind, k.heat)}, since {k.since}</span>
									</li>
								);
							})}
						</ul>
						<p className="muted fine" style={{ margin: "6px 0 0" }}>Casting them together costs a feud production quality and chemistry; frenemies push each other.{person.real && " Rivalries are invented for the game and say nothing about the real people."}</p>
					</>
				)}

				<h3>Career graphs</h3>
				<CareerGraph career={careerOf(state, person)} />

				<h3>Awards and nominations</h3>
				{wins.length === 0 && noms.length === 0 ? (
					<p className="muted" style={{ margin: 0 }}>No awards or nominations yet.</p>
				) : (
					<ul className="plain aw-list">
						{(hasNomData ? noms : wins.map((w) => ({ ...w, won: true }))).map((n) => (
							<li key={`${n.season}-${n.award}`} className="aw-row">
								<b className="num aw-year">{n.season}</b>
								<span>{n.award}</span>
								{n.won ? <b className="aw-won">Won</b> : <b className="aw-nom">Nominated</b>}
								<span>for</span>
								<MovieName mid={n.mid}>{n.movieTitle}</MovieName>
							</li>
						))}
					</ul>
				)}
				{!hasNomData && state.awards.length > 0 && (
					<p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>Nominations are recorded from the first ceremony in this version on; older seasons only list wins.</p>
				)}

				<h3>Filmography</h3>
				{credits.length === 0 ? (
					<p className="muted" style={{ margin: 0 }}>No films yet.</p>
				) : (
					<div className="scroll">
						<table className="data">
							<thead>
								<tr>
									<th>Year</th>
									<th>Film</th>
									<th>Role</th>
									<th className="r">Critics</th>
									<th className="r">Box office</th>
									<th>Awards</th>
								</tr>
							</thead>
							<tbody>
								{[...credits].reverse().map(({ movie, credit, wins: w, bestPicture, nominations, pictureNominee }) => (
									<tr key={movie.mid} className={movie.tid === state.userTid ? "mine" : ""}>
										<td className="num">{movie.season}</td>
										<td>
											<MovieName mid={movie.mid}>{movie.title}</MovieName>
											{installmentOf(movie) > 1 && <span className="tag">Part {installmentOf(movie)}</span>}{" "}
											<span className="muted">{GENRE_LABEL[movie.genre]}</span>
										</td>
										<td>{credit}</td>
										<td className="r num">{movie.criticScore ?? <span className="muted">&ndash;</span>}</td>
										<td className="r num">{movie.boxOffice !== undefined ? fmtMoney(movie.boxOffice) : <span className="muted">in production</span>}</td>
										<td className="gold">
											{w.join(", ")}
											{bestPicture && <span className="muted"> {w.length > 0 ? "· " : ""}film won Best Picture</span>}
											{nominations.length > 0 && (
												<span className="muted">
													{w.length > 0 || bestPicture ? " · " : ""}nominated: {nominations.map((n) => n.replace("Best ", "")).join(", ")}
												</span>
											)}
											{pictureNominee && <span className="muted"> {w.length + nominations.length > 0 ? "· " : ""}film nominated for Best Picture</span>}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
};
