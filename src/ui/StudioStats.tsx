import type { ReactNode } from "react";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { installmentOf } from "../game/franchise";
import { movieProfit } from "../game/movie";
import {
	AWARD_CATEGORIES,
	awardWins,
	byGenre,
	byYear,
	leagueTable,
	mostWorked,
	moneyOf,
	nominationCount,
	summaryOf,
} from "../game/studioStats";
import type { WorkRow } from "../game/studioStats";
import type { GameState, Movie } from "../game/types";
import { MovieName } from "./MovieName";
import { PersonName } from "./PersonName";

const TOP = 5;

const Empty = ({ children }: { children: ReactNode }) => <p className="muted" style={{ margin: 0 }}>{children}</p>;
const Rank = ({ rank }: { rank: number }) => <td className={`rank num ${rank === 1 ? "gold" : "muted"}`}>{rank === 1 ? "👑" : rank}</td>;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (n: number) => (n >= 0 ? fmtMoney(n) : fmtMoney(n));

const Tile = ({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "gain" | "loss" | "gold" }) => (
	<div className="stat-tile">
		<span className="stat-label muted">{label}</span>
		<b className={`stat-value num ${tone ?? ""}`}>{value}</b>
		{sub && <span className="stat-sub muted">{sub}</span>}
	</div>
);

const FilmLine = ({ movie, extra }: { movie?: Movie; extra: ReactNode }) =>
	movie ? (
		<>
			<dt>
				<MovieName mid={movie.mid}>{movie.title}</MovieName>
				{installmentOf(movie) > 1 && <span className="tag">Part {installmentOf(movie)}</span>}
			</dt>
			<dd>{extra}</dd>
		</>
	) : null;

// ── panels ──

const Headline = ({ state, tid }: { state: GameState; tid: number }) => {
	const studio = state.studios.find((s) => s.tid === tid)!;
	const wins = awardWins(state.awards, tid);
	const noms = nominationCount(state.awards, tid);
	const money = moneyOf(state, tid);
	const sum = summaryOf(state, tid);
	return (
		<section className="panel">
			<div className="stat-tiles">
				<Tile label="Awards won" value={wins.length} tone="gold" sub={noms > 0 ? `from ${noms} nominations` : undefined} />
				<Tile label="Films released" value={sum.films} sub={sum.films ? `${sum.hits} profitable (${pct(sum.hits / sum.films)})` : undefined} />
				<Tile label="Money spent" value={fmtMoney(money.spent)} sub="on all your films" />
				<Tile label="Box office" value={fmtMoney(money.boxOffice)} />
				<Tile label="Net profit" value={fmtMoney(money.profit)} tone={money.profit >= 0 ? "gain" : "loss"} sub={money.spent > 0 ? `${money.roi >= 0 ? "+" : ""}${pct(money.roi)} return` : undefined} />
				<Tile label="Cash now" value={fmtMoney(studio.cash)} sub={`reputation ${Math.round(studio.reputation)}`} />
			</div>
		</section>
	);
};

