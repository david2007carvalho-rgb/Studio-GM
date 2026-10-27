import { useState } from "react";
import { brandById, BRANDS, CATEGORY_LABEL, KIND_LABEL } from "../game/brandData";
import type { Brand } from "../game/brandData";
import { acceptBrandOffer, activeDeals, declineBrandOffer, expectedIncome, hotFranchises, minRep, pendingOffers, relOf, totalEarned } from "../game/brands";
import type { BrandResult } from "../game/brands";
import { setBrandDealsOn } from "../game/features";
import { fmtMoney } from "../game/format";
import type { BrandDeal, BrandOffer, GameState } from "../game/types";
import { BrandLogo } from "./BrandLogo";
import { MovieName } from "./MovieName";
import { useBrandDeals } from "./useBrandDeals";

type Props = { state: GameState; onChange: (next: GameState) => void };

const KIND_ICON = { studio: "🤝", merch: "🧸", game: "🎮", tv: "📺" } as const;
const KIND_NAME = { studio: "Studio partner", merch: "Merchandise", game: "Video game", tv: "TV series" } as const;

const termsText = (o: BrandOffer): string => {
	if (o.kind === "studio") return `${fmtMoney(o.upfront)} now, then ${fmtMoney(o.annual)} a year for ${o.years} years. Locks the ${CATEGORY_LABEL[brandById(o.brandId)!.category].toLowerCase()} category.`;
	if (o.kind === "merch") return `${fmtMoney(o.upfront)} now, then about ${fmtMoney(o.annual)} in royalties in year one, fading over ${o.years} years.`;
	if (o.kind === "game") return `${fmtMoney(o.upfront)} now. Released next off-season: royalties of about ${fmtMoney(o.annual)}, from a flop to double that, depending on the reviews.`;
	return `${fmtMoney(o.upfront)} now, then ${fmtMoney(o.annual)} a season for ${o.years} season${o.years > 1 ? "s" : ""}. A hit is renewed, a flop is cancelled.`;
};

