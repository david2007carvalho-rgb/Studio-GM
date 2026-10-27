import { RELEASE_LABEL } from "../game/streaming";
import { platformById } from "../game/streamingData";
import { useState } from "react";
import { splitCast } from "../game/cast";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { franchiseFilms, franchiseIdOf, franchiseName, installmentOf } from "../game/franchise";
import { finalQuality, movieProfit } from "../game/movie";
import { brandById } from "../game/brandData";
import { ipById, propertyById } from "../game/ip";
import { MovieName } from "./MovieName";
import { STYLES } from "../game/scripts";
import { PersonName } from "./PersonName";
import { getPerson } from "../game/phase";
import type { GameState, Movie } from "../game/types";


const studioName = (state: GameState, tid: number) => state.studios.find((s) => s.tid === tid)?.name ?? "?";
const Director = ({ state, m }: { state: GameState; m: Movie }) => (
	<PersonName person={getPerson(state, m.directorPid)} awards={state.awards} />
);
const Names = ({ state, pids }: { state: GameState; pids: number[] }) => (
	<>
		{pids.map((pid, i) => (
			<span key={pid}>
				{i > 0 && ", "}
				<PersonName person={getPerson(state, pid)} awards={state.awards} />
			</span>
		))}
	</>
);
/** Leads first, then the supporting actors under their own label. */
const Cast = ({ state, m }: { state: GameState; m: Movie }) => {
	const { leads, supporting } = splitCast(m);
	return (
		<>
			<Names state={state} pids={leads} />
			{supporting.length > 0 && (
				<>
					<span className="muted"> &middot; supporting: </span>
					<Names state={state} pids={supporting} />
				</>
			)}
		</>
	);
};
const dash = <span className="muted">&ndash;</span>;

const pct = (x: number): string => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

/** Film title, with a small "Part 2" tag when it is a sequel. */
const Title = ({ m, state }: { m: Movie; state: GameState }) => {
	const ip = m.ipId ? ipById(state, m.ipId) : undefined;
	return (
	<>
		<MovieName mid={m.mid}>{m.title}</MovieName>
		{installmentOf(m) > 1 && (
			<span className="tag" title="Sequel in a franchise">
				Part {installmentOf(m)}
			</span>
		)}
		{ip && (
			<span className="tag ip-tag" title={`Licensed ${ip.name} film`}>
				{ip.emoji} {ip.name}
			</span>
		)}
	</>
	);
};

