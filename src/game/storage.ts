import LZString from "lz-string";
import { challengeLabel } from "./challenges";
import { withTraits } from "./traits";
import { addScripts } from "./scripts";
import { Phase } from "./types";
import type { GameState, StreamingDeal } from "./types";

// Bump this number whenever GameState changes shape, so old saves are ignored.
const SLOT_PREFIX = "studio-gm-slot-v3-";
const LAST_KEY = "studio-gm-last-slot";
const LEGACY_KEY = "studio-gm-save-v3"; // the single save from before slots existed

export const SLOT_COUNT = 5;

type Envelope = { savedAt: number; state: GameState };

export type SlotInfo = {
	slot: number; // 1..SLOT_COUNT
	empty: boolean;
	savedAt?: number;
	summary?: { studio: string; difficulty: GameState["difficulty"]; hideRatings?: boolean; allTime?: boolean; challenge?: string; season: number; cash: number; reputation: number; films: number };
};

const slotKey = (slot: number) => SLOT_PREFIX + slot;

// A long game is ~1.5 MB of JSON and a browser only gives a site ~5 MB of localStorage, so three or four
// developed saves used to fill it and every further save failed silently. Saves are now compressed (about 5x smaller).
// Uncompressed saves from before still load, and are compressed the first time the slots are read.
const PACKED = "lz:";
const pack = (json: string): string => PACKED + LZString.compressToUTF16(json);
const unpack = (raw: string): string | null => (raw.startsWith(PACKED) ? LZString.decompressFromUTF16(raw.slice(PACKED.length)) : raw);

let compacted = false;
/** Once per page load: rewrite every old uncompressed slot in compressed form (always smaller, so it cannot hit the quota). */
const compactOldSlots = (): void => {
	if (compacted) return;
	compacted = true;
	for (let slot = 1; slot <= SLOT_COUNT; slot++) {
		try {
			const raw = localStorage.getItem(slotKey(slot));
			if (raw && !raw.startsWith(PACKED)) localStorage.setItem(slotKey(slot), pack(raw));
		} catch {
			// leave it as it was
		}
	}
};

/**
 * Saves from before streaming contracts: a deal was a one-off fee plus a short viewership bonus.
 * Turn each into a plain contract (the money already paid stays paid; the bonus keeps coming) and drop the old offers and talks.
 */
const migrateStreaming = (state: GameState): void => {
	const old = state.streamDeals as unknown as (Partial<StreamingDeal> & { fee?: number; season?: number; bonus?: number; bonusLeft?: number })[] | undefined;
	if (!old?.length && !(state as { streamTalks?: unknown }).streamTalks) {
		if (state.streamOffers?.some((o) => (o as { fee?: number }).fee !== undefined)) state.streamOffers = [];
		return;
	}
	state.streamDeals = (old ?? []).map((d) => {
		if (d.status) return d as StreamingDeal; // already a contract
		const signed = d.season ?? state.season;
		const left = d.bonusLeft ?? 0;
		return {
			id: d.id ?? 0,
			mid: d.mid ?? -1,
			platformId: d.platformId ?? "",
			kind: "licence",
			signed,
			firstPay: Math.max(signed + 1, state.season),
			years: Math.max(1, left),
			upfront: d.fee ?? 0,
			annual: left > 0 ? (d.bonus ?? 0) : 0,
			perks: [],
			demands: [],
			festivals: d.festivals ?? [],
			paidTotal: d.fee ?? 0,
			withheld: 0,
			renewals: 0,
			status: left > 0 ? "active" : "ended",
			...(left > 0 ? {} : { endedSeason: signed + 2, endNote: "Old-style deal that had finished paying." }),
		} as StreamingDeal;
	});
	state.streamOffers = [];
	delete (state as { streamTalks?: unknown }).streamTalks;
};

const readEnvelope = (slot: number): Envelope | null => {
	try {
		const raw = localStorage.getItem(slotKey(slot));
		if (!raw) return null;
		const json = unpack(raw);
		if (!json) return null;
		const env = JSON.parse(json) as Envelope;
		if (!env?.state) return null;
		env.state.difficulty ??= "normal"; // saves made before difficulty existed
		migrateStreaming(env.state);
		if (env.state.people.some((p) => !p.traits)) env.state.people = env.state.people.map(withTraits); // saves from before personality traits
		if (env.state.phase === Phase.DEVELOPMENT && !env.state.scripts?.some((s) => s.season === env.state.season)) addScripts(env.state); // saves from before scripts
		return env;
	} catch {
		return null;
	}
};

/** Move the old single save into slot 1 (only if slot 1 is free). Runs once. */
const migrateLegacy = (): void => {
	compactOldSlots();
	try {
		const raw = localStorage.getItem(LEGACY_KEY);
		if (!raw) return;
		if (!readEnvelope(1)) {
			const env: Envelope = { savedAt: Date.now(), state: JSON.parse(raw) as GameState };
			localStorage.setItem(slotKey(1), pack(JSON.stringify(env)));
			localStorage.setItem(LAST_KEY, "1");
		}
		localStorage.removeItem(LEGACY_KEY);
	} catch {
		// ignore: the old save is simply left alone
	}
};

/** Writes the save. Returns false when it could not be stored (storage full or blocked), so the UI can say so. */
export const saveGame = (slot: number, state: GameState): boolean => {
	try {
		compactOldSlots();
		const env: Envelope = { savedAt: Date.now(), state };
		localStorage.setItem(slotKey(slot), pack(JSON.stringify(env)));
		localStorage.setItem(LAST_KEY, String(slot));
		return true;
	} catch (e) {
		console.error("Studio GM: could not save", e);
		return false;
	}
};

export const loadGame = (slot: number): GameState | null => {
	migrateLegacy();
	const env = readEnvelope(slot);
	if (!env) return null;
	try {
		localStorage.setItem(LAST_KEY, String(slot));
	} catch {
		// ignore
	}
	return env.state;
};

export const clearGame = (slot: number): void => {
	try {
		localStorage.removeItem(slotKey(slot));
		if (localStorage.getItem(LAST_KEY) === String(slot)) localStorage.removeItem(LAST_KEY);
	} catch {
		// ignore
	}
};

/** The slot played most recently, if it still has a save. */
export const lastSlot = (): number | null => {
	migrateLegacy();
	try {
		const n = Number(localStorage.getItem(LAST_KEY));
		return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT && readEnvelope(n) ? n : null;
	} catch {
		return null;
	}
};

export const listSlots = (): SlotInfo[] => {
	migrateLegacy();
	return Array.from({ length: SLOT_COUNT }, (_, i) => {
		const slot = i + 1;
		const env = readEnvelope(slot);
		if (!env) return { slot, empty: true };
		const s = env.state;
		const studio = s.studios.find((x) => x.tid === s.userTid);
		return {
			slot,
			empty: false,
			savedAt: env.savedAt,
			summary: {
				studio: studio?.name ?? "Your studio",
				difficulty: s.difficulty,
				hideRatings: s.hideRatings,
				allTime: s.allTime,
				challenge: challengeLabel(s.challenge) ?? undefined,
				season: s.season,
				cash: studio?.cash ?? 0,
				reputation: Math.round(studio?.reputation ?? 0),
				films: s.movies.filter((m) => m.tid === s.userTid).length,
			},
		};
	});
};
