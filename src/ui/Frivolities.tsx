import type { ReactNode } from "react";
import { RETIRED } from "../game/constants";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import {
	GOAT_ACTOR,
	GOAT_DIRECTOR,
	GOAT_FILM,
	IP_FAME,
	actingPairs,
	actorLegacies,
	directorDuos,
	directorLegacies,
	filmLegacies,
	ipLegacies,
	top,
} from "../game/legacy";
import { installmentOf } from "../game/franchise";
import type { ActorLegacy, DirectorLegacy, FilmLegacy, Pairing } from "../game/legacy";
import type { GameState, Person } from "../game/types";
import { MovieName } from "./MovieName";
import { PersonName } from "./PersonName";

const TOP = 5;

const studioName = (state: GameState, tid: number) => state.studios.find((s) => s.tid === tid)?.name ?? "?";

const Empty = ({ children }: { children: ReactNode }) => <p className="muted" style={{ margin: 0 }}>{children}</p>;

/** Rank shown as "1." like a leaderboard. */
const Medal = ({ rank }: { rank: number }) => <td className="rank num">{rank}.</td>;

// ── stacked bar showing where a GOAT score comes from ──
type Piece = { label: string; value: number; color: string };

const C = { awards: "#c2a52f", money: "#1f9a78", rating: "#1c86bd", purple: "#7d52b8", critics: "#c4574b", grey: "#7b8794" };

