import { createContext, useContext } from "react";

/** True when the game was started with "Hide ratings": no Ovr, Fit or attribute numbers anywhere. Provided by App. */
export const HideRatingsContext = createContext(false);
export const useHideRatings = () => useContext(HideRatingsContext);
