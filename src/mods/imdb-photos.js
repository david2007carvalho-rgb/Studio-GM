/* Mod: IMDb Profile Photos — adds a photo (linked to IMDb) to actor/director profile pop-ups. */
SGM.register('imdb-photos', {
  start(ctx) {
    const PLACEHOLDER =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#3a3a3a"/><circle cx="48" cy="37" r="17" fill="#8a8a8a"/><path d="M12 96c0-24 16-38 36-38s36 14 36 38z" fill="#8a8a8a"/></svg>');
    const ROLE_LABELS = { Director: 'director', Actor: 'actor', Actress: 'actress' };

    ctx.addStyle(`
      .sgm-imdb-link { flex: none; display: block; width: 96px; height: 96px; border-radius: 50%; }
      .sgm-imdb-link[href] { cursor: pointer; }
      .sgm-imdb-link[href]:hover .sgm-imdb-photo { border-color: #f5c518; }
      .sgm-imdb-photo { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; object-position: top;
        flex: none; background: #3a3a3a; border: 2px solid rgba(255,255,255,.15); }
      .modal-head.sgm-has-photo > div:not(.sgm-x) { flex: 1; min-width: 0; }`);

    function personHead(dialog) {
      const head = dialog.querySelector('.modal-head');
      const h2 = head && head.querySelector('h2');
      const firstSub = head && head.querySelector('.modal-sub > span');
      if (!head || !h2 || !firstSub) return null;
      const role = ROLE_LABELS[firstSub.textContent.trim()];
      if (!role) return null; // a film page, not a person
      const name = [...h2.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (!name) return null;
      // the game's profile for a real-world person says its numbers are invented and say nothing about the real person
      const real = /invented for the game and say nothing about the real person/.test(dialog.textContent);
      return { head, name, role, real };
    }

    function apply(dialog) {
      const info = personHead(dialog);
      if (!info) return;
      const { head, name, role, real } = info;
      const key = `${role}|${name}|${real}`;
      let link = head.querySelector(':scope > .sgm-imdb-link');
      if (!link) {
        link = document.createElement('a');
        link.className = 'sgm-imdb-link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const photo = document.createElement('img');
        photo.className = 'sgm-imdb-photo';
        photo.alt = '';
        photo.referrerPolicy = 'no-referrer';
        link.appendChild(photo);
        head.classList.add('sgm-has-photo');
        head.insertBefore(link, head.firstChild);
      }
      const img = link.firstChild;
      if (link.dataset.key === key) return;
      link.dataset.key = key;
      link.removeAttribute('href'); // only linked once IMDb has recognised the person
      link.removeAttribute('title');
      img.src = PLACEHOLDER;
      if (ctx.settings.realOnly && !real) return;
      ctx.photos.lookup(name, role).then((res) => {
        if (link.dataset.key !== key || !res) return;
        if (res.id) { link.href = `https://www.imdb.com/name/${res.id}/`; link.title = `Open ${name} on IMDb`; }
        if (res.url) { img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; }; img.src = res.url; }
      });
    }

    const scan = () => document.querySelectorAll('.modal[role="dialog"]').forEach(apply);
    ctx.on('dom', scan);
    ctx.on('settings', () => { document.querySelectorAll('.sgm-imdb-link').forEach((l) => delete l.dataset.key); scan(); });
    ctx.addCleanup(() => document.querySelectorAll('.sgm-imdb-link').forEach((el) => el.remove()));
    ctx.addCleanup(() => document.querySelectorAll('.sgm-has-photo').forEach((el) => el.classList.remove('sgm-has-photo')));
    scan();
  },
});