const Awards = ({ state, tid }: { state: GameState; tid: number }) => {
	const wins = awardWins(state.awards, tid);
	return (
		<section className="panel goat">
			<h2>🏆 Awards</h2>
			{wins.length === 0 ? (
				<Empty>No award yet. Win one at the ceremony after Distribution.</Empty>
			) : (
				<>
					<div className="award-chips">
						{AWARD_CATEGORIES.map((c) => {
							const n = wins.filter((w) => w.key === c.key).length;
							return (
								<span key={c.key} className={`award-chip ${n === 0 ? "none" : ""}`}>
									{c.label} <b className="num">{n}</b>
								</span>
							);
						})}
					</div>
					<div className="scroll" style={{ maxHeight: 280, overflowY: "auto" }}>
						<table className="data">
							<thead>
								<tr>
									<th className="r">Year</th>
									<th>Award</th>
									<th>Winner</th>
									<th>Film</th>
								</tr>
							</thead>
							<tbody>
								{wins.map((w) => {
									const person = w.winner.pid !== undefined ? state.people.find((p) => p.pid === w.winner.pid) : undefined;
									return (
										<tr key={`${w.season}-${w.key}`}>
											<td className="r num">{w.season}</td>
											<td>{w.label}</td>
											<td className="wrap">
												{w.key === "bestPicture" ? <span className="muted">the film</span> : person ? <PersonName person={person} awards={state.awards} /> : w.winner.name}
											</td>
											<td className="wrap">
												<MovieName mid={w.winner.mid}>{w.winner.movieTitle}</MovieName>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</>
			)}
		</section>
	);
};

const MostWorked = ({ state, tid, role }: { state: GameState; tid: number; role: "actor" | "director" }) => {
	const isDir = role === "director";
	const list: WorkRow[] = mostWorked(state, tid, role).slice(0, TOP);
	return (
		<section className="panel">
			<h2>{isDir ? "🎬 Most worked directors" : "🌟 Most worked actors"}</h2>
			{list.length === 0 ? (
				<Empty>No {isDir ? "director" : "actor"} has worked on your films yet.</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th />
								<th>{isDir ? "Director" : "Actor"}</th>
								<th className="r">Films</th>
								{!isDir && <th className="r">As lead</th>}
								<th className="r">Box office</th>
								<th className="r">Critics</th>
								<th className="r">Awards</th>
							</tr>
						</thead>
						<tbody>
							{list.map((r, i) => (
								<tr key={r.person.pid}>
									<Rank rank={i + 1} />
									<td className="wrap">
										<PersonName person={r.person} awards={state.awards} /> <span className="muted">last {r.lastSeason}</span>
									</td>
									<td className="r num"><b>{r.films}</b></td>
									{!isDir && <td className="r num">{r.leads}</td>}
									<td className="r num">{fmtMoney(r.gross)}</td>
									<td className="r num">{Math.round(r.avgCritic)}</td>
									<td className="r num">{r.wins}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">Counted over the films you paid for. Ties are broken by box office. "Awards" are acting or directing prizes they won for your studio's films.</p>
		</section>
	);
};

const Money = ({ state, tid }: { state: GameState; tid: number }) => {
	const m = moneyOf(state, tid);
	const years = byYear(state, tid);
	const parts = [
		{ label: "Production & salaries", value: m.production, color: "#0e6b78" },
		{ label: "Marketing", value: m.marketing, color: "#b8891f" },
		{ label: "Licence fees", value: m.licenseFees, color: "#8a4a8f" },
		{ label: "Scripts", value: m.scriptFees, color: "#4a7a3a" },
	];
	const total = parts.reduce((s, p) => s + p.value, 0) || 1;
	return (
		<section className="panel">
			<h2>💰 Money</h2>
			{years.length === 0 ? (
				<Empty>You have not paid for a film yet.</Empty>
			) : (
				<>
					<div className="goat-bar" role="img" aria-label={parts.map((p) => `${p.label} ${fmtMoney(p.value)}`).join(", ")}>
						{parts.map((p) => (
							<span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${fmtMoney(p.value)}`} />
						))}
					</div>
					<div className="goat-legend">
						{parts.map((p) => (
							<span key={p.label}>
								<i style={{ background: p.color }} />
								{p.label} <b className="num">{fmtMoney(p.value)}</b>
							</span>
						))}
					</div>
					<dl className="kv">
						<dt>Platform financing received</dt>
						<dd className="gain">{m.platformCover > 0 ? `−${fmtMoney(m.platformCover)} off your costs` : "none"}</dd>
						<dt>Net money spent</dt>
						<dd><b>{fmtMoney(m.spent)}</b></dd>
						<dt>Box office earned</dt>
						<dd>{fmtMoney(m.boxOffice)}</dd>
						<dt>Streaming contracts paid</dt>
						<dd>{fmtMoney(m.streamingIncome)}</dd>
						<dt>Net profit</dt>
						<dd className={m.profit >= 0 ? "gain" : "loss"}><b>{signed(m.profit)}</b></dd>
					</dl>
					<div className="scroll" style={{ marginTop: 12 }}>
						<table className="data">
							<thead>
								<tr>
									<th className="r">Year</th>
									<th className="r">Films</th>
									<th className="r">Spent</th>
									<th className="r">Box office</th>
									<th className="r">Profit</th>
									<th className="r">🏆</th>
								</tr>
							</thead>
							<tbody>
								{years.map((y) => (
									<tr key={y.season}>
										<td className="r num">{y.season}</td>
										<td className="r num">{y.films}</td>
										<td className="r num">{fmtMoney(y.spent)}</td>
										<td className="r num">{fmtMoney(y.boxOffice)}</td>
										<td className={`r num ${y.profit >= 0 ? "gain" : "loss"}`}>{fmtMoney(y.profit)}</td>
										<td className="r num">{y.wins}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
			<p className="muted fine">Profit counts released films only (box office and streaming payments minus what the films cost you). Rights you bought in the IP Store are not included, only the per-film licence fees.</p>
		</section>
	);
};

const Highlights = ({ state, tid }: { state: GameState; tid: number }) => {
	const s = summaryOf(state, tid);
	return (
		<section className="panel">
			<h2>⭐ Highlights</h2>
			{s.films === 0 ? (
				<Empty>Release a film to see highlights.</Empty>
			) : (
				<dl className="kv">
					<dt>Biggest hit (profit)</dt>
					<dd>{s.bestProfit && movieProfit(s.bestProfit) > 0 ? <MovieName mid={s.bestProfit.mid}>{s.bestProfit.title}</MovieName> : "—"}</dd>
					<dt className="muted">&nbsp;&nbsp;made</dt>
					<dd className="gain">{s.bestProfit && movieProfit(s.bestProfit) > 0 ? fmtMoney(movieProfit(s.bestProfit)) : "—"}</dd>
					<dt>Biggest flop</dt>
					<dd>{s.worstProfit && movieProfit(s.worstProfit) < 0 ? <MovieName mid={s.worstProfit.mid}>{s.worstProfit.title}</MovieName> : "none yet"}</dd>
					<dt className="muted">&nbsp;&nbsp;lost</dt>
					<dd className="loss">{s.worstProfit && movieProfit(s.worstProfit) < 0 ? fmtMoney(movieProfit(s.worstProfit)) : "—"}</dd>
					<FilmLine movie={s.biggestGross} extra={fmtMoney(s.biggestGross?.boxOffice ?? 0)} />
					<dt className="muted">&nbsp;&nbsp;↑ highest gross</dt>
					<dd />
					<FilmLine movie={s.bestCritic} extra={`${Math.round(s.bestCritic?.criticScore ?? 0)} critics`} />
					<dt className="muted">&nbsp;&nbsp;↑ best reviewed</dt>
					<dd />
					<dt>Average critics / audience</dt>
					<dd>{Math.round(s.avgCritic)} / {s.avgAudience ? Math.round(s.avgAudience) : "—"}</dd>
					<dt>Sequels · licensed · streaming-backed</dt>
					<dd>{s.sequels} · {s.licensed} · {s.streaming}</dd>
					<dt>Longest franchise</dt>
					<dd>{s.longestFranchise > 1 ? `${s.longestFranchise} films` : "none yet"}</dd>
				</dl>
			)}
		</section>
	);
};

const Genres = ({ state, tid }: { state: GameState; tid: number }) => {
	const list = byGenre(state, tid);
	return (
		<section className="panel">
			<h2>🎞️ By genre</h2>
			{list.length === 0 ? (
				<Empty>Release a film to see how each genre does for you.</Empty>
			) : (
				<div className="scroll">
					<table className="data">
						<thead>
							<tr>
								<th>Genre</th>
								<th className="r">Films</th>
								<th className="r">Box office</th>
								<th className="r">Profit</th>
								<th className="r">Critics</th>
							</tr>
						</thead>
						<tbody>
							{list.map((g) => (
								<tr key={g.genre}>
									<td>{GENRE_LABEL[g.genre]}</td>
									<td className="r num">{g.films}</td>
									<td className="r num">{fmtMoney(g.boxOffice)}</td>
									<td className={`r num ${g.profit >= 0 ? "gain" : "loss"}`}>{fmtMoney(g.profit)}</td>
									<td className="r num">{Math.round(g.avgCritic)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="muted fine">Ranked by profit, so the first row is the genre that earns you the most.</p>
		</section>
	);
};

const League = ({ state }: { state: GameState }) => {
	const rows = leagueTable(state);
	return (
		<section className="panel">
			<h2>🏛️ League table</h2>
			<div className="scroll">
				<table className="data">
					<thead>
						<tr>
							<th />
							<th>Studio</th>
							<th className="r">Awards</th>
							<th className="r">Films</th>
							<th className="r">Box office</th>
							<th className="r">Profit</th>
							<th className="r">Rep</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r, i) => (
							<tr key={r.tid} className={r.tid === state.userTid ? "mine" : ""}>
								<Rank rank={i + 1} />
								<td>{r.name}</td>
								<td className="r num"><b>{r.awards}</b></td>
								<td className="r num">{r.films}</td>
								<td className="r num">{fmtMoney(r.boxOffice)}</td>
								<td className={`r num ${r.profit >= 0 ? "gain" : "loss"}`}>{fmtMoney(r.profit)}</td>
								<td className="r num">{Math.round(r.reputation)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="muted fine">All studios ranked by awards, then box office. Rivals' profit leaves out streaming income.</p>
		</section>
	);
};

export const StudioStats = ({ state }: { state: GameState }) => {
	const tid = state.userTid;
	const studio = state.studios.find((s) => s.tid === tid)!;
	return (
		<main className="frivol">
			<h2 style={{ margin: 0, fontFamily: "var(--serif)" }}>{studio.name}: studio stats</h2>
			<Headline state={state} tid={tid} />
			<div className="frivol-grid">
				<Awards state={state} tid={tid} />
				<Money state={state} tid={tid} />
				<MostWorked state={state} tid={tid} role="actor" />
				<MostWorked state={state} tid={tid} role="director" />
				<Highlights state={state} tid={tid} />
				<Genres state={state} tid={tid} />
				<League state={state} />
			</div>
		</main>
	);
};
