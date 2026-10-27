import { deadlineOf, goalDef, goalProgress, ruleDef, seasonsLeft } from "../game/challenges";
import type { GameState } from "../game/types";

/** A small "locked" note shown where a challenge rule forbids what the page is for. Nothing is shown when `reason` is null. */
export const ChallengeLock = ({ reason }: { reason: string | null }) => (reason ? <p className="chal-lock">🔒 {reason}</p> : null);

/** The Challenge page: the goal and how far along you are, the rules the game is enforcing, and how the run ended. */
export const Challenge = ({ state }: { state: GameState }) => {
	const run = state.challenge;
	if (!run) return null;
	const goal = run.goal ? goalDef(run.goal) : undefined;
	const progress = goalProgress(state);
	const active = run.status === "active";
	const pct = progress ? Math.max(0, Math.min(100, (progress.value / progress.target) * 100)) : 0;
	const left = seasonsLeft(state);
	const lastSeason = goal ? deadlineOf(run) : null;

	return (
		<div className="store">
			<section className="panel chal-page">
				<h2 style={{ margin: 0 }}>
					Challenge
					<span className={`chal-status ${run.status}`}>{active ? "In progress" : run.status === "won" ? "Complete" : "Failed"}</span>
				</h2>

				{!active && run.note && (
					<p className={run.status === "won" ? "ok" : "error"}>
						{run.status === "won" ? "Complete" : "Failed"}
						{run.endSeason ? ` (season ${run.endSeason})` : ""}: {run.note} The rules below no longer apply.
					</p>
				)}

				{goal && progress && (
					<div className="chal-goal">
						<h3>
							{goal.emoji} {goal.name}
						</h3>
						<p className="muted">{goal.summary}</p>
						<div className="chal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
							<div className={`chal-bar-fill ${run.status}`} style={{ width: `${pct}%` }} />
						</div>
						<p className="num">
							<b>{progress.text}</b>
							{active && lastSeason !== null && (
								<span className="muted">
									{" "}
									· {left} season{left === 1 ? "" : "s"} left (last one is {lastSeason})
								</span>
							)}
						</p>
					</div>
				)}

				{run.rules.length > 0 && (
					<div className="chal-rules">
						<h3>{active ? "Rules the game is enforcing" : "Rules (no longer enforced)"}</h3>
						<ul className={active ? "" : "off"}>
							{run.rules.map((id) => {
								const r = ruleDef(id);
								return (
									<li key={id}>
										<b>
											{r.emoji} {r.name}
										</b>
										<ul>
											{r.rules.map((line) => (
												<li key={line}>{line}</li>
											))}
										</ul>
									</li>
								);
							})}
						</ul>
					</div>
				)}

				{!goal && active && <p className="muted">This challenge has no goal: the rules apply for as long as you play this save.</p>}
			</section>
		</div>
	);
};
