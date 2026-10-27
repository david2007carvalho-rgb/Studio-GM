/* Mod: Advance Reviews — adds IMDb, Letterboxd and Rotten Tomatoes scores to a film's page.
 *
 * The game only has two real numbers per film: the critics' score and the audience score (0-100).
 * This mod turns them into four "site" scores that disagree a little, the way real sites do:
 *   IMDb (0-10)            leans towards the audience
 *   Letterboxd (0-5)       leans towards the critics
 *   Rotten Tomatoes critics / audience (0-100)   sit right next to the game's own two scores
 * Each site gets a small random wobble that is fixed per film (it never changes between openings).
 * The wobble is balanced so IMDb, Letterboxd and Rotten Tomatoes (the average of its two) always
 * average back out to the film's overall score, (critics + audience) / 2. Nothing is written to the save.
 */
SGM.register('advance-reviews', {
  start(ctx) {
    const SPREAD = { tight: 1.5, normal: 4, loose: 7 }; // wobble in points on a 0-100 scale
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    // ── deterministic randomness: the same film always gets the same wobble ──
    const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    /** critic, audience: 0-100. Returns the four site scores. */
    function scoresFor(movie, spread) {
      const c = movie.criticScore;
      const a = movie.audienceScore ?? c; // very old saves have no audience score: assume it matches the critics
      const r = rng(hash(`${movie.mid}|${movie.title}|${movie.season}`));
      const wob = (amp) => (r() * 2 - 1) * amp;
      const overall = (c + a) / 2;
      const lean = (a - c) * 0.25; // IMDb drifts towards audiences, Letterboxd towards critics

      let rtC = c + wob(spread * 0.75);
      let rtA = a + wob(spread * 0.75);
      let imdb = overall + lean + wob(spread);
      let lb = overall - lean + wob(spread);

      // balance: IMDb, Letterboxd and Rotten Tomatoes (its two scores averaged) must average back to the overall
      const rtMid = (rtC + rtA) / 2;
      const drift = (imdb + lb + rtMid - 3 * overall) / 3;
      imdb -= drift; lb -= drift; rtC -= drift; rtA -= drift;

      return {
        imdb: Math.round(clamp(imdb, 5, 99)) / 10,        // 0-100 -> 0-10, one decimal
        lb: Math.round(clamp(lb, 5, 99) * 5) / 100,       // 0-100 -> 0-5, two decimals (like the real site)
        rtCritics: Math.round(clamp(rtC, 0, 100)),
        rtAudience: Math.round(clamp(rtA, 0, 100)),
      };
    }


    // ── written reviews: one short quote per site, picked by the film's own seed so it never changes ──
    // Tiers by that site's score (0-100): 0 = pan, 1 = weak, 2 = mixed, 3 = good, 4 = rave.
    // Tokens: {t} title, {d} director, {l} lead actor, {g} genre.
    const tier = (v) => (v < 35 ? 0 : v < 55 ? 1 : v < 70 ? 2 : v < 85 ? 3 : 4);
    const QUOTES = {
      imdb: [
        ['Two hours I will never get back. {l} deserved a better script than this.', 'Genuinely hard to sit through. The {g} beats are all there, none of them land.', 'Whoever greenlit {t} should be asked some questions.', 'I wanted to like it. I really did. I checked my phone four times.', 'Not even bad in a fun way, just flat.'],
        ['Has its moments, but too few. {d} never finds the tone.', 'A forgettable {g}. {l} tries hard and it is not enough.', 'Okay for a rainy Sunday if you have nothing else queued.', 'The ending undoes whatever goodwill the first half built.', 'Watchable, not recommendable. 5 stars out of 10 feels generous.'],
        ['Solid {g}. Nothing new, but it does the job and {l} is good in it.', 'Better than I expected going in. A little long, a little predictable, still enjoyable.', 'Fun enough. I would watch it again on a plane.', '{d} keeps it moving, even when the script stumbles.', 'Decent. The middle drags, the last twenty minutes make up for it.'],
        ['Really enjoyed {t}. {l} carries it and the pacing is spot on.', 'One of the better {g} films I have seen in a while. Recommended.', 'Great atmosphere, great cast, and an ending that earns itself.', '{d} clearly knew what they were doing. Went in sceptical, left a fan.', 'Rewatched it twice already. Still finding new things.'],
        ['A masterpiece of the genre. {l} is unforgettable. 10/10, no notes.', 'This is why I love movies. {d} has outdone themselves.', 'Walked out speechless. {t} will be talked about for years.', 'Perfect from the first frame to the last. Easily top of the year.', 'Cannot recommend this enough. Go in blind and thank me later.'],
      ],
      lb: [
        ['not for me. {d} confuses mood with substance and {l} is stranded', 'a {g} that forgot to have an idea. one star for the lighting', 'felt every minute. the trailer was the best part', 'this is what happens when nobody says no to anyone', 'i laughed, but never at the right moments'],
        ['the ambition is there and the execution just is not. {d} gets a pass for trying', 'pretty to look at, empty to think about', '{l} is great, {t} is not their best vehicle', 'half a great film, half a long meeting', 'mid. nice score though'],
        ['a perfectly fine {g}, with a few shots I will remember', 'liked it more on the way home than while watching it', '{d} has a voice, it just needs sharper material', '{l} does a lot with a little. fun, not essential', 'a small pleasure. would pair well with takeaway'],
        ['quietly very good. {d} trusts the audience and it pays off', '{l} gives one of those performances you keep thinking about', 'the final scene did something to me. {t} deserves more eyes', 'sharp, funny and unexpectedly tender for a {g}', 'ticks every box and then some. already want to rewatch'],
        ['instant favourite. {d} at the very top of their craft', 'cried, then immediately wanted to start it over', 'cinema. {l} is the best they have ever been', 'a {g} that makes you remember why you fell in love with films', 'five stars and a lump in my throat. {t} stays with you'],
      ],
      rtC: [
        ['A joyless slog; {d} mistakes noise for narrative.', '{t} wastes a capable cast on a script that never finds its footing.', 'Technically competent, emotionally bankrupt.', 'An unwelcome reminder of how thin a {g} can feel.', 'It is hard to imagine who this was made for.'],
        ['{d} shows flashes of craft, but {t} cannot hold itself together.', 'Uneven and overlong, though {l} gives it real effort.', 'A {g} that promises more than it delivers.', 'Efficient rather than inspired.', 'Admirably ambitious, frustratingly muddled.'],
        ['A capable, well-made {g} that rarely surprises.', '{l} elevates familiar material; {d} keeps the machinery humming.', 'Not a revelation, but a polished and often engaging night out.', '{t} knows exactly what it is and delivers it with assurance.', 'Crowd-pleasing in the best sense, forgettable in the worst.'],
        ['{d} stages {t} with confidence and real feeling.', 'A smart, handsome {g} anchored by an excellent {l}.', 'Intelligent, propulsive and surprisingly moving.', 'One of the year\'s most satisfying surprises.', 'Rich in detail and generous with its pleasures.'],
        ['A triumph. {d} delivers the best {g} in years.', '{l} is extraordinary in a film that never puts a foot wrong.', 'Dazzling, humane and unmissable.', '{t} is the kind of picture that redefines what a {g} can do.', 'A modern classic in the making.'],
      ],
      rtA: [
        ['Total waste of money. Left halfway through.', 'Boring! Nobody in our row could tell what was going on.', 'Expected way more from {l}. Do not bother.', 'Worst {g} I have seen this year, not even close.', 'Fell asleep and woke up to the same movie.'],
        ['Not terrible, not good. We argued about it in the car park.', 'Too slow for me, but my partner liked {l}.', 'Some good scenes, plenty of bad ones.', 'Rental at best.', 'Fine at home, would not pay cinema prices again.'],
        ['Good popcorn movie. {l} was fun to watch.', 'Better than the critics say! A solid {g} night out.', 'We liked it. Kids liked it. That is a win.', 'Entertaining start to finish, even if it is nothing new.', 'Pretty good, a bit predictable, still glad I went.'],
        ['Loved it! {t} had the whole cinema laughing and gasping.', 'Great {g}, great cast, would see it again.', 'Brought the family and nobody got bored. {l} was brilliant.', 'Way better than I expected, go see it!', 'Fantastic ride. Left the cinema grinning.'],
        ['BEST MOVIE OF THE YEAR!! We clapped at the end.', 'Went three times already. {l} deserves every award.', 'Everything I wanted from a {g} and more. A must see!', 'Stunning. Cried, laughed, cheered, repeat.', '{t} is a gem. Tell everyone you know.'],
      ],
    };
    const USERS = {
      imdb: ['cinefan_88', 'moviebuff2', 'ratedR', 'popcorn_critic', 'filmnerd_pt', 'sofa_surfer', 'Reel_Deal', 'matinee_mark', 'nightowl77', 'bigscreenben'],
      lb: ['grain_of_film', 'sundayscreening', 'frame_by_frame', 'midnight_matinee', 'nitrate_dreams', 'rewatchclub', 'closeup_cat', 'tracking_shot', 'letterbox_lou', 'dolly_zoom'],
      rtC: ['Ellis Marlowe, The Evening Reel', 'Priya Natarajan, Frame & Focus', 'Tomás Vidal, Cinema Diário', 'Hannah Kessler, The Screen Review', 'Declan Rourke, Pictures Weekly', 'Mina Okafor, Film Quarterly', 'Rafael Duarte, Noite de Cinema', 'Grace Whitfield, The Gazette'],
      rtA: ['Verified Audience', 'Verified Audience', 'Verified Audience'],
    };
    const GENRE = { comedy: 'comedy', drama: 'drama', thriller: 'thriller', romance: 'romance', action: 'action', horror: 'horror', crime: 'crime', sciFiFantasy: 'sci-fi', adventure: 'adventure' };

    function reviewsFor(movie, save, vals) {
      const r = rng(hash(`rev|${movie.mid}|${movie.title}`));
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      const person = (pid) => save.people?.find((x) => x.pid === pid)?.name;
      const lead = person((movie.leadPids?.[0] ?? movie.castPids?.[0])) || 'the cast';
      const dir = person(movie.directorPid) || 'the director';
      const fill = (t) => t.replace(/\{t\}/g, movie.title).replace(/\{d\}/g, dir).replace(/\{l\}/g, lead).replace(/\{g\}/g, GENRE[movie.genre] || 'film');
      const out = {};
      for (const k of ['imdb', 'lb', 'rtC', 'rtA']) {
        // each site is judged on its own number, so a 3.0 on Letterboxd reads very differently from a 9.0 on IMDb
        out[k] = { text: fill(pick(QUOTES[k][tier(vals[k])])), who: pick(USERS[k]) };
      }
      return out;
    }

    ctx.addStyle(`
      .sgm-reviews { margin: 10px 0 0; }
      .sgm-reviews-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
      .sgm-rv { background: #1c1c1c; border: 1px solid var(--m-line, #2f2f2f); border-radius: 8px; padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .sgm-rv-site { display: flex; align-items: center; gap: 7px; font: 700 12px/1 var(--sans, system-ui); letter-spacing: .04em; text-transform: uppercase; color: #b3b3b3; }
      .sgm-rv-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .sgm-rv-score { font: 700 28px/1.1 var(--sans, system-ui); color: #fff; font-variant-numeric: tabular-nums; }
      .sgm-rv-score small { font-size: 14px; font-weight: 600; color: #b3b3b3; margin-left: 2px; }
      .sgm-rv-note { font-size: 12px; color: #b3b3b3; }
      .sgm-rv-quote { margin: 8px 0 0; padding: 8px 0 0; border-top: 1px solid #2f2f2f; font-size: 13px; line-height: 1.4; color: #e6e6e6; font-style: italic; }
      .sgm-rv-who { display: block; margin-top: 4px; font-size: 11.5px; font-style: normal; color: #9a9a9a; }
      .sgm-rv-bar { height: 4px; border-radius: 2px; background: #333; overflow: hidden; margin-top: 4px; }
      .sgm-rv-bar i { display: block; height: 100%; border-radius: 2px; }
      .sgm-rv-imdb .sgm-rv-dot, .sgm-rv-imdb .sgm-rv-bar i { background: #f5c518; }
      .sgm-rv-imdb .sgm-rv-score { color: #f5c518; }
      .sgm-rv-lb .sgm-rv-dot { background: linear-gradient(90deg, #ff8000 33%, #00e054 33% 66%, #40bcf4 66%); border-radius: 3px; width: 14px; }
      .sgm-rv-lb .sgm-rv-bar i { background: #00e054; }
      .sgm-rv-fresh .sgm-rv-bar i, .sgm-rv-fresh .sgm-rv-dot { background: #fa320a; }
      .sgm-rv-rotten .sgm-rv-bar i, .sgm-rv-rotten .sgm-rv-dot { background: #6bb12a; }
      .sgm-rv-footnote { margin: 8px 0 0; font-size: 12px; color: #b3b3b3; }`);

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const tile = (cls, site, score, unit, note, pct, rev) =>
      `<div class="sgm-rv ${cls}"><div class="sgm-rv-site"><span class="sgm-rv-dot"></span>${esc(site)}</div>` +
      `<div class="sgm-rv-score">${esc(score)}<small>${esc(unit)}</small></div><div class="sgm-rv-note">${esc(note)}</div>` +
      `<div class="sgm-rv-bar"><i style="width:${clamp(pct, 0, 100)}%"></i></div>` +
      (rev ? `<p class="sgm-rv-quote">“${esc(rev.text)}”<span class="sgm-rv-who">— ${esc(rev.who)}</span></p>` : '') + `</div>`;

    function render(movie, s, rv) {
      const rt = (v) => (v >= 60 ? 'sgm-rv-fresh' : 'sgm-rv-rotten');
      const rtNote = (v) => (v >= 60 ? '🍅 Fresh' : '🤢 Rotten');
      return (
        tile('sgm-rv-imdb', 'IMDb', s.imdb.toFixed(1), '/10', 'User rating', s.imdb * 10, rv?.imdb) +
        tile('sgm-rv-lb', 'Letterboxd', s.lb.toFixed(2), '/5', 'Average rating', s.lb * 20, rv?.lb) +
        tile(rt(s.rtCritics), 'Rotten Tomatoes · Critics', `${s.rtCritics}%`, '', rtNote(s.rtCritics), s.rtCritics, rv?.rtC) +
        tile(rt(s.rtAudience), 'Rotten Tomatoes · Audience', `${s.rtAudience}%`, '', s.rtAudience >= 60 ? '🍿 Upright' : '🤢 Spilled', s.rtAudience, rv?.rtA)
      );
    }

    // ── find the film that a page belongs to ──
    function movieOf(dialog) {
      const save = ctx.game.readSave();
      if (!save?.movies) return null;
      const title = dialog.getAttribute('aria-label');
      const subs = [...dialog.querySelectorAll('.modal-sub > span')].map((x) => x.textContent.trim());
      const season = Number((subs.join(' ').match(/Released\s+(\d+)/) || [])[1]);
      let list = save.movies.filter((m) => m.title === title && (!season || m.season === season));
      if (list.length > 1) {
        const studioName = subs[subs.length - 1] === 'Your studio' ? subs[subs.length - 2] : subs[subs.length - 1];
        const tids = (save.studios || []).filter((s) => s.name === studioName).map((s) => s.tid);
        const narrowed = list.filter((m) => tids.includes(m.tid));
        if (narrowed.length) list = narrowed;
      }
      return list[0] || null;
    }

    const timers = new Set();
    function apply(dialog, attempt = 0) {
      const reception = [...dialog.querySelectorAll('h3')].find((h) => /^Reception$/i.test(h.textContent.trim()));
      const kv = reception?.nextElementSibling;
      if (!kv) return; // not a film page
      const movie = movieOf(dialog);
      if (!movie) { // the game saves ~300 ms after a change: look again shortly
        if (attempt < 6) { const t = setTimeout(() => { timers.delete(t); if (dialog.isConnected) apply(dialog, attempt + 1); }, 400); timers.add(t); }
        return;
      }
      let box = dialog.querySelector(':scope .sgm-reviews');
      if (movie.criticScore === undefined) { box?.remove(); return; } // not released yet
      const spread = SPREAD[ctx.settings.spread] ?? SPREAD.normal;
      const showText = ctx.settings.written !== false;
      const key = `${movie.mid}|${movie.criticScore}|${movie.audienceScore}|${spread}|${showText}`;
      if (box && box.dataset.key === key && box.previousElementSibling === kv) return;
      box?.remove();
      const s = scoresFor(movie, spread);
      const save = ctx.game.readSave();
      const rv = showText && save ? reviewsFor(movie, save, { imdb: s.imdb * 10, lb: s.lb * 20, rtC: s.rtCritics, rtA: s.rtAudience }) : null;
      box = document.createElement('div');
      box.className = 'sgm-reviews';
      box.dataset.key = key;
      box.innerHTML =
        `<div class="sgm-reviews-grid">${render(movie, s, rv)}</div>` +
        (ctx.settings.footnote
          ? `<p class="sgm-rv-footnote">Site scores are drawn from this film's critics (${movie.criticScore}) and audience (${movie.audienceScore ?? movie.criticScore}) scores; together they average to the game's overall.</p>`
          : '');
      box.title = 'Simulated site scores based on the film\'s critics and audience scores';
      kv.insertAdjacentElement('afterend', box);
    }

    const scan = () => document.querySelectorAll('.modal[role="dialog"]').forEach((d) => apply(d));
    ctx.on('dom', scan);
    ctx.on('settings', scan);
    ctx.addCleanup(() => { timers.forEach(clearTimeout); timers.clear(); document.querySelectorAll('.sgm-reviews').forEach((el) => el.remove()); });
    scan();
  },
});
