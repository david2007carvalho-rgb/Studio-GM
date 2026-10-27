import { fmtMoney } from "../game/format";
import type { Career } from "../game/legacy";
import { useHideRatings } from "./ratingsContext";

// Small dependency-free SVG charts for a person's profile.

const W = 360;
const H = 150;
const PAD = { l: 36, r: 10, t: 12, b: 22 };

type Pt = { x: number; y: number; tip: string; gold?: boolean };

const Chart = ({
	title,
	points,
	kind,
	yMin,
	yMax,
	yFmt,
	note,
}: {
	title: string;
	points: Pt[];
	kind: "line" | "bars";
	yMin: number;
	yMax: number;
	yFmt: (v: number) => string;
	note?: string;
}) => {
	const xs = points.map((p) => p.x);
	const x0 = Math.min(...xs);
	const x1 = Math.max(...xs);
	const plotW = W - PAD.l - PAD.r;
	const plotH = H - PAD.t - PAD.b;
	const sx = (x: number) => PAD.l + (x1 === x0 ? plotW / 2 : ((x - x0) / (x1 - x0)) * plotW);
	const sy = (y: number) => PAD.t + plotH - ((Math.min(yMax, Math.max(yMin, y)) - yMin) / (yMax - yMin || 1)) * plotH;
	const ticks = [yMin, (yMin + yMax) / 2, yMax];
	const xTicks = x1 - x0 <= 6 ? [...new Set(xs)] : [x0, Math.round((x0 + x1) / 2), x1];
	const barW = Math.max(6, Math.min(26, plotW / Math.max(points.length, 1) - 6));
	const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");

	return (
		<figure className="career-chart">
			<figcaption>{title}</figcaption>
			<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => p.tip.split("\n")[0]).join("; ")}`}>
				{ticks.map((t) => (
					<g key={t}>
						<line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} className="cg-grid" />
						<text x={PAD.l - 5} y={sy(t) + 3.5} textAnchor="end" className="cg-axis">
							{yFmt(t)}
						</text>
					</g>
				))}
				{xTicks.map((x) => (
					<text key={x} x={sx(x)} y={H - 6} textAnchor="middle" className="cg-axis">
						{x}
					</text>
				))}
				{kind === "line" && points.length > 1 && <path d={path} className="cg-line" />}
				{points.map((p) =>
					kind === "bars" ? (
						<rect key={p.x} x={sx(p.x) - barW / 2} y={sy(p.y)} width={barW} height={Math.max(1, PAD.t + plotH - sy(p.y))} className={p.gold ? "cg-bar gold" : "cg-bar"}>
							<title>{p.tip}</title>
						</rect>
					) : (
						<circle key={`${p.x}-${p.y}`} cx={sx(p.x)} cy={sy(p.y)} r={p.gold ? 5 : 3.5} className={p.gold ? "cg-dot gold" : "cg-dot"}>
							<title>{p.tip}</title>
						</circle>
					),
				)}
			</svg>
			{note && <div className="muted fine">{note}</div>}
		</figure>
	);
};

/** Three graphs (the rating one is hidden with the ratings): overall rating over time, critics' score per film, box office per year. */
export const CareerGraph = ({ career }: { career: Career }) => {
	const hide = useHideRatings(); // the rating history is hidden with the ratings
	const { seasons, ratings: allRatings } = career;
	const ratings = hide ? [] : allRatings;
	const released = seasons.filter((s) => s.films > 0);
	const hasAny = released.length > 0 || ratings.length > 1;
	if (!hasAny) return <p className="muted" style={{ margin: 0 }}>Graphs appear once they have released a film or lived through an off-season.</p>;

	const critics: Pt[] = released.flatMap((s) =>
		s.critics.map((c) => ({ x: s.season, y: c, gold: s.won, tip: `${s.season}: critics ${c}${s.won ? " (won an award this year)" : s.nominated ? " (nominated)" : ""}` })),
	);
	const grossPts: Pt[] = released.map((s) => ({
		x: s.season,
		y: s.gross,
		gold: s.won,
		tip: `${s.season}: ${fmtMoney(s.gross)} from ${s.films} film${s.films === 1 ? "" : "s"}${s.won ? " (won an award)" : ""}`,
	}));
	const maxGross = Math.max(...grossPts.map((p) => p.y), 1);
	const ratingPts: Pt[] = ratings.map((r) => ({ x: r.season, y: r.ovr, tip: `${r.season}: overall ${r.ovr}` }));
	const rVals = ratingPts.map((p) => p.y);
	const rMin = Math.max(0, Math.floor((Math.min(...rVals, 100) - 4) / 5) * 5);
	const rMax = Math.min(100, Math.ceil((Math.max(...rVals, 0) + 4) / 5) * 5);

	return (
		<div className="career-grid">
			{hide ? null : ratingPts.length > 1 ? (
				<Chart title="Overall rating" kind="line" points={ratingPts} yMin={rMin} yMax={Math.max(rMax, rMin + 10)} yFmt={(v) => String(Math.round(v))} note="Recorded at the start of each season." />
			) : (
				<figure className="career-chart">
					<figcaption>Overall rating</figcaption>
					<p className="muted fine">The rating history starts recording at the next off-season.</p>
				</figure>
			)}
			{critics.length > 0 && (
				<Chart title="Critics’ score per film" kind="line" points={critics} yMin={0} yMax={100} yFmt={(v) => String(Math.round(v))} note="Gold rings: a year they won an award." />
			)}
			{grossPts.length > 0 && (
				<Chart title="Box office per year" kind="bars" points={grossPts} yMin={0} yMax={maxGross * 1.05} yFmt={(v) => fmtMoney(v).replace(/\.\d+/, "")} note="Gold bars: a year they won an award." />
			)}
		</div>
	);
};
