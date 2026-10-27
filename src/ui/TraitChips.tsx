import { TRAITS, knownTraitsOf } from "../game/traits";
import type { Person, TraitId } from "../game/types";

/** One personality trait as a small coloured chip. Hover for what it does. */
export const TraitChip = ({ id }: { id: TraitId }) => (
	<span className={`trait ${TRAITS[id].tone}`} title={TRAITS[id].blurb}>
		{TRAITS[id].label}
	</span>
);

/** The traits of a person that the player has discovered. Hidden ones are never shown (nothing here hints that they exist). */
export const TraitChips = ({ person }: { person: Pick<Person, "traits" | "knownTraits"> }) => {
	const known = knownTraitsOf(person);
	if (known.length === 0) return null;
	return (
		<span className="trait-row">
			{known.map((id) => (
				<TraitChip key={id} id={id} />
			))}
		</span>
	);
};
