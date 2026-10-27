import { Phase } from "../types";
import type { GameState, NewsItem } from "../types";
import { nominationsNews, winnersNews } from "./awardsNews";
import { bondDrafts } from "./bonds";
import { type DramaStage, rollDrama } from "./drama";
import { evolveBonds } from "../rivalries";
import { offseasonNews, seasonPreviewNews } from "./offseason";
import { productionNews, wrapNews } from "./production";
import { releaseNews } from "./release";
import { makeRoom } from "./room";
import { type Draft, polish } from "./util";
import { createVoice } from "./voice";

export { releaseEffect } from "./drama";

// ═════════════════════════════════════════════════════════════
// The news feed. Every phase change writes one "issue" of articles into GameState.news.
// The articles only READ the game, except drama (drama.ts), which really changes films.
// A bug here must never break the game, so everything is wrapped and fails quietly.
// ═════════════════════════════════════════════════════════════

/** How many articles are kept (the oldest are dropped). About 40-50 are written per season. */
export const NEWS_KEEP = 320;
/** The most articles one issue can hold. The least important are left out when it is full. */
const ISSUE_MAX = 18;

/** Roll this stage's drama for the season's films and apply what changes right away. Returns the articles (give them to makeNews). */
export const stageDrama = (state: GameState, stage: DramaStage): Draft[] => {
	try {
		return rollDrama(state, stage, createVoice(state));
	} catch (e) {
		console.error("drama failed", e);
		return [];
	}
};

/** Off-season: feuds cool or end, and the tabloids start new ones (see rivalries.ts). Changes the game; returns the articles (give them to makeNews). */
export const stageBonds = (state: GameState): Draft[] => {
	try {
		return bondDrafts(state, evolveBonds(state), createVoice(state));
	} catch (e) {
		console.error("bonds failed", e);
		return [];
	}
};

/**
 * Write the issue for the phase change from `prev` to `next` and add it to `next.news`.
 * `drama` are the articles stageDrama returned during this phase change.
 */
export const makeNews = (prev: GameState, next: GameState, drama: Draft[]): void => {
	try {
		const afterCeremony = prev.phase === Phase.AWARDS;
		const room = makeRoom(prev, next, createVoice(next, afterCeremony ? { asOf: next.season + 1, fresh: true } : {}));
		switch (prev.phase) {
			case Phase.DEVELOPMENT:
				productionNews(room, drama);
				break;
			case Phase.PRODUCTION:
				wrapNews(room, drama);
				break;
			case Phase.POST:
				releaseNews(room, drama);
				nominationsNews(room);
				break;
			case Phase.DISTRIBUTION:
				winnersNews(room);
				break;
			case Phase.AWARDS:
				offseasonNews(room);
				for (const d of drama) room.add(d); // feuds and friendships (stageBonds)
				break;
			case Phase.OFFSEASON:
				seasonPreviewNews(room);
				break;
		}
		publish(next, room.out, prev.phase);
	} catch (e) {
		console.error("news failed", e);
	}
};

const publish = (state: GameState, drafts: Draft[], from: Phase): void => {
	if (drafts.length === 0) return;
	// A full issue keeps the most important articles, but always the ones with a table.
	const kept = drafts.length <= ISSUE_MAX ? drafts : [...drafts].sort((a, b) => Number(!!b.card) - Number(!!a.card) || b.rank - a.rank).slice(0, ISSUE_MAX);
	const issue = (state.newsIssue ?? 0) + 1;
	state.newsIssue = issue;
	const phase = from === Phase.OFFSEASON ? Phase.DEVELOPMENT : ((from + 1) as Phase);
	const items: NewsItem[] = kept.map((d) => ({
		...d,
		id: state.nextNewsId ?? 0,
		issue,
		season: state.season,
		phase,
		headline: polish(d.headline),
		body: d.body.map(polish).filter(Boolean),
		...(d.card && { card: { ...d.card, rows: d.card.rows.map((r) => ({ ...r, text: polish(r.text) })) } }),
	}));
	for (const it of items) {
		it.id = state.nextNewsId ?? 0;
		state.nextNewsId = it.id + 1;
	}
	state.news = [...(state.news ?? []), ...items].slice(-NEWS_KEEP);
};
