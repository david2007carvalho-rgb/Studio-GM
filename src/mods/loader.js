/* Studio GM Toolkit — mod loader (runs on the game page).
 *
 * A mod is registered with SGM.register(id, { boot?, start(ctx), stop?(ctx) }).
 *   boot(ctx)  runs once on page load, even when the mod is off (for mods that must sync with the game).
 *   start(ctx) runs when the mod is on (at load, or the moment it is switched on).
 *   stop(ctx)  runs when it is switched off. Everything added through ctx (listeners, styles, cleanups) is removed automatically.
 * A mod that throws is isolated: it is marked failed and the others keep running.
 *
 * ctx: id, settings (live), settingsOf(id), isEnabled(id), setEnabled(bool), on(event, fn), addStyle(css), addCleanup(fn), game, photos, log.
 * Events: 'dom' (the page changed, debounced), 'phase' ({phase, season, prev}), 'settings' (this mod's settings changed).
 */
(() => {
  if (globalThis.SGM) return;
  const factories = new Map(); // id -> mod definition
  const running = new Map(); // id -> { ctx, cleanups }
  const failed = new Map(); // id -> message
  const handlers = new Map(); // event -> Set<{ id, fn }>
  let state = {};
  let started = false;

  const log = (id, ...a) => console.log(`%c[Studio GM mod:${id}]`, 'color:#c5a65d', ...a);
  const warn = (id, ...a) => console.warn(`[Studio GM mod:${id}]`, ...a);

  // ── reading the game ──────────────────────────────────────
  const SLOT_KEY = 'studio-gm-last-slot';
  const game = {
    phase: () => (document.querySelector('.phase-row .track li[aria-current="true"], .track li.current')?.textContent || '').replace(/\s+/g, ' ').trim(),
    season() {
      const spans = [...document.querySelectorAll('.topbar .stats > span')];
      const s = spans.find((x) => /^\s*Season\s*$/i.test(x.childNodes?.[0]?.textContent || ''));
      const v = Number(s?.querySelector('b')?.textContent);
      return Number.isFinite(v) && v > 0 ? v : null;
    },
    advanceButton: () => document.querySelector('.advance .btn'),
    /** The current save, decoded (the game writes it ~300 ms after every change). */
    readSave() {
      try {
        const slot = localStorage.getItem(SLOT_KEY);
        let key = null, best = -1;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          const m = k && k.match(/^studio-gm-slot-v(\d+)-(\d+)$/);
          if (m && m[2] === slot && Number(m[1]) > best) { best = Number(m[1]); key = k; }
        }
        const raw = key && localStorage.getItem(key);
        if (!raw) return null;
        const json = raw.startsWith('lz:') ? globalThis.LZString.decompressFromUTF16(raw.slice(3)) : raw;
        return json ? JSON.parse(json).state : null;
      } catch (_) {
        return null;
      }
    },
    awardsOf: (save, season) => save?.awards?.find((a) => a.season === season),
  };

  // ── IMDb lookups (the background worker does the fetching and caching) ──
  const photoCache = new Map();
  const photos = {
    lookup(name, role) {
      const key = `${role}|${name}`;
      if (!photoCache.has(key)) {
        photoCache.set(key, new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage({ type: 'imdb-photo', name, role }, (res) => resolve(chrome.runtime.lastError || !res ? {} : res));
          } catch (_) { resolve({}); }
        }));
      }
      return photoCache.get(key);
    },
  };

  // ── events ────────────────────────────────────────────────
  function emit(event, payload, only) {
    for (const h of [...(handlers.get(event) || [])]) {
      if (only && h.id !== only) continue;
      try { h.fn(payload); } catch (e) { warn(h.id, `error in ${event} handler`, e); }
    }
  }
  let lastPhase = null;
  let queued = false;
  function onPageChange() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const phase = game.phase();
      const season = game.season();
      const key = `${season}|${phase}`;
      if (phase && key !== lastPhase) {
        const prev = lastPhase;
        lastPhase = key;
        emit('phase', { phase, season, prev });
      }
      emit('dom');
    });
  }

  // ── mod lifecycle ─────────────────────────────────────────
  function makeCtx(id) {
    const cleanups = [];
    const ctx = {
      id, game, photos,
      get settings() { return globalThis.SGMStore.settingsOf(state, id); },
      settingsOf: (other) => globalThis.SGMStore.settingsOf(state, other),
      isEnabled: (other) => globalThis.SGMStore.isEnabled(state, other) && running.has(other),
      setEnabled: (on) => globalThis.SGMStore.update(id, { enabled: !!on }),
      on(event, fn) {
        const h = { id, fn };
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(h);
        const off = () => handlers.get(event)?.delete(h);
        cleanups.push(off);
        return off;
      },
      addStyle(css) {
        const el = document.createElement('style');
        el.dataset.sgmMod = id;
        el.textContent = css;
        (document.head || document.documentElement).appendChild(el);
        cleanups.push(() => el.remove());
        return el;
      },
      addCleanup: (fn) => cleanups.push(fn),
      log: (...a) => log(id, ...a),
    };
    return { ctx, cleanups };
  }

  function startMod(id) {
    const mod = factories.get(id);
    if (!mod || running.has(id)) return;
    const entry = makeCtx(id);
    running.set(id, entry);
    try {
      mod.start?.(entry.ctx);
      failed.delete(id);
      log(id, 'started');
      onPageChange();
    } catch (e) {
      warn(id, 'failed to start', e);
      failed.set(id, String(e?.message || e));
      stopMod(id, true);
    }
  }
  function stopMod(id, keepFailure) {
    const entry = running.get(id);
    if (!entry) return;
    running.delete(id);
    try { factories.get(id)?.stop?.(entry.ctx); } catch (e) { warn(id, 'error while stopping', e); }
    for (const fn of entry.cleanups.splice(0).reverse()) { try { fn(); } catch (e) { warn(id, 'cleanup error', e); } }
    if (!keepFailure) failed.delete(id);
    log(id, 'stopped');
  }

  const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function applyState(next) {
    const prev = state;
    state = next;
    for (const id of factories.keys()) {
      const on = globalThis.SGMStore.isEnabled(state, id);
      if (on && !running.has(id)) startMod(id);
      else if (!on && running.has(id)) stopMod(id);
      else if (on && !sameJson(globalThis.SGMStore.settingsOf(prev, id), globalThis.SGMStore.settingsOf(state, id))) {
        emit('settings', globalThis.SGMStore.settingsOf(state, id), id);
      }
    }
  }

  // ── public API ────────────────────────────────────────────
  globalThis.SGM = {
    register(id, mod) {
      if (!globalThis.SGM_META.some((m) => m.id === id)) return warn(id, 'not listed in core/mods.js; ignored');
      factories.set(id, mod);
    },
    async start() {
      if (started) return;
      started = true;
      state = await globalThis.SGMStore.load();
      new MutationObserver(onPageChange).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[globalThis.SGMStore.KEY]) applyState(changes[globalThis.SGMStore.KEY].newValue || {});
      });
      // the popup asks which mods are alive on this tab
      chrome.runtime.onMessage.addListener((msg, _s, send) => {
        if (msg?.type === 'sgm-status') send({ running: [...running.keys()], failed: Object.fromEntries(failed) });
      });
      for (const [id, mod] of factories) {
        try { mod.boot?.(makeCtx(id).ctx); } catch (e) { warn(id, 'boot failed', e); }
      }
      for (const id of factories.keys()) if (globalThis.SGMStore.isEnabled(state, id)) startMod(id);
      onPageChange();
    },
  };
})();
