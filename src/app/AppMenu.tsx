import { useCallback, useEffect, useRef, useState } from "react";
import { checkForUpdate, discardUpdate, downloadUpdate, getUpdateUrl, installFromFile, lastCheck, restart, running, setUpdateUrl, stagedUpdate } from "./updater";
import type { OtaMeta } from "./updater";

/* The app menu: updates and mods. Opened by the gear button (any code can open it with openAppMenu()). */
export const openAppMenu = (): void => window.dispatchEvent(new Event("sgm-open-menu"));

export const MenuButton = ({ className = "btn ghost" }: { className?: string }) => (
	<button className={className} onClick={openAppMenu} aria-label="App menu: updates and mods">
		⚙ Menu
	</button>
);

// ── updates ─────────────────────────────────────────────
const Updates = () => {
	const [staged, setStaged] = useState<OtaMeta | null>(null);
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);
	const [url, setUrl] = useState(getUpdateUrl());
	const fileRef = useRef<HTMLInputElement>(null);
	const run = running();

	useEffect(() => { void stagedUpdate().then(setStaged); }, []);

	const check = async () => {
		setBusy(true);
		setMsg("Checking…");
		setUpdateUrl(url);
		const r = await checkForUpdate();
		if (r.state === "current") setMsg("You have the latest version.");
		else if (r.state === "error") setMsg(r.message);
		else {
			try {
				setMsg(`Downloading version ${r.meta.version}…`);
				await downloadUpdate(r.meta);
				setStaged(r.meta);
				setMsg("Update downloaded. Restart to use it.");
			} catch (e) {
				setMsg(e instanceof Error ? e.message : "Download failed.");
			}
		}
		setBusy(false);
	};

	const pickFile = async (f: File | undefined) => {
		if (!f) return;
		try {
			const meta = await installFromFile(f);
			setStaged(meta);
			setMsg(`Update ${meta.version} installed. Restart to use it.`);
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Could not read that file.");
		}
	};

	const last = lastCheck();
	return (
		<div className="sheet-section">
			<dl className="kv sheet-kv">
				<dt>Version</dt>
				<dd>{run.version} · build {run.build}</dd>
				<dt>Running from</dt>
				<dd>{run.source === "update" ? "a downloaded update" : "the installed app"}</dd>
				<dt>Last check</dt>
				<dd>{last ? new Date(last).toLocaleString() : "never"}</dd>
			</dl>
			{staged && (
				<div className="sheet-banner">
					<b>Update {staged.version} is ready.</b>
					{staged.notes && <span> {staged.notes}</span>}
					<button className="btn" onClick={restart}>Restart now</button>
				</div>
			)}
			<button className="btn" disabled={busy || !url.trim()} onClick={check}>Check for updates</button>
			{msg && <p className="sheet-msg" role="status">{msg}</p>}
			<label className="sheet-field">
				<span>Update address</span>
				<input type="url" value={url} placeholder="https://your-name.github.io/studio-gm/" onChange={(e) => setUrl(e.target.value)} onBlur={() => setUpdateUrl(url)} />
			</label>
			<p className="muted fine">The app checks this address by itself when it opens. Your saves are never touched by an update.</p>
			<button className="btn quiet" onClick={() => fileRef.current?.click()}>Install update from a file…</button>
			<input ref={fileRef} type="file" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
			{run.source === "update" && (
				<button className="btn quiet" onClick={async () => { await discardUpdate(); restart(); }}>Go back to the installed version</button>
			)}
		</div>
	);
};

// ── mods ────────────────────────────────────────────────
type Setting = { key: string; type: "toggle" | "select"; label: string; default: unknown; options?: [string, string][] };
type Mod = { id: string; name: string; icon: string; category: string; version: string; tagline: string; description: string; settings: Setting[]; changelog: string[] };
type Store = {
	load: () => Promise<Record<string, unknown>>;
	update: (id: string, patch: { enabled?: boolean; settings?: Record<string, unknown> }) => Promise<Record<string, unknown>>;
	reset: () => Promise<void>;
	isEnabled: (s: Record<string, unknown>, id: string) => boolean;
	settingsOf: (s: Record<string, unknown>, id: string) => Record<string, unknown>;
};
const g = globalThis as unknown as { SGM_META?: Mod[]; SGMStore?: Store; chrome?: { runtime: { sendMessage: (m: unknown, cb: (r: { running: string[]; failed: Record<string, string> } | undefined) => void) => void } } };

