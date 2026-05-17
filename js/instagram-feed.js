/**
 * js/instagram-feed.js — Kalkan Info
 *
 * #kalkaninfo hashtag etiketli postları çek, index.html'deki
 * #instagram-tagged grid'i dinamik olarak doldur.
 *
 * Veri kaynağı:
 *   1. /data/instagram-feed.json (Vercel cron build-time cache)
 *   2. /api/instagram-hashtag (canlı API — sadece secret ile)
 *
 * Veri yoksa mevcut statik mockup grid bozulmaz.
 */
(function () {
  'use strict';

  const FEED_PATH = '/data/instagram-feed.json';
  const GRID_SELECTOR = '#instagram-tagged .grid';

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'şimdi';
    if (min < 60) return `${min}d`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}sa`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}g`;
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  function postCard(p) {
    const url = escapeHtml(p.permalink || `https://www.instagram.com/explore/tags/kalkaninfo/`);
    const img = escapeHtml(p.image || '');
    const caption = escapeHtml((p.caption || '').slice(0, 80));
    const ago = timeAgo(p.timestamp);
    if (!img) return '';
    return `
      <a href="${url}" target="_blank" rel="noopener" class="group relative aspect-square overflow-hidden rounded-xl block" style="box-shadow:0 1px 3px rgba(7,33,54,0.08);">
        <img src="${img}" loading="lazy" decoding="async" alt="Instagram post" class="w-full h-full object-cover group-hover:scale-[1.06]" style="transition:transform .5s ease;" referrerpolicy="no-referrer" />
        <div class="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-transparent to-transparent"></div>
        <div class="absolute bottom-2 left-2 right-2 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition">${caption}${ago ? ` · ${ago}` : ''}</div>
        <div class="absolute top-2 right-2 w-7 h-7 rounded-full grid place-items-center text-white" style="background:rgba(0,0,0,0.55);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41a3.7 3.7 0 0 1 1.37.9c.43.42.7.83.9 1.36.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.37c-.42.43-.83.7-1.36.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.37-.9c-.43-.42-.7-.83-.9-1.36-.16-.43-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.2-.53.47-.94.9-1.37.43-.43.84-.7 1.37-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Z"/></svg>
        </div>
      </a>
    `;
  }

  async function loadFeed() {
    try {
      const res = await fetch(FEED_PATH + '?t=' + Date.now(), { cache: 'no-cache' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[instagram-feed] load failed', e);
      return null;
    }
  }

  function hideComingSoon() {
    const note = document.querySelector('#instagram-tagged .mt-4.text-center');
    if (note) note.style.display = 'none';
  }

  async function init() {
    const grid = document.querySelector(GRID_SELECTOR);
    if (!grid) return;

    const data = await loadFeed();
    if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
      // Statik mockup'a dokunma; "Yakında" rozeti görünür kalsın
      return;
    }

    // Gerçek post HTML'i hazırla
    const html = data.posts.slice(0, 6).map(postCard).filter(Boolean).join('');
    if (html) {
      grid.innerHTML = html;
      hideComingSoon();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
