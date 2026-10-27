import { useEffect, useState } from "react";
import { NEGOTIATIONS_EVENT, NEGOTIATIONS_KEY, negotiationsOn } from "../game/features";

/** True while the advanced negotiations toggle is on (the Talent checkbox or the Studio GM Toolkit popup). */
export const useNegotiations = (): boolean => {
	const [on, setOn] = useState(negotiationsOn);
	useEffect(() => {
		const sync = () => setOn(negotiationsOn());
		const onStorage = (e: StorageEvent) => e.key === NEGOTIATIONS_KEY && sync();
		window.addEventListener(NEGOTIATIONS_EVENT, sync);
		window.addEventListener("storage", onStorage);
		return () => {
			window.removeEventListener(NEGOTIATIONS_EVENT, sync);
			window.removeEventListener("storage", onStorage);
		};
	}, []);
	return on;
};
