import { MenuButton } from "../app/AppMenu";
import { useRef, useState } from "react";
import { GOALS, RULES, goalDef, incompatibility } from "../game/challenges";
import { DIFFICULTY_SETTINGS } from "../game/constants";
import { fmtMoney } from "../game/format";
import { STUDIO_NAME_MAX, cleanStudioName } from "../game/phase";
import { clearGame, listSlots } from "../game/storage";
import type { Difficulty, GoalId, RuleId } from "../game/types";

const ORDER: Difficulty[] = ["easy", "normal", "hard"];

const fmtDate = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Start screen: five save slots. Load a game, delete one, or start a new one in an empty slot. */
export const SaveSlots = ({
	onLoad,
	onStart,
	allTime,
	onToggleAllTime,
}: {
	onLoad: (slot: number) => void;
	onStart: (slot: number, d: Difficulty, options: { hideRatings: boolean; studioName: string; allTime: boolean; rules: RuleId[]; goal?: GoalId }) => void;
	allTime: boolean;
	onToggleAllTime: () => void;
}) => {
	// Hidden switch: click the "Studio GM" title 5 times in a row (each click within 1.5 s of the last) to flip the All-Time edition.
	const taps = useRef({ n: 0, last: 0 });
	const tapTitle = () => {
		const now = Date.now();
		taps.current.n = now - taps.current.last < 1500 ? taps.current.n + 1 : 1;
		taps.current.last = now;
		if (taps.current.n >= 5) {
			taps.current.n = 0;
			onToggleAllTime();
		}
	};
	const [slots, setSlots] = useState(listSlots);
	const [difficulty, setDifficulty] = useState<Record<number, Difficulty>>({});
	const [names, setNames] = useState<Record<number, string>>({}); // studio name typed per slot
	const [hidden, setHidden] = useState<Record<number, boolean>>({}); // "Hide ratings" per slot
	const [chal, setChal] = useState<Record<number, { rules: RuleId[]; goal?: GoalId }>>({}); // challenge picked per slot (see challenges.ts)

	const remove = (slot: number) => {
		if (!window.confirm(`Delete the save in slot ${slot}? This cannot be undone.`)) return;
		clearGame(slot);
		setSlots(listSlots());
	};

	return (
		<main className="start">
			<h1 onClick={tapTitle}>
				Studio GM{allTime && <span className="edition-tag">All-Time</span>}
			</h1>
			<div className="start-menu"><MenuButton className="btn quiet" /></div>
			{allTime && <p className="muted">All-Time edition: every legend of film history is a free agent, 18 years old and far from their prime. Sign them young and watch them become great.</p>}
			<p className="muted">Run a movie studio. Hire the talent, make a film every year, and chase the awards. Pick a save slot to continue or start a new game.</p>
			<div className="slot-grid">
				{slots.map((s) => {
					const d = difficulty[s.slot] ?? "normal";
					return (
						<section key={s.slot} className="panel save-slot">
							<h2>Slot {s.slot}</h2>
							{s.empty || !s.summary ? (
								<>
									<p className="muted">Empty</p>
									<div className="field">
										<label htmlFor={`name-${s.slot}`}>Studio name</label>
										<input
											id={`name-${s.slot}`}
											type="text"
											maxLength={STUDIO_NAME_MAX}
											placeholder="My Studio"
											value={names[s.slot] ?? ""}
											onChange={(e) => setNames((m) => ({ ...m, [s.slot]: e.target.value }))}
										/>
									</div>
									<div className="field">
										<label htmlFor={`diff-${s.slot}`}>Difficulty</label>
										<select id={`diff-${s.slot}`} value={d} onChange={(e) => setDifficulty((m) => ({ ...m, [s.slot]: e.target.value as Difficulty }))}>
											{ORDER.map((k) => (
												<option key={k} value={k}>
													{DIFFICULTY_SETTINGS[k].label}
												</option>
											))}
										</select>
									</div>
									<p className="muted slot-desc">{DIFFICULTY_SETTINGS[d].description}</p>
									<label className="check hide-ratings" title="No Ovr, Fit or attribute numbers anywhere. Judge talent by what they have done: films, reviews, box office, awards.">
										<input type="checkbox" checked={!!hidden[s.slot]} onChange={(e) => setHidden((m) => ({ ...m, [s.slot]: e.target.checked }))} /> Hide ratings
									</label>
									<p className="muted slot-desc">{hidden[s.slot] ? "No Ovr, Fit or attribute numbers. You sort and judge talent by their track record and by specialties that suit the genre." : "Ovr, Fit and attributes are shown."}</p>
									<ChallengePicker value={chal[s.slot] ?? { rules: [] }} onChange={(v) => setChal((m) => ({ ...m, [s.slot]: v }))} />
									<button className="btn" onClick={() => onStart(s.slot, d, { hideRatings: !!hidden[s.slot], studioName: cleanStudioName(names[s.slot]), allTime, rules: chal[s.slot]?.rules ?? [], goal: chal[s.slot]?.goal })}>
										New game
									</button>
								</>
							) : (
								<>
									<dl className="kv num">
										<dt>Studio</dt>
										<dd>{s.summary.studio}</dd>
										<dt>Mode</dt>
										<dd>{DIFFICULTY_SETTINGS[s.summary.difficulty].label}{s.summary.allTime ? " · All-Time" : ""}{s.summary.hideRatings ? " · ratings hidden" : ""}</dd>
										{s.summary.challenge && (
											<>
												<dt>Challenge</dt>
												<dd>{s.summary.challenge}</dd>
											</>
										)}
										<dt>Season</dt>
										<dd>{s.summary.season}</dd>
										<dt>Cash</dt>
										<dd>{fmtMoney(s.summary.cash)}</dd>
										<dt>Reputation</dt>
										<dd>{s.summary.reputation}</dd>
										<dt>Your films</dt>
										<dd>{s.summary.films}</dd>
									</dl>
									{s.savedAt && <p className="muted slot-desc">Saved {fmtDate(s.savedAt)}</p>}
									<div className="slot-actions">
										<button className="btn" onClick={() => onLoad(s.slot)}>
											Continue
										</button>
										<button className="btn quiet" onClick={() => remove(s.slot)}>
											Delete
										</button>
									</div>
								</>
							)}
						</section>
					);
				})}
			</div>
		</main>
	);
};

