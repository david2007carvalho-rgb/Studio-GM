import type { ReactNode } from "react";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { installmentOf } from "../game/franchise";
import { top } from "../game/legacy";
import { awardDroughts, biggestFlops, biggestOpenings, nominationLeaders, scoredFilms } from "../game/records";
import type { GameState, Movie } from "../game/types";
import { MovieName } from "./MovieName";
import { PersonName } from "./PersonName";

const TOP = 10;

const studioName = (state: GameState, tid: number) => state.studios.find((s) => s.tid === tid)?.name ?? "?";
const Empty = ({ children }: { children: ReactNode }) => <p className="muted" style={{ margin: 0 }}>{children}</p>;
const Rank = ({ rank }: { rank: number }) => <td className={`rank num ${rank === 1 ? "gold" : "muted"}`}>{rank === 1 ? "👑" : rank}</td>;

const Title = ({ movie }: { movie: Movie }) => (
	<>
		<MovieName mid={movie.mid}>{movie.title}</MovieName>
		{installmentOf(movie) > 1 && <span className="tag">Part {installmentOf(movie)}</span>} <span className="muted">{GENRE_LABEL[movie.genre]}</span>
	</>
);

const Openings = ({ state }: { state: GameState }) => {
	const list = top(biggestOpenings(state), TOP, (r) => r.opening);
	return (
		<section className="panel">
			<h2>🚀 Highest-grossing opening</h2>
			{list.length === 0 ? (
				<Empty>No opening weekend recorded yet. Release a film first (films from older saves have no opening figure).</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>Film</th>
								<th>Studio</th>
								<th className="r">Year</th>
								<th className="r">Opening</th>
								<th className="r">Total</th>
							</tr>
						</thead>
						<tbody>
							{list.map((r, i) => (
								<tr key={r.movie.mid} className={r.movie.tid === state.userTid ? "mine" : ""}>
									<Rank rank={i + 1} />
									<td className="wrap"><Title movie={r.movie} /></td>
									<td>{studioName(state, r.movie.tid)}</td>
									<td className="r num">{r.movie.season}</td>
									<td className="r num" title={`${Math.round(r.share * 100)}% of its total`}><b>{fmtMoney(r.opening)}</b></td>
									<td className="r num">{fmtMoney(r.movie.boxOffice ?? 0)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">Opening weekend is a share of the final gross (roughly 15-55%). Big marketing and sequels open bigger; well-reviewed films have longer legs.</p>
		</section>
	);
};

const Flops = ({ state }: { state: GameState }) => {
	const list = top(biggestFlops(state), TOP, (r) => r.loss);
	return (
		<section className="panel">
			<h2>💥 Biggest flop</h2>
			{list.length === 0 ? (
				<Empty>No film has lost money yet.</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>Film</th>
								<th>Studio</th>
								<th className="r">Year</th>
								<th className="r">Cost</th>
								<th className="r">Box office</th>
								<th className="r">Loss</th>
							</tr>
						</thead>
						<tbody>
							{list.map((r, i) => (
								<tr key={r.movie.mid} className={r.movie.tid === state.userTid ? "mine" : ""}>
									<Rank rank={i + 1} />
									<td className="wrap"><Title movie={r.movie} /></td>
									<td>{studioName(state, r.movie.tid)}</td>
									<td className="r num">{r.movie.season}</td>
									<td className="r num">{fmtMoney(r.cost)}</td>
									<td className="r num">{fmtMoney(r.movie.boxOffice ?? 0)}</td>
									<td className="r num loss" title={`${Math.round(-r.returnOnCost * 100)}% of its cost lost`}><b>{fmtMoney(-r.loss)}</b></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">Ranked by dollars lost: box office minus budget and marketing. Hover the loss for the share of the cost.</p>
		</section>
	);
};

const Droughts = ({ state }: { state: GameState }) => {
	const list = top(awardDroughts(state), TOP, (d) => d.longest, (d) => (d.ongoing ? 1 : 0));
	return (
		<section className="panel">
			<h2>🏜️ Longest awards drought</h2>
			{list.length === 0 ? (
				<Empty>Nobody has gone a season without an award after winning one yet.</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>Person</th>
								<th className="r">Seasons without</th>
								<th>Since</th>
								<th className="r">Wins</th>
							</tr>
						</thead>
						<tbody>
							{list.map((d, i) => (
								<tr key={d.person.pid}>
									<Rank rank={i + 1} />
									<td className="wrap">
										<PersonName person={d.person} awards={state.awards} />{" "}
										<span className="muted">{d.person.role === "director" ? "director" : "actor"}</span>
									</td>
									<td className="r num"><b>{d.longest}</b></td>
									<td className="num">
										{d.from}
										{d.to !== null ? ` – won again ${d.to}` : d.ongoing ? " – still waiting" : " – never won again"}
									</td>
									<td className="r num">{d.wins}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">The most seasons between two wins, or from a last win until today (active people) or their last film (retired people). Only people with at least one win count, and any of the five person awards ends a drought.</p>
		</section>
	);
};

const BestScored = ({ state, by }: { state: GameState; by: "critics" | "audience" }) => {
	const isCritics = by === "critics";
	const other = isCritics ? "audience" : "critics";
	const list = top(scoredFilms(state), TOP, (r) => r[by], (r) => r[other]);
	return (
		<section className="panel">
			<h2>{isCritics ? "🎭 Best critics score" : "🍿 Best audience score"}</h2>
			{list.length === 0 ? (
				<Empty>No film with a {isCritics ? "critics" : "audience"} score yet (films from older saves may lack an audience score).</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>Film</th>
								<th>Studio</th>
								<th className="r">Year</th>
								<th className="r">{isCritics ? "Critics" : "Audience"}</th>
								<th className="r">{isCritics ? "Audience" : "Critics"}</th>
							</tr>
						</thead>
						<tbody>
							{list.map((r, i) => (
								<tr key={r.movie.mid} className={r.movie.tid === state.userTid ? "mine" : ""}>
									<Rank rank={i + 1} />
									<td className="wrap"><Title movie={r.movie} /></td>
									<td>{studioName(state, r.movie.tid)}</td>
									<td className="r num">{r.movie.season}</td>
									<td className="r num"><b>{Math.round(r[by])}</b></td>
									<td className="r num muted">{Math.round(r[other])}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">Ties are broken by the {other} score.</p>
		</section>
	);
};

const MostNominated = ({ state, role }: { state: GameState; role: "director" | "actor" }) => {
	const isDir = role === "director";
	const list = top(nominationLeaders(state, role), TOP, (r) => r.nominations, (r) => r.wins);
	return (
		<section className="panel">
			<h2>{isDir ? "🎬 Most nominated directors" : "🌟 Most nominated actors"}</h2>
			{list.length === 0 ? (
				<Empty>No {isDir ? "director" : "actor"} has been nominated yet.</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>{isDir ? "Director" : "Actor"}</th>
								<th className="r">Nominations</th>
								<th className="r">Wins</th>
							</tr>
						</thead>
						<tbody>
							{list.map((r, i) => (
								<tr key={r.person.pid}>
									<Rank rank={i + 1} />
									<td className="wrap">
										<PersonName person={r.person} awards={state.awards} />
									</td>
									<td className="r num"><b>{r.nominations}</b></td>
									<td className="r num">{r.wins}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">Counts every nomination, wins included. {isDir ? "Best Director" : "Best Actor, Actress and both supporting awards"}; ties are broken by wins.</p>
		</section>
	);
};

export const Records = ({ state }: { state: GameState }) => (
	<main className="frivol">
		<div className="frivol-grid">
			<Openings state={state} />
			<Flops state={state} />
			<BestScored state={state} by="critics" />
			<BestScored state={state} by="audience" />
			<MostNominated state={state} role="director" />
			<MostNominated state={state} role="actor" />
			<Droughts state={state} />
		</div>
	</main>
);