const Breakdown = ({ pieces }: { pieces: Piece[] }) => {
	const total = pieces.reduce((s, p) => s + p.value, 0) || 1;
	return (
		<>
			<div className="goat-bar" role="img" aria-label={pieces.map((p) => `${p.label} ${Math.round(p.value)}`).join(", ")}>
				{pieces.map((p) => (
					<span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value.toFixed(1)}`} />
				))}
			</div>
			<div className="goat-legend">
				{pieces.map((p) => (
					<span key={p.label}>
						<i style={{ background: p.color }} />
						{p.label} <b className="num">{Math.round(p.value)}</b>
					</span>
				))}
			</div>
		</>
	);
};

const actorPieces = (a: ActorLegacy): Piece[] => [
	{ label: "Awards", value: a.parts.awards, color: C.awards },
	{ label: "Box office", value: a.parts.money, color: C.money },
	{ label: "Rating", value: a.parts.rating, color: C.rating },
	{ label: "Star power", value: a.parts.starPower, color: C.purple },
	{ label: "Critics", value: a.parts.critics, color: C.critics },
];

const directorPieces = (d: DirectorLegacy): Piece[] => [
	{ label: "Awards", value: d.parts.awards, color: C.awards },
	{ label: "Box office", value: d.parts.money, color: C.money },
	{ label: "Rating", value: d.parts.rating, color: C.rating },
	{ label: "Craft", value: d.parts.craft, color: C.purple },
	{ label: "Critics", value: d.parts.critics, color: C.critics },
];

const filmPieces = (f: FilmLegacy): Piece[] => [
	{ label: "Critics", value: f.parts.critics, color: C.critics },
	{ label: "Box office", value: f.parts.money, color: C.money },
	{ label: "Awards", value: f.parts.awards, color: C.awards },
	{ label: "Profit", value: f.parts.profit, color: C.purple },
	{ label: "Legacy", value: f.parts.legacy, color: C.grey },
];

const Status = ({ person }: { person: Person }) => (
	<span className="muted">{person.tid === RETIRED ? "retired" : `age ${person.age}`}</span>
);

// ── panels ──

const GoatActors = ({ state }: { state: GameState }) => {
	const list = top(actorLegacies(state), TOP, (a) => a.goat);
	return (
		<section className="panel goat">
			<h2>👑 GOAT actor</h2>
			{list.length === 0 ? (
				<Empty>No actor has a career yet. Release some films first.</Empty>
			) : (
				<>
					<div className="goat-hero">
						<div className="goat-name">
							<PersonName person={list[0].person} awards={state.awards} /> <Status person={list[0].person} />
						</div>
						<div className="goat-score num">{Math.round(list[0].goat)}</div>
					</div>
					<div className="muted">
						{list[0].films} films, {fmtMoney(list[0].gross)} box office, {list[0].awardCount} acting award
						{list[0].awardCount === 1 ? "" : "s"}, peak overall {Math.round(list[0].overall)}
					</div>
					<Breakdown pieces={actorPieces(list[0])} />
					{list.length > 1 && (
						<table className="data goat-table">
							<tbody>
								{list.slice(1).map((a, i) => (
									<tr key={a.person.pid}>
										<Medal rank={i + 2} />
										<td className="wrap">
											<PersonName person={a.person} awards={state.awards} /> <Status person={a.person} />
										</td>
										<td className="r num">
											<b>{Math.round(a.goat)}</b>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
					<p className="muted fine">
						Score = {GOAT_ACTOR.leadWin} per lead award + {GOAT_ACTOR.supportingWin} per supporting award + {GOAT_ACTOR.pictureFilm} per Best
						Picture film + 1 per {fmtMoney(GOAT_ACTOR.grossPer)} of box office + rating (overall above 50) + star power (charisma and audience
						connection above 50, their public reputation) + average critics above 60. Rating and star power use their peak, not their current ratings, and retired actors still count.
					</p>
				</>
			)}
		</section>
	);
};

const GoatDirectors = ({ state }: { state: GameState }) => {
	const list = top(directorLegacies(state), TOP, (d) => d.goat);
	return (
		<section className="panel goat">
			<h2>👑 GOAT director</h2>
			{list.length === 0 ? (
				<Empty>No director has a career yet. Release some films first.</Empty>
			) : (
				<>
					<div className="goat-hero">
						<div className="goat-name">
							<PersonName person={list[0].person} awards={state.awards} /> <Status person={list[0].person} />
						</div>
						<div className="goat-score num">{Math.round(list[0].goat)}</div>
					</div>
					<div className="muted">
						{list[0].films} films, {fmtMoney(list[0].gross)} box office, {list[0].awardCount} Best Director award
						{list[0].awardCount === 1 ? "" : "s"}, {list[0].pictureFilms} Best Picture, avg critics {Math.round(list[0].avgCritics)}, peak overall {Math.round(list[0].overall)}
					</div>
					<Breakdown pieces={directorPieces(list[0])} />
					{list.length > 1 && (
						<table className="data goat-table">
							<tbody>
								{list.slice(1).map((d, i) => (
									<tr key={d.person.pid}>
										<Medal rank={i + 2} />
										<td className="wrap">
											<PersonName person={d.person} awards={state.awards} /> <Status person={d.person} />
										</td>
										<td className="r num">
											<b>{Math.round(d.goat)}</b>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
					<p className="muted fine">
						Score = {GOAT_DIRECTOR.win} per Best Director + {GOAT_DIRECTOR.pictureFilm} per Best Picture film they directed + 1 per{" "}
						{fmtMoney(GOAT_DIRECTOR.grossPer)} of box office + rating (overall above 50) + craft (vision and technique above 50) + average
						critics above 60. Rating and craft use their peak, not their current ratings, and retired directors still count.
					</p>
				</>
			)}
		</section>
	);
};

const GoatFilms = ({ state }: { state: GameState }) => {
	const list = top(filmLegacies(state), TOP, (f) => f.goat);
	const label = (f: FilmLegacy) => (
		<>
			<MovieName mid={f.movie.mid}>{f.movie.title}</MovieName>
			{installmentOf(f.movie) > 1 && <span className="tag">Part {installmentOf(f.movie)}</span>}
		</>
	);
	return (
		<section className="panel goat">
			<h2>👑 GOAT film</h2>
			{list.length === 0 ? (
				<Empty>No film has been released yet.</Empty>
			) : (
				<>
					<div className="goat-hero">
						<div className="goat-name">{label(list[0])}</div>
						<div className="goat-score num">{Math.round(list[0].goat)}</div>
					</div>
					<div className="muted">
						{list[0].movie.season} {GENRE_LABEL[list[0].movie.genre]} by {studioName(state, list[0].movie.tid)}: {fmtMoney(list[0].movie.boxOffice ?? 0)},
						critics {list[0].movie.criticScore}, {list[0].wins.total} award{list[0].wins.total === 1 ? "" : "s"}
					</div>
					<Breakdown pieces={filmPieces(list[0])} />
					{list.length > 1 && (
						<table className="data goat-table">
							<tbody>
								{list.slice(1).map((f, i) => (
									<tr key={f.movie.mid} className={f.movie.tid === state.userTid ? "mine" : ""}>
										<Medal rank={i + 2} />
										<td className="wrap">
											{label(f)} <span className="muted">{f.movie.season}</span>
										</td>
										<td className="r num">
											<b>{Math.round(f.goat)}</b>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
					<p className="muted fine">
						Score = critics above 50 x {GOAT_FILM.critics} + 1 per {fmtMoney(GOAT_FILM.grossPer)} of box office + awards (Best Picture{" "}
						{GOAT_FILM.picture}, Director {GOAT_FILM.director}, each lead award {GOAT_FILM.leadWin}, each supporting award{" "}
						{GOAT_FILM.supportingWin}) + profit on cost (up to {GOAT_FILM.roiMax}) + {GOAT_FILM.sequel} per later part in its franchise (up to{" "}
						{GOAT_FILM.sequelMax}).
					</p>
				</>
			)}
		</section>
	);
};

const MostAwards = ({ state }: { state: GameState }) => {
	const list = top(
		actorLegacies(state).filter((a) => a.awardCount > 0),
		TOP,
		(a) => a.awardCount,
		(a) => a.wins.lead * 2 + a.wins.supporting, // more lead wins first, then supporting
	);
	return (
		<section className="panel">
			<h2>🏆 Most awards (actors)</h2>
			{list.length === 0 ? (
				<Empty>No acting awards have been handed out yet.</Empty>
			) : (
				<table className="data">
					<thead>
						<tr>
							<th />
							<th>Actor</th>
							<th className="r">Lead</th>
							<th className="r">Supp.</th>
							<th className="r">Total</th>
						</tr>
					</thead>
					<tbody>
						{list.map((a, i) => (
							<tr key={a.person.pid}>
								<Medal rank={i + 1} />
								<td className="wrap">
									<PersonName person={a.person} awards={state.awards} /> <Status person={a.person} />
								</td>
								<td className="r num">{a.wins.lead}</td>
								<td className="r num">{a.wins.supporting}</td>
								<td className="r num">
									<b>{a.awardCount}</b>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</section>
	);
};

const TopEarners = ({ state }: { state: GameState }) => {
	const list = top(actorLegacies(state).filter((a) => a.films > 0), TOP, (a) => a.gross);
	return (
		<section className="panel">
			<h2>💰 Top-earning actors</h2>
			{list.length === 0 ? (
				<Empty>No films have been released yet.</Empty>
			) : (
				<table className="data">
					<thead>
						<tr>
							<th />
							<th>Actor</th>
							<th className="r">Films</th>
							<th className="r">Box office</th>
						</tr>
					</thead>
					<tbody>
						{list.map((a, i) => (
							<tr key={a.person.pid}>
								<Medal rank={i + 1} />
								<td className="wrap">
									<PersonName person={a.person} awards={state.awards} /> <Status person={a.person} />
								</td>
								<td className="r num">{a.films}</td>
								<td className="r num">
									<b>{fmtMoney(a.gross)}</b>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			<p className="muted fine">Total box office of every film they appeared in, for any studio.</p>
		</section>
	);
};

const TopFilms = ({ state }: { state: GameState }) => {
	const list = top(filmLegacies(state), TOP, (f) => f.movie.boxOffice ?? 0);
	return (
		<section className="panel">
			<h2>🎬 Highest-grossing films</h2>
			{list.length === 0 ? (
				<Empty>No film has been released yet.</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>Film</th>
								<th>Studio</th>
								<th className="r">Year</th>
								<th className="r">Critics</th>
								<th className="r">Box office</th>
							</tr>
						</thead>
						<tbody>
							{list.map((f, i) => (
								<tr key={f.movie.mid} className={f.movie.tid === state.userTid ? "mine" : ""}>
									<Medal rank={i + 1} />
									<td>
										<MovieName mid={f.movie.mid}>{f.movie.title}</MovieName>
										{installmentOf(f.movie) > 1 && <span className="tag">Part {installmentOf(f.movie)}</span>}
									</td>
									<td>{studioName(state, f.movie.tid)}</td>
									<td className="r num">{f.movie.season}</td>
									<td className="r num">{f.movie.criticScore}</td>
									<td className="r num">
										<b>{fmtMoney(f.movie.boxOffice ?? 0)}</b>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
};

const FamousIps = ({ state }: { state: GameState }) => {
	const list = top(ipLegacies(state), TOP, (ip) => ip.fame);
	return (
		<section className="panel">
			<h2>⭐ Most famous IPs</h2>
			{list.length === 0 ? (
				<Empty>No franchise yet. Make a sequel in the Development phase (the Franchise menu) and your first series will show up here.</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>Franchise</th>
								<th>Studio</th>
								<th className="r">Films</th>
								<th className="r">Box office</th>
								<th className="r">Avg critics</th>
								<th className="r">Fame</th>
							</tr>
						</thead>
						<tbody>
							{list.map((ip, i) => (
								<tr key={ip.id} className={ip.films[0].tid === state.userTid ? "mine" : ""}>
									<Medal rank={i + 1} />
									<td>{ip.name}</td>
									<td>{studioName(state, ip.films[0].tid)}</td>
									<td className="r num">{ip.films.length}</td>
									<td className="r num">{fmtMoney(ip.gross)}</td>
									<td className="r num">{Math.round(ip.avgCritics)}</td>
									<td className="r num">
										<b>{ip.fame}</b>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">
				Fame = 1 per {fmtMoney(IP_FAME.grossPer * 1000)} of total box office (scaled by critics) + {IP_FAME.award} per award its films won + {IP_FAME.part}{" "}
				per film.
			</p>
		</section>
	);
};

/** Two people who keep working together. Hover the film count to see which films. */
const PairTable = ({ state, list, empty, firstLabel }: { state: GameState; list: Pairing[]; empty: string; firstLabel: string }) =>
	list.length === 0 ? (
		<Empty>{empty}</Empty>
	) : (
		<div className="scroll">
			<table className="data">
				<thead>
					<tr>
						<th />
						<th>{firstLabel}</th>
						<th className="r">Films</th>
						<th className="r">Box office</th>
						<th className="r">Avg critics</th>
						<th className="r">Film awards</th>
					</tr>
				</thead>
				<tbody>
					{list.map((p, i) => (
						<tr key={`${p.a.pid}-${p.b.pid}`}>
							<Medal rank={i + 1} />
							<td className="wrap">
								<PersonName person={p.a} awards={state.awards} /> &amp; <PersonName person={p.b} awards={state.awards} />
							</td>
							<td className="r num" title={p.films.map((m) => `${m.season}: ${m.title}`).join("\n")}>
								<b>{p.films.length}</b>
							</td>
							<td className="r num">{fmtMoney(p.gross)}</td>
							<td className="r num">{Math.round(p.avgCritics)}</td>
							<td className="r num">{p.filmAwards}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);

const bestPairs = (list: Pairing[]) =>
	top(list, TOP, (p) => p.films.length, (p) => p.gross); // most films together; ties go to the bigger box office

const ActingPairs = ({ state }: { state: GameState }) => (
	<section className="panel">
		<h2>🎭 Most acting pair</h2>
		<PairTable
			state={state}
			list={bestPairs(actingPairs(state))}
			firstLabel="Actors"
			empty="No two actors have shared more than one film yet."
		/>
		<p className="muted fine">Two actors in the same film, any billing. Needs at least 2 films together. Hover the film count for the titles.</p>
	</section>
);

const DirectorDuos = ({ state }: { state: GameState }) => (
	<section className="panel">
		<h2>🎥 Actor-director duo</h2>
		<PairTable
			state={state}
			list={bestPairs(directorDuos(state))}
			firstLabel="Director & actor"
			empty="No director and actor have made more than one film together yet."
		/>
		<p className="muted fine">Director first. Needs at least 2 films together. &ldquo;Film awards&rdquo; counts every award those films won.</p>
	</section>
);

export const Frivolities = ({ state }: { state: GameState }) => (
	<main className="frivol fv-dark">
		<div className="frivol-grid goats">
			<GoatActors state={state} />
			<GoatDirectors state={state} />
			<GoatFilms state={state} />
		</div>
		<div className="frivol-grid">
			<MostAwards state={state} />
			<TopEarners state={state} />
			<TopFilms state={state} />
			<FamousIps state={state} />
			<ActingPairs state={state} />
			<DirectorDuos state={state} />
		</div>
	</main>
);
