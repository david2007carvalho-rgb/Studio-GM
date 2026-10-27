/* Mod: Advanced Negotiations. The feature itself lives in the game; this mod keeps its switch and the game's own
 * localStorage switch (studio-gm-advanced-negotiations) in step, in both directions. */
(() => {
  const KEY = 'studio-gm-advanced-negotiations';
  const EVENT = 'sgm-negotiations-change';
  const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } };
  const write = (on) => { try { if (read() !== on) { localStorage.setItem(KEY, on ? '1' : '0'); window.dispatchEvent(new Event(EVENT)); } } catch (_) { /* ignore */ } };

  SGM.register('negotiations', {
    // Runs even while the mod is off, so the game's own checkbox can switch the mod on.
    async boot(ctx) {
      const state = await SGMStore.load();
      // First run (no saved choice yet): adopt whatever the game already has.
      if (state.negotiations?.enabled === undefined && read()) ctx.setEnabled(true);
      window.addEventListener(EVENT, async () => {
        const now = await SGMStore.load();
        if (SGMStore.isEnabled(now, 'negotiations') !== read()) ctx.setEnabled(read());
      });
    },
    start: () => write(true),
    stop: () => write(false),
  });
})();
