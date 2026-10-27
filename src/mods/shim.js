/* Phone replacement for the browser-extension APIs the Toolkit mods were written against.
 * chrome.storage.local  -> localStorage (JSON, one key per entry)
 * chrome.runtime       -> in-page messaging; the IMDb photo lookup (the old background.js) lives here now. */
import LZString from "lz-string";

globalThis.LZString = LZString;

const P = "sgm-chrome:";
const changeListeners = new Set();
const messageListeners = new Set();

const readKey = (k) => {
  try { const raw = localStorage.getItem(P + k); return raw == null ? undefined : JSON.parse(raw); } catch (_) { return undefined; }
};
const writeKey = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (_) { /* storage full: ignore */ } };

const local = {
  async get(keys) {
    const list = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : keys && typeof keys === "object" ? Object.keys(keys) : [];
    const out = {};
    for (const k of list) { const v = readKey(k); if (v !== undefined) out[k] = v; }
    return out;
  },
  async set(obj) {
    const changes = {};
    for (const [k, v] of Object.entries(obj)) {
      const oldValue = readKey(k);
      writeKey(k, v);
      changes[k] = { oldValue, newValue: v };
    }
    for (const fn of [...changeListeners]) { try { fn(changes, "local"); } catch (_) { /* a listener must not break saving */ } }
  },
};

// ── IMDb photo lookup (ported from the extension's background.js) ──
const HIT_TTL = 90 * 24 * 3600 * 1000;
const MISS_TTL = 7 * 24 * 3600 * 1000;
const inflight = new Map();
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ROLE_WORDS = { director: ["director"], actor: ["actor"], actress: ["actress", "actor"] };

async function fetchSuggestions(name) {
  const q = norm(name).replace(/ /g, "_");
  if (!q) return [];
  for (const host of ["v2", "v3"]) {
    try {
      const res = await fetch(`https://${host}.sg.media-imdb.com/suggestion/${q[0]}/${encodeURIComponent(q)}.json`);
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json.d)) return json.d;
    } catch (_) { /* try the next endpoint */ }
  }
  throw new Error("IMDb lookup failed");
}
function pick(results, name, role) {
  const target = norm(name);
  const people = results.filter((r) => typeof r.id === "string" && r.id.startsWith("nm") && norm(r.l || "") === target);
  if (!people.length) return null;
  const words = ROLE_WORDS[role] || [];
  return people.find((r) => words.some((w) => (r.s || "").toLowerCase().includes(w))) || people[0];
}
const resize = (url) => url.replace(/\._V1_.*\.(jpg|png)$/i, "._V1_UX256_CR0,0,256,256_.$1");

async function lookup(name, role) {
  const key = `imdb|v2|${role}|${norm(name)}`;
  const hit = readKey(key);
  if (hit && Date.now() - hit.t < (hit.id ? HIT_TTL : MISS_TTL)) return { url: hit.url, id: hit.id };
  let url = null, id = null;
  try {
    const match = pick(await fetchSuggestions(name), name, role);
    if (match) { id = match.id; if (match.i && match.i.imageUrl) url = resize(match.i.imageUrl); }
  } catch (_) {
    return { url: null, id: null }; // offline or blocked: show the grey image this time, try again later
  }
  writeKey(key, { url, id, t: Date.now() });
  return { url, id };
}

globalThis.chrome = {
  storage: { local, onChanged: { addListener: (fn) => changeListeners.add(fn) } },
  runtime: {
    lastError: undefined,
    onMessage: { addListener: (fn) => messageListeners.add(fn) },
    sendMessage(msg, cb) {
      const done = (res) => { try { cb && cb(res); } catch (_) { /* ignore */ } };
      if (msg && msg.type === "imdb-photo") {
        const k = `${msg.role}|${msg.name}`;
        if (!inflight.has(k)) inflight.set(k, lookup(msg.name, msg.role).finally(() => inflight.delete(k)));
        inflight.get(k).then(done);
        return;
      }
      let answered = false;
      for (const fn of [...messageListeners]) {
        try { if (fn(msg, {}, (r) => { answered = true; done(r); })) return; } catch (_) { /* ignore */ }
      }
      if (!answered) done(undefined);
    },
  },
};
