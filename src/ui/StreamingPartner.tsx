import { fmtMoney } from "../game/format";
import { RELEASE_LABEL, describeFx, releaseFx, streamPitch } from "../game/streaming";
import { PLATFORMS } from "../game/streamingData";
import type { FilmGenre, GameState, ReleaseMode } from "../game/types";
import { bar, stanceLabel, TermsList } from "./StreamBits";

type Props = {
	state: GameState;
	genre: FilmGenre;
	budget: number; // salaries + base + extra
	marketing: number;
	fit: number | null; // team fit for the genre, null until the team is complete
	platformId: string | null | undefined;
	release: ReleaseMode;
	onPick: (platformId: string | null, release: ReleaseMode) => void;
};

const MODES: ReleaseMode[] = ["wide", "limited", "streaming"];

/** The "Streaming partner" part of the greenlight form: who is interested, what they pay, how the film is released, what the contract holds. */
export const StreamingPartner = ({ state, genre, budget, marketing, fit, platformId, release, onPick }: Props) => {
	const ctx = { genre, budget, marketing, fit };
	const pitches = PLATFORMS.map((p) => streamPitch(state, p, ctx, release));
	const rows = [...pitches].sort((a, b) => Number(!!b.terms) - Number(!!a.terms)); // interested platforms first
	const chosen = pitches.find((x) => x.platform.id === platformId);

	return (
		<div className="field">
			<span className="muted fine">A platform that likes your film can pay part of its budget and sign a multi-year contract with perks and demands.</span>
			<div className="partner-list">
				<button type="button" className={`partner-row ${!platformId ? "chosen" : ""}`} aria-pressed={!platformId} onClick={() => onPick(null, "wide")}>
					<b>No platform</b>
					<span className="muted">Wide cinema release, you carry all the risk and keep all the upside.</span>
				</button>
				{fit === null && <span className="muted">Hire a director and a full cast to see which platforms are interested.</span>}
				{rows.map(({ platform: p, terms, refusal, financing, marketingCover }) => {
					const on = platformId === p.id;
					return (
						<button
							key={p.id}
							type="button"
							className={`partner-row ${on ? "chosen" : ""} ${terms ? "" : "off"}`}
							disabled={!terms && !on}
							aria-pressed={on}
							onClick={() => onPick(p.id, release === "wide" ? p.favoured : release)}
						>
							<span>
								{p.emoji} <b>{p.name}</b> <span className="muted">· {stanceLabel(p)}</span>
							</span>
							{terms ? (
								<span className="num">
									pays <b>{fmtMoney(financing + marketingCover)}</b> now · {terms.years} years · about {fmtMoney(terms.annual)} a year
								</span>
							) : (
								<span className="muted">{fit === null ? "needs a team first" : refusal}</span>
							)}
						</button>
					);
				})}
			</div>

			{chosen && (
				<div className="ip-box partner-box">
					<b>
						{chosen.platform.emoji} {chosen.platform.name}
					</b>
					<span className="muted">{chosen.platform.releaseNote}</span>
					<span className="label">How will the film be released?</span>
					<div className="mode-row">
						{MODES.map((m) => {
							const alt = streamPitch(state, chosen.platform, ctx, m);
							return (
								<button key={m} type="button" className="role-btn mode-btn" aria-pressed={release === m} onClick={() => onPick(chosen.platform.id, m)}>
									<b>
										{RELEASE_LABEL[m]}
										{chosen.platform.favoured === m ? " ★" : ""}
									</b>
									<span className="num">
										{alt.terms ? `${fmtMoney(alt.financing + alt.marketingCover)} now · ${fmtMoney(alt.terms.annual)}/yr` : "–"}
									</span>
								</button>
							);
						})}
					</div>
					<ul className="demands">
						{describeFx(chosen.platform, releaseFx(chosen.platform, release)).map((l, i) => (
							<li key={i} className={l.good === true ? "gain" : l.good === false ? "loss" : "muted"}>
								{l.text}
							</li>
						))}
					</ul>
					{chosen.terms ? (
						<>
							<span className="num">
								Pays <b>{fmtMoney(chosen.financing)}</b> of the budget{chosen.marketingCover > 0 && <> and <b>{fmtMoney(chosen.marketingCover)}</b> of the marketing</>} when production starts. After release: a{" "}
								<b>{chosen.terms.years}-year contract</b>, about <b>{fmtMoney(chosen.terms.annual)}</b> a year (it follows the audience score). It then offers to renew, or the rights come back to you.
							</span>
							<TermsList perks={chosen.terms.perks} demands={chosen.terms.demands} />
						</>
					) : (
						<span className="error" style={{ margin: 0 }}>
							{chosen.refusal ?? "Not interested right now."}
						</span>
					)}
					<span className="muted">★ the release this platform likes best. The three release modes are the same film: only the money, the box office and the awards change.</span>
					<span className="muted">Platform strength: wallet {bar(Math.min(1, chosen.platform.scale / 1.8))} · reach {bar(chosen.platform.reach)} · prestige {bar(chosen.platform.prestige)}</span>
				</div>
			)}
		</div>
	);
};
