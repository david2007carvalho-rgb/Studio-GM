// Optional features that can be switched on and off. The Studio GM Toolkit extension flips the same switch from its popup
// (its content script mirrors this localStorage key), and the Talent panel has a checkbox for it.

export const NEGOTIATIONS_KEY = "studio-gm-advanced-negotiations";
export const NEGOTIATIONS_EVENT = "sgm-negotiations-change";

export const negotiationsOn = (): boolean => {
	try {
		return localStorage.getItem(NEGOTIATIONS_KEY) === "1";
	} catch {
		return false;
	}
};

export const setNegotiationsOn = (on: boolean): void => {
	try {
		localStorage.setItem(NEGOTIATIONS_KEY, on ? "1" : "0");
	} catch {
		// private mode: the switch simply does not stick
	}
	window.dispatchEvent(new Event(NEGOTIATIONS_EVENT));
};

// ── Brand Deals (see brands.ts) ──────────────────────────────
// On unless switched off (a missing key means on). The Studio GM Toolkit's "Brand Deals" mod writes the same keys:
// the switch, and a few options (fee level, whether beer and spirits brands are in the game).

export const BRANDS_KEY = "studio-gm-brand-deals";
export const BRANDS_OPTS_KEY = "studio-gm-brand-deals-opts";
export const BRANDS_EVENT = "sgm-brand-deals-change";

export type BrandOpts = {
	alcohol: boolean; // beer and spirits brands take part
	fees: "stingy" | "fair" | "generous"; // how much brands pay
};
export const DEFAULT_BRAND_OPTS: BrandOpts = { alcohol: true, fees: "fair" };

export const brandDealsOn = (): boolean => {
	try {
		return localStorage.getItem(BRANDS_KEY) !== "0";
	} catch {
		return true;
	}
};

export const setBrandDealsOn = (on: boolean): void => {
	try {
		localStorage.setItem(BRANDS_KEY, on ? "1" : "0");
	} catch {
		// private mode: the switch simply does not stick
	}
	window.dispatchEvent(new Event(BRANDS_EVENT));
};

export const brandOpts = (): BrandOpts => {
	try {
		const raw = localStorage.getItem(BRANDS_OPTS_KEY);
		const parsed = raw ? (JSON.parse(raw) as Partial<BrandOpts>) : {};
		return {
			alcohol: typeof parsed.alcohol === "boolean" ? parsed.alcohol : DEFAULT_BRAND_OPTS.alcohol,
			fees: parsed.fees === "stingy" || parsed.fees === "generous" ? parsed.fees : DEFAULT_BRAND_OPTS.fees,
		};
	} catch {
		return { ...DEFAULT_BRAND_OPTS };
	}
};

export const FEE_LEVEL: Record<BrandOpts["fees"], number> = { stingy: 0.75, fair: 1, generous: 1.3 };
