import { useMemo, useState } from "react";
import { PHASE_NAMES } from "../game/constants";
import type { GameState, NewsItem, NewsKind } from "../game/types";
import { NewsText } from "./NewsText";

const KIND_LABEL: Record<NewsKind, string> = {
	production: "Production",
	drama: "Drama",
	boxoffice: "Box office",
	reviews: "Reviews",
	record: "Records",
	duo: "Partnerships",
	awards: "Awards",
	race: "Awards race",
	people: "People",
	studio: "Studios",
	franchise: "Franchises",
	rumor: "Rumor mill",
};

const FILTERS: { id: string; label: string; test: (n: NewsItem) => boolean }[] = [
	{ id: "all", label: "Everything", test: () => true },
	{ id: "mine", label: "Your studio", test: (n) => !!n.mine },
	{ id: "awards", label: "Awards", test: (n) => n.kind === "awards" || n.kind === "race" },
	{ id: "records", label: "Records", test: (n) => n.kind === "record" },
	{ id: "drama", label: "Drama & gossip", test: (n) => n.kind === "drama" || n.kind === "rumor" },
	{ id: "box", label: "Box office", test: (n) => ["boxoffice", "reviews", "franchise"].includes(n.kind) },
	{ id: "production", label: "Production", test: (n) => n.kind === "production" },
	{ id: "people", label: "People", test: (n) => n.kind === "people" || n.kind === "duo" },
	{ id: "studio", label: "Studios", test: (n) => n.kind === "studio" },
];

const PAGE = 40;
const STRIP = 3;
const SIDEBAR = 5;

const stamp = (n: NewsItem) => `${n.season} · ${PHASE_NAMES[n.phase]}`;

/** Jump to an article further down the page and flash it briefly. */
const goTo = (id: number) => {
	const el = document.getElementById(`news-${id}`);
	if (!el) return;
	el.scrollIntoView({ behavior: "smooth", block: "start" });
	el.classList.remove("flash");
	void el.offsetWidth; // restart the animation
	el.classList.add("flash");
};

const Tags = ({ n, isNew }: { n: NewsItem; isNew: boolean }) => (
	<>
		{n.tags?.map((t) => (
			<span key={t} className={`ntag ${t === "RECORD" || t === "BREAKING" ? "hot" : ""}`}>
				{t}
			</span>
		))}
		{n.mine && <span className="ntag yours">YOUR STUDIO</span>}
		{isNew && <span className="ntag fresh">NEW</span>}
	</>
);

const Table = ({ n }: { n: NewsItem }) =>
	n.card ? (
		<div className="news-table">
			<div className="news-table-title">{n.card.title}</div>
			<ul>
				{n.card.rows.map((r, i) => (
					<li key={i} className={`${r.mine ? "mine" : ""} ${r.won ? "won" : ""}`}>
						<span className="nt-label">
							{r.won && "🏆 "}
							{r.label}
						</span>
						<span className="nt-text">
							<NewsText text={r.text} />
						</span>
						{r.note && <span className="nt-note">{r.note}</span>}
					</li>
				))}
			</ul>
		</div>
	) : null;

/** A story in the river below the fold. */
const Card = ({ n, isNew, col2 }: { n: NewsItem; isNew: boolean; col2: boolean }) => (
	<article id={`news-${n.id}`} className={`news-card kind-${n.kind} rank-${n.rank} ${n.mine ? "mine" : ""} ${n.tone ? `tone-${n.tone}` : ""} ${col2 ? "col2" : ""} ${n.card ? `has-card card-${n.card.kind}` : ""}`}>
		<div className="news-kicker">
			<span className="iw-kicker">{KIND_LABEL[n.kind]}</span>
			<Tags n={n} isNew={isNew} />
		</div>
		<h3 className="news-headline">
			<NewsText text={n.headline} />
		</h3>
		{n.body.map((p, i) => (
			<p key={i} className="news-body">
				<NewsText text={p} />
			</p>
		))}
		{n.effect && <p className={`news-effect ${n.tone ?? ""}`}>{n.effect}</p>}
		<Table n={n} />
		<div className="news-stamp">{stamp(n)}</div>
	</article>
);

/** The boxed top story. */
const Lead = ({ n, isNew }: { n: NewsItem; isNew: boolean }) => {
	const [dek, ...rest] = n.body;
	return (
		<article id={`news-${n.id}`} className={`iw-lead kind-${n.kind} ${n.mine ? "mine" : ""} ${n.tone ? `tone-${n.tone}` : ""}`}>
			<div className="iw-lead-kicker">
				<span className="iw-kicker">{KIND_LABEL[n.kind]}</span>
				<Tags n={n} isNew={isNew} />
			</div>
			<h3 className="iw-lead-headline">
				<NewsText text={n.headline} />
			</h3>
			{dek && (
				<p className="iw-lead-dek">
					<NewsText text={dek} />
				</p>
			)}
			<div className="iw-byline">{stamp(n)}</div>
			{(rest.length > 0 || n.effect || n.card) && (
				<div className="iw-lead-rest">
					{rest.map((p, i) => (
						<p key={i} className="news-body">
							<NewsText text={p} />
						</p>
					))}
					{n.effect && <p className={`news-effect ${n.tone ?? ""}`}>{n.effect}</p>}
					<Table n={n} />
				</div>
			)}
		</article>
	);
};

