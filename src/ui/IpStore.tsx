import { useState } from "react";
import { ipBlocker } from "../game/challenges";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { TEAMUP_UNLOCK } from "../game/constants";
import { allIps, awardsLabel, buyBlocker, licenseOf, lockReason, propertyFilms, propertyStats, severityLabel, studioNameOf, tierLabel, universeFilms } from "../game/ip";
import type { Ip } from "../game/ipData";
import { movieProfit } from "../game/movie";
import { TRADE_QUICK_SALE, TRADE_ROUNDS } from "../game/constants";
import { acceptOffer, acceptPosition, declineOffer, ipValue, makeOffer, quickSale, rightsBlocker, sellableFranchises, talkStatus, tradableIp } from "../game/trade";
import type { SellableFranchise, TradeResult } from "../game/trade";
import { Phase } from "../game/types";
import { ChallengeLock } from "./Challenge";
import type { Deal, GameState } from "../game/types";

type Filter = "all" | "available" | "mine" | "rivals";

type Props = {
	state: GameState;
	onBuy: (ipId: string) => string | null; // returns an error message, or null when the purchase worked
	onChange: (next: GameState) => void; // a trade changed the game (rights moved, cash moved, talks moved on)
	onGoStudio: () => void;
};

type Say = (ok: boolean, text: string) => void;
type Talking = { ipId: string; side: Deal["side"] };

const flames = (heat: number): string => (heat >= 1.2 ? "🔥🔥🔥" : heat >= 0.95 ? "🔥🔥" : "🔥");
const heatLabel = (heat: number): string => (heat >= 1.2 ? "A-list" : heat >= 0.95 ? "Popular" : "Niche");
const pctBoost = (boost: number): string => `+${Math.round((boost - 1) * 100)}%`;

