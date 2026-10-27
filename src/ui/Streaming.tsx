import { useState } from "react";
import { streamingBlocker } from "../game/challenges";
import { fmtMoney, GENRE_LABEL } from "../game/format";
import { acceptStreamOffer, activeDeals, dealEnd, declineStreamOffer, demandStatus, freeFilms, pendingPayments, RELEASE_LABEL } from "../game/streaming";
import type { StreamResult } from "../game/streaming";
import { PLATFORMS, platformById } from "../game/streamingData";
import type { Platform } from "../game/streamingData";
import type { GameState, StreamingDeal, StreamingOffer } from "../game/types";
import { ChallengeLock } from "./Challenge";
import { MovieName } from "./MovieName";
import { StreamLogo } from "./StreamLogo";
import { useHideRatings } from "./ratingsContext";
import { bar, stanceLabel, TermsList } from "./StreamBits";

type Props = {
	state: GameState;
	onChange: (next: GameState) => void;
};

const perYears = (n: number, annual: number): string => `${fmtMoney(annual)} × ${n}`;

export const Streaming = ({ state, onChange }: Props) => {
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
	const studio = state.studios.find((s) => s.tid === state.userTid)!;
	const offers = state.streamOffers ?? [];
	const running = activeDeals(state).sort((a, b) => dealEnd(a) - dealEnd(b));
	const ended = (state.streamDeals ?? []).filter((d) => d.status === "ended").sort((a, b) => (b.endedSeason ?? 0) - (a.endedSeason ?? 0) || b.id - a.id);
	const free = freeFilms(state);

	const apply = (result: StreamResult) => {
		if (!result.ok) return setMessage({ ok: false, text: result.error });
		onChange(result.state);
		setMessage({ ok: true, text: result.message });
	};

	return (
		<div className="store nf">
			<section className="panel">
				<div className="store-head">
					<div>
						<h2 style={{ margin: 0 }}>Streaming</h2>
						<details className="fold intro"><summary>How it works</summary>
<p className="muted">
							Platforms work with you through <b>contracts</b>. The best way in is at the <b>greenlight</b>: a platform that likes your film pays part of its budget and signs a
							4-5 year deal once it is out. Each platform has its own view of cinemas, so how you release the film changes the money, the box office and the awards.
						</p>
						<p className="muted">
							A film that is already released <b>cannot be sold from this page</b>: platforms come to you with offers in the off-season. Every contract gives{" "}
							<b>perks</b> (promotion, reputation, awards campaigns, sequel bonuses, IP discounts, easier talent) and attaches <b>demands</b> (genre quotas, limits on wide
							releases, exclusivity, a reputation floor). When it ends the platform either offers to renew on different terms or the rights come back. Broken demands cost
							money and reputation, and kill the renewal.
						</p>
</details>
					</div>
					<div className="store-cash num">
						<span className="muted">Cash</span>
						<b>{fmtMoney(studio.cash)}</b>
						<span className="muted">{fmtMoney(pendingPayments(state))} in payments to come</span>
					</div>
				</div>
				<ChallengeLock reason={streamingBlocker(state)} />
				{message && <p className={message.ok ? "ok" : "error"}>{message.text}</p>}
			</section>

			{offers.length > 0 && (
				<section className="panel offers">
					<h2 style={{ marginTop: 0 }}>Offers on the table</h2>
					<p className="muted">Made this off-season. They expire when the new season starts. A renewal replaces a contract that just ran out.</p>
					{offers.map((o) => (
						<OfferRow key={o.id} state={state} offer={o} onAccept={() => apply(acceptStreamOffer(state, o.id))} onDecline={() => onChange(declineStreamOffer(state, o.id))} />
					))}
				</section>
			)}

			<section className="panel">
				<h2 style={{ marginTop: 0 }}>Your contracts</h2>
				{running.length === 0 ? (
					<p className="muted">
						No running contracts. Pick a streaming partner when you plan your next film (Studio page, Development phase), or wait for an off-season offer for a released film.
					</p>
				) : (
					<div className="deal-grid">
						{running.map((d) => (
							<DealCard key={d.id} state={state} deal={d} />
						))}
					</div>
				)}
			</section>

			<section className="panel">
				<h2 style={{ marginTop: 0 }}>Films without a contract</h2>
				{free.length === 0 ? (
					<p className="muted">Every released film of yours is under contract (or you have not released one yet).</p>
				) : (
					<>
						<p className="muted">
							These can only be sold if a platform makes an offer. They arrive in the off-season, more often for films that did well with the platform&rsquo;s kind of audience.
							Older films fetch less.
						</p>
						<div className="scroll">
							<table className="data">
								<thead>
									<tr>
										<th>Film</th>
										<th className="r">Season</th>
										<th>Genre</th>
										<th className="r">Critics</th>
										<th className="r">Audience</th>
										<th className="r">Box office</th>
									</tr>
								</thead>
								<tbody>
									{free.map((m) => (
										<tr key={m.mid}>
											<td className="wrap">
												<MovieName mid={m.mid}>{m.title}</MovieName>
											</td>
											<td className="r num">{m.season}</td>
											<td>{GENRE_LABEL[m.genre]}</td>
											<td className="r num">{m.criticScore}</td>
											<td className="r num">{m.audienceScore ?? "–"}</td>
											<td className="r num">{fmtMoney(m.boxOffice ?? 0)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}
			</section>

			<section className="nf-platforms">
				<h2 style={{ marginTop: 0 }}>The platforms</h2>
				<div className="ip-grid">
					{PLATFORMS.map((p) => (
						<PlatformCard key={p.id} platform={p} />
					))}
				</div>
			</section>

			{ended.length > 0 && (
				<section className="panel">
					<h2 style={{ marginTop: 0 }}>Past contracts</h2>
					<div className="scroll">
						<table className="data">
							<thead>
								<tr>
									<th>Film</th>
									<th>Platform</th>
									<th className="r">Ran</th>
									<th className="r">Paid in total</th>
									<th>How it ended</th>
								</tr>
							</thead>
							<tbody>
								{ended.map((d) => {
									const m = state.movies.find((x) => x.mid === d.mid);
									const p = platformById(d.platformId);
									return (
										<tr key={d.id}>
											<td className="wrap">{m ? <MovieName mid={m.mid}>{m.title}</MovieName> : "?"}</td>
											<td className="wrap">
												{p?.emoji} {p?.name}
											</td>
											<td className="r num">
												{d.firstPay}–{dealEnd(d)}
											</td>
											<td className="r num">{fmtMoney(d.paidTotal)}</td>
											<td className="wrap">{d.endNote ?? "–"}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>
			)}
		</div>
	);
};

const KIND_LABEL = { licence: "New licence", renewal: "Renewal" } as const;

const OfferRow = ({ state, offer: o, onAccept, onDecline }: { state: GameState; offer: StreamingOffer; onAccept: () => void; onDecline: () => void }) => {
	const p = platformById(o.platformId);
	const m = state.movies.find((x) => x.mid === o.mid);
	if (!p || !m) return null;
	const total = o.upfront + o.annual * o.years;
	return (
		<div className="offer-block">
			<div className="offer-row" style={{ borderTop: 0, padding: 0 }}>
				<span>
					{p.emoji} <b>{p.name}</b> · <span className="muted">{KIND_LABEL[o.kind]}</span> for <MovieName mid={m.mid}>{m.title}</MovieName>
				</span>
				<span className="slot-actions">
					<button className="btn" onClick={onAccept}>
						Accept
					</button>
					<button className="btn quiet" onClick={onDecline}>
						Decline
					</button>
				</span>
			</div>
			<div className="num">
				{o.upfront > 0 && (
					<>
						<b>{fmtMoney(o.upfront)}</b> {o.kind === "renewal" ? "renewal bonus" : "up front"} +{" "}
					</>
				)}
				<b>{fmtMoney(o.annual)}</b> a year for <b>{o.years} years</b> <span className="muted">({perYears(o.years, o.annual)}, {fmtMoney(total)} in all)</span>
			</div>
			<TermsList perks={o.perks} demands={o.demands} />
		</div>
	);
};

const DealCard = ({ state, deal: d }: { state: GameState; deal: StreamingDeal }) => {
	const p = platformById(d.platformId);
	const m = state.movies.find((x) => x.mid === d.mid);
	if (!p || !m) return null;
	const status = demandStatus(state, d);
	const end = dealEnd(d);
	const left = Math.max(0, end - Math.max(d.firstPay, state.season) + 1);
	const broken = status.some((s) => s.state === "broken");
	return (
		<div className={`deal-card ${broken ? "at-risk" : ""}`}>
			<div className="offer-row" style={{ borderTop: 0, padding: 0 }}>
				<span>
					{p.emoji} <b>{p.name}</b> · <MovieName mid={m.mid}>{m.title}</MovieName>
				</span>
				<span className="muted">
					{d.kind === "original" ? `Backed from the greenlight${m.release ? ` · ${RELEASE_LABEL[m.release]}` : ""}` : d.kind === "renewal" ? "Renewal" : "Licence"}
				</span>
			</div>
			<div className="num">
				<b>{fmtMoney(d.annual)}</b> a year · runs {d.firstPay}–{end} ({left} payment{left === 1 ? "" : "s"} left) · paid so far {fmtMoney(d.paidTotal)}
				{d.withheld > 0 && <span className="loss"> · {d.withheld} withheld</span>}
			</div>
			<div className="muted ip-note">
				The platform decides on a renewal in the {end} off-season: it offers new terms if the contract was honoured and it likes the film, otherwise the rights come back.
			</div>
			<TermsList perks={d.perks} demands={d.demands} status={status} />
			{d.festivals.length > 0 && <div className="gain">Festival prizes: {d.festivals.join("; ")}</div>}
		</div>
	);
};

/** "fit 60+", or just "a well-matched team" when ratings are hidden. */
const MinFit = ({ n }: { n: number }) => {
	const hide = useHideRatings();
	return <>{hide ? "a well-matched team" : `fit ${n}+`}</>;
};

const PlatformCard = ({ platform: p }: { platform: Platform }) => (
	<section className="panel ip-card nf-card">
		<div className="ip-top">
			<div className="ip-title">
				<StreamLogo id={p.id} name={p.name} />
				<h2>{p.name}</h2>
			</div>
			<div className="ip-price">
				<span className="muted">Wallet</span>
				<b>{bar(Math.min(1, p.scale / 1.8))}</b>
			</div>
		</div>
		<p className="ip-tagline muted">{p.tagline}</p>
		<p className="ip-note">{p.quirk}</p>
		<p className="ip-note">
			<b>{stanceLabel(p)}.</b> {p.releaseNote}
		</p>
		<dl className="ip-stats">
			<div>
				<dt>Audience reach</dt>
				<dd>{bar(p.reach)}</dd>
			</div>
			<div>
				<dt>Prestige</dt>
				<dd>{bar(p.prestige)}</dd>
			</div>
			<div>
				<dt>Backs films at greenlight</dt>
				<dd>
					rep {p.pitch.minRep}+, <MinFit n={p.pitch.minFit} />
				</dd>
			</div>
			<div>
				<dt>Favours</dt>
				<dd>{RELEASE_LABEL[p.favoured]}</dd>
			</div>
			<div>
				<dt>Judges films by</dt>
				<dd>{p.criticWeight >= 0.65 ? "Critics" : p.criticWeight <= 0.35 ? "Audience" : "Both"}</dd>
			</div>
			<div>
				<dt>Festival push</dt>
				<dd>{p.festivalPush ? bar(p.festivalPush * 2) : <span className="muted">none</span>}</dd>
			</div>
		</dl>
	</section>
);
