import { GENRE_LABEL, fmtMoney } from "../game/format";
import { STYLES, fitPoints, qualityWord, scriptRating } from "../game/scripts";
import type { FilmGenre, Script, ScriptInfo } from "../game/types";

/** A small horizontal bar, 0-100. */
const Bar = ({ label, value, tone }: { label: string; value: number; tone?: "main" | "risk" }) => (
	<div className="sbar" title={`${label}: ${Math.round(value)}`}>
		<span className="sbar-label">{label}</span>
		<span className="sbar-track">
			<span className={`sbar-fill ${tone ?? ""}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
		</span>
	</div>
);

const fitWord = (pts: number): string => (pts >= 6 ? "Great fit" : pts >= 2 ? "Good fit" : pts > -2 ? "Neutral fit" : pts > -6 ? "Poor fit" : "Bad fit");

/** One script as a card: its quality bar, how well its style suits the genre, and the strengths of the style. */
export const ScriptCard = ({
	info,
	genre,
	price,
	picked,
	hide,
	onPick,
	note,
}: {
	info: ScriptInfo;
	genre: FilmGenre;
	price?: number; // missing = free (the director's own script)
	picked?: boolean;
	hide: boolean; // "Hide ratings": words instead of numbers
	onPick?: () => void;
	note?: string;
}) => {
	const def = STYLES[info.style];
	const fit = fitPoints(info.style, genre);
	const rating = Math.round(scriptRating(info, genre));
	const body = (
		<>
			<div className="sc-head">
				<b>{def.label}</b>
				<span className="num">{price === undefined ? "Included" : fmtMoney(price)}</span>
			</div>
			<div className="muted fine">{info.own ? `Written by ${info.writer}, the director` : `by ${info.writer}`}</div>
			<Bar label="Script" value={info.quality} tone="main" />
			<div className="sc-fit">
				<span className={fit > 1 ? "gain" : fit < -1 ? "loss" : "muted"}>
					{hide ? fitWord(fit) : `${fit > 0 ? "+" : ""}${fit} ${GENRE_LABEL[genre]} fit`}
				</span>
				<span className="num">{hide ? qualityWord(rating) : <>rating <b>{rating}</b></>}</span>
			</div>
			<div className="sc-bars">
				<Bar label="Hook" value={def.bars.hook} />
				<Bar label="Acclaim" value={def.bars.acclaim} />
				<Bar label="Crowd" value={def.bars.crowd} />
				<Bar label="Risk" value={def.bars.risk} tone="risk" />
			</div>
			<div className="muted fine">{info.logline}</div>
			{note && <div className="muted fine">{note}</div>}
		</>
	);
	if (!onPick) return <div className="script-card static">{body}</div>;
	return (
		<button type="button" role="radio" aria-checked={!!picked} className={`script-card ${picked ? "picked" : ""}`} onClick={onPick}>
			{body}
		</button>
	);
};

/** The scripts on the market for the chosen genre. Click one to buy it for this film; click it again to put it back. */
export const ScriptPicker = ({
	scripts,
	genre,
	pickedId,
	hide,
	cash,
	onPick,
}: {
	scripts: Script[];
	genre: FilmGenre;
	pickedId: number | null | undefined;
	hide: boolean;
	cash: number;
	onPick: (id: number | null) => void;
}) => {
	const picked = scripts.find((s) => s.id === pickedId);
	return (
		<div className="field">
			<span className="label">
				Script <span className="muted">· {GENRE_LABEL[genre]} scripts on the market this season</span>
			</span>
			{scripts.length === 0 ? (
				<span className="muted">No scripts on the market.</span>
			) : (
				<div className="script-grid" role="radiogroup" aria-label="Script">
					{scripts.map((s) => (
						<ScriptCard key={s.id} info={s} genre={genre} price={s.price} picked={s.id === pickedId} hide={hide} onPick={() => onPick(s.id === pickedId ? null : s.id)} note={s.price > cash ? "More than you can afford." : undefined} />
					))}
				</div>
			)}
			<span className="muted fine">
				{picked ? STYLES[picked.style].blurb : "Pick one: it sets the story, and its fee is added to the cost. Each style suits some genres better. Switching genre shows that genre’s scripts."}
			</span>
		</div>
	);
};