export const IpStore = ({ state, onBuy, onChange, onGoStudio }: Props) => {
	const [filter, setFilter] = useState<Filter>("all");
	const [confirming, setConfirming] = useState<string | null>(null);
	const [talking, setTalking] = useState<Talking | null>(null);
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
	const studio = state.studios.find((s) => s.tid === state.userTid)!;
	const owner = (ip: Ip) => licenseOf(state, ip.id);
	const catalogue = allIps(state);
	const mineCount = catalogue.filter((ip) => owner(ip)?.tid === state.userTid).length;
	const franchises = sellableFranchises(state, state.userTid);
	const offers = state.offers ?? [];
	const say: Say = (ok, text) => setMessage({ ok, text });

	// Apply the outcome of a trade: new state, and a message. A finished deal closes the negotiation.
	const apply = (result: TradeResult) => {
		if (!result.ok) return say(false, result.error);
		onChange(result.state);
		say(result.outcome !== "walk", result.message);
		if (result.outcome === "deal") setTalking(null);
	};

	const shown = catalogue.filter((ip) => {
		const lic = owner(ip);
		if (filter === "available") return !lic;
		if (filter === "mine") return lic?.tid === state.userTid;
		if (filter === "rivals") return !!lic && lic.tid !== state.userTid;
		return true;
	}).sort((a, b) => {
		// your IPs first, then by price, most prestigious first
		const mine = (ip: Ip) => (owner(ip)?.tid === state.userTid ? 1 : 0);
		return mine(b) - mine(a) || b.price - a.price;
	});

	const buy = (ip: Ip) => {
		const error = onBuy(ip.id);
		setConfirming(null);
		setMessage(error ? { ok: false, text: error } : { ok: true, text: `You now own the rights to ${ip.name}. Pick one of its heroes in the Studio page when you plan a film.` });
	};

	return (
		<div className="store">
			<section className="panel">
				<div className="store-head">
					<div>
						<h2 style={{ margin: 0 }}>IP Store</h2>
						<details className="fold intro"><summary>How it works</summary>
<p className="muted">
							Buy the film rights to a famous universe, then make movies about its heroes. A licensed film gets a <b>box-office boost</b> and a bigger opening
							weekend, but the fans arrive with <b>expectations</b>: miss the critic score they want and you get backlash, miss the box office and it
							counts as a disappointment. The bigger the name, the bigger the boost, and the higher the bar. Rights are exclusive: only one studio can own each
							IP. You pay a licence fee on top of the budget for every film.
						</p>
						<p className="muted">
							Rights can change hands. <b>Sell</b> an IP you own, <b>negotiate</b> with the rival that holds one you want, or turn your own{" "}
							<b>sequel franchise</b> into an IP and sell it. Rivals give ground over {TRADE_ROUNDS} rounds, then walk away until next season. Rights you just
							acquired cannot be flipped until next season.
						</p>
</details>
					</div>
					<div className="store-cash num">
						<span className="muted">Cash</span>
						<b>{fmtMoney(studio.cash)}</b>
						<span className="muted">
							{mineCount} IP{mineCount === 1 ? "" : "s"} owned
						</span>
					</div>
				</div>
				<div className="tabs" role="tablist" style={{ marginTop: 14, marginBottom: 0 }}>
					{(
						[
							["all", "All"],
							["available", "Available"],
							["mine", "Yours"],
							["rivals", "Owned by rivals"],
						] as const
					).map(([key, label]) => (
						<button key={key} role="tab" className="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>
							{label}
						</button>
					))}
				</div>
				<ChallengeLock reason={ipBlocker(state)} />
				{message && <p className={message.ok ? "ok" : "error"}>{message.text}</p>}
			</section>

			{offers.length > 0 && (
				<section className="panel offers">
					<h2>Offers for your IPs</h2>
					<p className="muted">Rivals made these offers this off-season. They expire when the new season starts.</p>
					{offers.map((o) => {
						const ip = tradableIp(state, o.ipId, state.userTid)?.ip;
						if (!ip) return null;
						return (
							<div key={o.id} className="offer-row">
								<span>
									<b>{studioNameOf(state, o.fromTid)}</b> offers <b className="num">{fmtMoney(o.price)}</b> for {ip.emoji} {ip.name}{" "}
									<span className="muted num">(market value {fmtMoney(ipValue(state, ip))})</span>
								</span>
								<span className="slot-actions">
									<button className="btn" onClick={() => apply(acceptOffer(state, o.id))}>
										Accept
									</button>
									<button className="btn quiet" onClick={() => onChange(declineOffer(state, o.id))}>
										Decline
									</button>
								</span>
							</div>
						);
					})}
				</section>
			)}

			{franchises.length > 0 && (
				<section className="panel">
					<h2>Your franchises</h2>
					<p className="muted">
						A chain of your own original sequels is worth money as an IP. Sell it and the buyer gets the rights to continue it (with the usual licence fee, boost and
						fan expectations built from how the series performed). You keep the cash but can no longer make sequels to it, unless you buy it back.
					</p>
					<div className="ip-grid">
						{franchises.map((f) => (
							<FranchiseCard
								key={f.fid}
								state={state}
								franchise={f}
								talking={talking?.ipId === f.ip?.id}
								onOpen={() => {
									setMessage(null);
									setTalking(f.ip ? { ipId: f.ip.id, side: "sell" } : null);
								}}
								onClose={() => setTalking(null)}
								apply={apply}
							/>
						))}
					</div>
				</section>
			)}

			{shown.length === 0 ? (
				<p className="muted">Nothing here yet.</p>
			) : (
				<div className="ip-grid">
					{shown.map((ip) => (
						<IpCard
							key={ip.id}
							ip={ip}
							state={state}
							confirming={confirming === ip.id}
							onAsk={() => {
								setMessage(null);
								setConfirming(ip.id);
							}}
							onCancel={() => setConfirming(null)}
							onConfirm={() => buy(ip)}
							onGoStudio={onGoStudio}
							talking={talking?.ipId === ip.id ? talking.side : null}
							onTalk={(side) => {
								setMessage(null);
								setTalking(side ? { ipId: ip.id, side } : null);
							}}
							apply={apply}
						/>
					))}
				</div>
			)}
		</div>
	);
};

type CardProps = {
	ip: Ip;
	state: GameState;
	confirming: boolean;
	onAsk: () => void;
	onCancel: () => void;
	onConfirm: () => void;
	onGoStudio: () => void;
	talking: Deal["side"] | null; // which negotiation is open on this card
	onTalk: (side: Deal["side"] | null) => void;
	apply: (result: TradeResult) => void;
};

