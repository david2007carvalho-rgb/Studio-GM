/* Over-the-air updates. The app is a thin native shell around a web bundle (one .js + one .css file).
 * An update is just a newer pair of those two files, saved in Cache Storage; the loader in index.html
 * (written by scripts/postbuild.mjs) boots from them instead of the bundled copy. Same origin, so saves are untouched.
 * Two ways in: the update address (GitHub Pages, checked automatically) or an update file picked from the phone. */

const CACHE = "sgm-ota-v1";
const URL_KEY = "sgm-update-url";
const LAST_KEY = "sgm-update-last-check";

export type OtaMeta = { build: number; version: string; js: string; css: string; notes?: string };
type Running = { build: number; version: string; source: "bundled" | "update"; updateUrl?: string };

export const running = (): Running => (window as unknown as { __SGM__?: Running }).__SGM__ ?? { build: 0, version: "dev", source: "bundled" };

export const getUpdateUrl = (): string => {
	let u = "";
	try { u = localStorage.getItem(URL_KEY) ?? ""; } catch { /* ignore */ }
	u = (u || running().updateUrl || "").trim();
	return u && !u.endsWith("/") ? u + "/" : u;
};
export const setUpdateUrl = (u: string): void => {
	try { u.trim() ? localStorage.setItem(URL_KEY, u.trim()) : localStorage.removeItem(URL_KEY); } catch { /* ignore */ }
};

const supported = (): boolean => typeof caches !== "undefined";

/** The update already downloaded and waiting for a restart, if it is newer than what is running. */
export const stagedUpdate = async (): Promise<OtaMeta | null> => {
	if (!supported()) return null;
	try {
		const c = await caches.open(CACHE);
		const m = await c.match("/__ota/meta");
		const meta = m ? ((await m.json()) as OtaMeta) : null;
		return meta && meta.build > running().build ? meta : null;
	} catch {
		return null;
	}
};

const stage = async (meta: OtaMeta, js: string, css: string): Promise<void> => {
	if (!supported()) throw new Error("This device cannot store updates (Cache Storage is missing).");
	if (js.length < 2000 || !css.length) throw new Error("The update files look empty or damaged.");
	const c = await caches.open(CACHE);
	await c.put("/__ota/js", new Response(js));
	await c.put("/__ota/css", new Response(css));
	await c.put("/__ota/meta", new Response(JSON.stringify({ build: meta.build, version: meta.version, js: meta.js, css: meta.css, notes: meta.notes })));
};

export type CheckResult = { state: "current" } | { state: "available"; meta: OtaMeta } | { state: "error"; message: string };

/** Ask the update address whether something newer than the running build exists. */
export const checkForUpdate = async (): Promise<CheckResult> => {
	const base = getUpdateUrl();
	if (!base) return { state: "error", message: "No update address set." };
	try {
		const res = await fetch(`${base}update.json?t=${Date.now()}`, { cache: "no-store" });
		if (!res.ok) return { state: "error", message: `The server answered ${res.status}.` };
		const meta = (await res.json()) as OtaMeta;
		try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* ignore */ }
		if (typeof meta.build !== "number" || !meta.js || !meta.css) return { state: "error", message: "update.json is not valid." };
		const staged = await stagedUpdate();
		if (meta.build <= running().build || (staged && staged.build >= meta.build)) return { state: "current" };
		return { state: "available", meta };
	} catch (e) {
		return { state: "error", message: e instanceof Error ? e.message : "Could not reach the update address (offline?)." };
	}
};

/** Download the files of an available update and keep them ready for the next restart. */
export const downloadUpdate = async (meta: OtaMeta): Promise<void> => {
	const base = getUpdateUrl();
	const [jsRes, cssRes] = await Promise.all([fetch(base + meta.js, { cache: "no-store" }), fetch(base + meta.css, { cache: "no-store" })]);
	if (!jsRes.ok || !cssRes.ok) throw new Error("Could not download the update files.");
	await stage(meta, await jsRes.text(), await cssRes.text());
};

/** Install an update from a .sgmupdate file the person picked (no server needed). */
export const installFromFile = async (file: File): Promise<OtaMeta> => {
	const data = JSON.parse(await file.text()) as { format?: string; build?: number; version?: string; js?: string; css?: string; notes?: string };
	if (data.format !== "sgm-update-1" || typeof data.build !== "number" || !data.js || data.css === undefined) throw new Error("This is not a Studio GM update file.");
	if (data.build <= running().build) throw new Error(`This update (build ${data.build}) is not newer than the one running (build ${running().build}).`);
	const meta: OtaMeta = { build: data.build, version: data.version ?? "?", js: "", css: "", notes: data.notes };
	await stage(meta, data.js, data.css);
	return meta;
};

/** Remove any downloaded update and go back to the bundled app on the next restart. */
export const discardUpdate = async (): Promise<void> => {
	try { if (supported()) await caches.delete(CACHE); } catch { /* ignore */ }
	try { localStorage.removeItem("sgm-ota-trying"); } catch { /* ignore */ }
};

export const lastCheck = (): number => {
	try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; }
};
export const restart = (): void => location.reload();