/** Your film this season, filled in as the phases go by. */
export const MovieCard = ({ state, movie }: { state: GameState; movie: Movie }) => {
	const director = getPerson(state, movie.directorPid);
	const { leads, supporting } = splitCast(movie);
	const shot = movie.productionQuality !== undefined;
	const edited = movie.postQuality !== undefined;
	const released = movie.boxOffice !== undefined;
	const profit = released ? movieProfit(movie) : 0;
	const ip = movie.ipId ? ipById(state, movie.ipId) : undefined;
	const prop = movie.propertyId ? propertyById(state, movie.propertyId)?.prop : undefined;
	const res = movie.ipResult;

	return (
		<section className="panel">
			<h2>
				<MovieName mid={movie.mid}>{movie.title}</MovieName>
			</h2>
			<div className="muted">
				{GENRE_LABEL[movie.genre]}. Directed by <PersonName person={director} awards={state.awards} />, starring{" "}
				<Names state={state} pids={leads} />
				{supporting.length > 0 && (
					<>
						, with <Names state={state} pids={supporting} /> in supporting roles
					</>
				)}
				.
			</div>
			{movie.prequelMid !== undefined && (
				<div className="muted">
					Part {installmentOf(movie)} of the {franchiseName(state, movie)} franchise.
				</div>
			)}
			{ip && (
				<div className="muted">
					Licensed {ip.emoji} <b>{ip.name}</b>
					{prop && <> &middot; {prop.name}</>}.
				</div>
			)}
			<dl className="kv">
				<dt>Budget</dt>
				<dd>{fmtMoney(movie.budget)}</dd>
				<dt>Marketing</dt>
				<dd>{fmtMoney(movie.marketing ?? 0)}</dd>
				{movie.script && (
					<>
						<dt>Script</dt>
						<dd>
							{STYLES[movie.script.style].label} &middot; {movie.script.own ? "the director's own" : `by ${movie.script.writer}`}
							<span className="muted"> &middot; quality {movie.script.quality}{movie.script.landed !== undefined && movie.script.landed !== movie.script.quality ? `, landed ${movie.script.landed}` : ""}{movie.scriptFee ? ` · ${fmtMoney(movie.scriptFee)}` : ""}</span>
						</dd>
					</>
				)}
				{ip && (
					<>
						<dt>Licence fee ({ip.name})</dt>
						<dd>{fmtMoney(movie.licenseFee ?? 0)}</dd>
					</>
				)}
				{movie.streamPlatformId && (
					<>
						<dt>Streaming partner</dt>
						<dd>
							{platformById(movie.streamPlatformId)?.emoji} {platformById(movie.streamPlatformId)?.name} &middot; {RELEASE_LABEL[movie.release ?? "wide"].toLowerCase()}
							{(movie.financing ?? 0) + (movie.platformMarketing ?? 0) > 0 && <span className="muted"> &middot; paid {fmtMoney((movie.financing ?? 0) + (movie.platformMarketing ?? 0))} towards the cost</span>}
						</dd>
					</>
				)}
				{movie.brands && movie.brands.length > 0 && (
					<>
						<dt>Brand partners</dt>
						<dd>
							{movie.brands.map((p) => brandById(p.brandId)?.name + (p.tier === "sponsor" ? " (presenting)" : "")).join(", ")}
							<span className="muted"> &middot; paid {fmtMoney(movie.brandFunding ?? 0)} towards the cost</span>
							{movie.brandBonus ? <span className={movie.brandBonus > 0 ? "gain" : "loss"}> &middot; {movie.brandBonus > 0 ? "hit bonus" : "make-good"} {fmtMoney(movie.brandBonus)}</span> : null}
						</dd>
					</>
				)}
				<dt>Production quality</dt>
				<dd>{shot ? movie.productionQuality : dash}</dd>
				{shot && (movie.chemistry ?? 0) > 0 && (
					<>
						<dt>Chemistry bonus (returning duos)</dt>
						<dd>+{movie.chemistry!.toFixed(1)} (included above)</dd>
					</>
				)}
				<dt>Post-production quality</dt>
				<dd>{edited ? movie.postQuality : dash}</dd>
				<dt>Final quality</dt>
				<dd>{shot && edited ? Math.round(finalQuality(movie)) : dash}</dd>
				<dt>Critics&rsquo; score</dt>
				<dd>{movie.criticScore ?? dash}</dd>
				<dt>Audience score</dt>
				<dd>{movie.audienceScore ?? dash}</dd>
				<dt>Box office</dt>
				<dd>{released ? fmtMoney(movie.boxOffice ?? 0) : dash}</dd>
				<dt>Profit</dt>
				<dd className={released ? (profit >= 0 ? "gain" : "loss") : ""}>{released ? fmtMoney(profit) : dash}</dd>
				{released && movie.standaloneBoxOffice !== undefined && movie.standaloneCritic !== undefined && (
					<>
						<dt>Franchise effect on box office</dt>
						<dd>
							{fmtMoney(movie.standaloneBoxOffice)} standalone &rarr; {fmtMoney(movie.boxOffice ?? 0)} (
							{pct((movie.boxOffice ?? 0) / Math.max(movie.standaloneBoxOffice, 1) - 1)})
						</dd>
						<dt>Franchise effect on critics</dt>
						<dd>
							{movie.standaloneCritic} standalone &rarr; {movie.criticScore}
						</dd>
					</>
				)}
				{released && res && ip && (
					<>
						<dt>{ip.name} boost on box office</dt>
						<dd className="gain">
							+{Math.round((res.boost - 1) * 100)}% (+{fmtMoney(res.lift)})
						</dd>
						<dt>Fans expected</dt>
						<dd>
							critics {res.expectCritic}+ and {fmtMoney(res.expectGross)}+
						</dd>
						<dt>Fan reaction</dt>
						<dd className={res.reaction < 1 ? "loss" : "gain"}>
							{res.reaction < 1 ? "Backlash" : "Acclaim"} {pct(res.reaction - 1)} on box office
						</dd>
						<dt>Expectations</dt>
						<dd className={res.metCritic && res.metGross ? "gain" : "loss"}>
							{res.metCritic && res.metGross
								? "Met on critics and box office"
								: !res.metCritic && !res.metGross
									? "Missed on critics and box office"
									: res.metCritic
										? "Critics happy, box office disappointing"
										: "Box office fine, critics disappointed"}
						</dd>
						<dt>Reputation from the fans</dt>
						<dd className={res.reputation >= 0 ? "gain" : "loss"}>
							{res.reputation >= 0 ? "+" : ""}
							{res.reputation.toFixed(1)}
						</dd>
						<dt>Fan goodwill for {ip.name}</dt>
						<dd className={res.goodwillDelta >= 0 ? "gain" : "loss"}>
							{res.goodwillDelta >= 0 ? "+" : ""}
							{res.goodwillDelta.toFixed(0)}
						</dd>
					</>
				)}
			</dl>
		</section>
	);
};

