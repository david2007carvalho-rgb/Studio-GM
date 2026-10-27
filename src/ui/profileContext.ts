import { createContext, useContext } from "react";

/** Lets any name in the game open that person's profile window. Provided by App. */
export const ProfileContext = createContext<((pid: number) => void) | null>(null);
export const useOpenProfile = () => useContext(ProfileContext);

/** Lets any film title in the game open that film's page. Provided by App. */
export const MovieContext = createContext<((mid: number) => void) | null>(null);
export const useOpenMovie = () => useContext(MovieContext);