const IpCard = ({ ip, state, confirming, onAsk, onCancel, onConfirm, onGoStudio, talking, onTalk, apply }: CardProps) => {
	const lic = licenseOf(state, ip.id);
	const mine = lic?.tid === state.userTid;
	const rival = !!lic && !mine;
	const blocker = lic ? null : buyBlocker(state, ip.id, state.userTid);
	const goodwill = lic?.goodwill;
	const sellBlock = mine ? rightsBlocker(state, ip, state.userTid) : null;
	const buyTalk = rival ? talkStatus(state, ip.id, lic!.tid, "buy") : null;

	const films = universeFilms(state, state.userTid, ip.id);
	const gross = films.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
	const profit = films.reduce((sum, m) => sum + movieProfit(m), 0);

	// A typical hero (heat 1.0) tells you what the universe is like.
	const typical = propertyStats(ip, { id: "", name: "", genre: "action", heat: 1 }, goodwill);
	const sorted = [...ip.properties].sort((a, b) => b.heat - a.heat);

	return (
		<section className={`panel ip-card ${mine ? "mine" : rival ? "rival" : ""}`}>
			<div className="ip-top">
				<div className="ip-title">
					<span className="ip-emoji" aria-hidden>
						{ip.emoji}
					</span>
					<div>
						<h2>{ip.name}</h2>
						<span className="badge">{ip.custom ? "Homegrown" : tierLabel(ip)}</span> <span className="badge">{severityLabel(ip.severity)} fans</span>{" "}
						{awardsLabel(ip.awardsPenalty ?? 0) && (
							<span className="badge" title={`Awards voters knock ${ip.awardsPenalty} critic points off its films in the Best Picture vote (less for director and acting)`}>
								{awardsLabel(ip.awardsPenalty ?? 0)}
							</span>
						)}
					</div>
				</div>
				<div className="ip-price num">
					<b>{fmtMoney(ip.price)}</b>
					<span className="muted">rights</span>
				</div>
			</div>
			<p className="ip-tagline muted">{ip.tagline}</p>

			<dl className="ip-stats num">
				<div>
					<dt>Box-office boost (typical hero)</dt>
					<dd className="gain">
						<b>{pctBoost(typical.boost)}</b> {mine && <span className="muted">at current goodwill</span>}
					</dd>
				</div>
				<div>
					<dt>Licence fee per film</dt>
					<dd>
						<b>{fmtMoney(ip.filmFee)}</b>
					</dd>
				</div>
				<div>
					<dt>Fans expect critics</dt>
					<dd>
						<b>{typical.expectCritic}+</b>
					</dd>
				</div>
				<div>
					<dt>Fans expect box office</dt>
					<dd>
						<b>{fmtMoney(typical.expectGross)}+</b>
					</dd>
				</div>
			</dl>

			{mine && goodwill !== undefined && (
				<div>
					<div className="race-row" style={{ fontSize: 13 }}>
						<span className="muted">Fan goodwill</span>
						<span className="num">{Math.round(goodwill)} / 100</span>
					</div>
					<div className="meter gw" role="img" aria-label={`Fan goodwill ${Math.round(goodwill)} out of 100`}>
						<span style={{ width: `${goodwill}%` }} />
					</div>
					<p className="muted ip-note" style={{ marginTop: 6 }}>
						{films.length === 0
							? "No films yet. Hits raise goodwill and with it the boost; flops and backlash lower it."
							: `${films.length} film${films.length > 1 ? "s" : ""} so far, ${fmtMoney(gross)} box office, `}
						{films.length > 0 && <span className={profit >= 0 ? "gain" : "loss"}>{fmtMoney(profit)} profit</span>}
						{films.length > 0 && "."}
					</p>
				</div>
			)}

			<div className="ip-actions">
				{mine ? (
					<>
						<span className="badge gold">★ You own the rights</span>
						{state.phase === Phase.DEVELOPMENT && (
							<button className="btn quiet" onClick={onGoStudio}>
								Plan a film
							</button>
						)}
						<button className="btn quiet" disabled={sellBlock !== null} onClick={() => onTalk(talking === "sell" ? null : "sell")}>
							{talking === "sell" ? "Close talks" : "Sell rights…"}
						</button>
						{sellBlock && <span className="muted ip-note">{sellBlock}</span>}
					</>
				) : rival ? (
					<>
						<span className="badge rep">Owned by {studioNameOf(state, lic!.tid)}</span>
						<button className="btn quiet" disabled={buyTalk?.status === "closed"} onClick={() => onTalk(talking === "buy" ? null : "buy")}>
							{talking === "buy" ? "Close talks" : "Negotiate to buy…"}
						</button>
						{buyTalk?.status === "closed" && <span className="muted ip-note">{buyTalk.reason}</span>}
					</>
				) : confirming ? (
					<>
						<button className="btn" onClick={onConfirm}>
							Confirm: pay {fmtMoney(ip.price)}
						</button>
						<button className="btn quiet" onClick={onCancel}>
							Cancel
						</button>
					</>
				) : (
					<>
						<button className="btn" disabled={blocker !== null} onClick={onAsk}>
							Buy rights
						</button>
						{blocker && <span className="muted ip-note">{blocker}</span>}
					</>
				)}
			</div>

			{talking && <Negotiation state={state} ip={ip} side={talking} apply={apply} onClose={() => onTalk(null)} />}

			<details className="ip-details">
				<summary>
					{ip.custom ? "The franchise" : `${ip.properties.length} heroes & stories`}
				</summary>
				<div className="scroll ip-props">
					<table className="data">
						<thead>
							<tr>
								<th>Property</th>
								<th>Pull</th>
								<th className="r">Boost</th>
								<th className="r">Fee</th>
								<th className="r">Critics</th>
								<th className="r">Films</th>
							</tr>
						</thead>
						<tbody>
							{sorted.map((prop) => {
								const stats = propertyStats(ip, prop, goodwill);
								const made = propertyFilms(state, state.userTid, prop.id).length;
								const locked = lockReason(state, state.userTid, ip, prop);
								return (
									<tr key={prop.id} title={locked ?? undefined}>
										<td className={`wrap ${locked && mine ? "locked" : ""}`}>
											{prop.name}
											{prop.teamUp && (
												<span className="tag" title={`Crossover event: unlocks after ${TEAMUP_UNLOCK} different heroes have had a film`}>
													{mine && !locked ? "Crossover" : "🔒 Crossover"}
												</span>
											)}{" "}
											<span className="muted">{GENRE_LABEL[prop.genre]}</span>
										</td>
										<td title={heatLabel(prop.heat)}>{flames(prop.heat)}</td>
										<td className="r num gain">{pctBoost(stats.boost)}</td>
										<td className="r num">{fmtMoney(stats.fee)}</td>
										<td className="r num">{stats.expectCritic}+</td>
										<td className="r num">{made > 0 ? made : <span className="muted">&ndash;</span>}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<p className="muted fine">
					Famous heroes pull bigger crowds but cost more and come with higher expectations. Make a hero&rsquo;s film again and it becomes a sequel, with the usual
					franchise effects. Crossover events unlock once {TEAMUP_UNLOCK} different heroes have had a film.
				</p>
			</details>
		</section>
	);
};

// ── trading ──────────────────────────────────────────────────

const toK = (millions: string): number => Math.round((Number(millions) || 0) * 1000);

type NegotiationProps = {
	state: GameState;
	ip: Ip;
	side: Deal["side"];
	apply: (result: TradeResult) => void;
	onClose: () => void;
};

/**
 * Talks with the rivals about one IP. side "sell": every rival that could buy it makes you an offer.
 * side "buy": the rival that owns it names its price. You can take the price on the table or answer with your own.
 */
const Negotiation = ({ state, ip, side, apply, onClose }: NegotiationProps) => {
	const [prices, setPrices] = useState<Record<number, string>>({});
	const [confirmQuick, setConfirmQuick] = useState(false);
	const lic = licenseOf(state, ip.id);
	const rivals = state.studios.filter((s) => s.tid !== state.userTid && (side === "sell" ? s.tid !== lic?.tid : s.tid === lic?.tid));
	const talks = rivals.map((r) => ({ studio: r, talk: talkStatus(state, ip.id, r.tid, side) }));
	const open = talks.filter((t) => t.talk.status === "open");
	const value = ipValue(state, ip);
	const quickPrice = Math.round((value * TRADE_QUICK_SALE) / 500) * 500;
	const verb = side === "sell" ? "Ask" : "Offer";

	return (
		<div className="deal-panel">
			<div className="deal-head">
				<b>{side === "sell" ? `Sell ${ip.name}` : `Buy ${ip.name}`}</b>
				<span className="muted num">
					Market value {fmtMoney(value)}
					{lic && <> &middot; fan goodwill {Math.round(lic.goodwill)}</>}
				</span>
				<button className="btn quiet" onClick={onClose}>
					Close
				</button>
			</div>
			<p className="muted ip-note">
				{side === "sell"
					? `Each rival shows the most it would pay this round. Ask for less to close, or push for more: they raise their offer after every miss, and walk away after ${TRADE_ROUNDS} rounds. A ridiculous ask costs you a round and moves them nowhere.`
					: `The rival shows its asking price this round. Pay it, or make a lower offer: it comes down after every miss, and walks away after ${TRADE_ROUNDS} rounds. A lowball costs you a round and moves it nowhere.`}
			</p>
			{talks.length === 0 && <p className="muted">No studio to talk to.</p>}
			{talks.map(({ studio, talk }) => (
				<div key={studio.tid} className="deal-row">
					<div className="deal-who">
						<b>{studio.name}</b> <span className="muted num">cash {fmtMoney(studio.cash)}</span>
					</div>
					{talk.status === "closed" ? (
						<span className="muted ip-note">{talk.reason}</span>
					) : (
						<div className="deal-offer">
							<span className="num">
								{side === "sell" ? "Would pay up to" : "Asking"} <b>{fmtMoney(talk.position!)}</b>{" "}
								<span className="muted">
									(round {talk.round} of {TRADE_ROUNDS})
								</span>
							</span>
							<span className="slot-actions">
								<button className="btn" onClick={() => apply(acceptPosition(state, ip.id, studio.tid, side))}>
									{side === "sell" ? "Take" : "Pay"} {fmtMoney(talk.position!)}
								</button>
								<label className="deal-input">
									<span className="muted">or {verb.toLowerCase()} $</span>
									<input
										type="number"
										min={0}
										step={0.5}
										placeholder={String(Math.round(talk.position! / 100) / 10)}
										value={prices[studio.tid] ?? ""}
										onChange={(e) => setPrices((p) => ({ ...p, [studio.tid]: e.target.value }))}
									/>
									<span className="muted">M</span>
								</label>
								<button
									className="btn quiet"
									disabled={toK(prices[studio.tid] ?? "") <= 0}
									onClick={() => apply(makeOffer(state, ip.id, studio.tid, side, toK(prices[studio.tid] ?? "")))}
								>
									{verb}
								</button>
							</span>
						</div>
					)}
				</div>
			))}
			{side === "sell" && (
				<div className="deal-quick">
					{confirmQuick ? (
						<>
							<button
								className="btn"
								onClick={() => {
									setConfirmQuick(false);
									apply(quickSale(state, ip.id));
								}}
							>
								Confirm: sell now for {fmtMoney(quickPrice)}
							</button>
							<button className="btn quiet" onClick={() => setConfirmQuick(false)}>
								Cancel
							</button>
						</>
					) : (
						<>
							<button className="btn quiet" disabled={open.length === 0 && talks.length === 0} onClick={() => setConfirmQuick(true)}>
								Quick sale: {fmtMoney(quickPrice)}
							</button>
							<span className="muted ip-note">
								Sells immediately for {Math.round(TRADE_QUICK_SALE * 100)}% of the market value to the richest rival that can pay. No haggling, no waiting.
							</span>
						</>
					)}
				</div>
			)}
		</div>
	);
};

type FranchiseCardProps = {
	state: GameState;
	franchise: SellableFranchise;
	talking: boolean;
	onOpen: () => void;
	onClose: () => void;
	apply: (result: TradeResult) => void;
};

/** One of your own sequel franchises that could be sold as an IP. */
const FranchiseCard = ({ state, franchise, talking, onOpen, onClose, apply }: FranchiseCardProps) => {
	const { ip, films, blocker } = franchise;
	const released = films.filter((m) => m.boxOffice !== undefined);
	const gross = released.reduce((sum, m) => sum + (m.boxOffice ?? 0), 0);
	const critic = released.length ? Math.round(released.reduce((sum, m) => sum + (m.criticScore ?? 0), 0) / released.length) : 0;
	const profit = released.reduce((sum, m) => sum + movieProfit(m), 0);
	const found = ip ? tradableIp(state, ip.id, state.userTid) : null;
	return (
		<section className="panel ip-card mine">
			<div className="ip-top">
				<div className="ip-title">
					<span className="ip-emoji" aria-hidden>
						🎞️
					</span>
					<div>
						<h2>{franchise.name}</h2>
						<span className="badge">Your franchise</span> <span className="badge">{films.length} films</span>
					</div>
				</div>
				<div className="ip-price num">
					<b>{ip ? fmtMoney(ip.price) : "–"}</b>
					<span className="muted">as an IP</span>
				</div>
			</div>
			<dl className="ip-stats num">
				<div>
					<dt>Box office so far</dt>
					<dd>
						<b>{fmtMoney(gross)}</b>
					</dd>
				</div>
				<div>
					<dt>Average critics</dt>
					<dd>
						<b>{critic}</b>
					</dd>
				</div>
				<div>
					<dt>Profit so far</dt>
					<dd className={profit >= 0 ? "gain" : "loss"}>
						<b>{fmtMoney(profit)}</b>
					</dd>
				</div>
				{ip && (
					<div>
						<dt>Buyer would get</dt>
						<dd>
							<b>+{Math.round((ip.boost - 1) * 100)}%</b> boost, fee {fmtMoney(ip.filmFee)}
						</dd>
					</div>
				)}
			</dl>
			<div className="ip-actions">
				<button className="btn" disabled={blocker !== null || !found} onClick={talking ? onClose : onOpen}>
					{talking ? "Close talks" : "Sell as an IP…"}
				</button>
				{blocker && <span className="muted ip-note">{blocker}</span>}
			</div>
			{talking && ip && <Negotiation state={state} ip={ip} side="sell" apply={apply} onClose={onClose} />}
		</section>
	);
};
