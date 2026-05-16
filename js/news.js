// Renders data/haberler.json into haberler.html — replaces previously hard-coded cards.
// Categories, marquee, count, filter buttons are all built from the live JSON.

(function () {
  'use strict';

  const GRID = document.getElementById('card-grid');
  const FILTER_BAR = document.querySelector('[data-news-filterbar]');
  const COUNT_EL = document.querySelector('[data-news-count]');
  const MARQUEE_EL = document.querySelector('[data-news-marquee]');
  const SORT_EL = document.querySelector('[data-news-sort]');
  const HEAD_SUB = document.querySelector('[data-news-headsub]');

  if (!GRID) return;

  const CATEGORY_COLORS = {
    Plaj:     { bg: '#0ea5e9', emoji: '🏖️' },
    Restoran: { bg: '#e74c3c', emoji: '🍽️' },
    Belediye: { bg: '#475569', emoji: '🏛️' },
    Kültür:   { bg: '#7c3aed', emoji: '🏛️' },
    Hava:     { bg: '#0891b2', emoji: '⛅' },
    Etkinlik: { bg: '#e89812', emoji: '🎉' },
    Asayiş:   { bg: '#dc2626', emoji: '🚓' },
    Turizm:   { bg: '#1a5e93', emoji: '⛵' },
    Gündem:   { bg: '#0a2e4c', emoji: '📰' },
  };

  function categoryStyle(cat) {
    const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Gündem;
    return c;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function cardHtml(item) {
    const style = categoryStyle(item.category);
    const tinted = `linear-gradient(140deg, ${style.bg}33 0%, transparent 55%)`;
    const safeImage = escapeHtml(item.image || '');
    const source = item.source ? `${escapeHtml(item.source)} · ` : '';
    const href = item.sourceUrl ? escapeHtml(item.sourceUrl) : '#';
    const externalAttr = item.sourceUrl ? ' target="_blank" rel="noopener"' : '';
    return `
      <article class="news-card group rounded-xl overflow-hidden bg-white border border-sea-100 card-hover transition" data-cat="${escapeHtml(item.category)}" style="box-shadow:0 1px 3px rgba(7,33,54,0.07),0 6px 20px -6px rgba(7,33,54,0.13);">
        <a href="${href}"${externalAttr} class="block">
          <div class="relative overflow-hidden">
            <img src="${safeImage}" loading="lazy" class="w-full h-44 object-cover group-hover:scale-[1.04]" style="transition:transform .4s cubic-bezier(.25,.46,.45,.94);" alt="${escapeHtml(item.title)}" onerror="this.onerror=null;this.src='/assets/img/b7549bd5771f.webp'" />
            <div class="absolute inset-0 bg-gradient-to-t from-sea-900/60 to-transparent"></div>
            <div class="absolute inset-0" style="background:${tinted};mix-blend-mode:multiply;"></div>
            <span class="absolute top-3 left-3 text-white text-[11px] font-bold uppercase px-2 py-1 rounded" style="letter-spacing:0.06em;background:${style.bg};">${style.emoji} ${escapeHtml(item.category)}</span>
          </div>
          <div class="p-4">
            <div class="text-[11px] uppercase tracking-wider text-sea-400 font-semibold">${source}${formatDate(item.date)}</div>
            <h3 class="font-display font-bold text-sea-800 mt-1.5 leading-snug line-clamp-2">${escapeHtml(item.title)}</h3>
            <p class="text-sm text-sea-700/70 mt-2 line-clamp-3">${escapeHtml(item.summary)}</p>
            <div class="mt-3 pt-3 border-t border-sea-100">
              <span class="text-xs font-semibold text-sea-500 inline-flex items-center gap-1">Habere Git
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
              </span>
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function renderEmpty(msg) {
    GRID.innerHTML = `<div class="col-span-full text-center py-16 text-sea-500">
      <div class="text-4xl mb-3">📭</div>
      <div class="font-semibold">${escapeHtml(msg)}</div>
    </div>`;
  }

  let state = {
    items: [],
    categories: [],
    activeCat: 'tumu',
    sort: 'newest',
  };

  function applyFilters() {
    let list = state.items.slice();
    if (state.activeCat !== 'tumu') {
      list = list.filter(it => it.category === state.activeCat);
    }
    if (state.sort === 'oldest') {
      list.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (state.sort === 'cat') {
      list.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'tr'));
    } else {
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    if (!list.length) {
      renderEmpty('Bu kategoride henüz haber yok.');
    } else {
      GRID.innerHTML = list.map(cardHtml).join('');
    }
    if (COUNT_EL) COUNT_EL.textContent = `${state.items.length} haber · Kalkan & çevresi`;
  }

  function renderFilterBar() {
    if (!FILTER_BAR) return;
    const counts = { tumu: state.items.length };
    state.items.forEach(it => {
      counts[it.category] = (counts[it.category] || 0) + 1;
    });
    const cats = ['tumu', ...state.categories];
    FILTER_BAR.innerHTML = cats.map(cat => {
      const label = cat === 'tumu' ? 'Tümü' : cat;
      const count = counts[cat] || 0;
      const active = cat === state.activeCat;
      const base = 'filter-btn text-xs font-semibold px-4 py-2 rounded-full border transition';
      const cls = active
        ? `${base} bg-sea-800 text-white border-sea-800`
        : `${base} bg-white text-sea-700 border-sea-200 hover:border-sea-400`;
      return `<button data-cat-btn="${escapeHtml(cat)}" class="${cls}">${escapeHtml(label)} (${count})</button>`;
    }).join('');
    FILTER_BAR.querySelectorAll('[data-cat-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeCat = btn.getAttribute('data-cat-btn');
        renderFilterBar();
        applyFilters();
      });
    });
  }

  function renderMarquee() {
    if (!MARQUEE_EL) return;
    const top = state.items.slice(0, 6);
    if (!top.length) {
      MARQUEE_EL.innerHTML = '<span class="mr-10">📰 Haberler yükleniyor…</span>';
      return;
    }
    const emoji = { Plaj:'🏖️', Restoran:'🍽️', Belediye:'🏛️', Kültür:'🏛️', Hava:'⛅', Etkinlik:'🎉', Asayiş:'🚓', Turizm:'⛵', Gündem:'📰' };
    const seq = top.map(it => `<span class="mr-10">${emoji[it.category] || '📰'} ${escapeHtml(it.title)} — ${formatDate(it.date)}</span>`).join('');
    MARQUEE_EL.innerHTML = seq + seq;
  }

  function bindSort() {
    if (!SORT_EL) return;
    SORT_EL.addEventListener('change', () => {
      const v = SORT_EL.value;
      state.sort = v === 'oldest' ? 'oldest' : v === 'cat' ? 'cat' : 'newest';
      applyFilters();
    });
  }

  async function load() {
    GRID.innerHTML = '<div class="col-span-full text-center py-16 text-sea-400">Haberler yükleniyor…</div>';
    try {
      const res = await fetch('/data/haberler.json?t=' + Date.now(), { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.items = Array.isArray(data.items) ? data.items : [];
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      if (HEAD_SUB && data._meta && data._meta.updated) {
        const updated = new Date(data._meta.updated);
        if (!isNaN(updated)) {
          HEAD_SUB.textContent = `Son güncelleme: ${formatDate(updated.toISOString())} · ${state.items.length} haber`;
        }
      }
      renderFilterBar();
      renderMarquee();
      applyFilters();
    } catch (err) {
      console.error('news.js load error:', err);
      renderEmpty('Haberler yüklenemedi. Lütfen sayfayı yenileyin.');
    }
  }

  bindSort();
  load();
})();
