/**
 * header-search.js — Site içi global arama overlay
 * Tüm sayfalardaki [aria-label="Ara"] butonlarına otomatik bağlanır.
 * Veriyi KalkanData (window.KalkanData) üzerinden okur — yoksa data/*.json'dan fetch.
 */

(function () {
  'use strict';

  const COLLECTIONS = [
    { key: 'villalar',    label: 'Villalar',    page: 'villalar.html',     icon: '🏖️' },
    { key: 'restoranlar', label: 'Restoran & Bar', page: 'restoranlar.html',  icon: '🍽️' },
    { key: 'plajlar',     label: 'Plajlar',     page: 'plajlar.html',      icon: '🌊' },
    { key: 'turlar',      label: 'Turlar',      page: 'turlar.html',       icon: '🚤' },
    { key: 'hizmetler',   label: 'Hizmetler',   page: 'hizmetler.html',    icon: '🛠️' },
    { key: 'haberler',    label: 'Haberler',    page: 'haberler.html',     icon: '📰' },
  ];

  let _cache = null; // { villalar: [...], restoranlar: [...], ... }

  async function _loadAll() {
    if (_cache) return _cache;
    _cache = {};
    for (const c of COLLECTIONS) {
      try {
        let data;
        if (window.KalkanData?.load) data = await window.KalkanData.load(c.key);
        else { const r = await fetch(`data/${c.key}.json?t=${Date.now()}`); data = r.ok ? await r.json() : { items: [] }; }
        _cache[c.key] = (data?.items || []).map(it => ({ ...it, __collection: c.key, __pageLabel: c.label, __page: c.page, __icon: c.icon }));
      } catch (e) { console.warn('[search] load', c.key, e); _cache[c.key] = []; }
    }
    return _cache;
  }

  function _esc(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  function _matches(item, q) {
    const hay = (item.name || item.title || '') + ' ' + (item.summary || '') + ' ' + (item.category || '') + ' ' + (item.cuisine || '') + ' ' + (item.location || '') + ' ' + (Array.isArray(item.tags) ? item.tags.join(' ') : '') + ' ' + (Array.isArray(item.categories) ? item.categories.join(' ') : '');
    return hay.toLowerCase().includes(q);
  }

  function _resultCard(item) {
    const title = item.name || item.title || '—';
    const sub = item.category || item.cuisine || item.summary || '';
    const cover = item.image || (Array.isArray(item.images) && item.images[0]) || (Array.isArray(item.gallery) && (item.gallery[0]?.url || item.gallery[0])) || '';
    const linkHash = item.id ? `#${item.id}` : '';
    const _href = item.customSiteUrl ? _esc(item.customSiteUrl) : (_esc(item.__page)+linkHash);
    const _ext = item.customSiteUrl ? ' target="_blank" rel="noopener"' : '';
    return `
      <a href="${_href}"${_ext} class="flex items-center gap-3 p-3 rounded-lg hover:bg-sea-50 transition border border-transparent hover:border-sea-200">
        <div class="w-12 h-12 rounded bg-sea-100 grid place-items-center overflow-hidden flex-shrink-0 text-xl">
          ${cover ? `<img src="${_esc(cover)}" alt="" class="w-full h-full object-cover" />` : item.__icon || '📍'}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-display font-bold text-sea-800 text-sm leading-tight truncate">${_esc(title)}</div>
          <div class="text-[11px] text-sea-600/80 mt-0.5 truncate">${_esc(item.__pageLabel)}${sub ? ' · ' + _esc(sub) : ''}</div>
        </div>
      </a>`;
  }

  function _ensureOverlay() {
    if (document.getElementById('ki-search-overlay')) return;
    const html = `
      <div id="ki-search-overlay" style="display:none;position:fixed;inset:0;z-index:99998;background:rgba(7,33,54,0.85);backdrop-filter:blur(6px);padding:24px 16px;overflow-y:auto;">
        <div style="max-width:720px;margin:60px auto 40px;background:#fff;border-radius:16px;box-shadow:0 16px 64px rgba(0,0,0,0.4);overflow:hidden;font-family:'Inter',system-ui,sans-serif;">
          <div style="padding:14px 18px;border-bottom:1px solid #cfdfee;display:flex;align-items:center;gap:10px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a5e93" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input id="ki-search-input" type="search" placeholder="Villa, restoran, plaj, hizmet ara…" autocomplete="off"
              style="flex:1;border:0;outline:0;font-size:17px;font-weight:500;color:#072136;background:transparent;" />
            <button id="ki-search-close" aria-label="Kapat" style="width:32px;height:32px;border-radius:9999px;border:0;background:#eaf2f9;color:#0a2e4c;font-size:18px;cursor:pointer;">×</button>
          </div>
          <div id="ki-search-results" style="max-height:60vh;overflow-y:auto;padding:8px;">
            <div style="padding:48px 16px;text-align:center;color:#5d97c4;font-size:14px;">
              <div style="font-size:36px;margin-bottom:8px;">🔍</div>
              <div>Aramaya başlamak için yazın…</div>
              <div style="font-size:11px;margin-top:4px;opacity:0.7;">Kısayol: <kbd style="background:#eaf2f9;padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;">⌘K</kbd> / <kbd style="background:#eaf2f9;padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;">/</kbd></div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    const overlay = document.getElementById('ki-search-overlay');
    const input   = document.getElementById('ki-search-input');
    const results = document.getElementById('ki-search-results');
    const closeBtn = document.getElementById('ki-search-close');

    let _t = null;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      clearTimeout(_t);
      _t = setTimeout(() => _runSearch(q, results), 120);
    });
    closeBtn.addEventListener('click', _closeSearch);
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeSearch(); });
    document.addEventListener('keydown', e => {
      const opened = overlay.style.display === 'block';
      if (opened && e.key === 'Escape') { _closeSearch(); return; }
      if (!opened && (e.key === '/' || (e.metaKey && e.key === 'k') || (e.ctrlKey && e.key === 'k'))) {
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
        e.preventDefault();
        _openSearch();
      }
    });
  }

  async function _runSearch(q, resultsEl) {
    if (!q || q.length < 2) {
      resultsEl.innerHTML = `<div style="padding:48px 16px;text-align:center;color:#5d97c4;font-size:14px;">
        <div style="font-size:36px;margin-bottom:8px;">🔍</div>
        <div>En az 2 karakter yazın…</div>
      </div>`;
      return;
    }
    resultsEl.innerHTML = `<div style="padding:24px;text-align:center;color:#5d97c4;">Aranıyor…</div>`;
    const all = await _loadAll();
    const grouped = {};
    let total = 0;
    for (const c of COLLECTIONS) {
      const found = (all[c.key] || []).filter(it => _matches(it, q)).slice(0, 8);
      if (found.length) { grouped[c.key] = { label: c.label, items: found }; total += found.length; }
    }
    if (!total) {
      resultsEl.innerHTML = `<div style="padding:48px 16px;text-align:center;color:#5d97c4;font-size:14px;">
        <div style="font-size:36px;margin-bottom:8px;">🤷</div>
        <div>"<strong>${_esc(q)}</strong>" için sonuç yok.</div>
      </div>`;
      return;
    }
    const html = Object.entries(grouped).map(([key, g]) => `
      <div style="padding:8px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5d97c4;">${_esc(g.label)} (${g.items.length})</div>
      <div style="padding:0 8px 8px;display:grid;gap:4px;">${g.items.map(_resultCard).join('')}</div>
    `).join('');
    resultsEl.innerHTML = html;
  }

  function _openSearch() {
    _ensureOverlay();
    const overlay = document.getElementById('ki-search-overlay');
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('ki-search-input')?.focus(), 50);
  }

  function _closeSearch() {
    const overlay = document.getElementById('ki-search-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function _attach() {
    // Tüm "Ara" butonlarına bağla
    document.querySelectorAll('[aria-label="Ara"], [data-action="open-search"]').forEach(btn => {
      if (btn.dataset.kiSearchBound) return;
      btn.dataset.kiSearchBound = '1';
      btn.addEventListener('click', e => { e.preventDefault(); _openSearch(); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _attach);
  else _attach();

  // Public API
  window.KalkanSearch = { open: _openSearch, close: _closeSearch };
})();
