import { brandById, CATEGORY_LABEL } from "../game/brandData";
import type { Brand } from "../game/brandData";
import { visibleBrands, planBrands, pickBlocker, quote, MAX_PLACEMENTS } from "../game/brands";
import type { QuoteCtx } from "../game/brands";
import { fmtMoney } from "../game/format";
import type { BrandPick, BrandTier, GameState } from "../game/types";
import { BrandLogo } from "./BrandLogo";

type Props = {
	state: GameState;
	ctx: QuoteCtx;
	picks: BrandPick[];
	onChange: (picks: BrandPick[]) => void;
};

/** The "Brand partners" part of the greenlight form: product placements and a presenting sponsor that pay part of the cost. */
export const BrandPartners = ({ state, ctx, picks, onChange }: Props) => {
	const plan = planBrands(state, picks, ctx);
	const toggle = (brand: Brand, tier: BrandTier) => {
		const has = picks.find((p) => p.brandId === brand.id && p.tier === tier);
		onChange(has ? picks.filter((p) => p !== has) : [...picks.filter((p) => p.brandId !== brand.id), { brandId: brand.id, tier }]);
	};
	const rows = (tier: BrandTier) =>
		visibleBrands(tier)
			.map((brand) => ({ brand, q: quote(state, brand, tier, ctx) }))
			.map((r) => ({ ...r, block: pickBlocker(state, picks, r.brand, tier) }))
			.sort((a, b) => Number(b.q.ok && !b.block) - Number(a.q.ok && !a.block) || b.q.cash + b.q.cover - (a.q.cash + a.q.cover));

	const section = (tier: BrandTier, title: string, blurb: string) => (
		<div className="bd-section">
			<span className="label">{title}</span>
			<span className="muted fine">{blurb}</span>
			<div className="partner-list">
				{rows(tier).map(({ brand, q, block }) => {
					const on = picks.some((p) => p.brandId === brand.id && p.tier === tier);
					const off = !on && (!q.ok || !!block);
					return (
						<button key={brand.id} type="button" className={`partner-row bd-row ${on ? "chosen" : ""} ${off ? "off" : ""}`} disabled={off} aria-pressed={on} onClick={() => toggle(brand, tier)}>
							<span className="bd-who">
								<BrandLogo brand={brand} size={28} />
								<span>
									<b>{brand.name}</b> <span className="muted">· {CATEGORY_LABEL[brand.category]}</span>
									{q.love && <span className="gain"> · fits this genre</span>}
									{q.returning && <span className="gain"> · returning</span>}
									{q.partner && <span className="gain"> · your partner</span>}
								</span>
							</span>
							{off ? (
								<span className="muted">{block ?? q.refusal}</span>
							) : (
								<span className="num">
									pays <b>{fmtMoney(q.cash + q.cover)}</b> · <span className="loss">&minus;{q.critic} critics</span> · <span className="gain">+{(q.gross * 100).toFixed(1)}% gross</span>
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);

	return (
		<div className="field">
			<span className="muted fine">
				Brands pay towards the film and sell tickets with their own campaigns, but every logo costs critic points (action films hardly notice, dramas suffer). Up to {MAX_PLACEMENTS} placements and one presenting sponsor,
				one brand per category.
			</span>
			{section("sponsor", "Presenting sponsor", "“Presented by…”. The biggest cheque, the biggest cost, and it also pays part of the marketing.")}
			{section("placement", "Product placement", "A product on screen. Smaller cheques, smaller costs.")}
			{picks.length > 0 && (
				<div className="ip-box partner-box">
					{plan.ok ? (
						<>
							<b>
								{picks.map((p) => brandById(p.brandId)?.name).join(", ")} pay {fmtMoney(plan.funding)}
							</b>
							<span className="muted">
								Expect about <span className="loss">{plan.critic} critic points</span> and <span className="gain">+{(plan.gross * 100).toFixed(1)}% gross</span>. A hit pays a bonus, a flop owes a make-good.
								{plan.scaled && " The total is capped: brands never pay more than 45% of the film's cost."}
							</span>
						</>
					) : (
						<span className="loss">{plan.error}</span>
					)}
				</div>
			)}
		</div>
	);
};
