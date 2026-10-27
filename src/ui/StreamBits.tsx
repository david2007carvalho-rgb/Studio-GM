import { describeDemand, describePerk } from "../game/streaming";
import type { DemandStatus } from "../game/streaming";
import type { Platform } from "../game/streamingData";
import type { Demand, Perk } from "../game/types";

/** Five dots for a 0-1 value. */
export const bar = (value: number): string => {
	const n = Math.max(1, Math.round(value * 5));
	return "●".repeat(n) + "○".repeat(5 - n);
};

/** What a platform thinks of cinemas, in words. */
export const stanceLabel = (p: Platform): string =>
	p.theatrical >= 0.5 ? "Loves cinemas" : p.theatrical >= 0.15 ? "Likes cinemas" : p.theatrical > -0.15 ? "Neutral on cinemas" : p.theatrical > -0.45 ? "Prefers streaming" : "Dislikes cinemas";

/** Perks (what you get) and demands (what it wants from you) of one contract. With `status`, each demand shows how you are doing. */
export const TermsList = ({ perks, demands, status }: { perks: Perk[]; demands: Demand[]; status?: DemandStatus[] }) => (
	<div className="terms">
		<div>
			<span className="muted ip-note">You get</span>
			<ul className="demands">
				{perks.length === 0 && <li className="muted">Just the money</li>}
				{perks.map((p, i) => (
					<li key={i} className="gain">
						＋ {describePerk(p)}
					</li>
				))}
			</ul>
		</div>
		<div>
			<span className="muted ip-note">It wants</span>
			<ul className="demands">
				{demands.length === 0 && <li className="muted">No special demands</li>}
				{status
					? status.map((s, i) => (
							<li key={i} className={s.state === "ok" ? "gain" : s.state === "broken" ? "loss" : ""}>
								{s.state === "ok" ? "✓" : s.state === "broken" ? "✗" : "…"} {s.text}
							</li>
						))
					: demands.map((d, i) => <li key={i}>▸ {describeDemand(d)}</li>)}
			</ul>
		</div>
	</div>
);