/** The News page, laid out like a trade-paper homepage: every article the game has written, newest first, with filters. */
export const News = ({ state }: { state: GameState }) => {
	// What was already read when the page opened (the app marks everything read right after), so new articles can be flagged.
	const [seenAtOpen] = useState(() => state.newsSeen ?? 0);
	const [filter, setFilter] = useState("all");
	const [season, setSeason] = useState<number | "all">("all");
	const [shown, setShown] = useState(PAGE);

	const all = state.news ?? [];
	const seasons = useMemo(() => [...new Set(all.map((n) => n.season))].sort((a, b) => b - a), [all]);
	const test = FILTERS.find((f) => f.id === filter)!.test;
	const items = all.filter((n) => test(n) && (season === "all" || n.season === season));

	// newest issue first; inside an issue the front page stories come first
	const issues = useMemo(() => {
		const byIssue = new Map<number, NewsItem[]>();
		for (const n of items) (byIssue.get(n.issue) ?? byIssue.set(n.issue, []).get(n.issue)!).push(n);
		return [...byIssue.entries()].sort((a, b) => b[0] - a[0]).map(([issue, list]) => ({ issue, list: [...list].sort((a, b) => b.rank - a.rank || a.id - b.id) }));
	}, [items]);

	const ordered = issues.flatMap((i) => i.list);
	const lead = ordered[0];
	const strip = ordered.slice(1, 1 + STRIP);
	const side = ordered.slice(1 + STRIP, 1 + STRIP + SIDEBAR);
	const isNew = (n: NewsItem) => n.issue > seenAtOpen;

	// The river holds everything except the lead, which already shows in full above.
	let remaining = shown;
	const total = items.length - (lead ? 1 : 0);

	return (
		<div className="news-page">
			<header className="iw-masthead">
				<label className="iw-season">
					Season{" "}
					<select value={season} onChange={(e) => { setSeason(e.target.value === "all" ? "all" : Number(e.target.value)); setShown(PAGE); }}>
						<option value="all">All</option>
						{seasons.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</label>
				<h2 className="iw-logo" aria-label="The Studio Reel">
					<span className="iw-logo-a">Studio</span>
					<span className="iw-logo-b">Reel</span>
				</h2>
				<div className="iw-count">{all.length} {all.length === 1 ? "story" : "stories"} on file</div>
			</header>

			<nav className="iw-nav" role="tablist" aria-label="Filter the news">
				{FILTERS.map((f) => (
					<button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setShown(PAGE); }}>
						{f.label}
					</button>
				))}
			</nav>

			{all.length === 0 && <p className="iw-empty">Everything the industry is talking about. Advance the season and the stories start rolling in.</p>}
			{items.length === 0 && all.length > 0 && <p className="iw-empty">Nothing in this section yet.</p>}

			{strip.length > 0 && (
				<div className="iw-strip">
					<div className="iw-strip-inner">
						{strip.map((n) => (
							<button key={n.id} type="button" className="iw-strip-item" onClick={() => goTo(n.id)}>
								<span className="iw-kicker">{KIND_LABEL[n.kind]}</span>
								<span className="iw-strip-headline">
									<NewsText text={n.headline} />
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			{lead && (
				<div className="iw-wrap">
					<div className="iw-top">
						<Lead n={lead} isNew={isNew(lead)} />
						{side.length > 0 && (
							<aside className="iw-latest" aria-label="Latest news">
								<h3>Latest News</h3>
								<ul>
									{side.map((n) => (
										<li key={n.id}>
											<button type="button" onClick={() => goTo(n.id)}>
												<span className="iw-kicker plain">{KIND_LABEL[n.kind]}</span>
												<span className="iw-side-headline">
													<NewsText text={n.headline} />
												</span>
												<span className="iw-side-time">{stamp(n)}</span>
											</button>
										</li>
									))}
								</ul>
							</aside>
						)}
					</div>

					{issues.map(({ issue, list }) => {
						if (remaining <= 0) return null;
						const rows = list.filter((n) => n.id !== lead.id);
						if (rows.length === 0) return null;
						const slice = rows.slice(0, remaining);
						remaining -= slice.length;
						const first = list[0];
						const unread = list.filter(isNew).length;
						// which column each card lands in, so the dotted divider can sit between them
						let pos = 0;
						return (
							<section key={issue} className="news-issue">
								<h3 className="news-issue-head">
									<span>{stamp(first)}</span>
									{unread > 0 && <span className="ntag fresh">{unread} new</span>}
								</h3>
								<div className="news-grid">
									{slice.map((n) => {
										const wide = !!n.card;
										const col2 = !wide && pos === 1;
										pos = wide ? 0 : (pos + 1) % 2;
										return <Card key={n.id} n={n} isNew={isNew(n)} col2={col2} />;
									})}
								</div>
							</section>
						);
					})}

					{remaining <= 0 && total > shown && (
						<p className="more">
							<button className="iw-more" onClick={() => setShown(shown + PAGE)}>
								More news <span aria-hidden>→</span>
							</button>
						</p>
					)}
				</div>
			)}
		</div>
	);
};