type ChallengeChoice = { rules: RuleId[]; goal?: GoalId };

/** Optional challenge for a new game: a goal with a deadline and/or rules the game enforces. */
const ChallengePicker = ({ value, onChange }: { value: ChallengeChoice; onChange: (v: ChallengeChoice) => void }) => {
	const goal = value.goal ? goalDef(value.goal) : undefined;
	const picked = [...(goal ? [goal.name] : []), ...value.rules.map((id) => RULES.find((r) => r.id === id)!.name)];
	const toggle = (id: RuleId) => onChange({ ...value, rules: value.rules.includes(id) ? value.rules.filter((r) => r !== id) : [...value.rules, id] });
	return (
		<details className="fold chal-pick" open={picked.length > 0}>
			<summary>
				Challenge <span className="muted">{picked.length ? `· ${picked.join(" + ")}` : "(optional)"}</span>
			</summary>
			<div className="field">
				<label>Goal</label>
				<select value={value.goal ?? ""} onChange={(e) => onChange({ ...value, goal: (e.target.value || undefined) as GoalId | undefined })}>
					<option value="">No goal</option>
					{GOALS.map((g) => (
						<option key={g.id} value={g.id} disabled={!!incompatibility(value.rules, g.id)}>
							{g.emoji} {g.name} · {g.years} seasons
						</option>
					))}
				</select>
			</div>
			{goal && (
				<p className="muted slot-desc">
					{goal.summary} You have {goal.years} seasons.
				</p>
			)}
			<div className="chal-rule-list">
				{RULES.map((r) => {
					const clash = incompatibility([r.id], value.goal);
					return (
						<label key={r.id} className="check chal-rule" title={clash ?? r.rules.join(" ")}>
							<input type="checkbox" checked={value.rules.includes(r.id)} disabled={!!clash} onChange={() => toggle(r.id)} />
							<span>
								<b>
									{r.emoji} {r.name}
								</b>
								<span className="muted"> {clash ?? r.summary}</span>
							</span>
						</label>
					);
				})}
			</div>
			<p className="muted slot-desc">The rules are enforced by the game, not just advised. They stop applying when the goal is won or lost.</p>
		</details>
	);
};
