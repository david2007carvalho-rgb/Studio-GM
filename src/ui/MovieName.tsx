import type { ReactNode } from "react";
import { useOpenMovie } from "./profileContext";

/** A film title you can click to open the film's page. Without a provider it is plain text. */
export const MovieName = ({ mid, children }: { mid: number; children: ReactNode }) => {
	const open = useOpenMovie();
	if (!open) return <>{children}</>;
	return (
		<button type="button" className="name-link" onClick={() => open(mid)}>
			{children}
		</button>
	);
};
