#!/usr/bin/env node
/**
 * Su Sporlari mini-site uretici (restoran builder deseninde).
 * Kullanim: node scripts/build-su-sporlari-pages.mjs [slug1 slug2 ...]
 *   - Slug verilmezse data/su-sporlari.json'daki TUM isletmeler uretilir.
 *
 * Cikti: hizmet/<slug>/index.html  (restoran-kalitesinde: 5 dil, tam SEO,
 *   JSON-LD SportsActivityLocation, galeri, hakkimizda, hizmetler, iletisim+harita)
 * Ayrica sitemap.xml'e /hizmet/<slug> URL'lerini ekler.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);
const data = JSON.parse(await readFile(join(root, 'data', 'su-sporlari.json'), 'utf8'));
const template = await readFile(join(root, 'hizmet', '_template-susporlari', 'index.html'), 'utf8');
const targets = args.length ? args : (data.items || []).map(it => it.id);

// Su sporlari sabit temasi — deniz mavisi / turkuaz.
const THEME = { bg:'#04121e', bg2:'#08202f', accent:'#3fb8c4', accent2:'#2e909a', text:'#e2eef4', muted:'#8aa6b6', font:'Poppins' };

// HTML escape
const esc = (s) => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ── i18n attribute uretici ──
const I18N_LANGS = ['en', 'de', 'ru', 'fr'];
function i18nAttrs(i18n){
  if (!i18n || typeof i18n !== 'object') return '';
  const out = [];
  for (const l of I18N_LANGS){
    const v = i18n[l];
    if (typeof v === 'string' && v.trim()) out.push(`data-${l}="${esc(v)}"`);
  }
  return out.join(' ');
}
// Bir servis oge index'i icin lang -> etiket objesi cikar (servicesI18n[lang][idx])
function serviceAttrs(item, idx){
  const m = item.servicesI18n; if (!m) return '';
  const obj = {};
  for (const l of I18N_LANGS){ const arr = m[l]; if (Array.isArray(arr) && arr[idx]) obj[l] = arr[idx]; }
  return i18nAttrs(obj);
}

// Yildizlar
function starsHtml(rating) {
  if (!rating) return '';
  const v = Math.max(0, Math.min(5, Number(rating)));
  const full = Math.floor(v);
  const half = (v - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const star = (fill) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.4" style="display:inline-block;vertical-align:middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  return star('currentColor').repeat(full) + (half ? star('none').repeat(1) : '') + star('none').repeat(empty);
}

// AggregateRating JSON-LD — rating+reviewCount varsa (gecersizse alan cikarilir)
function aggregateRatingJson(r) {
  const ratingValue = r?.rating ?? null;
  const reviewCount = r?.reviewCount ?? null;
  if (!ratingValue || !reviewCount) return null;
  return { '@type': 'AggregateRating', ratingValue: Number(ratingValue), reviewCount: Number(reviewCount), bestRating: 5, worstRating: 1 };
}
// Geo JSON-LD
function geoJson(r) {
  const c = r?.coordinates || {};
  const lat = c.latitude ?? c.lat ?? null;
  const lng = c.longitude ?? c.lng ?? null;
  if (lat == null || lng == null) return null;
  return { '@type': 'GeoCoordinates', latitude: Number(lat), longitude: Number(lng) };
}

// Calisma saatleri metni: dizi ({gun:saat}) | string | bos
const DAY_TR = { pazartesi:'Pzt', salı:'Sal', 'Çarşamba':'Çar', perşembe:'Per', cuma:'Cum', cumartesi:'Cmt', pazar:'Paz' };
function hoursText(hours) {
  if (!hours) return 'Bilgi için arayın';
  if (typeof hours === 'string') return hours;
  if (Array.isArray(hours)) {
    // Tum gunler ayni saat ise tek satir goster
    const pairs = hours.map(o => { const k = Object.keys(o)[0]; return { day: k, time: o[k] }; });
    const uniq = [...new Set(pairs.map(p => p.time))];
    if (uniq.length === 1) return `Her gün ${uniq[0]}`;
    return pairs.map(p => `${DAY_TR[p.day] || p.day}: ${p.time}`).join(' · ');
  }
  return 'Bilgi için arayın';
}

// Sosyal / dis baglantilar (website + daima google maps)
function socialLinks(r){
  const icons = [];
  if (r.website) icons.push(`<a href="${esc(r.website)}" target="_blank" rel="noopener" aria-label="Web Sitesi" title="Web Sitesi" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></a>`);
  icons.push(`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+' Kalkan')}" target="_blank" rel="noopener" aria-label="Google Haritalar" title="Google'da gör" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></a>`);
  return icons.join('');
}

// 5-dil UI etiketleri
const I18N_BASE = {
  tr: { about:'Hakkımızda', services:'Hizmetler', gallery:'Galeri', contact:'İletişim', cta_services:'Hizmetler', cta_contact:'İletişim', cta_whatsapp:'WhatsApp ile Yaz', about_label:'Hakkımızda', services_label:'Aktiviteler & Hizmetler', services_title:'Sunduğumuz Aktiviteler', services_sub:'Kalkan\'ın berrak sularında deneyimleyebileceğiniz aktiviteler ve hizmetler.', gallery_label:'Galeri', gallery_title:'Objektiften Kareler', contact_label:'İletişim', contact_title:'Bize Ulaşın', contact_addr:'Adres', contact_phone:'Telefon', contact_hours:'Çalışma Saatleri', contact_social:'Bağlantılar', related_label:'Keşfet', related_title:'Kalkan\'da Diğer Su Sporları', related_sub:'Aynı kategoride keşfedebileceğiniz diğer Kalkan su sporları işletmeleri.', related_all:'Tüm Su Sporları →' },
  en: { about:'About', services:'Services', gallery:'Gallery', contact:'Contact', cta_services:'Services', cta_contact:'Contact', cta_whatsapp:'Message on WhatsApp', about_label:'About Us', services_label:'Activities & Services', services_title:'Activities We Offer', services_sub:'Activities and services you can experience in the clear waters of Kalkan.', gallery_label:'Gallery', gallery_title:'Moments', contact_label:'Contact', contact_title:'Get In Touch', contact_addr:'Address', contact_phone:'Phone', contact_hours:'Opening Hours', contact_social:'Links', related_label:'Discover', related_title:'Other Water Sports in Kalkan', related_sub:'Other Kalkan water sports businesses in the same category worth exploring.', related_all:'All Water Sports →' },
  de: { about:'Über uns', services:'Leistungen', gallery:'Galerie', contact:'Kontakt', cta_services:'Leistungen', cta_contact:'Kontakt', cta_whatsapp:'Auf WhatsApp schreiben', about_label:'Über uns', services_label:'Aktivitäten & Leistungen', services_title:'Unsere Aktivitäten', services_sub:'Aktivitäten und Leistungen, die Sie im klaren Wasser von Kalkan erleben können.', gallery_label:'Galerie', gallery_title:'Momente', contact_label:'Kontakt', contact_title:'Kontaktiere uns', contact_addr:'Adresse', contact_phone:'Telefon', contact_hours:'Öffnungszeiten', contact_social:'Links', related_label:'Entdecken', related_title:'Weitere Wassersportarten in Kalkan', related_sub:'Weitere Wassersport-Anbieter in Kalkan derselben Kategorie.', related_all:'Alle Wassersportarten →' },
  ru: { about:'О нас', services:'Услуги', gallery:'Галерея', contact:'Контакты', cta_services:'Услуги', cta_contact:'Контакты', cta_whatsapp:'Написать в WhatsApp', about_label:'О нас', services_label:'Активности и услуги', services_title:'Наши активности', services_sub:'Активности и услуги, которые вы можете испытать в чистых водах Калкана.', gallery_label:'Галерея', gallery_title:'Моменты', contact_label:'Контакты', contact_title:'Свяжитесь с нами', contact_addr:'Адрес', contact_phone:'Телефон', contact_hours:'Часы работы', contact_social:'Ссылки', related_label:'Откройте', related_title:'Другие водные виды спорта в Калкане', related_sub:'Другие компании водных видов спорта Калкана той же категории.', related_all:'Все водные виды спорта →' },
  fr: { about:'À propos', services:'Services', gallery:'Galerie', contact:'Contact', cta_services:'Services', cta_contact:'Contact', cta_whatsapp:'Écrire sur WhatsApp', about_label:'À propos', services_label:'Activités & Services', services_title:'Nos Activités', services_sub:'Activités et services à découvrir dans les eaux claires de Kalkan.', gallery_label:'Galerie', gallery_title:'Instants', contact_label:'Contact', contact_title:'Contactez-nous', contact_addr:'Adresse', contact_phone:'Téléphone', contact_hours:'Horaires', contact_social:'Liens', related_label:'Découvrir', related_title:'Autres sports nautiques à Kalkan', related_sub:'D\'autres prestataires de sports nautiques de Kalkan dans la même catégorie.', related_all:'Tous les sports nautiques →' }
};

// Benzer isletmeler bolumu — ayni kategoriden digerlerine ic link
function relatedSection(current, allItems) {
  const picks = allItems.filter(x => x.id !== current.id).slice(0, 6);
  if (!picks.length) return '';
  const cards = picks.map(x => `
      <a href="/hizmet/${esc(x.id)}/" class="related-card block p-5 transition" style="border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
        <div class="text-[10px] tracking-[0.2em] uppercase font-bold mb-2" style="color:var(--theme-accent);">${esc(x.category || 'Su Sporları')}</div>
        <div class="font-display text-xl font-bold mb-1" style="color:var(--theme-text);">${esc(x.name)}</div>
        <div class="text-sm" style="color:var(--theme-muted);">${esc(x.type || '')}</div>
      </a>`).join('');
  return `
<section class="py-24 md:py-32 px-6">
  <div class="max-w-7xl mx-auto">
    <div class="section-label mb-6" data-i="related_label">Keşfet</div>
    <h2 class="font-display text-4xl md:text-5xl font-extrabold mb-4" data-i="related_title">Kalkan'da Diğer Su Sporları</h2>
    <p class="mb-12 text-base max-w-2xl" style="color:var(--theme-muted);" data-i="related_sub">Aynı kategoride keşfedebileceğiniz diğer Kalkan su sporları işletmeleri.</p>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">${cards}</div>
    <div class="mt-12">
      <a href="/hizmetler.html?cat=Su%20Sporlar%C4%B1" class="btn-ghost" data-i="related_all">Tüm Su Sporları →</a>
    </div>
  </div>
</section>`;
}

let built = [];

for (const slug of targets) {
  const r = (data.items || []).find(x => x.id === slug);
  if (!r) { console.warn(`Atlandi: ${slug} su-sporlari.json'da yok`); continue; }

  // Galeri: sadece bu isletmenin gercekten var olan fotograflari
  const gallery = (r.gallery || []).filter(Boolean)
    .filter(g => g.startsWith('/') ? existsSync(join(root, g.replace(/^\//, ''))) : true);
  const heroImage = (r.image && (r.image.startsWith('/') ? existsSync(join(root, r.image.replace(/^\//, ''))) : true))
    ? r.image
    : (gallery[0] || '');
  const aboutImage = gallery[1] || gallery[0] || heroImage;

  const galleryItems = gallery.map((src, i) => `
    <a href="${esc(src)}" target="_blank" class="gallery-item aspect-square block">
      <img src="${esc(src)}" alt="${esc(r.name)} ${i+1}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.background='var(--theme-bg-2)';this.style.opacity='0.3';">
    </a>`).join('');

  // Hizmet kartlari (servicesI18n data-attribute ile)
  const services = Array.isArray(r.services) ? r.services : [];
  const servicesItems = services.map((s, i) => `
      <div class="service-card p-5">
        <div class="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--theme-accent)" stroke-width="2" style="flex-shrink:0;margin-top:2px;"><path d="M20 6L9 17l-5-5"/></svg>
          <div class="font-display text-lg font-bold" ${serviceAttrs(r, i)}>${esc(s)}</div>
        </div>
      </div>`).join('');

  // Rating rozeti (hero)
  // Dil-notr rozet: yildizlar + puan + (Google logolu) yorum sayisi — "yorum" kelimesi yok.
  const ratingBadge = r.rating
    ? `<div class="flex justify-center"><span class="rating-badge"><span style="display:inline-flex;gap:1px;">${starsHtml(r.rating)}</span> ${Number(r.rating).toFixed(1)}${r.reviewCount ? ` · ${esc(r.reviewCount)} <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-1px;"><path d="M21 11.1H12.9V13.5H17.5C17.1 15.4 15.5 16.5 12.9 16.5C10 16.5 7.7 14.2 7.7 11.3C7.7 8.4 10 6.1 12.9 6.1C14.2 6.1 15.3 6.6 16.2 7.4L18 5.6C16.7 4.4 14.9 3.7 12.9 3.7C8.7 3.7 5.3 7.1 5.3 11.3C5.3 15.5 8.7 18.9 12.9 18.9C17.2 18.9 21 15.8 21 11.3C21 11.2 21 11.1 21 11.1Z"/></svg>` : ''}</span></div>`
    : '';

  // sameAs
  const sameAs = [];
  if (r.website) sameAs.push(r.website);
  sameAs.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+' Kalkan')}`);

  // Telefon / WhatsApp
  const phone = r.phone || '+90 530 665 07 94';
  const phoneRaw = phone.replace(/[^\d+]/g, '');
  const waRaw = phoneRaw.replace(/^\+/, '') || '905306650794';

  const heroImageFull = heroImage.startsWith('/') ? `https://kalkaninfo.com${heroImage}` : heroImage;

  // JSON-LD kosullu bloklar
  const aggObj = aggregateRatingJson(r);
  const aggregateRatingBlock = aggObj ? `"aggregateRating":${JSON.stringify(aggObj)},\n  ` : '';
  const geoObj = geoJson(r);
  const geoBlock = geoObj ? `"geo":${JSON.stringify(geoObj)},\n  ` : '';

  // META i18n
  const metaTitle = `${r.name} — Kalkan | kalkaninfo.com`;
  const descI18n = r.summaryI18n || {};
  const META_I18N = {};
  for (const l of ['tr', 'en', 'de', 'ru', 'fr']){
    META_I18N[l] = { title: metaTitle, desc: (l === 'tr') ? (r.summary || '') : (descI18n[l] || r.summary || '') };
  }

  const mapsQuery = encodeURIComponent(r.location || (r.name + ' Kalkan'));

  const repl = {
    NAME: r.name,
    NAME_URL: encodeURIComponent(r.name),
    SLUG: r.id,
    CATEGORY: r.category || 'Su Sporları',
    SUMMARY: r.summary || r.tagline || '',
    TAGLINE: r.tagline || r.summary || '',
    TAGLINE_I18N_ATTRS: i18nAttrs(r.taglineI18n),
    RATING_BADGE: ratingBadge,
    ABOUT_TITLE: r.name,
    ABOUT_TITLE_I18N_ATTRS: '',
    ABOUT_P1: r.aboutP1 || r.summary || '',
    ABOUT_P1_I18N_ATTRS: i18nAttrs(r.aboutP1I18n),
    ABOUT_P2: r.aboutP2 || '',
    ABOUT_P2_I18N_ATTRS: i18nAttrs(r.aboutP2I18n),
    ABOUT_IMAGE: aboutImage,
    HERO_IMAGE: heroImage,
    HERO_IMAGE_FULL: heroImageFull,
    OG_IMAGE_FULL: heroImageFull,
    SERVICES_ITEMS: servicesItems,
    GALLERY_ITEMS: galleryItems,
    LOCATION: r.location || 'Kalkan, Antalya',
    PHONE: phone,
    PHONE_RAW: phoneRaw,
    WA_RAW: waRaw,
    HOURS: hoursText(r.hours),
    MAPS_QUERY: mapsQuery,
    SOCIAL_LINKS: socialLinks(r),
    RELATED_SECTION: relatedSection(r, data.items || []),
    AGGREGATE_RATING_BLOCK: aggregateRatingBlock,
    GEO_BLOCK: geoBlock,
    SAME_AS_JSON: JSON.stringify(sameAs),
    META_I18N_JSON: JSON.stringify(META_I18N),
    I18N_JSON: JSON.stringify(I18N_BASE),
    THEME_BG: THEME.bg,
    THEME_BG_2: THEME.bg2,
    THEME_ACCENT: THEME.accent,
    THEME_ACCENT_2: THEME.accent2,
    THEME_TEXT: THEME.text,
    THEME_MUTED: THEME.muted,
    FONT_DISPLAY: THEME.font,
  };

  let html = template;
  for (const [k, v] of Object.entries(repl)) html = html.replaceAll(`{{${k}}}`, String(v));

  const outDir = join(root, 'hizmet', r.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  built.push({ slug: r.id, name: r.name, url: `https://kalkaninfo.com/hizmet/${r.id}/`, local: `http://localhost:3000/hizmet/${r.id}/` });
  console.log(`  + ${r.name}  ->  hizmet/${r.id}/`);
}

// Sitemap'e ekle (mevcut /hizmet/ formati)
if (built.length) {
  const sitemapPath = join(root, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0,10);
  let added = 0;
  for (const b of built) {
    const url = `https://kalkaninfo.com/hizmet/${b.slug}`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
      added++;
    }
  }
  if (added) await writeFile(sitemapPath, sitemap);
  console.log(`Sitemap: ${added} yeni /hizmet/ URL eklendi.`);
}

console.log('\n--- ADRESLER ---');
built.forEach(b => console.log(`  ${b.name}\n    Local : ${b.local}\n    Canli : ${b.url}\n`));
