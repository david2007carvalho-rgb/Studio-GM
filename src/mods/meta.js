/* Studio GM Toolkit — mod catalogue and settings storage.
 * Loaded by BOTH the popup and the game page, so it only holds data and storage helpers.
 *
 * To add a mod:
 *   1. add an entry to SGM_META below,
 *   2. add mods/<id>.js that calls SGM.register('<id>', { start(ctx) {...}, stop() {...} }),
 *   3. list that file in manifest.json (content_scripts.js), before core/boot.js.
 */
globalThis.SGM_META = [
  {
    id: 'ceremony',
    name: 'Attend the Ceremony',
    icon: '✦',
    category: 'Awards',
    version: '2.0.0',
    defaultEnabled: true,
    tagline: 'Play the awards night: nominees, then the reveal.',
    description:
      'Adds an Attend button under the all-nominees table. It jumps the game to the Awards phase (so the winners are decided), then opens the ceremony: every award shows its nominees, then reveals the winner. Winners come from the game itself; the mod never picks them.',
    settings: [
      { key: 'autoAdvance', type: 'toggle', label: 'Jump to Awards when I attend', default: true },
      { key: 'suspense', type: 'select', label: 'Reveal suspense', default: 'dramatic', options: [['dramatic', 'Dramatic'], ['quick', 'Quick'], ['none', 'None']] },
    ],
    changelog: ['2.0 — Reworked: button on the nominees article, auto-advances to Awards, photos for nominees and winners, thank-you finale.'],
  },
  {
    id: 'imdb-photos',
    name: 'IMDb Profile Photos',
    icon: '◉',
    category: 'Awards',
    version: '1.1.0',
    defaultEnabled: true,
    tagline: 'Real faces on profiles and in the ceremony.',
    description:
      'Shows IMDb photos (linked to their IMDb page) in actor and director profiles, and on nominees and winners in the ceremony. Lookups use IMDb\'s public suggestion endpoint and are cached.',
    settings: [{ key: 'realOnly', type: 'toggle', label: 'Real-world people only (avoids look-alike names)', default: true }],
    changelog: ['1.1 — Works in the All-Time edition; powers the ceremony photos.'],
  },
  {
    id: 'negotiations',
    name: 'Advanced Negotiations',
    icon: '⚖',
    category: 'Gameplay',
    version: '1.0.0',
    defaultEnabled: false,
    tagline: 'Negotiate salary, backend and promises instead of Hire / Pitch.',
    description:
      'Replaces Hire and Pitch with Negotiate: offer a salary and a box-office backend, make optional promises, and watch their demands tick off. Needs the updated game (this switch and the game\'s own Negotiations checkbox are the same setting).',
    settings: [],
    changelog: ['1.0 — Now a mod; stays in sync with the game\'s own checkbox.'],
  },
  {
    id: 'brand-deals',
    name: 'Brand Deals',
    icon: '$',
    category: 'Gameplay',
    version: '1.0.0',
    defaultEnabled: true,
    tagline: 'Sponsors, product placement, action figures, video games and TV spin-offs.',
    description:
      'Adds a Brands page and a Brand partners panel at the greenlight. Real brands (Apple, Sony, Samsung, Coca-Cola, Nike, BMW, LEGO, Hasbro, PlayStation, Netflix and more) pay for product placement or present your film, at the cost of critic points. After a hit they offer action figures, a video game or a TV spin-off, and each one heats up the franchise for its next sequel. Famous studios get yearly partner deals that lock a category. Needs the updated game (this switch and the Brands page checkbox are the same setting).',
    settings: [
      { key: 'fees', type: 'select', label: 'How much brands pay', default: 'fair', options: [['stingy', 'Stingy (-25%)'], ['fair', 'Fair'], ['generous', 'Generous (+30%)']] },
      { key: 'alcohol', type: 'toggle', label: 'Include beer and spirits brands', default: true },
    ],
    changelog: ['1.0 — Product placement, presenting sponsors, studio partners, merchandise, video game tie-ins, TV spin-offs and franchise heat for sequels.'],
  },
  {
    id: 'advance-reviews',
    name: 'Advance Reviews',
    icon: '★',
    category: 'Reception',
    version: '1.1.0',
    defaultEnabled: true,
    tagline: 'IMDb, Letterboxd and Rotten Tomatoes scores on every film page.',
    description:
      'Adds four review-site scores under Reception on a released film\'s page: IMDb (0-10), Letterboxd (0-5), and Rotten Tomatoes for critics and for audiences (0-100). They are built from the game\'s own critics and audience scores: IMDb leans towards audiences, Letterboxd towards critics, and each site wobbles a little (the same wobble every time you open the film). IMDb, Letterboxd and Rotten Tomatoes always average back to the film\'s real overall score. The mod only reads the game; it never changes a save.',
    settings: [
      { key: 'spread', type: 'select', label: 'How much the sites disagree', default: 'normal', options: [['tight', 'Tight'], ['normal', 'Normal'], ['loose', 'Loose']] },
      { key: 'written', type: 'toggle', label: 'Show a short written review on each site', default: true },
      { key: 'footnote', type: 'toggle', label: 'Show the critics/audience numbers they come from', default: false },
    ],
    changelog: ['1.1 — A short written review on each site, picked from many variations to match that site\'s score.', '1.0 — IMDb, Letterboxd and Rotten Tomatoes (critics and audience) on the film page.'],
  },
  {
    id: 'cinema-theme',
    name: 'Cinema Theme',
    icon: '◐',
    category: 'Look',
    version: '2.0.0',
    defaultEnabled: false,
    tagline: 'Re-skin the game like your favourite film brand.',
    description: 'Eleven looks, from Letterboxd to Retro Studio OS. Turn the mod off to get the original look back. Your choice is remembered after a reload.',
    settings: [
      {
        key: 'theme', type: 'select', label: 'Look', default: 'letterboxd',
        options: [
          ['letterboxd', 'Letterboxd'], ['imdb', 'IMDb'], ['netflix', 'Netflix'], ['a24', 'A24 / Indie Cinema'], ['hbo', 'HBO Prestige'],
          ['criterion', 'Criterion Collection'], ['hollywood', 'Old Hollywood'], ['appletv', 'Apple TV'], ['mubi', 'MUBI'],
          ['executive', 'Studio Executive'], ['retro', 'Retro Studio OS'],
        ],
      },
    ],
    changelog: ['2.0 — Applies live and survives reloads.'],
  },
];

