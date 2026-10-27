/* Mod: Brand Deals. The feature itself lives in the game (src/game/brands.ts); this mod keeps its switch and options
 * in step with the game's own localStorage keys, in both directions:
 *   studio-gm-brand-deals       "1" / "0"                      (the switch; a missing key means on)
 *   studio-gm-brand-deals-opts  {"alcohol":bool,"fees":"stingy|fair|generous"}
 * The game's Brands page has the same checkbox, so either one can switch it. */
(() => {
  const KEY = 'studio-gm-brand-deals';
  const OPTS = 'studio-gm-brand-deals-opts';
  const EVENT = 'sgm-brand-deals-change';
  const read = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; } };
  const write = (on) => { try { if (read() !== on) { localStorage.setItem(KEY, on ? '1' : '0'); window.dispatchEvent(new Event(EVENT)); } } catch (_) { /* ignore */ } };
  const writeOpts = (s) => {
    try {
      const next = JSON.stringify({ alcohol: s.alcohol !== false, fees: ['stingy', 'fair', 'generous'].includes(s.fees) ? s.fees : 'fair' });
      if (localStorage.getItem(OPTS) !== next) { localStorage.setItem(OPTS, next); window.dispatchEvent(new Event(EVENT)); }
    } catch (_) { /* ignore */ }
  };

  SGM.register('brand-deals', {
    // Runs even while the mod is off, so the game's own checkbox can switch the mod back on or off.
    async boot(ctx) {
      const state = await SGMStore.load();
      // First run (no saved choice yet): adopt a switch the player already flipped in the game.
      if (state['brand-deals']?.enabled === undefined && !read()) ctx.setEnabled(false);
      window.addEventListener(EVENT, async () => {
        const now = await SGMStore.load();
        if (SGMStore.isEnabled(now, 'brand-deals') !== read()) ctx.setEnabled(read());
      });
    },
    start(ctx) {
      write(true);
      writeOpts(ctx.settings);
      ctx.on('settings', writeOpts);
    },
    stop: () => write(false),
  });
})();
