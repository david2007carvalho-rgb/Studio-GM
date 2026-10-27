/* Mod: Cinema Theme — re-skins the game. Turn the mod off for the original look. */
SGM.register('cinema-theme', (() => {
  const palettes = {
    letterboxd: {back:'#101819',shell:'#172d2e',panel:'#1b2929',line:'#344746',text:'#e8f0ed',muted:'#a6c0bd',accent:'#ff8000',soft:'#3a3023',gold:'#ffbd59',radius:'10px',font:'Georgia,serif',buttonRadius:'22px',buttonText:'#171717'},
    imdb: {back:'#171717',shell:'#111111',panel:'#242424',line:'#3a3a3a',text:'#eeeeee',muted:'#aaaaaa',accent:'#f5c518',soft:'#39331b',gold:'#f5c518',radius:'5px',font:'Arial,sans-serif',buttonRadius:'4px',buttonText:'#111111'},
    netflix: {back:'#141414',shell:'#080808',panel:'#222222',line:'#383838',text:'#f5f5f1',muted:'#b3b3b3',accent:'#e50914',soft:'#3b1719',gold:'#f5c518',radius:'3px',font:'Arial,sans-serif',buttonRadius:'3px',buttonText:'#ffffff'},
    a24: {back:'#171613',shell:'#211f1b',panel:'#24221e',line:'#49443b',text:'#eee8dc',muted:'#b0a899',accent:'#b85b4d',soft:'#3a2926',gold:'#d5bd93',radius:'2px',font:'Georgia,serif',buttonRadius:'2px',buttonText:'#ffffff'},
    hbo: {back:'#0c0b12',shell:'#14111d',panel:'#1d1929',line:'#3b324e',text:'#f4f0fb',muted:'#b8afca',accent:'#a77be8',soft:'#302342',gold:'#e5c77b',radius:'8px',font:'Georgia,serif',buttonRadius:'5px',buttonText:'#120d1b'},
    criterion: {back:'#f0eee8',shell:'#faf9f5',panel:'#ffffff',line:'#d2d0c8',text:'#171715',muted:'#68675f',accent:'#111111',soft:'#e5e3dc',gold:'#77715f',radius:'0px',font:'Georgia,serif',buttonRadius:'0px',buttonText:'#ffffff'},
    hollywood: {back:'#211719',shell:'#321d23',panel:'#3a272b',line:'#6c4b45',text:'#f4e7cf',muted:'#c7b39b',accent:'#d0aa62',soft:'#493238',gold:'#e8c77f',radius:'4px',font:'Georgia,serif',buttonRadius:'3px',buttonText:'#211719'},
    appletv: {back:'#080808',shell:'#111111',panel:'#1b1b1b',line:'#363636',text:'#f7f7f7',muted:'#a8a8a8',accent:'#f3f3f3',soft:'#303030',gold:'#d6d6d6',radius:'12px',font:'-apple-system,BlinkMacSystemFont,Arial,sans-serif',buttonRadius:'24px',buttonText:'#111111'},
    mubi: {back:'#101815',shell:'#14251e',panel:'#1b2b23',line:'#354d40',text:'#edf2eb',muted:'#a6b7aa',accent:'#78b99a',soft:'#263c30',gold:'#d5d8a4',radius:'3px',font:'Georgia,serif',buttonRadius:'3px',buttonText:'#102019'},
    executive: {back:'#111713',shell:'#1b2820',panel:'#202e25',line:'#405346',text:'#e7eee7',muted:'#a7b8aa',accent:'#e0aa4f',soft:'#3a3425',gold:'#e9c578',radius:'5px',font:'ui-monospace,SFMono-Regular,Consolas,monospace',buttonRadius:'4px',buttonText:'#17130b'},
    retro: {back:'#9aa7b8',shell:'#c4ccd7',panel:'#d8dee7',line:'#71839c',text:'#15243b',muted:'#425875',accent:'#2356a8',soft:'#b8c9e2',gold:'#d7a829',radius:'0px',font:'Tahoma,Verdana,sans-serif',buttonRadius:'0px',buttonText:'#ffffff'}
  };
  const _labels = {letterboxd:'Letterboxd',imdb:'IMDb',netflix:'Netflix',a24:'A24 / Indie Cinema',hbo:'HBO Prestige',criterion:'Criterion Collection',hollywood:'Old Hollywood',appletv:'Apple TV',mubi:'MUBI',executive:'Studio Executive',retro:'Retro Studio OS'};
  
  function buildCss(name) {
    const p = palettes[name];
    if (!p) return '';
    const isLight = name === 'criterion' || name === 'retro';
    let extra = '';
    if (name === 'letterboxd') extra = `h1,h2,h3{letter-spacing:-.03em!important} .pill,.edition-tag{border-radius:20px!important} .track li.current{background:${p.accent}!important;color:#101819!important}`;
    if (name === 'imdb') extra = `h1,h2,h3{font-family:Arial,sans-serif!important;font-weight:800!important} .track li.current,.pill{background:${p.accent}!important;color:#111!important}`;
    if (name === 'netflix') extra = `h1,h2,h3{font-weight:800!important;letter-spacing:-.035em!important} .track li.current,.pill{background:${p.accent}!important;color:#fff!important} .btn:not(:disabled):hover{filter:brightness(1.12)!important}`;
    if (name === 'a24') extra = `h1,h2,h3{font-family:Georgia,serif!important;font-weight:500!important;letter-spacing:-.04em!important} .panel,.card,.section,.movie-card{box-shadow:none!important;border-width:1px!important} .btn{text-transform:none!important;letter-spacing:.02em!important}`;
    if (name === 'hbo') extra = `h1,h2,h3{font-family:Georgia,serif!important;letter-spacing:-.025em!important} .topbar{box-shadow:0 5px 25px rgba(0,0,0,.25)!important} .stat-card,.panel{box-shadow:0 8px 24px rgba(0,0,0,.16)!important}`;
    if (name === 'criterion') extra = `body{background:#f0eee8!important;color:#171715!important} .topbar{border-bottom:2px solid #111!important} h1,h2,h3{font-family:Georgia,serif!important;font-weight:500!important} .panel,.card,.section,.box,.stat-card,.news-item,.movie-card,.profile-card{box-shadow:none!important} a{ text-decoration:underline!important;text-underline-offset:3px!important}`;
    if (name === 'hollywood') extra = `h1,h2,h3{font-family:Georgia,serif!important;letter-spacing:.015em!important} .topbar{border-bottom:2px solid ${p.accent}!important} .panel,.card,.stat-card{box-shadow:inset 0 1px rgba(255,255,255,.035),0 5px 18px rgba(0,0,0,.18)!important}`;
    if (name === 'appletv') extra = `h1,h2,h3{font-weight:650!important;letter-spacing:-.04em!important} .panel,.card,.section,.stat-card,.movie-card{box-shadow:0 8px 30px rgba(0,0,0,.12)!important} .btn{font-weight:600!important}`;
    if (name === 'mubi') extra = `h1,h2,h3{font-family:Georgia,serif!important;font-weight:500!important} .panel,.card,.section,.movie-card{box-shadow:none!important} a{ text-decoration-thickness:1px!important;text-underline-offset:3px!important}`;
    if (name === 'executive') extra = `h1,h2,h3{font-family:ui-monospace,SFMono-Regular,Consolas,monospace!important;letter-spacing:-.04em!important} .panel,.card,.stat-card,.section{border-left:3px solid ${p.accent}!important} table{font-variant-numeric:tabular-nums!important} .pill,.edition-tag{text-transform:uppercase!important;letter-spacing:.06em!important;font-size:.75em!important}`;
    if (name === 'retro') extra = `body{background:#9aa7b8!important;color:#15243b!important;font-family:Tahoma,Verdana,sans-serif!important} .shell,.topbar{border:2px outset #e7ebf1!important} .panel,.card,.modal,.stat-card,.section,.box,.news-item,.movie-card,.profile-card{border:2px outset #e1e6ee!important;box-shadow:2px 2px 0 #6c7c91!important} .btn{border:2px outset #e1e6ee!important} h1,h2,h3{font-family:Tahoma,Verdana,sans-serif!important}`;
    return `:root{--ink:${p.back}!important;--muted:${p.muted}!important;--backdrop:${p.back}!important;--panel:${p.panel}!important;--line:${p.line}!important;--accent:${p.accent}!important;--accent-soft:${p.soft}!important;--gold:${p.gold}!important;--loss:#ef6666!important;--accent-dark:${p.accent}!important;--bar-bright:${p.text}!important;--bar-text:${p.muted}!important;--bar-faint:${p.muted}!important;--bar-chip:${p.panel}!important;--bar-done:${p.soft}!important;--bar-done-text:${p.text}!important;--bar-line:${p.line}!important;--bar-view-text:${p.text}!important;--ticker-bg:${p.back}!important;--ticker-line:${p.line}!important;--ticker-link:${p.accent}!important;--ticker-text:${p.text}!important;--scrim:rgba(0,0,0,.72)!important;--serif:${p.font}!important;--sans:${p.font}!important;color-scheme:${isLight?'light':'dark'}!important}html,body{background:${p.back}!important;color:${p.text}!important;font-family:${p.font}!important}body *{border-color:${p.line}!important}body .shell,body .topbar{background:${p.shell}!important;color:${p.text}!important}body .topbar{border-bottom:2px solid ${p.accent}!important}body .panel,body .card,body .modal,body .stat-card,body .section,body .box,body .news-item,body .movie-card,body .profile-card{background:${p.panel}!important;color:${p.text}!important;border-color:${p.line}!important;border-radius:${p.radius}!important}body h1,body h2,body h3,body h4{color:${p.text}!important}body .btn:not(.quiet):not(.ghost),body button.primary,body [type=submit]{background:${p.accent}!important;color:${p.buttonText}!important;border-radius:${p.buttonRadius}!important;border-color:${p.accent}!important}body .btn.quiet,body .btn.ghost{color:${p.accent}!important;border-color:${p.accent}!important;border-radius:${p.buttonRadius}!important}body a{color:${p.accent}!important}body .pill,body .edition-tag{background:${p.soft}!important;color:${p.text}!important;border-radius:${p.radius}!important}body input,body select,body textarea{background:${name==='criterion'?'#fff':name==='retro'?'#eef2f8':p.back}!important;color:${p.text}!important;border-color:${p.line}!important}body table.data td{border-bottom-color:${p.line}!important}body ::selection{background:${p.accent}!important;color:${p.back}!important}/* Readability guardrails: force readable foregrounds on common game UI elements. */
  body :is(p,li,label,legend,dt,dd,th,td,figcaption,summary,small,strong,em,h1,h2,h3,h4,h5,h6){color:${p.text}!important}
  body :is(.muted,.subtle,.secondary,.help,.hint,.description,.caption,.text-muted,[aria-description]){color:${p.muted}!important}
  body :is(button,.btn,[role=button],a) :is(span,strong,small,svg){color:inherit!important}
  body button,body .btn,body [role=button],body input[type=button],body input[type=submit]{text-shadow:none!important}
  body input,body select,body textarea{caret-color:${p.text}!important}
  body input::placeholder,body textarea::placeholder{color:${p.muted}!important;opacity:1!important}
  body select option{background:${isLight?(name==='retro'?'#eef2f8':'#ffffff'):p.panel}!important;color:${p.text}!important}
  body :disabled,body [aria-disabled=true]{opacity:.72!important}
  body :focus-visible{outline:2px solid ${p.accent}!important;outline-offset:2px!important}
  body .pill,body .edition-tag,body .badge,body .tag,body [class*=badge],[class*=chip]{color:${p.text}!important}
  body .pill *,body .edition-tag *,body .badge *,body .tag *,body [class*=badge] *,body [class*=chip] *{color:inherit!important}
  ${extra}`;
  }

  return {
    start(ctx) {
      const ID = 'studio-gm-cinema-theme';
      const apply = () => {
        const name = ctx.settings.theme;
        document.getElementById(ID)?.remove();
        const css = buildCss(name);
        if (!css) return document.documentElement.removeAttribute('data-studio-gm-theme');
        const style = document.createElement('style');
        style.id = ID;
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        document.documentElement.setAttribute('data-studio-gm-theme', name);
      };
      apply();
      ctx.on('settings', apply);
      ctx.addCleanup(() => {
        document.getElementById(ID)?.remove();
        document.documentElement.removeAttribute('data-studio-gm-theme');
      });
    },
  };
})());
