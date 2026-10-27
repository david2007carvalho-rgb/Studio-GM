import { RELEASE_LABEL } from "../game/streaming";
import { platformById } from "../game/streamingData";
import { useEffect } from "react";
import { splitCast } from "../game/cast";
import { FREE_AGENT, RETIRED } from "../game/constants";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { franchiseName, installmentOf } from "../game/franchise";
import { ipById, propertyById } from "../game/ip";
import { filmPage } from "../game/legacy";
import { movieCost, movieProfit } from "../game/movie";
import { brandById } from "../game/brandData";
import type { GameState, Movie } from "../game/types";
import { MovieName } from "./MovieName";
import { isKnown } from "../game/traits";
import { STYLES } from "../game/scripts";
import { PersonName } from "./PersonName";
import { TraitChip } from "./TraitChips";

const dash = <span className="muted">&ndash;</span>;
const pct = (x: number): string => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;
const ordinal = (n: number): string => {
	const r = n % 100;
	if (r >= 11 && r <= 13) return `${n}th`;
	return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
};

/** Pop-up with one film's page: money, opening weekend, cast, director, awards and franchise. */
export const MovieProfile = ({ state, mid, onClose }: { state: GameState; mid: number; onClose: () => void }) => {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const movie: Movie | undefined = state.movies.find((m) => m.mid === mid);
	if (!movie) return null;

	const person = (pid: number) => state.people.find((p) => p.pid === pid);
	const director = person(movie.directorPid);
	const { leads, supporting } = splitCast(movie);
	const studio = state.studios.find((s) => s.tid === movie.tid);
	const released = movie.boxOffice !== undefined;
	const page = filmPage(state, movie);
	const cost = movieCost(movie);
	const profit = released ? movieProfit(movie) : 0;
	const roi = cost > 0 ? profit / cost : 0;
	const ip = movie.ipId ? ipById(state, movie.ipId) : undefined;
	const prop = movie.propertyId ? propertyById(state, movie.propertyId)?.prop : undefined;
	const res = movie.ipResult;
	const openingShare = movie.opening !== undefined && (movie.boxOffice ?? 0) > 0 ? movie.opening / (movie.boxOffice ?? 1) : null;
	const prequel = movie.prequelMid !== undefined ? state.movies.find((m) => m.mid === movie.prequelMid) : undefined;
	const ceremony = state.awards.find((a) => a.season === movie.season);
	const status = !released ? "In production" : `Released ${movie.season}`;

	const castRow = (pid: number) => {
		const p = person(pid);
		if (!p) return null;
		const ret = p.tid === RETIRED ? "retired" : p.tid === FREE_AGENT ? "free agent" : "";
		return (
			<li key={pid}>
				<PersonName person={p} awards={state.awards} /> <span className="muted">{p.gender === "female" ? "actress" : "actor"}{ret && ` · ${ret}`}</span>
			</li>
		);
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<section className="panel modal" role="dialog" aria-modal="true" aria-label={movie.title} onClick={(e) => e.stopPropagation()}>
				<div className="modal-head">
					<div>
						<h2>
							{movie.title} {page.wins > 0 && <span className="gold">🏆{page.wins}</span>}
							{installmentOf(movie) > 1 && <span className="tag">Part {installmentOf(movie)}</span>}
							{ip && (
								<span className="tag ip-tag" title={`Licensed ${ip.name} film`}>
									{ip.emoji} {ip.name}
								</span>
							)}
						</h2>
						<div className="modal-sub">
							<span>{GENRE_LABEL[movie.genre]}</span>
							<span className="sep">·</span>
							<span>{status}</span>
							<span className="sep">·</span>
							<span>{studio?.name ?? "?"}</span>
							{movie.tid === state.userTid && (
								<>
									<span className="sep">·</span>
									<b className="gold">Your studio</b>
								</>
							)}
						</div>
					</div>
					<button className="imdb-close" onClick={onClose}>
						<span aria-hidden>✕</span> Close
					</button>
				</div>

				<h3>Money</h3>
				<dl className="kv">
					<dt>Box office</dt>
					<dd>{released ? <b>{fmtMoney(movie.boxOffice ?? 0)}</b> : dash}</dd>
					<dt>Opening weekend</dt>
					<dd>
						{movie.opening !== undefined ? (
							<>
								<b>{fmtMoney(movie.opening)}</b>
								{openingShare !== null && <span className="muted"> ({Math.round(openingShare * 100)}% of the total)</span>}
							</>
						) : released ? (
							<span className="muted" title="This film was released in a save made before openings were recorded">not recorded</span>
						) : (
							dash
						)}
					</dd>
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
								{movie.brandFx && <span className="muted"> &middot; <span className="loss">{movie.brandFx.critic} critics</span>, <span className="gain">+{Math.round((movie.brandFx.gross - 1) * 1000) / 10}% gross</span></span>}
								{movie.brandBonus ? <span className={movie.brandBonus > 0 ? "gain" : "loss"}> &middot; {movie.brandBonus > 0 ? "hit bonus" : "make-good"} {fmtMoney(movie.brandBonus)}</span> : null}
							</dd>
						</>
					)}
					{movie.brandFx && movie.brandFx.heat > 1 && (
						<>
							<dt>Franchise heat</dt>
							<dd className="gain">+{Math.round((movie.brandFx.heat - 1) * 1000) / 10}% gross from merchandise, games and TV</dd>
						</>
					)}
				<dt>Total cost</dt>
					<dd>{fmtMoney(cost)}</dd>
					<dt>Profit</dt>
					<dd className={released ? (profit >= 0 ? "gain" : "loss") : ""}>
						{released ? (
							<>
								<b>{fmtMoney(profit)}</b> <span className="muted">({pct(roi)} on cost)</span>
							</>
						) : (
							dash
						)}
					</dd>
				</dl>

				<h3>Reception</h3>
				<dl className="kv">
					<dt>Critics&rsquo; score</dt>
					<dd>{movie.criticScore !== undefined ? <b>{movie.criticScore}</b> : dash}</dd>
					<dt>Audience score</dt>
					<dd>{movie.audienceScore !== undefined ? <b>{movie.audienceScore}</b> : dash}</dd>
					<dt>Production quality</dt>
					<dd>{movie.productionQuality ?? dash}</dd>
					<dt>Post-production quality</dt>
					<dd>{movie.postQuality ?? dash}</dd>
					{page.ranks && (
						<>
							<dt>Box office rank</dt>
							<dd>
								{ordinal(page.ranks.seasonBoxOffice)} of {page.ranks.seasonOf} in {movie.season} &middot; {ordinal(page.ranks.boxOffice)} of {page.ranks.of} ever
							</dd>
							<dt>Critics&rsquo; rank</dt>
							<dd>{ordinal(page.ranks.critics)} of {page.ranks.of} ever</dd>
							{page.ranks.opening !== null && (
								<>
									<dt>Opening weekend rank</dt>
									<dd>{ordinal(page.ranks.opening)} ever</dd>
								</>
							)}
						</>
					)}
				</dl>

				<h3>Director and cast</h3>
				<ul className="plain">
					<li>
						{director ? <PersonName person={director} awards={state.awards} /> : "?"} <span className="muted">director</span>
					</li>
					{leads.map(castRow)}
					{supporting.length > 0 && (
						<li className="muted" style={{ marginTop: 6 }}>
							Supporting
						</li>
					)}
					{supporting.map(castRow)}
				</ul>

				{(movie.tension?.length ?? 0) > 0 && (
					<>
						<h3>Feuds and friendships</h3>
						<ul className="drama-list">
							{movie.tension!.map((t) => (
								<li key={`${t.a}-${t.b}`} className={t.kind === "feud" ? "hurt" : "helped"}>
									<b>{person(t.a)?.name ?? "?"}</b> and <b>{person(t.b)?.name ?? "?"}</b> <span className="muted">({t.kind === "feud" ? "feud" : "frenemies"})</span>
									<div className="muted fine">{t.prod > 0 ? "+" : "−"}{Math.abs(t.prod)} production quality</div>
								</li>
							))}
						</ul>
					</>
				)}

				{(movie.drama?.length ?? 0) > 0 && (
					<>
						<h3>Behind the scenes</h3>
						<ul className="drama-list">
							{movie.drama!.map((d, i) => (
								<li key={i} className={d.effect}>
									<b>{d.label}</b> <span className="muted">({d.stage === "production" ? "shoot" : d.stage === "post" ? "post-production" : "release"})</span>
									<div>{d.note}</div>
									{d.who !== undefined && d.trait && isKnown(person(d.who) ?? {}, d.trait!) && (
										<div className="fine">
											{person(d.who)?.name}: <TraitChip id={d.trait} />
										</div>
									)}
									<div className="muted fine">
										{[
											d.prod && `${d.prod > 0 ? "+" : "−"}${Math.abs(Math.round(d.prod))} production quality`,
											d.post && `${d.post > 0 ? "+" : "−"}${Math.abs(Math.round(d.post))} post-production quality`,
											d.cost && `+${fmtMoney(Math.round((movie.budget / (1 + d.cost)) * d.cost))} cost`,
											d.gross && `${d.gross > 1 ? "+" : "−"}${Math.abs(Math.round((d.gross - 1) * 100))}% box office`,
											d.critic && `${d.critic > 0 ? "+" : "−"}${Math.abs(d.critic)} critics`,
										].filter(Boolean).join(" · ") || "No effect on the film"}
									</div>
								</li>
							))}
						</ul>
					</>
				)}

				<h3>Awards and nominations</h3>
				{page.awards.length === 0 ? (
					<p className="muted" style={{ margin: 0 }}>
						{!released ? "Not released yet." : !ceremony ? `The ${movie.season} awards have not been held yet.` : "No awards or nominations."}
					</p>
				) : (
					<ul className="plain aw-list">
						{page.awards.map((a) => (
							<li key={`${a.award}-${a.name}`} className="aw-row">
								<span>{a.award}</span>
								{a.won ? <b className="aw-won">Won</b> : <b className="aw-nom">Nominated</b>}
								{a.pid !== undefined && <span className="muted">&ndash; {a.name}</span>}
							</li>
						))}
					</ul>
				)}
				{released && ceremony && !page.hasNomData && (
					<p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
						Nominations are recorded from the first ceremony in this version on; older seasons only list wins.
					</p>
				)}

				{(prequel || page.sequels.length > 0) && (
					<>
						<h3>Franchise: {franchiseName(state, movie)}</h3>
						<ul className="plain">
							{page.sequels.map((m) => (
								<li key={m.mid} className={m.mid === movie.mid ? "mine" : ""}>
									<span className="num muted">{m.season}</span>{" "}
									{m.mid === movie.mid ? <b>{m.title}</b> : <MovieName mid={m.mid}>{m.title}</MovieName>}
									<span className="tag">Part {installmentOf(m)}</span>{" "}
									<span className="muted">
										{m.boxOffice !== undefined ? `${fmtMoney(m.boxOffice)} · critics ${m.criticScore}` : "in production"}
									</span>
								</li>
							))}
						</ul>
						{released && movie.standaloneBoxOffice !== undefined && movie.standaloneCritic !== undefined && (
							<dl className="kv">
								<dt>Franchise effect on box office</dt>
								<dd>
									{fmtMoney(movie.standaloneBoxOffice)} standalone &rarr; {fmtMoney(movie.boxOffice ?? 0)} ({pct((movie.boxOffice ?? 0) / Math.max(movie.standaloneBoxOffice, 1) - 1)})
								</dd>
								<dt>Franchise effect on critics</dt>
								<dd>
									{movie.standaloneCritic} standalone &rarr; {movie.criticScore}
								</dd>
								{movie.continuity !== undefined && (
									<>
										<dt>Returning crew</dt>
										<dd>{Math.round(movie.continuity * 100)}%</dd>
									</>
								)}
							</dl>
						)}
					</>
				)}

				{(ip || (movie.chemistry ?? 0) > 0 || movie.directorPitchId !== undefined) && (
					<>
						<h3>More info</h3>
						<dl className="kv">
							{ip && (
								<>
									<dt>Licensed property</dt>
									<dd>
										{ip.emoji} {ip.name}
										{prop && <> &middot; {prop.name}</>}
									</dd>
								</>
							)}
							{ip && (ip.awardsPenalty ?? 0) > 0 && (
								<>
									<dt>Awards voters&rsquo; discount</dt>
									<dd className="loss" title="Critic points knocked off this film in the Best Picture vote; 60% of it for Best Director, 40% for the acting awards">
										&minus;{ip.awardsPenalty} in the Best Picture vote
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
								</>
							)}
							{movie.directorPitchId !== undefined && (
								<>
									<dt>Origin</dt>
									<dd className={movie.passedPitch ? "loss" : undefined}>
										{movie.passedPitch ? "The one that got away: the director pitched it to you and you passed" : "Pitched by its director and funded by this studio"}
									</dd>
								</>
							)}
							{(movie.chemistry ?? 0) > 0 && (
								<>
									<dt>Chemistry bonus (returning duos)</dt>
									<dd>+{movie.chemistry!.toFixed(1)} production quality</dd>
								</>
							)}
						</dl>
					</>
				)}
			</section>
		</div>
	);
};
