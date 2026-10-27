import { useEffect, useMemo, useState } from "react";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { negotiationOf, refusalReason, requiredReputation, reputationGap, userReputation } from "../game/hiring";
import {
	NEG_BACKEND_STEPS, NEG_MAX_COSTARS, NEG_ROUNDS, askingSalary, demandMet, demandText, emptyTerms, evaluate, expectedGross, termsText,
	type NegotiationResult,
} from "../game/negotiate";
import { ovr } from "../game/ovr";
import { STYLES } from "../game/scripts";
import { GENRES, SCRIPT_STYLES } from "../game/types";
import type { DealTerms, FilmGenre, GameState, ScriptStyle } from "../game/types";
import { RETIRED } from "../game/constants";
import { talentBlocker } from "../game/challenges";
import { useHideRatings } from "./ratingsContext";

type Props = {
	state: GameState;
	pid: number;
	onClose: () => void;
	onOffer: (pid: number, terms: DealTerms) => NegotiationResult;
};

/** The negotiating table: offer a salary, a backend share and promises; see what they want and how likely they are to sign. */
export const Negotiate = ({ state, pid, onClose, onOffer }: Props) => {
	const hide = useHideRatings();
	const p = state.people.find((x) => x.pid === pid);
	const [terms, setTerms] = useState<DealTerms | null>(null);
	const [result, setResult] = useState<string | null>(null);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const ask = p ? askingSalary(state, p) : 0;
	const t: DealTerms = terms ?? emptyTerms(ask);
	const e = p ? evaluate(state, p, t) : null;
	const neg = p ? negotiationOf(state, pid) : undefined;
	const open = !neg || neg.status === "open";

	// People you could promise: nobody who would refuse you, nobody a challenge rule bars, best first.
	const options = useMemo(() => {
		const usable = state.people
			.filter((x) => x.tid !== RETIRED && x.pid !== pid && !refusalReason(state, x) && !talentBlocker(state, x))
			.sort((a, b) => ovr(b.attrs, b.role) - ovr(a.attrs, a.role));
		return { directors: usable.filter((x) => x.role === "director"), actors: usable.filter((x) => x.role === "actor") };
	}, [state, pid]);

	if (!p) return null;
	const set = (patch: Partial<DealTerms>) => setTerms({ ...t, ...patch });
	const costar = (i: number, v: string) => {
		const list = [...t.costars];
		if (v === "") list.splice(i, 1);
		else list[i] = Number(v);
		set({ costars: [...new Set(list)] });
	};
	const need = requiredReputation(state.difficulty, p, state);
	const gap = reputationGap(state, p);
	const lo = Math.round(ask * 0.4 / 10) * 10;
	const hi = Math.round(ask * 3 / 10) * 10;
	const pct = e && e.ok ? Math.round(e.chance * 100) : 0;
	const mood = pct >= 80 ? "Eager" : pct >= 55 ? "Warm" : pct >= 30 ? "Cool" : pct >= 10 ? "Cold" : "Hostile";

	const submit = () => {
		const r = onOffer(pid, t);
		setResult(r.ok ? r.message : r.error);
		if (r.ok) setTerms(null); // the next offer starts from the ask again
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<section className="panel neg-modal" role="dialog" aria-modal="true" aria-label={`Negotiate with ${p.name}`} onClick={(ev) => ev.stopPropagation()}>
				<div className="neg-head">
					<div>
						<h2>Negotiate with {p.name}</h2>
						<div className="muted fine">
							{p.role === "director" ? "Director" : p.gender === "female" ? "Actress" : "Actor"} · Age {p.age} · market price {fmtMoney(p.contract.amount)}
							{need > 0 && <> · needs reputation {need} (yours {userReputation(state)}{gap > 0 ? `, ${gap} short` : ""})</>}
						</div>
					</div>
					<button className="btn quiet" onClick={onClose} aria-label="Close">✕</button>
				</div>

				{neg?.status === "signed" && neg.terms ? (
					<p className="ok">Signed: {termsText(neg.terms, state)}. These are enforced when you greenlight and when the film is released.</p>
				) : !e ? null : !e.ok ? (
					<p className="loss">{e.reason}</p>
				) : (
					<>
						<div className="neg-grid">
							<div>
								<h3>Their demands</h3>
								{e.demands.length === 0 ? (
									<p className="muted fine">None. They just want a fair price.</p>
								) : (
									<ul className="neg-demands">
										{e.demands.map((d, i) => {
											const ok = demandMet(state, d, t);
											return (
												<li key={i} className={ok ? "gain" : "loss"}>
													{ok ? "✓" : "✗"} {demandText(d, hide)}
												</li>
											);
										})}
									</ul>
								)}
								<p className="muted fine">
									They ask {fmtMoney(ask)} for the film. Stars and people far above your reputation ask for more and demand more. Lesser-known people take worse deals.
								</p>
							</div>
							<div className="neg-chance">
								<div className="neg-pct">{pct}%</div>
								<div className="muted fine">chance they sign · {mood}</div>
								<div className="muted fine">Offer {Math.min(NEG_ROUNDS, (neg?.rounds ?? 0) + 1)} of {NEG_ROUNDS}</div>
							</div>
						</div>

						<h3>Your offer</h3>
						<label className="neg-row">
							<span>Salary <b>{fmtMoney(t.salary)}</b> <span className="muted fine">(ask {fmtMoney(ask)})</span></span>
							<input type="range" min={lo} max={hi} step={10} value={clampTo(t.salary, lo, hi)} onChange={(ev) => set({ salary: Number(ev.target.value) })} disabled={!open} />
						</label>
						<label className="neg-row">
							<span>Backend <span className="muted fine">share of the box office{t.backend ? ` · about ${fmtMoney(Math.round((t.backend / 100) * expectedGross(state)))} on a typical film of yours` : ""}</span></span>
							<select value={t.backend} onChange={(ev) => set({ backend: Number(ev.target.value) })} disabled={!open}>
								{NEG_BACKEND_STEPS.map((x) => <option key={x} value={x}>{x}%</option>)}
							</select>
						</label>
						<label className="neg-row">
							<span>Promise a genre <span className="muted fine">optional</span></span>
							<select value={t.genre ?? ""} onChange={(ev) => set({ genre: (ev.target.value || null) as FilmGenre | null })} disabled={!open}>
								<option value="">No promise</option>
								{GENRES.map((g) => <option key={g} value={g}>{GENRE_LABEL[g]}</option>)}
							</select>
						</label>
						<label className="neg-row">
							<span>Promise a script type <span className="muted fine">optional</span></span>
							<select value={t.style ?? ""} onChange={(ev) => set({ style: (ev.target.value || null) as ScriptStyle | null })} disabled={!open}>
								<option value="">No promise</option>
								{SCRIPT_STYLES.map((s) => <option key={s} value={s}>{STYLES[s].label}</option>)}
							</select>
						</label>
						{p.role === "actor" && (
							<label className="neg-row">
								<span>Promise a director <span className="muted fine">optional</span></span>
								<select value={t.director ?? ""} onChange={(ev) => set({ director: ev.target.value ? Number(ev.target.value) : null })} disabled={!open}>
									<option value="">No promise</option>
									{options.directors.slice(0, 80).map((d) => <option key={d.pid} value={d.pid}>{d.name}{hide ? "" : ` (${ovr(d.attrs, d.role)})`}</option>)}
								</select>
							</label>
						)}
						{Array.from({ length: NEG_MAX_COSTARS }, (_, i) => (
							<label className="neg-row" key={i}>
								<span>{p.role === "director" ? "Promise an actor" : "Promise a co-star"} {i + 1} <span className="muted fine">optional</span></span>
								<select value={t.costars[i] ?? ""} onChange={(ev) => costar(i, ev.target.value)} disabled={!open || (i > 0 && t.costars.length < i)}>
									<option value="">No promise</option>
									{options.actors.slice(0, 120).map((a) => <option key={a.pid} value={a.pid}>{a.name}{hide ? "" : ` (${ovr(a.attrs, a.role)})`}</option>)}
								</select>
							</label>
						))}
						<p className="muted fine">Promises are binding: you cannot greenlight a film that breaks them. Backend is paid out of the box office when the film is released.</p>

						<div className="neg-actions">
							<button className="btn" onClick={submit} disabled={!open}>{open ? "Make offer" : "Talks are over"}</button>
							<button className="btn quiet" onClick={onClose}>Walk away</button>
						</div>
					</>
				)}
				{result && <p className="neg-result" role="status">{result}</p>}
			</section>
		</div>
	);
};

const clampTo = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
