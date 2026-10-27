/* Mod: Attend the Ceremony. See core/mods.js for its description and settings. */
SGM.register('ceremony', (() => {
  let activeClose = null; // closes the open ceremony window, if any

  return {
    start(ctx) {
      const stopObserve = ceremonyMain(ctx, (close) => { activeClose = close; });
      ctx.addCleanup(() => { stopObserve(); activeClose?.(); activeClose = null; document.querySelectorAll('.sgm-attend-holder').forEach((el) => el.remove()); });
    },
  };

function ceremonyMain(ctx, setClose) {
  const OVERLAY_ID = 'sgm-attend-ceremony';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Order of the night: the big one last.
  const CATEGORIES = [
    { key: 'bestSupportingActor', label: 'Best Supporting Actor', person: true, role: 'actor' },
    { key: 'bestSupportingActress', label: 'Best Supporting Actress', person: true, role: 'actress' },
    { key: 'bestDirector', label: 'Best Director', person: true, role: 'director' },
    { key: 'bestActor', label: 'Best Actor', person: true, role: 'actor' },
    { key: 'bestActress', label: 'Best Actress', person: true, role: 'actress' },
    { key: 'bestPicture', label: 'Best Picture', person: false },
  ];

  const PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#2a2620"/>' +
        '<circle cx="48" cy="37" r="17" fill="#6f6650"/><path d="M12 96c0-24 16-38 36-38s36 14 36 38z" fill="#6f6650"/></svg>'
    );

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SUSPENSE = { dramatic: 1700, quick: 600, none: 0 };
  const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));

  // ── reading the game's save ────────────────────────────────

  const readSave = () => ctx.game.readSave();
  const awardsOf = (state, season) => ctx.game.awardsOf(state, season);

  /** Turn the save into the list of awards the ceremony walks through. */
  function buildCeremony(state, season) {
    const awards = awardsOf(state, season);
    if (!awards) return null;
    const studioName = (tid) => state.studios.find((s) => s.tid === tid)?.name ?? '';
    const person = (pid) => (pid === undefined ? undefined : state.people.find((p) => p.pid === pid));
    const shuffle = (list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const rounds = [];
    for (const cat of CATEGORIES) {
      const w = awards[cat.key];
      if (!w) continue;
      const isWinner = (e) => (w.pid !== undefined ? e.pid === w.pid : e.mid === w.mid);
      const entries = awards.nominees?.[cat.key]?.length ? awards.nominees[cat.key] : [w];
      const nominees = entries.map((e) => {
        const p = person(e.pid);
        const film = state.movies.find((m) => m.mid === e.mid);
        const director = !cat.person && film ? person(film.directorPid) : undefined;
        return {
          title: cat.person ? e.name : e.movieTitle || e.name,
          sub: cat.person ? e.movieTitle : director ? `Directed by ${director.name}` : '',
          studio: studioName(e.tid),
          mine: e.tid === state.userTid,
          winner: isWinner(e),
          photo: cat.person ? { name: e.name, role: cat.role, real: !ctx.settingsOf('imdb-photos').realOnly || !!p?.real } : null,
        };
      });
      if (!nominees.some((n) => n.winner)) continue;
      rounds.push({ label: cat.label, person: cat.person, nominees: shuffle(nominees) });
    }
    return rounds.length ? { season, rounds } : null;
  }

  // ── IMDb photos (the background worker does the lookup and caching) ──

  const lookupPhoto = (photo) => ctx.photos.lookup(photo.name, photo.role);
  /** Fill every <img data-photo> inside root. Invented people (not on IMDb) keep the silhouette. */
  function loadPhotos(root, rounds) {
    root.querySelectorAll('img[data-n]').forEach((img) => {
      const n = rounds[Number(img.dataset.r)].nominees[Number(img.dataset.n)];
      if (!n.photo?.real || img.dataset.loaded) return;
      img.dataset.loaded = '1';
      lookupPhoto(n.photo).then((res) => {
        if (!res.url) return;
        img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
        img.src = res.url;
      });
    });
  }

  // ── the ceremony window ───────────────────────────────────

  function openCeremony(data, usePhotos) {
    document.getElementById(OVERLAY_ID)?.remove();
    const { rounds, season } = data;
    const won = rounds.filter((r) => r.nominees.some((n) => n.winner && n.mine)).length;
    let index = 0;
    let busy = false;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="sgm-backdrop"></div>
      <section class="sgm-ceremony" role="dialog" aria-modal="true" aria-label="Awards ceremony">
        <button class="sgm-close" type="button" aria-label="Close ceremony">×</button>
        <header class="sgm-head">
          <div class="sgm-brand"><span class="sgm-star">✦</span> THE STUDIO REEL AWARDS</div>
          <div class="sgm-season">${esc(season)}</div>
        </header>
        <div class="sgm-body"></div>
        <footer class="sgm-foot"></footer>
      </section>`;
    document.body.appendChild(overlay);
    const $ = (s) => overlay.querySelector(s);
    const body = $('.sgm-body');
    const foot = $('.sgm-foot');
    const dialog = $('.sgm-ceremony');

    const close = () => {
      setClose(null);
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };
    document.addEventListener('keydown', onKey, true);
    setClose(close);
    $('.sgm-close').addEventListener('click', close);

    const card = (n, ri, ni, large) => `
      <li class="sgm-nominee${n.mine ? ' sgm-mine' : ''}" data-n="${ni}">
        ${n.photo && usePhotos ? `<img class="sgm-photo" data-r="${ri}" data-n="${ni}" alt="" referrerpolicy="no-referrer" src="${PLACEHOLDER}">` : ''}
        <span class="sgm-nominee-name">${esc(n.title)}</span>
        ${n.sub ? `<span class="sgm-nominee-sub">${esc(n.sub)}</span>` : ''}
        <span class="sgm-nominee-studio">${esc(n.studio)}${n.mine ? ' · <b>YOUR STUDIO</b>' : ''}</span>
      </li>`;

    function showRound() {
      const round = rounds[index];
      busy = false;
      body.innerHTML = `
        <p class="sgm-progress">AWARD ${index + 1} OF ${rounds.length}</p>
        <div class="sgm-dots">${rounds.map((_, i) => `<i class="${i < index ? 'done' : i === index ? 'now' : ''}"></i>`).join('')}</div>
        <h1 class="sgm-category">${esc(round.label)}</h1>
        <p class="sgm-prompt">The nominees</p>
        <ul class="sgm-nominees ${round.person ? 'sgm-people' : 'sgm-films'}">${round.nominees.map((n, ni) => card(n, index, ni)).join('')}</ul>
        <div class="sgm-spotlight" aria-live="polite"></div>`;
      foot.innerHTML = '<button class="sgm-btn sgm-reveal" type="button">Reveal the winner</button>';
      const btn = $('.sgm-reveal');
      btn.addEventListener('click', reveal);
      btn.focus();
      dialog.scrollTop = 0;
      if (usePhotos) {
        loadPhotos(body, rounds);
        // warm the next category's photos while this one is on screen
        const next = rounds[index + 1];
        if (next) next.nominees.forEach((n) => n.photo?.real && lookupPhoto(n.photo));
      }
    }

    async function reveal() {
      if (busy) return;
      busy = true;
      const round = rounds[index];
      const prompt = $('.sgm-prompt');
      const btn = $('.sgm-reveal');
      btn.disabled = true;
      prompt.textContent = 'And the winner is…';
      prompt.classList.add('sgm-suspense');
      await wait(SUSPENSE[ctx.settings.suspense] ?? 1700);
      if (!document.getElementById(OVERLAY_ID)) return;

      const wi = round.nominees.findIndex((n) => n.winner);
      const w = round.nominees[wi];
      body.querySelectorAll('.sgm-nominee').forEach((el) => {
        el.classList.add(Number(el.dataset.n) === wi ? 'sgm-is-winner' : 'sgm-lost');
      });
      prompt.textContent = 'The winner';
      prompt.classList.remove('sgm-suspense');
      $('.sgm-spotlight').innerHTML = `
        <div class="sgm-winner-card${w.mine ? ' sgm-mine' : ''}">
          ${w.photo && usePhotos ? `<img class="sgm-photo sgm-photo-lg" data-r="${index}" data-n="${wi}" alt="" referrerpolicy="no-referrer" src="${PLACEHOLDER}">` : '<div class="sgm-trophy" aria-hidden="true">✦</div>'}
          <div class="sgm-winner-name">${esc(w.title)}</div>
          ${w.sub ? `<div class="sgm-winner-sub">${esc(w.sub)}</div>` : ''}
          <div class="sgm-winner-studio">${esc(w.studio)}${w.mine ? ' · <b>YOUR STUDIO</b>' : ''}</div>
        </div>`;
      if (usePhotos) {
        // the photo was already fetched for the nominee row, so this resolves instantly
        loadPhotos($('.sgm-spotlight'), rounds);
      }
      $('.sgm-spotlight').scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });

      const last = index === rounds.length - 1;
      foot.innerHTML = `<button class="sgm-btn sgm-next" type="button">${last ? 'Finish the ceremony' : 'Next award →'}</button>`;
      const next = $('.sgm-next');
      next.addEventListener('click', () => { if (last) showEnd(); else { index++; showRound(); } });
      next.focus();
    }

    function showEnd() {
      body.innerHTML = `
        <div class="sgm-end">
          <div class="sgm-final-star">✦</div>
          <h1 class="sgm-category">Thank you for attending</h1>
          <p class="sgm-prompt">${won ? `Your studio took home ${won} ${won === 1 ? 'award' : 'awards'} tonight. Goodnight!` : 'The doors are closing on the night. Goodnight!'}</p>
        </div>`;
      foot.innerHTML = '<button class="sgm-btn sgm-done" type="button">Close</button>';
      const done = $('.sgm-done');
      done.addEventListener('click', close);
      done.focus();
    }

    showRound();
  }

  // ── the button on the nominees article ───────────────────

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const advanceButton = () => ctx.game.advanceButton();

  function showNote(holder, text) {
    let note = holder.querySelector('.sgm-attend-note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'sgm-attend-note';
      holder.appendChild(note);
    }
    note.textContent = text;
  }

  async function attend(button, season) {
    const holder = button.parentElement;
    button.disabled = true;
    const label = button.querySelector('.sgm-attend-label');
    const original = label.textContent;
    const reset = () => { button.disabled = false; label.textContent = original; };
    try {
      let state = readSave();
      // Winners are drawn when the game enters the Awards phase. If we are still before it, move there now.
      if (!awardsOf(state, season)) {
        if (!ctx.settings.autoAdvance) {
          showNote(holder, 'The awards are not decided yet. Advance to the Awards phase first (or turn on "Jump to Awards" in the mod settings).');
          return reset();
        }
        const adv = advanceButton();
        const inDistribution = /advance to awards/i.test(norm(adv?.textContent));
        if (!adv || !inDistribution || adv.disabled || state?.season !== season) {
          showNote(holder, 'The awards for this season are not available yet. Advance to the Awards phase from the game first.');
          return reset();
        }
        label.textContent = 'Heading to the awards…';
        adv.click();
        state = null;
        for (let i = 0; i < 40 && !state; i++) { // the game saves ~300ms after a change
          await new Promise((r) => setTimeout(r, 250));
          const s = readSave();
          if (awardsOf(s, season)) state = s;
        }
      }
      const data = state && buildCeremony(state, season);
      if (!data) {
        showNote(holder, 'Could not read the awards from the game save. Reload the game tab and try again.');
        return reset();
      }
      holder.querySelector('.sgm-attend-note')?.remove();
      openCeremony(data, ctx.isEnabled('imdb-photos'));
      reset();
    } catch (err) {
      console.error('Studio GM ceremony:', err);
      showNote(holder, 'Something went wrong opening the ceremony.');
      reset();
    }
  }

  function scan() {
    for (const title of document.querySelectorAll('.news-table-title')) {
      if (!/nominees\s*$/i.test(norm(title.textContent))) continue;
      const table = title.closest('.news-table');
      const article = table?.closest('article');
      if (!table || !article || article.querySelector('.sgm-attend-holder')) continue;
      const season = Number(norm(article.querySelector('.news-stamp, .iw-byline')?.textContent).match(/^(\d{4})/)?.[1]);
      if (!season) continue;
      const holder = document.createElement('div');
      holder.className = 'sgm-attend-holder';
      holder.innerHTML = '<button class="sgm-attend-button" type="button"><span aria-hidden="true">✦</span><span class="sgm-attend-label">Attend the ceremony</span></button>';
      holder.querySelector('button').addEventListener('click', (e) => attend(e.currentTarget, season));
      table.insertAdjacentElement('afterend', holder);
    }
  }

  const off = ctx.on('dom', scan);
  scan();
  return off;
}
})());
