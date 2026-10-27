/**
 * Tiny inline-SVG marks for the streaming platforms. No images, no network: a few dozen bytes each,
 * drawn once with static markup, so they cost nothing at runtime. Stylised, not the official artwork.
 */
import type { SVGProps } from "react";

type Props = { id: string; name: string };

const text = (fill: string, label: string, extra: SVGProps<SVGTextElement> = {}) => (
	<text x="0" y="22" fill={fill} fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontWeight="800" fontSize="22" {...extra}>
		{label}
	</text>
);

const MARKS: Record<string, { w: number; node: JSX.Element }> = {
	netflix: {
		w: 24,
		node: (
			<>
				<path d="M4 2h6v28H4z" fill="#b20710" />
				<path d="M20 2h6v28h-6z" fill="#b20710" />
				<path d="M4 2h6l16 28h-6z" fill="#e50914" />
			</>
		),
	},
	prime: {
		w: 74,
		node: (
			<>
				{text("#fff", "prime", { fontSize: 24, fontWeight: 700, x: 0, y: 20 })}
				<path d="M2 26c14 6 34 6 50 0" stroke="#00a8e1" strokeWidth="2.6" fill="none" strokeLinecap="round" />
				<path d="M46 22l7 3-5 5" stroke="#00a8e1" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			</>
		),
	},
	disney: {
		w: 62,
		node: text("#fff", "Disney+", { fontStyle: "italic", fontWeight: 600, fontSize: 19, fontFamily: "'Iowan Old Style', Georgia, serif", y: 22 }),
	},
	max: { w: 56, node: text("#2e7bff", "max", { fontSize: 28, fontWeight: 900, y: 24 }) },
	apple: {
		w: 40,
		node: (
			<>
				<path d="M20 9c-3-2-8-1-9 4-1 6 3 14 7 14 1 0 1.5-.7 2-.7s1 .7 2 .7c4 0 7-7 6-9-3-1-4-5-1-7-2-2-5-2-7-2z" fill="#fff" />
				<path d="M20 8c0-3 2-5 4-5 0 3-2 5-4 5z" fill="#fff" />
			</>
		),
	},
	paramount: {
		w: 34,
		node: (
			<>
				<circle cx="17" cy="17" r="15" fill="#0064ff" />
				<path d="M5 27L17 7l12 20z" fill="#fff" opacity="0.92" />
				<path d="M12 27l5-8 5 8z" fill="#0064ff" />
			</>
		),
	},
	peacock: {
		w: 34,
		node: (
			<>
				{[
					["#f6c600", 17, 4],
					["#ff4f36", 28, 10],
					["#12b886", 6, 10],
					["#5b6df6", 24, 20],
					["#00b3ff", 10, 20],
				].map(([c, x, y]) => (
					<circle key={String(c)} cx={x as number} cy={y as number} r="4.2" fill={c as string} />
				))}
				<path d="M17 28v-8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
			</>
		),
	},
	hulu: { w: 62, node: text("#1ce783", "hulu", { fontSize: 28, fontWeight: 900, y: 24 }) },
	mubi: { w: 70, node: text("#fff", "MUBI", { fontSize: 22, fontWeight: 800, letterSpacing: "0.12em" }) },
};

export const StreamLogo = ({ id, name }: Props) => {
	const m = MARKS[id];
	if (!m) return null;
	return (
		<svg className="nf-logo" viewBox={`0 0 ${m.w} 32`} width={m.w} height={32} role="img" aria-label={name}>
			{m.node}
		</svg>
	);
};
