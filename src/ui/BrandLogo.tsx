import type { Brand } from "../game/brandData";

/** A round badge in the brand's colours. Lettering only: no images, no network. */
export const BrandLogo = ({ brand, size = 34 }: { brand: Brand; size?: number }) => (
	<span
		className="bd-logo"
		aria-hidden="true"
		style={{ background: brand.color, color: brand.ink, width: size, height: size, fontSize: brand.mark.length > 3 ? size * 0.26 : brand.mark.length > 2 ? size * 0.32 : size * 0.42 }}
	>
		{brand.mark || "\uF8FF"}
	</span>
);
