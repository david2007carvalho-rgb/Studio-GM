import { useState } from "react";
import { DIRECTOR_PITCH_ROUNDS } from "../game/constants";
import { fitFor, pitchPreview, temperament } from "../game/directorPitches";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { ovr } from "../game/ovr";
import type { DirectorPitch, GameState } from "../game/types";
import { trackRecords } from "../game/trackRecord";
import { PersonName } from "./PersonName";
import { useHideRatings } from "./ratingsContext";

type Props = {
	state: GameState;
	error: string | null;
	onFund: (id: number) => void;
	onCounter: (id: number, amount: number) => void; // amount in thousands of $
	onPass: (id: number) => void;
	onWithdraw: (id: number) => void;
};

const TEMPER_TEXT = {
	flexible: "Flexible: will come down a good way on the price.",
	reasonable: "Reasonable: will give some ground.",
	firm: "Firm: will not come down much.",
} as const;

/** The directors' pitches of this Development phase: fund one, haggle, or pass. */
export const Pitches = ({ state, error, onFund, onCounter, onPass, onWithdraw }: Props) => {
	const [counters, setCounters] = useState<Record<number, string>>({}); // the amount typed in each card, in $M
	const pitches = state.directorPitches ?? [];
	const cash = state.studios.find((s) => s.tid === state.userTid)?.cash ?? 0;

	return (
		<section className="panel pitches">
			<h2>Director pitches</h2>
			<p className="muted fine" style={{ marginTop: 0 }}>
				Directors bring you a film and ask for funding. <b>Fund</b> one and it becomes your plan below (the cast must come from the director&rsquo;s wish list),
				make a <b>counter-offer</b>, or <b>pass</b>. A film you turn down may be made by a rival.
			</p>
			{pitches.length === 0 && <p className="muted">No director has a film for you this year.</p>}
			{pitches.map((dp) => (
				<PitchCard
					key={dp.id}
					state={state}
					dp={dp}
					cash={cash}
					typed={counters[dp.id]}
					onType={(v) => setCounters((c) => ({ ...c, [dp.id]: v }))}
					onFund={onFund}
					onCounter={onCounter}
					onPass={onPass}
					onWithdraw={onWithdraw}
				/>
			))}
			{error && <p className="error">{error}</p>}
		</section>
	);
};

type CardProps = {
	state: GameState;
	dp: DirectorPitch;
	cash: number;
	typed: string | undefined;
	onType: (value: string) => void;
	onFund: Props["onFund"];
	onCounter: Props["onCounter"];
	onPass: Props["onPass"];
	onWithdraw: Props["onWithdraw"];
};

const PitchCard = ({ state, dp, cash, typed, onType, onFund, onCounter, onPass, onWithdraw }: CardProps) => {
	const hide = useHideRatings();
	const pv = pitchPreview(state, dp);
	const records = hide ? trackRecords(state, dp.genre) : null;
	const closed = dp.status === "declined" || dp.status === "walked";
	const roundsLeft = DIRECTOR_PITCH_ROUNDS - dp.rounds;
	const counter = typed ?? String(Math.round((dp.ask * 0.9) / 1000));
	const amount = Number(counter) * 1000;
	const budget = dp.agreed ?? dp.ask;
	const tooBig = budget > cash; // not even the budget fits in your cash (marketing comes on top)
	const top = pv.pool.slice(0, 3).map((p) => p.name).join(", ");

	return (
		<div className={`pitch-card ${dp.status}`}>
			<div className="pitch-head">
				<b>&ldquo;{dp.title}&rdquo;</b> <span className="muted">&middot; {GENRE_LABEL[dp.genre]} &middot; directed by</span>{" "}
				<PersonName person={pv.director} awards={state.awards} /> {!hide && <span className="muted num">(ovr {ovr(pv.director.attrs, "director")})</span>}
			</div>

			{closed ? (
				<div className="muted">{dp.status === "declined" ? "You passed on this film." : `${pv.director.name} walked away after your counter-offers.`}</div>
			) : (
				<>
					<div className="pitch-money num">
						Asks <b>{fmtMoney(dp.ask)}</b>
						<span className="muted"> &middot; director&rsquo;s fee {fmtMoney(pv.director.contract.amount)} &middot; cheapest possible film {fmtMoney(pv.lowest)}</span>
					</div>
					<div className="muted fine">
						{hide ? "The best-matched cast on the list" : `Best-fit cast on the list (fit ${pv.bestFit ?? "?"})`} costs {fmtMoney(pv.bestCost)}
						{pv.bestCastLeft >= 0 ? `, leaving ${fmtMoney(pv.bestCastLeft)} for sets and effects.` : `: ${fmtMoney(-pv.bestCastLeft)} more than the ask.`}{" "}
						{dp.status === "open" && TEMPER_TEXT[temperament(dp)]}
					</div>
					{tooBig && <div className="loss fine">You have {fmtMoney(cash)}: this budget alone is more than your cash.</div>}

					<details className="fold wish">
						<summary>
							Wish list <span className="muted">&middot; {pv.pool.length} actors{hide ? "" : ` (top fits: ${top})`}</span>
						</summary>
						<table className="data">
							<thead>
								<tr>
									<th>Actor</th>
									{hide ? (
										<>
											<th className="r">Films</th>
											<th className="r">Critics</th>
										</>
									) : (
										<>
											<th className="r">Ovr</th>
											<th className="r" title={`Suitability for ${GENRE_LABEL[dp.genre]}`}>Fit</th>
										</>
									)}
									<th className="r">Price</th>
								</tr>
							</thead>
							<tbody>
								{(hide ? [...pv.pool].sort((x, y) => x.name.localeCompare(y.name)) : pv.pool).map((a) => (
									<tr key={a.pid}>
										<td>
											<PersonName person={a} awards={state.awards} />
										</td>
										{hide ? (
											<>
												<td className="r num">{records?.get(a.pid)?.films || <span className="muted">&ndash;</span>}</td>
												<td className="r num">{records?.get(a.pid)?.critics ?? <span className="muted">&ndash;</span>}</td>
											</>
										) : (
											<>
												<td className="r num">{ovr(a.attrs, "actor")}</td>
												<td className="r num">{fitFor(a, dp.genre)}</td>
											</>
										)}
										<td className="r num">{fmtMoney(a.contract.amount)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</details>

					{dp.status === "funded" ? (
						<div className="pitch-actions">
							<span className="ok" style={{ margin: 0 }}>
								Funded at <b>{fmtMoney(dp.agreed ?? dp.ask)}</b>. Pick the cast below.
							</span>
							<button className="btn quiet" onClick={() => onWithdraw(dp.id)}>
								Withdraw funding
							</button>
							<button className="btn quiet" onClick={() => onPass(dp.id)}>
								Pass
							</button>
						</div>
					) : (
						<div className="pitch-actions">
							<button className="btn" onClick={() => onFund(dp.id)}>
								Fund {fmtMoney(dp.ask)}
							</button>
							<span className="counter">
								<label htmlFor={`counter-${dp.id}`} className="muted fine">
									or offer $
								</label>
								<input id={`counter-${dp.id}`} type="number" min={1} step={1} value={counter} onChange={(e) => onType(e.target.value)} />
								<span className="muted fine">M</span>
								<button className="btn quiet" disabled={!(amount > 0)} onClick={() => onCounter(dp.id, amount)} title={`${roundsLeft} counter-offer${roundsLeft === 1 ? "" : "s"} left before the director walks away`}>
									Counter ({roundsLeft} left)
								</button>
							</span>
							<button className="btn quiet" onClick={() => onPass(dp.id)}>
								Pass
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
};
