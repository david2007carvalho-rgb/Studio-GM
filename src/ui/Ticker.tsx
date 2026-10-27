import { useEffect, useState } from "react";
import { stripTokens } from "../game/news/util";
import type { GameState } from "../game/types";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A one-line strip of the latest headlines under the top bar. It rotates by itself, pauses under the mouse, and opens the News page when clicked. */
export const Ticker = ({ state, onOpen }: { state: GameState; onOpen: () => void }) => {
	const issue = state.newsIssue ?? 0;
	const top = (state.news ?? [])
		.filter((n) => n.issue === issue)
		.sort((a, b) => b.rank - a.rank || a.id - b.id)
		.slice(0, 6);
	const [i, setI] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => setI(0), [issue]);
	useEffect(() => {
		if (paused || top.length < 2 || reduced()) return;
		const id = window.setInterval(() => setI((x) => x + 1), 6000);
		return () => window.clearInterval(id);
	}, [paused, top.length]);

	if (top.length === 0) return null;
	const item = top[i % top.length];
	return (
		<div className="ticker" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
			<span className="ticker-label">📰 {item.tags?.[0] ?? "LATEST"}</span>
			<button key={item.id} type="button" className="ticker-text" onClick={onOpen} title="Open the news">
				{stripTokens(item.headline)}
			</button>
			<span className="ticker-count num">
				{(i % top.length) + 1}/{top.length}
			</span>
			<button type="button" className="ticker-all" onClick={onOpen}>
				All news →
			</button>
		</div>
	);
};
