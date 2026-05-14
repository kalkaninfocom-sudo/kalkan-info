/* Kalkan Info — Site Render Library
   Site sayfaları bu kütüphaneyi kullanarak data/*.json dosyalarından
   içerik render eder. Admin paneli localStorage'a kaydederse, site
   önce localStorage'a, sonra JSON'a fallback yapar.
*/

const KalkanData = (() => {
  const LS_KEY = 'kalkan_info_admin_v1';

  async function load(name) {
    // 1) localStorage (admin tarafından düzenlenmişse)
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed[name]) return parsed[name];
      }
    } catch(e) { /* ignore */ }
    // 2) data/*.json
    try {
      const res = await fetch(`data/${name}.json?t=${Date.now()}`);
      return await res.json();
    } catch(e) {
      console.error(`[KalkanData] ${name} yüklenemedi:`, e);
      return { items: [] };
    }
  }

  async function loadAll(...names) {
    const results = await Promise.all(names.map(load));
    return Object.fromEntries(names.map((n,i) => [n, results[i]]));
  }

  // ============== Render helpers ==============
  function escape(s) {
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  function safeImage(url, alt='') {
    if (!url) return `<div class="w-full h-full bg-ink-700/10 grid place-items-center text-ink-700/40">📷</div>`;
    return `<img src="${escape(url)}" alt="${escape(alt)}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=&quot;w-full h-full bg-ink-700/10 grid place-items-center text-ink-700/40&quot;>📷</div>'" />`;
  }

  function ratingStars(r) {
    if (!r) return '';
    return `<span class="inline-flex items-center gap-1 text-sun-500 text-xs font-semibold">★ ${Number(r).toFixed(1)}</span>`;
  }

  function tagPill(label, kind='default') {
    const cls = {
      sun: 'bg-sun-400/16 text-[#9a6b00]',
      ok:  'bg-emerald-100 text-emerald-700',
      sea: 'bg-sea-600/10 text-sea-600',
      mute:'bg-ink-700/10 text-ink-700/70'
    }[kind] || 'bg-sea-600/10 text-sea-600';
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}">${escape(label)}</span>`;
  }

  function featuredBadge() {
    return `<span class="inline-flex items-center gap-1 absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">★ Öne Çıkan</span>`;
  }

  // ============== Card templates ==============
  // Plaj card
  function plajCard(p) {
    const tags = (p.tags||[]).slice(0,3).map(t => tagPill(t,'sea')).join('');
    return `
      <article class="card group" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);transition:transform 200ms ease, box-shadow 200ms ease;">
        <div class="relative aspect-[16/10] overflow-hidden">
          ${safeImage(p.image, p.name)}
          ${p.featured ? featuredBadge() : ''}
          <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-ink-900/90 to-transparent">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] text-white/80 font-semibold tracking-wide uppercase">${escape(p.category||'')}</span>
              ${p.rating ? `<span class="bg-white/95 px-2 py-0.5 rounded-full">${ratingStars(p.rating)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="p-4">
          <h3 class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(p.name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(p.distance||'')}${p.drive?` · ${escape(p.drive)}`:''}</div>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(p.summary||'')}</p>
          <div class="flex flex-wrap gap-1 mt-3">${tags}</div>
        </div>
      </article>
    `;
  }

  // Villa card
  function villaCard(v) {
    const tags = (v.tags||[]).slice(0,3).map(t => tagPill(t,'sea')).join('');
    // Gallery: gallery array varsa onu kullan, yoksa sadece image
    const images = (v.gallery && v.gallery.length) ? v.gallery : [v.image].filter(Boolean);
    const slides = images.map((src, i) => `
      <div class="villa-slide" style="position:absolute;inset:0;opacity:${i===0?1:0};transition:opacity .35s ease;">
        ${safeImage(src, v.name)}
      </div>
    `).join('');
    const dots = images.length > 1 ? `
      <div class="villa-dots" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:3;">
        ${images.map((_, i) => `<span class="villa-dot" data-idx="${i}" style="width:6px;height:6px;border-radius:9999px;background:${i===0?'#fff':'rgba(255,255,255,0.45)'};transition:background .2s ease;"></span>`).join('')}
      </div>
    ` : '';
    const arrows = images.length > 1 ? `
      <button class="villa-arrow villa-prev" aria-label="Önceki" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:4;width:32px;height:32px;border-radius:9999px;background:rgba(7,33,54,0.55);color:#fff;display:grid;place-items:center;opacity:0;transition:opacity .2s ease,background .15s ease;cursor:pointer;backdrop-filter:blur(4px);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <button class="villa-arrow villa-next" aria-label="Sonraki" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:4;width:32px;height:32px;border-radius:9999px;background:rgba(7,33,54,0.55);color:#fff;display:grid;place-items:center;opacity:0;transition:opacity .2s ease,background .15s ease;cursor:pointer;backdrop-filter:blur(4px);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    ` : '';
    return `
      <article class="card villa-card group" data-images="${images.length}" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);">
        <div class="relative aspect-[16/10] overflow-hidden villa-gallery">
          ${slides}
          ${arrows}
          ${dots}
          ${v.featured ? featuredBadge() : ''}
          <div class="absolute top-3 left-3 z-[3]"><span class="bg-ink-900/85 text-white text-[10px] font-bold px-2 py-1 rounded-full">${escape(v.category||'')}</span></div>
        </div>
        <div class="p-4">
          <h3 class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(v.name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(v.location||'')} · ${escape(v.capacity||'')}</div>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(v.summary||'')}</p>
          <div class="flex flex-wrap gap-1 mt-3">${tags}</div>
          <div class="mt-4 pt-3 border-t border-ink-700/8">
            <a href="https://wa.me/905306650794?text=${encodeURIComponent('Merhaba, ' + (v.name||'villa') + ' hakkında bilgi almak istiyorum.')}" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-[#1da851] transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
              <span>Concierge ile Sor</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  // Tur card — concierge yönlendirmeli (fiyat ve direkt rezervasyon kaldırıldı)
  function turCard(t) {
    const msg = encodeURIComponent(`Merhaba Kalkan Info, ${t.name||'tur'} hakkında bilgi almak istiyorum.`);
    return `
      <article class="card" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);">
        <div class="relative aspect-[16/10] overflow-hidden">
          ${safeImage(t.image, t.name)}
          ${t.featured ? featuredBadge() : ''}
          <div class="absolute top-3 left-3"><span class="bg-sun-500 text-ink-900 text-[10px] font-bold px-2 py-1 rounded-full">${escape(t.category||'')}</span></div>
        </div>
        <div class="p-4">
          <h3 class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(t.name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(t.duration||'')}${t.capacity?` · ${escape(t.capacity)}`:''}</div>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(t.summary||'')}</p>
          <div class="mt-4 pt-3 border-t border-ink-700/8">
            <a href="https://wa.me/905306650794?text=${msg}" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-[#1da851] transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
              <span>Concierge ile Sor</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  // Restoran card
  function restoranCard(r) {
    const specs = (r.specialties||[]).slice(0,2).map(s => tagPill(s,'sea')).join('');
    return `
      <article class="card" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);">
        <div class="relative aspect-[16/10] overflow-hidden">
          ${safeImage(r.image, r.name)}
          ${r.featured ? featuredBadge() : ''}
          <div class="absolute top-3 left-3"><span class="bg-ink-900/85 text-white text-[10px] font-bold px-2 py-1 rounded-full">${escape(r.category||'')}</span></div>
          <div class="absolute bottom-3 right-3"><span class="bg-white/95 text-ink-900 text-xs font-bold px-2 py-1 rounded-full">${escape(r.priceRange||'')}</span></div>
        </div>
        <div class="p-4">
          <h3 class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(r.name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(r.cuisine||'')} · ${escape(r.location||'')}</div>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(r.summary||'')}</p>
          <div class="flex flex-wrap gap-1 mt-3">${specs}</div>
          <div class="flex items-center justify-between mt-4 pt-3 border-t border-ink-700/8">
            ${ratingStars(r.rating) || '<span></span>'}
            ${r.phone && r.phone!=='—' ? `<a href="tel:${escape(r.phone.replace(/\\s/g,''))}" class="text-sea-600 text-xs font-bold hover:underline">${escape(r.phone)}</a>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  // Haber card
  function haberCard(h) {
    return `
      <article class="card" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);">
        <div class="relative aspect-[16/10] overflow-hidden">
          ${safeImage(h.image, h.title)}
          ${h.featured ? featuredBadge() : ''}
          <div class="absolute top-3 left-3"><span class="bg-sea-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">${escape(h.category||'')}</span></div>
        </div>
        <div class="p-4">
          <div class="text-[11px] text-ink-700/60 font-semibold uppercase tracking-wide">${escape(h.date||'')}</div>
          <h3 class="font-display font-extrabold text-ink-900 text-base leading-tight mt-1">${escape(h.title)}</h3>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-3">${escape(h.summary||'')}</p>
        </div>
      </article>
    `;
  }

  // Hizmet card
  function hizmetCard(h) {
    const providerCount = Number(h.providerCount || 0);
    const providerBadge = providerCount > 0
      ? `<span class="inline-flex items-center gap-1.5 bg-sea-50 text-sea-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-sea-100"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path d="M15 19c0-2 1.5-3.5 4-3.5s3 1.5 3 3.5"/></svg>${providerCount} sağlayıcı</span>`
      : `<span class="inline-flex items-center gap-1.5 bg-sun-400/10 text-sun-600 text-[11px] font-bold px-2.5 py-1 rounded-full border border-sun-400/30">Yakında sağlayıcı</span>`;
    return `
      <article class="card service-card" data-service="${escape(h.id||'')}" style="background:white;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(7,33,54,0.1),0 16px 40px -8px rgba(7,33,54,0.2)';" onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(7,33,54,0.08),0 0 0 0 transparent';">
        ${h.image ? `<div class="relative aspect-[16/9] overflow-hidden rounded-lg mb-3 -mx-1">${safeImage(h.image, h.name)}<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(7,33,54,0.55) 100%);"></div><div class="pm-hint" style="position:absolute;bottom:0;left:0;right:0;padding:6px 12px;color:#f4b53d;font-size:0.63rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;display:flex;align-items:center;gap:4px;">→ Sağlayıcıları Gör</div></div>` : ''}
        <div class="flex items-start gap-3">
          <div class="text-3xl">${escape(h.icon||'🛠️')}</div>
          <div class="flex-1 min-w-0">
            <h3 class="font-display font-extrabold text-ink-900 text-base leading-tight">${escape(h.name)}</h3>
            <div class="text-[11px] text-ink-700/60 uppercase tracking-wide mt-0.5">${escape(h.category||'')}</div>
          </div>
        </div>
        <p class="text-sm text-ink-700/80 mt-3">${escape(h.summary||'')}</p>
        ${(h.details||[]).length ? `<ul class="text-xs text-ink-700/70 mt-3 space-y-1">${(h.details||[]).map(d => `<li class="flex items-start gap-1.5"><span class="text-sea-600">•</span>${escape(d)}</li>`).join('')}</ul>` : ''}
        <div class="flex items-center justify-between mt-4 pt-3 border-t border-ink-700/8 gap-2">
          ${providerBadge}
          ${h.hours ? `<span class="text-[11px] text-ink-700/60">${escape(h.hours)}</span>` : ''}
        </div>
      </article>
    `;
  }

  // ============== Filter helpers ==============
  function filterItems(items, { category, q, featured } = {}) {
    let out = [...(items||[])];
    if (featured) out = out.filter(i => i.featured);
    if (category) out = out.filter(i => i.category === category);
    if (q) {
      const ql = q.toLowerCase();
      out = out.filter(i => JSON.stringify(i).toLowerCase().includes(ql));
    }
    return out;
  }

  return {
    load, loadAll,
    plajCard, villaCard, turCard, restoranCard, haberCard, hizmetCard,
    filterItems, escape, safeImage, ratingStars, tagPill
  };
})();
