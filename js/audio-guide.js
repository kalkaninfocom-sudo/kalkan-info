// Sesli Rehber Player — antik kent sayfaları için
// HTML: <div data-audio-guide data-slug="patara"></div>
// Manifest: /data/audio-manifest.json — {slug: {lang: path}}
(function () {
  const LANG_LABELS = { tr: 'TR', en: 'EN', de: 'DE', ru: 'RU', fr: 'FR' };
  const LANG_FULL = {
    tr: { title: 'Sesli Rehber', sub: 'Dil seçin ve dinleyin' },
    en: { title: 'Audio Guide', sub: 'Pick a language and listen' },
    de: { title: 'Audioguide', sub: 'Sprache wählen und anhören' },
    ru: { title: 'Аудиогид', sub: 'Выберите язык и слушайте' },
    fr: { title: 'Guide audio', sub: 'Choisissez une langue et écoutez' },
  };

  function getCurrentLang() {
    try {
      return (localStorage.getItem('lang') || document.documentElement.lang || 'tr').slice(0, 2);
    } catch (_) {
      return 'tr';
    }
  }

  function track(name, props) {
    if (window.plausible) window.plausible(name, props ? { props } : undefined);
  }

  function injectStyles() {
    if (document.getElementById('ag-styles')) return;
    const s = document.createElement('style');
    s.id = 'ag-styles';
    s.textContent = [
      '.ag-card{background:linear-gradient(135deg,#072136 0%,#0a2e4c 100%);color:#fff;border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:14px;box-shadow:0 12px 32px -12px rgba(7,33,54,0.45),inset 0 1px 0 rgba(255,255,255,0.06);}',
      '.ag-head{display:flex;align-items:center;gap:14px;}',
      '.ag-icon{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#e89812 0%,#c97b09 100%);display:grid;place-items:center;font-size:22px;flex-shrink:0;box-shadow:0 6px 18px -4px rgba(232,152,18,0.55);}',
      '.ag-text{flex:1;min-width:0;}',
      '.ag-title{font-family:"Montserrat",system-ui,sans-serif;font-weight:700;font-size:15px;letter-spacing:-0.01em;line-height:1.2;}',
      '.ag-sub{font-size:12px;color:rgba(210,225,240,0.72);margin-top:2px;}',
      '.ag-langs{display:flex;gap:6px;flex-wrap:wrap;}',
      '.ag-lang{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;font-family:"Montserrat",system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:0.1em;padding:7px 12px;border-radius:9999px;cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease,transform .15s ease;}',
      '.ag-lang:hover:not(.is-disabled){background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.22);transform:translateY(-1px);}',
      '.ag-lang:focus-visible{outline:2px solid #f4b53d;outline-offset:2px;}',
      '.ag-lang.is-active{background:#e89812;border-color:#e89812;color:#072136;}',
      '.ag-lang.is-disabled{opacity:0.32;cursor:not-allowed;}',
      '.ag-audio{width:100%;height:40px;border-radius:8px;}',
      '.ag-audio::-webkit-media-controls-panel{background:rgba(255,255,255,0.06);}',
      '@media (prefers-color-scheme: light){.ag-audio{filter:invert(0);}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  async function init() {
    const hosts = document.querySelectorAll('[data-audio-guide]');
    if (!hosts.length) return;
    injectStyles();

    let manifest = {};
    try {
      const res = await fetch('/data/audio-manifest.json', { cache: 'no-store' });
      if (res.ok) manifest = await res.json();
    } catch (_) {
      return;
    }

    hosts.forEach((host) => {
      const slug = host.dataset.slug;
      const langs = manifest[slug];
      if (!langs || !Object.keys(langs).length) {
        host.style.display = 'none';
        return;
      }

      const currentLang = getCurrentLang();
      const langCopy = LANG_FULL[currentLang] || LANG_FULL.tr;
      const initialLang = langs[currentLang] ? currentLang : Object.keys(langs)[0];

      host.innerHTML = `
        <div class="ag-card">
          <div class="ag-head">
            <div class="ag-icon" aria-hidden="true">🎧</div>
            <div class="ag-text">
              <div class="ag-title">${langCopy.title}</div>
              <div class="ag-sub">${langCopy.sub}</div>
            </div>
          </div>
          <div class="ag-langs" role="tablist">
            ${['tr', 'en', 'de', 'ru', 'fr']
              .map((l) => {
                const available = !!langs[l];
                const active = l === initialLang;
                return `<button type="button" role="tab" class="ag-lang${active ? ' is-active' : ''}${available ? '' : ' is-disabled'}" data-lang="${l}"${available ? '' : ' disabled aria-disabled="true"'}>${LANG_LABELS[l]}</button>`;
              })
              .join('')}
          </div>
          <audio class="ag-audio" controls preload="none" src="${langs[initialLang]}"></audio>
        </div>
      `;

      const audio = host.querySelector('.ag-audio');
      const tabs = host.querySelectorAll('.ag-lang');
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          if (tab.disabled) return;
          const lang = tab.dataset.lang;
          if (!langs[lang]) return;
          tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
          const wasPlaying = !audio.paused;
          audio.src = langs[lang];
          if (wasPlaying) audio.play().catch(() => {});
          track('audio_guide_lang', { slug, lang });
        });
      });

      audio.addEventListener('play', () => track('audio_guide_play', { slug, lang: host.querySelector('.ag-lang.is-active')?.dataset.lang }), { once: false });
      audio.addEventListener('ended', () => track('audio_guide_complete', { slug, lang: host.querySelector('.ag-lang.is-active')?.dataset.lang }));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