export const Brands = ({ state, onChange }: Props) => {
	const { on, opts } = useBrandDeals();
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
	const studio = state.studios.find((s) => s.tid === state.userTid)!;
	const offers = pendingOffers(state);
	const running = activeDeals(state);
	const ended = (state.brandDeals ?? []).filter((d) => d.status === "ended").sort((a, b) => (b.endedSeason ?? 0) - (a.endedSeason ?? 0) || b.id - a.id);
	const sponsored = state.movies.filter((m) => m.tid === state.userTid && m.brands?.length).sort((a, b) => b.season - a.season);
	const hot = hotFranchises(state);
	const [dir, setDir] = useState<"all" | Brand["category"]>("all");

	const apply = (r: BrandResult) => {
		if (!r.ok) return setMessage({ ok: false, text: r.error });
		onChange(r.state);
		setMessage({ ok: true, text: r.message });
	};
	const directory = BRANDS.filter((b) => (b.category !== "alcohol" || opts.alcohol) && (dir === "all" || b.category === dir));
	const categories = [...new Set(BRANDS.filter((b) => b.category !== "alcohol" || opts.alcohol).map((b) => b.category))];

	return (
		<div className="store bd">
			<section className="panel">
				<div className="store-head">
					<div>
						<h2 style={{ margin: 0 }}>Brands</h2>
						<details className="fold intro">
							<summary>How it works</summary>
							<p className="muted">
								<b>At the greenlight</b> (Studio page, Development) pick a <b>presenting sponsor</b> and up to three <b>product placements</b>. They pay part of the cost up front, bring their own ad campaigns (a bigger gross), and cost critic
								points. A hit pays a bonus; a flop owes a make-good. Brands remember how your films did: a good relationship means better fees, a bad one means they stop calling.
							</p>
							<p className="muted">
								<b>After a hit</b>, brands make offers in the off-season: toy companies want <b>action figures</b>, publishers a <b>video game</b>, streaming services a <b>TV spin-off</b>. Each one pays now, pays later, and heats up the
								franchise, which gives its next <b>sequel</b> up to +10% gross. A flop game or a cancelled show cools it down. Famous studios also get yearly <b>studio partnerships</b> that lock a category.
							</p>
						</details>
						<label className="bd-switch">
							<input type="checkbox" checked={on} onChange={(e) => setBrandDealsOn(e.target.checked)} /> Brand Deals {on ? "on" : "off"}
							<span className="muted"> · fees: {opts.fees}{opts.alcohol ? "" : " · no beer and spirits"} (set in the Studio GM Toolkit)</span>
						</label>
					</div>
					<div className="store-cash num">
						<span className="muted">Cash</span>
						<b>{fmtMoney(studio.cash)}</b>
						<span className="muted">{fmtMoney(totalEarned(state))} earned from brands · about {fmtMoney(expectedIncome(state))} to come</span>
					</div>
				</div>
				{!on && <p className="muted">Switched off: no new offers and no sponsors at the greenlight. Deals you already signed keep running.</p>}
				{message && <p className={message.ok ? "ok" : "error"}>{message.text}</p>}
			</section>

			{offers.length > 0 && (
				<section className="panel offers">
					<h2 style={{ marginTop: 0 }}>Offers on the table</h2>
					<p className="muted">Made after the awards. They expire when the new season starts.</p>
					{offers.map((o) => {
						const b = brandById(o.brandId);
						if (!b) return null;
						return (
							<div className="bd-offer" key={o.id}>
								<BrandLogo brand={b} />
								<div className="bd-offer-main">
									<b>
										{KIND_ICON[o.kind]} {b.name}
									</b>{" "}
									<span className="muted">· {KIND_NAME[o.kind]}</span>
									<div>{o.mid !== undefined ? <MovieName mid={o.mid}>{o.title}</MovieName> : o.title}</div>
									<div className="muted">{termsText(o)}</div>
								</div>
								<span className="slot-actions">
									<button className="btn" onClick={() => apply(acceptBrandOffer(state, o.id))}>
										Accept
									</button>
									<button className="btn quiet" onClick={() => onChange(declineBrandOffer(state, o.id))}>
										Decline
									</button>
								</span>
							</div>
						);
					})}
				</section>
			)}

			<section className="panel">
				<h2 style={{ marginTop: 0 }}>Your deals</h2>
				{running.length === 0 ? (
					<p className="muted">Nothing running. After a hit, brands make offers in the off-season. Merchandise needs a family-friendly hit, games an action-adventure one, TV a well-reviewed one.</p>
				) : (
					<div className="deal-grid">
						{running.map((d) => (
							<DealCard key={d.id} deal={d} />
						))}
					</div>
				)}
			</section>

			{hot.length > 0 && (
				<section className="panel">
					<h2 style={{ marginTop: 0 }}>Hot franchises</h2>
					<p className="muted">Merchandise, games and TV shows keep a franchise in the public eye. Heat fades 10% a year and adds up to +{10}% to the gross of the next sequel.</p>
					<div className="bd-heat">
						{hot.map((f) => (
							<div key={f.fid} className="bd-heat-row">
								<MovieName mid={f.fid}>{f.title}</MovieName>
								<span className="bd-bar">
									<i style={{ width: `${Math.min(100, f.heat)}%` }} />
								</span>
								<span className="num">{Math.round(f.heat)}</span>
							</div>
						))}
					</div>
				</section>
			)}

			{sponsored.length > 0 && (
				<section className="panel">
					<h2 style={{ marginTop: 0 }}>Sponsored films</h2>
					<div className="scroll">
						<table className="data">
							<thead>
								<tr>
									<th>Film</th>
									<th>Brands</th>
									<th className="r">Paid</th>
									<th className="r">Critics</th>
									<th className="r">Gross</th>
									<th className="r">Settlement</th>
								</tr>
							</thead>
							<tbody>
								{sponsored.map((m) => (
									<tr key={m.mid}>
										<td className="wrap">
											<MovieName mid={m.mid}>{m.title}</MovieName> <span className="muted">{m.season}</span>
										</td>
										<td className="wrap">
											{m.brands!.map((p) => (
												<span key={p.brandId} className="bd-chip">
													{brandById(p.brandId)?.name}
													{p.tier === "sponsor" ? " ★" : ""}
												</span>
											))}
										</td>
										<td className="r num">{fmtMoney(m.brandFunding ?? 0)}</td>
										<td className="r num loss">{m.brandFx ? m.brandFx.critic : "–"}</td>
										<td className="r num gain">{m.brandFx ? `+${Math.round((m.brandFx.gross - 1) * 1000) / 10}%` : "–"}</td>
										<td className={`r num ${(m.brandBonus ?? 0) > 0 ? "gain" : (m.brandBonus ?? 0) < 0 ? "loss" : ""}`}>{m.brandBonus === undefined ? "–" : fmtMoney(m.brandBonus)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}

			<section className="panel">
				<div className="bd-dir-head">
					<h2 style={{ margin: 0 }}>The brands</h2>
					<select value={dir} onChange={(e) => setDir(e.target.value as typeof dir)} aria-label="Category">
						<option value="all">All categories</option>
						{categories.map((c) => (
							<option key={c} value={c}>
								{CATEGORY_LABEL[c]}
							</option>
						))}
					</select>
				</div>
				<div className="ip-grid bd-grid">
					{directory.map((b) => {
						const rel = Math.round(relOf(state, b.id));
						const locked = studio.reputation < minRep(b);
						return (
							<div key={b.id} className={`ip-card bd-card ${locked ? "off" : ""}`}>
								<div className="bd-card-top">
									<BrandLogo brand={b} size={38} />
									<div>
										<b>{b.name}</b>
										<div className="muted fine">
											{CATEGORY_LABEL[b.category]} · {"★".repeat(b.prestige)}
										</div>
									</div>
								</div>
								<p className="muted fine">{b.line}</p>
								<div className="fine">{b.kinds.map((k) => KIND_LABEL[k]).join(" · ")}</div>
								<div className="fine muted">
									Likes {b.loves.length ? b.loves.join(", ") : "anything"}
									{b.avoids.length > 0 && <> · avoids {b.avoids.join(", ")}</>}
								</div>
								<div className="fine">
									<span className="muted">Wants reputation {minRep(b)}+ · feels </span>
									<b className={rel >= 60 ? "gain" : rel < 30 ? "loss" : ""}>{rel}</b>
									<span className="muted"> about you</span>
								</div>
							</div>
						);
					})}
				</div>
			</section>

			{ended.length > 0 && (
				<section className="panel">
					<h2 style={{ marginTop: 0 }}>Past deals</h2>
					<div className="scroll">
						<table className="data">
							<thead>
								<tr>
									<th>Deal</th>
									<th>Brand</th>
									<th className="r">Paid in total</th>
									<th>How it ended</th>
								</tr>
							</thead>
							<tbody>
								{ended.map((d) => (
									<tr key={d.id}>
										<td className="wrap">
											{KIND_ICON[d.kind]} {d.title}
										</td>
										<td className="wrap">{brandById(d.brandId)?.name}</td>
										<td className="r num">{fmtMoney(d.paid)}</td>
										<td className="wrap">{d.endNote ?? "–"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}
		</div>
	);
};

const DealCard = ({ deal: d }: { deal: BrandDeal }) => {
	const b = brandById(d.brandId);
	if (!b) return null;
	return (
		<div className="deal-card">
			<div className="bd-card-top">
				<BrandLogo brand={b} />
				<div>
					<b>
						{KIND_ICON[d.kind]} {b.name}
					</b>
					<div className="muted fine">{KIND_NAME[d.kind]} · since {d.signed}</div>
				</div>
			</div>
			<div>{d.mid !== undefined ? <MovieName mid={d.mid}>{d.title}</MovieName> : d.title}</div>
			<div className="fine muted">{termsText(d)}</div>
			<div className="fine">
				Paid so far <b>{fmtMoney(d.paid)}</b>
				{d.quality !== undefined && (
					<>
						{" "}
						· score <b>{d.quality}</b>
					</>
				)}
			</div>
			{d.log.length > 1 && <div className="fine muted">{d.log[d.log.length - 1]}</div>}
		</div>
	);
};
