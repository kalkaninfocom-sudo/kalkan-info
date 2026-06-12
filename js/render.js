/* Kalkan Info — Site Render Library
   Site sayfaları bu kütüphaneyi kullanarak data/*.json dosyalarından
   içerik render eder. Admin paneli localStorage'a kaydederse, site
   önce localStorage'a, sonra JSON'a fallback yapar.
*/

const KalkanData = (() => {
  const LS_KEY = 'kalkan_info_admin_v1';
  const LANG_KEY = 'lang';
  const SUPPORTED_LANGS = ['en', 'tr', 'de', 'ru', 'fr'];

  // i18n helpers — JSON items may carry per-field translations.
  // Convention: alongside `name`, add `nameI18n: { en: "...", de: "...", ... }`.
  // Falls back to: target lang → en → tr → original field.
  function getLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
    } catch(e) { /* ignore */ }
    const docLang = (typeof document !== 'undefined' && document.documentElement.lang) || '';
    if (SUPPORTED_LANGS.includes(docLang)) return docLang;
    return 'tr';
  }

  // Pull a translated field with fallback chain.
  // t(item, 'name') → item.nameI18n[lang] || item.nameI18n.en || item.nameI18n.tr || item.name
  function t(item, field) {
    if (!item || !field) return '';
    const lang = getLang();
    const i18nKey = field + 'I18n';
    const dict = item[i18nKey];
    if (dict && typeof dict === 'object') {
      if (dict[lang]) return dict[lang];
      if (dict.en) return dict.en;
      if (dict.tr) return dict.tr;
    }
    return item[field] != null ? item[field] : '';
  }

  // Translate an array of strings (e.g. tags, specialties). Supports either
  // tagsI18n: { en:["..."], tr:[...] } OR tags: [ {en,tr,...} | "raw string" ]
  function tArray(item, field) {
    if (!item) return [];
    const lang = getLang();
    const i18nKey = field + 'I18n';
    const dict = item[i18nKey];
    if (dict && typeof dict === 'object') {
      if (Array.isArray(dict[lang])) return dict[lang];
      if (Array.isArray(dict.en)) return dict.en;
      if (Array.isArray(dict.tr)) return dict.tr;
    }
    const raw = item[field];
    if (!Array.isArray(raw)) return [];
    return raw.map(v => {
      if (v && typeof v === 'object') return v[lang] || v.en || v.tr || '';
      return v;
    });
  }

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
      const res = await fetch(`/data/${name}.json?t=${Date.now()}`);
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

  function imagePlaceholder(alt='') {
    return `<div class="w-full h-full grid place-items-center text-3xl" style="background:linear-gradient(135deg,#0a2e4c 0%,#134c79 60%,#1a5e93 100%);color:#f4b53d;" aria-label="${escape(alt)}">📷</div>`;
  }
  function safeImage(url, alt='') {
    if (!url || typeof url !== 'string' || !/^(https?:\/\/|\/)/i.test(url)) return imagePlaceholder(alt);
    const ph = imagePlaceholder(alt).replace(/"/g, '&quot;');
    return `<img src="${escape(url)}" alt="${escape(alt)}" class="w-full h-full object-cover" loading="lazy" decoding="async" onerror="this.outerHTML='${ph}'" />`;
  }

  function ratingStars(r) {
    if (!r) return '';
    return `<span class="inline-flex items-center gap-1 text-sun-500 text-xs font-semibold">★ ${Number(r).toFixed(1)}</span>`;
  }

  function tagPill(label, kind='default') {
    const cls = {
      sun: 'bg-sun-400/16 text-[#9a6b00]',
      ok:  'bg-sun-100 text-sun-700',
      sea: 'bg-sea-600/10 text-sea-600',
      mute:'bg-ink-700/10 text-ink-700/70'
    }[kind] || 'bg-sea-600/10 text-sea-600';
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}">${escape(label)}</span>`;
  }

  function featuredBadge() {
    const labels = { tr:'Öne Çıkan', en:'Featured', de:'Empfohlen', ru:'Рекомендуем', fr:'À la une' };
    const label = labels[getLang()] || labels.tr;
    return `<span class="inline-flex items-center gap-1 absolute top-3 right-3 bg-sun-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">★ ${escape(label)}</span>`;
  }

  // i18n labels for fixed strings used inside card templates
  function uiLabel(key) {
    const dict = {
      yolTarifi:      { tr:'Yol Tarifi', en:'Directions', de:'Wegbeschreibung', ru:'Маршрут', fr:'Itinéraire' },
      yolTarifiTitle: { tr:'Google Haritalar\'da yol tarifi', en:'Get directions on Google Maps', de:'Wegbeschreibung auf Google Maps', ru:'Маршрут в Google Картах', fr:'Itinéraire dans Google Maps' },
      concierge:      { tr:'Concierge ile Sor', en:'Ask Concierge', de:'Concierge fragen', ru:'Спросить консьержа', fr:'Demander au Concierge' },
      providers:      { tr:'sağlayıcı', en:'providers', de:'Anbieter', ru:'поставщиков', fr:'prestataires' },
      soonProviders:  { tr:'Yakında sağlayıcı', en:'Providers coming soon', de:'Anbieter bald verfügbar', ru:'Скоро поставщики', fr:'Prestataires bientôt' },
      seeProviders:   { tr:'→ Sağlayıcıları Gör', en:'→ See Providers', de:'→ Anbieter ansehen', ru:'→ Посмотреть поставщиков', fr:'→ Voir les prestataires' },
      directContact:  { tr:'Direkt İletişim', en:'Direct Contact', de:'Direktkontakt', ru:'Прямой контакт', fr:'Contact direct' },
      whatsappCta:    { tr:'WhatsApp ile İletişim', en:'Contact via WhatsApp', de:'Kontakt per WhatsApp', ru:'Связь через WhatsApp', fr:'Contact via WhatsApp' },
      instagramShow:  { tr:'Instagram\'da gör', en:'View on Instagram', de:'Auf Instagram ansehen', ru:'Смотреть в Instagram', fr:'Voir sur Instagram' },
      googleReviews:  { tr:'Yorumlar & Detay', en:'Reviews & Details', de:'Bewertungen & Details', ru:'Отзывы и детали', fr:'Avis & Détails' },
      googleReviewsTitle: { tr:'Restoran detay sayfası — yorumlar, menü, rezervasyon', en:'Restaurant detail page — reviews, menu, reservation', de:'Restaurantseite — Bewertungen, Speisekarte, Reservierung', ru:'Страница ресторана — отзывы, меню, бронирование', fr:'Page du restaurant — avis, menu, réservation' },
      readMore:       { tr:'Habere Git', en:'Read more', de:'Weiterlesen', ru:'Читать далее', fr:'Lire la suite' }
    };
    const row = dict[key];
    if (!row) return '';
    return row[getLang()] || row.tr || '';
  }

  // ============== Card templates ==============
  // Plaj card
  function plajCard(p) {
    const name = t(p, 'name');
    const summary = t(p, 'summary');
    const category = t(p, 'category');
    const distance = t(p, 'distance');
    const drive = t(p, 'drive');
    const tags = tArray(p, 'tags').slice(0,3).map(tag => tagPill(tag,'sea')).join('');
    const dest = (p.lat && p.lng)
      ? `${p.lat},${p.lng}`
      : encodeURIComponent(`${name||''} Kalkan Antalya`);
    const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    const detailHref = p.id ? `/plaj/${p.id}/` : null;
    const lng = getLang();
    const detailLabel = lng === 'en' ? 'Details' : lng === 'de' ? 'Details' : lng === 'ru' ? 'Подробнее' : lng === 'fr' ? 'Détails' : 'Detay';
    return `
      <article class="card group" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);transition:transform 200ms ease, box-shadow 200ms ease;">
        <div class="relative aspect-[16/10] overflow-hidden">
          ${detailHref ? `<a href="${detailHref}" aria-label="${escape(name||'')} ${escape(detailLabel)}" class="absolute inset-0 z-[1]"></a>` : ''}
          ${safeImage(p.image, name)}
          ${p.featured ? featuredBadge() : ''}
          <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-ink-900/90 to-transparent">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] text-white/80 font-semibold tracking-wide uppercase">${escape(category)}</span>
              ${p.rating ? `<span class="bg-white/95 px-2 py-0.5 rounded-full">${ratingStars(p.rating)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="p-4">
          <h3 class="font-display font-extrabold text-ink-900 text-lg leading-tight">${detailHref ? `<a href="${detailHref}" class="hover:text-sea-700 transition-colors">${escape(name)}</a>` : escape(name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(distance)}${drive?` · ${escape(drive)}`:''}</div>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(summary)}</p>
          <div class="flex flex-wrap gap-1 mt-3">${tags}</div>
          <div class="flex items-center gap-2 mt-3">
            ${detailHref ? `<a href="${detailHref}" class="flex-1 inline-flex items-center justify-center gap-1.5 bg-sea-800 hover:bg-sea-900 text-white text-[11px] font-bold px-3 py-2 rounded-md transition" aria-label="${escape(name||'')} ${escape(detailLabel)}">
              ${escape(detailLabel)}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>` : ''}
            <a href="${mapsHref}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="flex-shrink-0 inline-flex items-center gap-1.5 bg-sea-50 hover:bg-sea-100 text-sea-800 text-[11px] font-bold px-2.5 py-2 rounded-md transition" title="${escape(uiLabel('yolTarifiTitle'))}" aria-label="${escape(name||'')} ${escape(uiLabel('yolTarifi'))}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escape(uiLabel('yolTarifi'))}
            </a>
          </div>
        </div>
      </article>
    `;
  }

  // Villa card
  function villaCard(v) {
    const name = t(v, 'name');
    const summary = t(v, 'summary');
    const category = t(v, 'category');
    const location = t(v, 'location');
    const capacity = t(v, 'capacity');
    const tags = tArray(v, 'tags').slice(0,3).map(tag => tagPill(tag,'sea')).join('');
    // Gallery: gallery array varsa onu kullan, yoksa sadece image
    const images = (v.gallery && v.gallery.length) ? v.gallery : [v.image].filter(Boolean);
    const slides = images.map((src, i) => `
      <div class="villa-slide" style="position:absolute;inset:0;opacity:${i===0?1:0};transition:opacity .35s ease;">
        ${safeImage(src, name)}
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
      <article class="card villa-card group" data-images="${images.length}" data-villa-id="${escape(v.id||'')}" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);cursor:pointer;">
        <div class="relative aspect-[16/10] overflow-hidden villa-gallery">
          ${slides}
          ${arrows}
          ${dots}
          ${v.featured ? featuredBadge() : ''}
          <div class="absolute top-3 left-3 z-[3]"><span class="bg-ink-900/85 text-white text-[10px] font-bold px-2 py-1 rounded-full">${escape(category)}</span></div>
          ${v.instagram ? `<a href="${escape(v.instagram)}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="absolute bottom-3 right-3 z-[3] w-9 h-9 rounded-full grid place-items-center text-white transition hover:scale-110" style="background:linear-gradient(45deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888);box-shadow:0 2px 8px rgba(0,0,0,0.3);" title="${escape(uiLabel('instagramShow'))}" aria-label="${escape(name||'villa')} Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>` : ''}
        </div>
        <div class="p-4">
          <h3 class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(location)} · ${escape(capacity)}</div>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(summary)}</p>
          <div class="flex flex-wrap gap-1 mt-3">${tags}</div>
          <div class="mt-4 pt-3 border-t border-ink-700/8 space-y-2">
            ${['villa-poyraz','villa-ship-ahoy','villa-seascape'].includes(v.id) ? `
            <a href="/villa/${escape(v.id)}/" onclick="event.stopPropagation();" class="flex items-center justify-center gap-2 w-full bg-ink-900 text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-ink-700 transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <span data-en="View Detail Page" data-de="Detailseite ansehen" data-ru="Подробнее" data-fr="Voir la page détaillée">Detay Sayfası</span>
            </a>
            ` : ''}
            <a href="https://wa.me/905306650794?text=${encodeURIComponent('Merhaba, ' + (name||'villa') + ' hakkında bilgi almak istiyorum.')}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-[#1da851] transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
              <span>${escape(uiLabel('concierge'))}</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  // Tur card — concierge yönlendirmeli (fiyat ve direkt rezervasyon kaldırıldı)
  function turCard(tour) {
    const name = t(tour, 'name');
    const summary = t(tour, 'summary');
    const category = t(tour, 'category');
    const duration = t(tour, 'duration');
    const capacity = t(tour, 'capacity');
    const msg = encodeURIComponent(`Merhaba Kalkan Info, ${name||'tur'} hakkında bilgi almak istiyorum.`);
    return `
      <article class="card" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);">
        <div class="relative aspect-[16/10] overflow-hidden">
          ${safeImage(tour.image, name)}
          ${tour.featured ? featuredBadge() : ''}
          <div class="absolute top-3 left-3"><span class="bg-sun-500 text-ink-900 text-[10px] font-bold px-2 py-1 rounded-full">${escape(category)}</span></div>
        </div>
        <div class="p-4">
          <h3 class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(duration)}${capacity?` · ${escape(capacity)}`:''}</div>
          <p class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(summary)}</p>
          <div class="mt-4 pt-3 border-t border-ink-700/8">
            <a href="https://wa.me/905306650794?text=${msg}" target="_blank" rel="noopener" class="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-[#1da851] transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
              <span>${escape(uiLabel('concierge'))}</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  // Restoran card
  function restoranCard(r) {
    const name = t(r, 'name');
    const summary = t(r, 'summary');
    const category = t(r, 'category');
    const cuisine = t(r, 'cuisine');
    const location = t(r, 'location');
    const specsArr = tArray(r, 'specialties').slice(0, 2);
    // Emit data-en/de/ru/fr attrs so js/i18n.js can live-switch language
    // without re-rendering cards (MutationObserver pattern).
    const langAttrs = (dict) => {
      if (!dict || typeof dict !== 'object') return '';
      return ['en','de','ru','fr']
        .filter(l => dict[l])
        .map(l => `data-${l}="${escape(dict[l])}"`)
        .join(' ');
    };
    const nameAttrs = langAttrs(r.nameI18n);
    const summaryAttrs = langAttrs(r.summaryI18n);
    const specPillAttrs = (idx) => {
      const dict = r.specialtiesI18n;
      if (!dict) return '';
      return ['en','de','ru','fr']
        .filter(l => Array.isArray(dict[l]) && dict[l][idx])
        .map(l => `data-${l}="${escape(dict[l][idx])}"`)
        .join(' ');
    };
    const specs = specsArr.map((s, idx) => {
      const attrs = specPillAttrs(idx);
      return `<span ${attrs} class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sea-600/10 text-sea-600">${escape(s)}</span>`;
    }).join('');
    return `
      <article class="card" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);">
        <div class="relative aspect-[16/10] overflow-hidden">
          ${safeImage(r.image, name)}
          ${r.featured ? featuredBadge() : ''}
          <div class="absolute top-3 left-3"><span class="bg-ink-900/85 text-white text-[10px] font-bold px-2 py-1 rounded-full">${escape(category)}</span></div>
          <div class="absolute bottom-3 right-3 flex items-center gap-2">
            ${r.instagram ? `<a href="${escape(r.instagram)}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="w-9 h-9 rounded-full grid place-items-center text-white transition hover:scale-110" style="background:linear-gradient(45deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888);box-shadow:0 2px 8px rgba(0,0,0,0.3);" title="${escape(uiLabel('instagramShow'))}" aria-label="${escape(name||'')} Instagram"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>` : ''}
            ${r.priceRange ? `<span class="bg-white/95 text-ink-900 text-xs font-bold px-2 py-1 rounded-full">${escape(r.priceRange)}</span>` : ''}
          </div>
        </div>
        <div class="p-4">
          <h3 ${nameAttrs} class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(name)}</h3>
          <div class="text-xs text-ink-700/60 mt-1">${escape(cuisine)}${location?` · ${escape(location)}`:''}</div>
          <p ${summaryAttrs} class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(summary)}</p>
          <div class="flex flex-wrap gap-1 mt-3">${specs}</div>
          <div class="flex items-center justify-between mt-4 pt-3 border-t border-ink-700/8 gap-2">
            <a href="restoran/${escape(r.id)}/#reviews" onclick="event.stopPropagation();" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-md transition" style="background:#f1f3f4;color:#1a73e8;" onmouseover="this.style.background='#e8eaed';" onmouseout="this.style.background='#f1f3f4';" title="${escape(uiLabel('googleReviewsTitle'))}" aria-label="${escape(name||'')} ${escape(uiLabel('googleReviews'))}">
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC04" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
              ${escape(uiLabel('googleReviews'))}
            </a>
            ${r.customSiteUrl ? `<a href="${escape(r.customSiteUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-md transition" style="background:#E08B36;color:#fff;" onmouseover="this.style.background='#C97426';" onmouseout="this.style.background='#E08B36';" aria-label="${escape(name||'')} Web"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg><span data-en="Visit Website" data-de="Website" data-ru="Сайт" data-fr="Site web">Web Sitesi</span></a>` : ''}
            ${!r.customSiteUrl && r.phone && r.phone!=='—' ? `<a href="tel:${escape(r.phone.replace(/\\s/g,''))}" class="text-sea-600 text-xs font-bold hover:underline">${escape(r.phone)}</a>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  // Haber card
  function haberCard(h) {
    const title = t(h, 'title');
    const summary = t(h, 'summary');
    const category = t(h, 'category');
    const href = h.sourceUrl ? escape(h.sourceUrl) : 'haberler.html';
    const externalAttr = h.sourceUrl ? ' target="_blank" rel="noopener"' : '';
    return `
      <article class="card" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);transition:transform 0.2s ease,box-shadow 0.2s ease;">
        <a href="${href}"${externalAttr} class="block" style="text-decoration:none;color:inherit;" onmouseover="this.parentElement.style.transform='translateY(-2px)';this.parentElement.style.boxShadow='0 4px 8px rgba(7,33,54,0.1),0 16px 40px -8px rgba(7,33,54,0.18)';" onmouseout="this.parentElement.style.transform='';this.parentElement.style.boxShadow='0 1px 3px rgba(7,33,54,0.08)';">
          <div class="relative aspect-[16/10] overflow-hidden">
            ${safeImage(h.image, title)}
            ${h.featured ? featuredBadge() : ''}
            <div class="absolute top-3 left-3"><span class="bg-sea-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">${escape(category)}</span></div>
          </div>
          <div class="p-4">
            <div class="text-[11px] text-ink-700/60 font-semibold uppercase tracking-wide">${escape(h.date||'')}</div>
            <h3 class="font-display font-extrabold text-ink-900 text-base leading-tight mt-1">${escape(title)}</h3>
            <p class="text-sm text-ink-700/80 mt-2 line-clamp-3">${escape(summary)}</p>
            <div class="mt-3 pt-3 border-t border-ink-700/8">
              <span class="text-xs font-semibold text-sea-600 inline-flex items-center gap-1">${escape(uiLabel('readMore'))}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
              </span>
            </div>
          </div>
        </a>
      </article>
    `;
  }

  // Hizmet card
  function hizmetCard(h) {
    const name = t(h, 'name');
    const summary = t(h, 'summary');
    const category = t(h, 'category');
    const instructor = t(h, 'instructor');
    const details = tArray(h, 'details');
    // Direkt WhatsApp linkli kart (tek kişi/işletme — provider-modal yok)
    if (h.whatsappRaw) {
      const msg = encodeURIComponent(h.whatsappText || `Merhaba! Kalkan Info üzerinden ${name||'hizmet'} için ulaşıyorum.`);
      const waHref = `https://wa.me/${escape(h.whatsappRaw)}?text=${msg}`;
      const instructorLine = instructor ? `<div class="text-xs text-sea-700 font-bold mt-1">👤 ${escape(instructor)}</div>` : '';
      return `
        <a href="${waHref}" target="_blank" rel="noopener" class="card block" style="background:white;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease;text-decoration:none;color:inherit;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(7,33,54,0.1),0 16px 40px -8px rgba(7,33,54,0.2)';" onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(7,33,54,0.08),0 0 0 0 transparent';">
          ${h.image ? `<div class="relative aspect-[16/9] overflow-hidden rounded-lg mb-3 -mx-1">${safeImage(h.image, name)}<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(7,33,54,0.55) 100%);"></div><div style="position:absolute;bottom:0;left:0;right:0;padding:6px 12px;color:#25D366;font-size:0.7rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;display:flex;align-items:center;gap:6px;background:linear-gradient(0deg,rgba(7,33,54,0.85),transparent);"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>${escape(uiLabel('whatsappCta'))}</div></div>` : ''}
          <div class="flex items-start gap-3">
            <div class="text-3xl">${escape(h.icon||'🛠️')}</div>
            <div class="flex-1 min-w-0">
              <h3 class="font-display font-extrabold text-ink-900 text-base leading-tight">${escape(name)}</h3>
              <div class="text-[11px] text-ink-700/60 uppercase tracking-wide mt-0.5">${escape(category)}</div>
              ${instructorLine}
            </div>
          </div>
          <p class="text-sm text-ink-700/80 mt-3">${escape(summary)}</p>
          ${details.length ? `<ul class="text-xs text-ink-700/70 mt-3 space-y-1">${details.map(d => `<li class="flex items-start gap-1.5"><span class="text-sea-600">•</span>${escape(d)}</li>`).join('')}</ul>` : ''}
          <div class="flex items-center justify-between mt-4 pt-3 border-t border-ink-700/8 gap-2">
            <span class="inline-flex items-center gap-1.5 bg-[#25D366]/10 text-[#1da851] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#25D366]/25"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>${escape(uiLabel('directContact'))}</span>
            ${h.hours ? `<span class="text-[11px] text-ink-700/60">${escape(h.hours)}</span>` : ''}
          </div>
        </a>
      `;
    }
    const providerCount = Number(h.providerCount || 0);
    const providerBadge = providerCount > 0
      ? `<span class="inline-flex items-center gap-1.5 bg-sea-50 text-sea-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-sea-100"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path d="M15 19c0-2 1.5-3.5 4-3.5s3 1.5 3 3.5"/></svg>${providerCount} ${escape(uiLabel('providers'))}</span>`
      : `<span class="inline-flex items-center gap-1.5 bg-sun-400/10 text-sun-600 text-[11px] font-bold px-2.5 py-1 rounded-full border border-sun-400/30">${escape(uiLabel('soonProviders'))}</span>`;
    return `
      <article class="card service-card" data-service="${escape(h.id||'')}" style="background:white;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(7,33,54,0.1),0 16px 40px -8px rgba(7,33,54,0.2)';" onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(7,33,54,0.08),0 0 0 0 transparent';">
        ${h.image ? `<div class="relative aspect-[16/9] overflow-hidden rounded-lg mb-3 -mx-1">${safeImage(h.image, name)}<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(7,33,54,0.55) 100%);"></div><div class="pm-hint" style="position:absolute;bottom:0;left:0;right:0;padding:6px 12px;color:#f4b53d;font-size:0.63rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;display:flex;align-items:center;gap:4px;">${escape(uiLabel('seeProviders'))}</div></div>` : ''}
        <div class="flex items-start gap-3">
          <div class="text-3xl">${escape(h.icon||'🛠️')}</div>
          <div class="flex-1 min-w-0">
            <h3 class="font-display font-extrabold text-ink-900 text-base leading-tight">${escape(name)}</h3>
            <div class="text-[11px] text-ink-700/60 uppercase tracking-wide mt-0.5">${escape(category)}</div>
          </div>
        </div>
        <p class="text-sm text-ink-700/80 mt-3">${escape(summary)}</p>
        ${details.length ? `<ul class="text-xs text-ink-700/70 mt-3 space-y-1">${details.map(d => `<li class="flex items-start gap-1.5"><span class="text-sea-600">•</span>${escape(d)}</li>`).join('')}</ul>` : ''}
        <div class="flex items-center justify-between mt-4 pt-3 border-t border-ink-700/8 gap-2">
          ${providerBadge}
          ${h.hours ? `<span class="text-[11px] text-ink-700/60">${escape(h.hours)}</span>` : ''}
        </div>
      </article>
    `;
  }

  // Otel card — kalkaninfo.com/otel/<slug>/ adresine link verir, WhatsApp concierge CTA
  function otelCard(h) {
    const name = t(h, 'name');
    const summary = t(h, 'summary');
    const category = t(h, 'category');
    const location = t(h, 'location');
    const starRating = h.starRating;
    const nameAttrs = (() => {
      const dict = h.nameI18n;
      if (!dict) return '';
      return ['en','de','ru','fr'].filter(l => dict[l]).map(l => `data-${l}="${escape(dict[l])}"`).join(' ');
    })();
    const summaryAttrs = (() => {
      const dict = h.summaryI18n;
      if (!dict) return '';
      return ['en','de','ru','fr'].filter(l => dict[l]).map(l => `data-${l}="${escape(dict[l])}"`).join(' ');
    })();
    const starsBadge = starRating
      ? `<span class="bg-white/95 text-ink-900 text-xs font-bold px-2 py-1 rounded-full">${'★'.repeat(starRating)}</span>`
      : '';
    const msg = encodeURIComponent(`Merhaba Kalkan Info, ${name||'otel'} için rezervasyon bilgisi istiyorum.`);
    return `
      <article class="card" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(7,33,54,0.08);border:1px solid rgba(26,94,147,0.06);">
        <a href="otel/${escape(h.id)}/" class="block" style="text-decoration:none;color:inherit;">
          <div class="relative aspect-[16/10] overflow-hidden">
            ${safeImage(h.image, name)}
            ${h.featured ? featuredBadge() : ''}
            <div class="absolute top-3 left-3"><span class="bg-ink-900/85 text-white text-[10px] font-bold px-2 py-1 rounded-full">${escape(category)}</span></div>
            <div class="absolute bottom-3 right-3 flex items-center gap-2">
              ${starsBadge}
              ${h.priceRange ? `<span class="bg-white/95 text-ink-900 text-xs font-bold px-2 py-1 rounded-full">${escape(h.priceRange)}</span>` : ''}
            </div>
          </div>
          <div class="p-4">
            <h3 ${nameAttrs} class="font-display font-extrabold text-ink-900 text-lg leading-tight">${escape(name)}</h3>
            <div class="text-xs text-ink-700/60 mt-1">${escape(location)}</div>
            <p ${summaryAttrs} class="text-sm text-ink-700/80 mt-2 line-clamp-2">${escape(summary)}</p>
          </div>
        </a>
        <div class="px-4 pb-4 pt-1 flex items-center justify-between gap-2 border-t border-ink-700/8 mt-1">
          <a href="otel/${escape(h.id)}/" onclick="event.stopPropagation();" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-md transition" style="background:#f1f3f4;color:#1a73e8;" onmouseover="this.style.background='#e8eaed';" onmouseout="this.style.background='#f1f3f4';">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span data-en="Detail Page" data-de="Detailseite" data-ru="Подробнее" data-fr="Page détaillée">Detay Sayfası</span>
          </a>
          <a href="https://wa.me/905306650794?text=${msg}" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="inline-flex items-center gap-1.5 bg-[#25D366]/10 text-[#1da851] text-[11px] font-bold px-2.5 py-1.5 rounded-md border border-[#25D366]/25 hover:bg-[#25D366] hover:text-white transition">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
            ${escape(uiLabel('concierge'))}
          </a>
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
    plajCard, villaCard, turCard, restoranCard, otelCard, haberCard, hizmetCard,
    filterItems, escape, safeImage, ratingStars, tagPill,
    // i18n helpers (so pages can rerender on lang change)
    getLang, t, tArray
  };
})();