/** Mod settings live in chrome.storage.local under one key: { [modId]: { enabled?, settings? } }. */
globalThis.SGMStore = (() => {
  const KEY = 'sgmMods';
  const LEGACY = ['featureCeremony', 'featureImdbPhotos', 'featureNegotiations', 'lastTheme'];
  const meta = (id) => globalThis.SGM_META.find((m) => m.id === id);

  /** Load the state; the first time, carry over the switches from the old (pre-mod-loader) toolkit. */
  async function load() {
    const got = await chrome.storage.local.get([KEY, ...LEGACY]);
    if (got[KEY]) return got[KEY];
    const state = {};
    if (typeof got.featureCeremony === 'boolean') state.ceremony = { enabled: got.featureCeremony };
    if (typeof got.featureImdbPhotos === 'boolean') state['imdb-photos'] = { enabled: got.featureImdbPhotos };
    if (typeof got.featureNegotiations === 'boolean') state.negotiations = { enabled: got.featureNegotiations };
    if (got.lastTheme && got.lastTheme !== 'default') state['cinema-theme'] = { enabled: true, settings: { theme: got.lastTheme } };
    await chrome.storage.local.set({ [KEY]: state });
    return state;
  }
  const defaults = (id) => Object.fromEntries((meta(id)?.settings || []).map((s) => [s.key, s.default]));
  const isEnabled = (state, id) => state[id]?.enabled ?? !!meta(id)?.defaultEnabled;
  const settingsOf = (state, id) => ({ ...defaults(id), ...(state[id]?.settings || {}) });

  async function update(id, patch) {
    const state = await load();
    const cur = state[id] || {};
    state[id] = { ...cur, ...('enabled' in patch ? { enabled: patch.enabled } : {}), settings: { ...(cur.settings || {}), ...(patch.settings || {}) } };
    await chrome.storage.local.set({ [KEY]: state });
    return state;
  }
  const reset = () => chrome.storage.local.set({ [KEY]: {} });

  return { KEY, load, update, reset, isEnabled, settingsOf, defaults };
})();