const Mods = () => {
	const mods = g.SGM_META ?? [];
	const store = g.SGMStore;
	const [state, setState] = useState<Record<string, unknown>>({});
	const [live, setLive] = useState<{ running: string[]; failed: Record<string, string> }>({ running: [], failed: {} });
	const [open, setOpen] = useState<string | null>(null);

	const refreshLive = useCallback(() => {
		g.chrome?.runtime.sendMessage({ type: "sgm-status" }, (r) => r && setLive(r));
	}, []);
	useEffect(() => {
		void store?.load().then(setState);
		refreshLive();
	}, [store, refreshLive]);

	if (!store || !mods.length) return <p className="muted">Mods are not available in this build.</p>;
	const change = async (fn: () => Promise<Record<string, unknown>>) => {
		setState(await fn());
		setTimeout(refreshLive, 250);
	};
	const groups = [...new Set(mods.map((m) => m.category))];
	const onCount = mods.filter((m) => store.isEnabled(state, m.id)).length;

	return (
		<div className="sheet-section">
			<p className="muted">{onCount} of {mods.length} mods on. Changes apply instantly. Mods only read the game; they never change a save.</p>
			{groups.map((grp) => (
				<div key={grp}>
					<div className="mod-group">{grp}</div>
					{mods.filter((m) => m.category === grp).map((m) => {
						const on = store.isEnabled(state, m.id);
						const cfg = store.settingsOf(state, m.id);
						const bad = live.failed[m.id];
						return (
							<section key={m.id} className={`mod-card${on ? " on" : ""}`}>
								<div className="mod-top">
									<span className="mod-icon" aria-hidden>{m.icon}</span>
									<button className="mod-title" aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}>
										<strong>
											<span className={`mod-dot${bad ? " bad" : live.running.includes(m.id) ? " live" : ""}`} />
											{m.name} <span className="mod-ver">v{m.version}</span>
										</strong>
										<small>{m.tagline}</small>
									</button>
									<input type="checkbox" role="switch" className="mod-switch" aria-label={m.name} checked={on} onChange={(e) => void change(() => store.update(m.id, { enabled: e.target.checked }))} />
								</div>
								{open === m.id && (
									<div className="mod-body">
										<p>{m.description}</p>
										{m.settings.map((s) => (
											<label key={s.key} className="mod-setting">
												<span>{s.label}</span>
												{s.type === "toggle" ? (
													<input type="checkbox" checked={!!cfg[s.key]} onChange={(e) => void change(() => store.update(m.id, { settings: { [s.key]: e.target.checked } }))} />
												) : (
													<select value={String(cfg[s.key])} onChange={(e) => void change(() => store.update(m.id, { settings: { [s.key]: e.target.value } }))}>
														{s.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
													</select>
												)}
											</label>
										))}
										{bad && <p className="loss">Could not start: {bad}</p>}
										<ul className="fine muted">{m.changelog.map((c) => <li key={c}>{c}</li>)}</ul>
									</div>
								)}
							</section>
						);
					})}
				</div>
			))}
			<button className="btn quiet" onClick={() => void change(async () => { await store.reset(); return store.load(); })}>Reset all mods to defaults</button>
			<p className="muted fine">The IMDb photos mod needs internet; without it you just see the grey placeholder.</p>
		</div>
	);
};

// ── the sheet ───────────────────────────────────────────
export const AppMenu = () => {
	const [openSheet, setOpenSheet] = useState(false);
	const [tab, setTab] = useState<"updates" | "mods">("updates");
	useEffect(() => {
		const on = () => setOpenSheet(true);
		window.addEventListener("sgm-open-menu", on);
		return () => window.removeEventListener("sgm-open-menu", on);
	}, []);
	if (!openSheet) return null;
	return (
		<div className="sgm-sheet" role="dialog" aria-modal="true" aria-label="App menu">
			<header className="sheet-head">
				<h2>Menu</h2>
				<button className="btn ghost" data-sheet-close onClick={() => setOpenSheet(false)}>Close</button>
			</header>
			<div className="sheet-tabs" role="tablist">
				<button role="tab" aria-selected={tab === "updates"} onClick={() => setTab("updates")}>Updates</button>
				<button role="tab" aria-selected={tab === "mods"} onClick={() => setTab("mods")}>Mods</button>
			</div>
			<div className="sheet-body">{tab === "updates" ? <Updates /> : <Mods />}</div>
		</div>
	);
};

// ── automatic checks + the "update ready" toast ─────────
export const UpdateWatcher = () => {
	const [ready, setReady] = useState<OtaMeta | null>(null);
	useEffect(() => {
		let alive = true;
		const run = async () => {
			if (!getUpdateUrl() || Date.now() - lastCheck() < 20 * 60 * 1000) { setReady(await stagedUpdate()); return; }
			const r = await checkForUpdate();
			if (r.state === "available") { try { await downloadUpdate(r.meta); } catch { /* try again next time */ } }
			if (alive) setReady(await stagedUpdate());
		};
		const t = setTimeout(() => void run(), 3500);
		const vis = () => document.visibilityState === "visible" && void run();
		document.addEventListener("visibilitychange", vis);
		return () => { alive = false; clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
	}, []);
	if (!ready) return null;
	return (
		<div className="update-toast" role="status">
			<span>Update {ready.version} ready</span>
			<button className="btn" onClick={restart}>Restart</button>
			<button className="btn ghost" aria-label="Dismiss" onClick={() => setReady(null)}>✕</button>
		</div>
	);
};
