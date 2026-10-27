import { parseTokens } from "../game/news/util";
import { useOpenMovie, useOpenProfile } from "./profileContext";

/** Article text with its [[p:12|Name]] and [[m:34|Title]] tokens turned into clickable names and film titles. */
export const NewsText = ({ text }: { text: string }) => {
	const openPerson = useOpenProfile();
	const openMovie = useOpenMovie();
	return (
		<>
			{parseTokens(text).map((piece, i) => {
				if (!("kind" in piece)) return <span key={i}>{piece.text}</span>;
				const open = piece.kind === "p" ? openPerson : openMovie;
				if (!open) return <span key={i}>{piece.text}</span>;
				return (
					<button key={i} type="button" className={`name-link ${piece.kind === "m" ? "film-link" : ""}`} onClick={() => open(piece.id)}>
						{piece.text}
					</button>
				);
			})}
		</>
	);
};
