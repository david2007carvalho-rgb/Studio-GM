import type { AwardWinner, Person, SeasonAwards } from "../game/types";
import { useOpenProfile } from "./profileContext";

type Win = { season: number; award: string; movieTitle: string };

/** Every award this person has won, oldest first. */
export const awardsOf = (awards: SeasonAwards[], person: Pick<Person, "pid" | "name">): Win[] => {
	const wins: Win[] = [];
	const check = (season: number, award: string, w: AwardWinner | null | undefined) => {
		// Older saves did not store the winner's pid, so fall back to the name.
		if (w && (w.pid !== undefined ? w.pid === person.pid : w.name === person.name)) {
			wins.push({ season, award, movieTitle: w.movieTitle });
		}
	};
	for (const a of awards) {
		check(a.season, "Best director", a.bestDirector);
		check(a.season, "Best actor", a.bestActor);
		check(a.season, "Best actress", a.bestActress);
		check(a.season, "Best supporting actor", a.bestSupportingActor);
		check(a.season, "Best supporting actress", a.bestSupportingActress);
	}
	return wins.sort((a, b) => a.season - b.season);
};

/** A person's name (click it to open their profile); if they have won awards it shows a trophy and lists them (by year) on hover. */
export const PersonName = ({ person, awards }: { person: Pick<Person, "pid" | "name">; awards: SeasonAwards[] }) => {
	const open = useOpenProfile();
	const name = open ? (
		<button type="button" className="name-link" onClick={() => open(person.pid)}>
			{person.name}
		</button>
	) : (
		<>{person.name}</>
	);
	const wins = awardsOf(awards, person);
	if (wins.length === 0) return name;
	const tip = `${person.name}: ${wins.length} award${wins.length > 1 ? "s" : ""}\n` +
		wins.map((w) => `${w.season} – ${w.award} (${w.movieTitle})`).join("\n");
	return (
		<span title={tip} className="has-awards">
			{name} <span className="gold">🏆{wins.length}</span>
		</span>
	);
};
