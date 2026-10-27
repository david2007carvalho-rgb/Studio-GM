import { useEffect, useState } from "react";
import { BRANDS_EVENT, BRANDS_KEY, BRANDS_OPTS_KEY, brandDealsOn, brandOpts } from "../game/features";
import type { BrandOpts } from "../game/features";

/** The Brand Deals switch and options (the Brands page checkbox or the Studio GM Toolkit popup). Re-renders when either changes. */
export const useBrandDeals = (): { on: boolean; opts: BrandOpts } => {
	const read = () => ({ on: brandDealsOn(), opts: brandOpts() });
	const [value, setValue] = useState(read);
	useEffect(() => {
		const sync = () => setValue(read());
		const onStorage = (e: StorageEvent) => (e.key === BRANDS_KEY || e.key === BRANDS_OPTS_KEY) && sync();
		window.addEventListener(BRANDS_EVENT, sync);
		window.addEventListener("storage", onStorage);
		return () => {
			window.removeEventListener(BRANDS_EVENT, sync);
			window.removeEventListener("storage", onStorage);
		};
	}, []);
	return value;
};