/** Every studio's films for a chosen year (any past season too), with director and cast next to the profit. */
export const Releases = ({ state }: { state: GameState }) => {
	const released = state.movies.filter((m) => m.boxOffice !== undefined);
	const seasons = [...new Set(released.map((m) => m.season))].sort((a, b) => b - a);
	const [picked, setPicked] = useState<number | null>(null);
	if (seasons.length === 0) return null;
	const year = picked !== null && seasons.includes(picked) ? picked : seasons[0];
	const films = released.filter((m) => m.season === year).sort((a, b) => (b.criticScore ?? 0) - (a.criticScore ?? 0));

	return (
		<section className="panel">
			<div className="inline" style={{ justifyContent: "space-between", alignItems: "center" }}>
				<h2 style={{ margin: 0 }}>{year} releases</h2>
				{seasons.length > 1 && (
					<select aria-label="Year" value={year} onChange={(e) => setPicked(Number(e.target.value))}>
						{seasons.map((y) => (
							<option key={y} value={y}>
								{y}
							</option>
						))}
					</select>
				)}
			</div>
			<div className="scroll">
				<table className="data">
					<thead>
						<tr>
							<th>Film</th>
							<th>Studio</th>
							<th>Genre</th>
							<th className="r">Box office</th>
							<th className="r">Profit</th>
							<th className="r">Critics</th>
							<th className="r">Audience</th>
							<th>Director</th>
							<th>Cast</th>
						</tr>
					</thead>
					<tbody>
						{films.map((m) => {
							const profit = movieProfit(m);
							return (
								<tr key={m.mid} className={m.tid === state.userTid ? "mine" : ""}>
									<td><Title m={m} state={state} /></td>
									<td>{studioName(state, m.tid)}</td>
									<td>{GENRE_LABEL[m.genre]}</td>
									<td className="r num">{fmtMoney(m.boxOffice ?? 0)}</td>
									<td className={`r num ${profit >= 0 ? "gain" : "loss"}`}>{fmtMoney(profit)}</td>
									<td className="r num">{m.criticScore}</td>
									<td className="r num">{m.audienceScore ?? "–"}</td>
									<td className="wrap"><Director state={state} m={m} /></td>
									<td className="wrap cast"><Cast state={state} m={m} /></td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</section>
	);
};

/** Top 5 contenders per category with their chance of winning. Shown while films are in distribution. */
export const AwardRace = ({ state }: { state: GameState }) => {
	const race = state.awardRace;
	if (!race) return null;
	const cats = [
		{ what: "Best picture", list: race.bestPicture },
		{ what: "Best director", list: race.bestDirector },
		{ what: "Best actor", list: race.bestActor },
		{ what: "Best actress", list: race.bestActress },
		{ what: "Best supporting actor", list: race.bestSupportingActor },
		{ what: "Best supporting actress", list: race.bestSupportingActress },
	];
	return (
		<section className="panel">
			<h2>Awards race</h2>
			<p className="muted">Each contender's chance of winning, from the critics' scores so far. The real awards are a fresh draw, so the favourite can lose.</p>
			<div className="race-grid">
				{cats.map(({ what, list }) => (
					<div key={what} className="race-cat">
						<h3>{what}</h3>
						{list.length === 0 ? (
							<p className="muted">No contenders</p>
						) : (
							<ol className="race">
								{list.map((e) => (
									<li key={`${e.pid ?? "m"}-${e.mid}`} className={e.tid === state.userTid ? "mine" : ""}>
										<div className="race-row">
											<span className="race-name">
												{e.pid !== undefined ? <PersonName person={getPerson(state, e.pid)} awards={state.awards} /> : <MovieName mid={e.mid}>{e.name}</MovieName>}
											</span>
											<b className="num">{e.chance >= 0.995 ? ">99" : e.chance < 0.005 ? "<1" : Math.round(e.chance * 100)}%</b>
										</div>
										<div className="race-bar">
											<span style={{ width: `${Math.max(2, e.chance * 100)}%` }} />
										</div>
										<div className="muted race-sub">
											{e.pid !== undefined && <><MovieName mid={e.mid}>{e.movieTitle}</MovieName>, </>}
											{studioName(state, e.tid)}
										</div>
									</li>
								))}
							</ol>
						)}
					</div>
				))}
			</div>
		</section>
	);
};

/** Winners for this season, shown from the Awards phase on. */
export const Awards = ({ state }: { state: GameState }) => {
	const awards = state.awards.find((a) => a.season === state.season);
	if (!awards) return null;
	const rows = [
		{ what: "Best picture", w: awards.bestPicture },
		{ what: "Best director", w: awards.bestDirector },
		{ what: "Best actor", w: awards.bestActor },
		{ what: "Best actress", w: awards.bestActress },
		{ what: "Best supporting actor", w: awards.bestSupportingActor },
		{ what: "Best supporting actress", w: awards.bestSupportingActress },
	];
	return (
		<section className="panel">
			<h2>{state.season} awards</h2>
			<ul className="winners">
				{rows.map(({ what, w }) => w && (
					<li key={what} className={w.tid === state.userTid ? "mine" : ""}>
						<div className="what">{what}</div>
						<div className="who">{what === "Best picture" ? <MovieName mid={w.mid}>{w.name}</MovieName> : w.name}</div>
						<div className="muted">
							{what === "Best picture" ? studioName(state, w.tid) : <><MovieName mid={w.mid}>{w.movieTitle}</MovieName>, {studioName(state, w.tid)}</>}
							{w.tid === state.userTid && <b className="gold"> Your studio won</b>}
						</div>
					</li>
				))}
			</ul>
		</section>
	);
};

/** Your studio's films across all seasons. */
export const History = ({ state }: { state: GameState }) => {
	const mine = state.movies.filter((m) => m.tid === state.userTid && m.boxOffice !== undefined);
	if (mine.length === 0) return null;
	const wonBy = (m: Movie) => {
		const a = state.awards.find((x) => x.season === m.season);
		if (!a) return "";
		const wins = [];
		if (a.bestPicture.mid === m.mid) wins.push("Picture");
		if (a.bestDirector.mid === m.mid) wins.push("Director");
		if (a.bestActor?.mid === m.mid) wins.push("Actor");
		if (a.bestActress?.mid === m.mid) wins.push("Actress");
		if (a.bestSupportingActor?.mid === m.mid) wins.push("Supp. Actor");
		if (a.bestSupportingActress?.mid === m.mid) wins.push("Supp. Actress");
		return wins.join(", ");
	};
	const total = mine.reduce((sum, m) => sum + movieProfit(m), 0);
	return (
		<section className="panel">
			<h2>Your films</h2>
			<div className="scroll">
				<table className="data">
					<thead>
						<tr>
							<th>Year</th>
							<th>Film</th>
							<th>Genre</th>
							<th className="r">Profit</th>
							<th className="r">Critics</th>
							<th>Director</th>
							<th>Cast</th>
							<th>Awards</th>
						</tr>
					</thead>
					<tbody>
						{[...mine].reverse().map((m) => {
							const profit = movieProfit(m);
							return (
								<tr key={m.mid}>
									<td className="num">{m.season}</td>
									<td><Title m={m} state={state} /></td>
									<td>{GENRE_LABEL[m.genre]}</td>
									<td className={`r num ${profit >= 0 ? "gain" : "loss"}`}>{fmtMoney(profit)}</td>
									<td className="r num">{m.criticScore}</td>
									<td className="wrap"><Director state={state} m={m} /></td>
									<td className="wrap cast"><Cast state={state} m={m} /></td>
									<td className="gold">{wonBy(m)}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<p className="muted" style={{ marginBottom: 0 }}>
				Total profit: <b className={total >= 0 ? "gain" : "loss"}>{fmtMoney(total)}</b>
			</p>
		</section>
	);
};

/** Your franchises: every series with at least two films, and how each part did. */
export const Franchises = ({ state }: { state: GameState }) => {
	const mine = state.movies.filter((m) => m.tid === state.userTid && m.boxOffice !== undefined);
	const ids = [...new Set(mine.map(franchiseIdOf))];
	const series = ids
		.map((id) => ({ id, films: franchiseFilms(state, id).filter((m) => m.tid === state.userTid && m.boxOffice !== undefined) }))
		.filter((s) => s.films.length >= 2);
	if (series.length === 0) return null;
	return (
		<section className="panel">
			<h2>Your franchises</h2>
			<div className="scroll">
				<table className="data">
					<thead>
						<tr>
							<th>Franchise</th>
							<th className="r">Films</th>
							<th>Box office by part</th>
							<th className="r">Critics</th>
							<th className="r">Total profit</th>
						</tr>
					</thead>
					<tbody>
						{series.map(({ id, films }) => {
							const profit = films.reduce((sum, m) => sum + movieProfit(m), 0);
							return (
								<tr key={id}>
									<td>{franchiseName(state, films[0])}</td>
									<td className="r num">{films.length}</td>
									<td className="num">{films.map((m) => fmtMoney(m.boxOffice ?? 0)).join(" \u2192 ")}</td>
									<td className="r num">{films.map((m) => m.criticScore).join(" \u2192 ")}</td>
									<td className={`r num ${profit >= 0 ? "gain" : "loss"}`}>{fmtMoney(profit)}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</section>
	);
};
