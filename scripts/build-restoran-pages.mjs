#!/usr/bin/env node
/**
 * Restoran mini-site uretici.
 * Kullanim: node scripts/build-restoran-pages.mjs [slug1 slug2 ...]
 *   - Slug verilmezse 3 demo (aubergine, korsan-kalamar, harbor-lights) uretilir.
 */
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const REVIEWS_DIR = join(root, 'data', 'restoran-reviews');

const args = process.argv.slice(2);
// Slug verilmezse data/restoranlar.json'daki TUM restoranlar uretilir.
// Tek slug icin: node scripts/build-restoran-pages.mjs aubergine

const data = JSON.parse(await readFile(join(root, 'data', 'restoranlar.json'), 'utf8'));
const template = await readFile(join(root, 'restoran', '_template', 'index.html'), 'utf8');
const targets = args.length ? args : (data.items || []).map(it => it.id);
const { existsSync } = await import('node:fs');

// Pool fallback KALDIRILDI. Her restoran SADECE kendi fotograflarini gosterir.
// Galeri kaynagi: (1) restoranlar.json'daki gercek gallery + image, sonra
// (2) fetch-restoran-photos.mjs ile indirilen /assets/img/restoran/<slug>-{hero,1..8}.jpg.
// 8'e ulasilamazsa kart sayisi azalir; havuzdan baska restoranin fotosu KULLANILMAZ.

// Kanonik hero kullanan restoranlar — bunlarin hero gorseline dokunma.
// Fetch indirir ama mevcut "kanonik" hero korunur.
const REAL_HEROES = new Set(
  Array.isArray(data?._meta?.realHeroes)
    ? data._meta.realHeroes
    : ['aubergine', 'korsan-kalamar', 'harbor-lights', 'ziizi-pizza']
);

// Kategoriye gore tema secimi
function theme(category){
  const map = {
    'Fine Dining':       { bg:'#0d0610', bg2:'#1a0a14', accent:'#d4af37', accent2:'#b8932a', text:'#e8e2d4', muted:'#9b8f78', font:'Playfair+Display' },
    'Deniz Ürünleri':    { bg:'#061826', bg2:'#0a2236', accent:'#4eb1b3', accent2:'#3a8e91', text:'#e1ecf2', muted:'#7f9aae', font:'Cormorant+Garamond' },
    'Cafe & Bar':        { bg:'#1a120a', bg2:'#241710', accent:'#e8a55a', accent2:'#c8853e', text:'#f0e5d6', muted:'#a89882', font:'Cormorant+Garamond' },
    'Türk Mutfağı':      { bg:'#1a0e0a', bg2:'#241410', accent:'#d97757', accent2:'#b85a3d', text:'#f0e2d4', muted:'#a89682', font:'Cormorant+Garamond' },
    'Dünya Mutfağı':     { bg:'#0f0f10', bg2:'#1a1a1c', accent:'#c9b87f', accent2:'#a89860', text:'#e8e3d8', muted:'#9a948a', font:'Cormorant+Garamond' },
    'Pub & Lounge':      { bg:'#0a0d10', bg2:'#13181c', accent:'#e8c46c', accent2:'#c9a44e', text:'#e6e4dc', muted:'#94918a', font:'Playfair+Display' },
    'Gece Kulübü':       { bg:'#0a0410', bg2:'#15082a', accent:'#c47ae0', accent2:'#9a5cb8', text:'#ecdcf0', muted:'#9c8aa8', font:'Playfair+Display' }
  };
  return map[category] || map['Dünya Mutfağı'];
}

// Kategoriye gore Unsplash fallback gorsel keyword'leri
const UNSPLASH_KEYWORDS = {
  'Fine Dining':     ['fine-dining,plating','restaurant-elegant','wine-glass','chef-plating'],
  'Deniz Ürünleri':  ['seafood,restaurant','fresh-fish','mediterranean-seafood','meze-plate'],
  'Cafe & Bar':      ['cafe-coffee','specialty-coffee','cocktail-bar','brunch-plate'],
  'Türk Mutfağı':    ['turkish-food','meze-platter','kebab-grill','traditional-turkish'],
  'Dünya Mutfağı':   ['gourmet-food','restaurant-interior','plated-dish','dining-room'],
  'Pub & Lounge':    ['lounge-bar','cocktail','dim-lighting-bar','pub-interior'],
  'Gece Kulübü':     ['nightclub','dj-lights','dancing','party-night']
};

// Hakkimda ve menu icerik tohumlari
const CUSTOM = {
  'aubergine': {
    tagline: 'Akdeniz fine dining — taze malzeme, hassas detay.',
    aboutTitle: 'Detay ve Sadelik.',
    aboutP1: 'Aubergine, Kalkan\'ın kalbinde, denize bakan terasıyla Akdeniz mutfağının ince yorumunu sunar. Mevsimsel ürünler, kısa menü, dikkatle seçilmiş şarap kart.',
    aboutP2: 'Her tabak, mutfak şefimiz ve yerel üretici arasındaki diyaloğun ürünüdür. Aubergine\'de yemek, bir akşamın merkezi olmak için tasarlandı.',
    menuTitle: 'Mevsimlik Menü',
    menuSub: 'Menümüz her hafta yerel pazara göre yenilenir. Aşağıda mevcut sezonun seçili tabakları.',
    menu: {
      'Başlangıç': ['Karides ve avokado tartare', 'Roka, çam fıstığı, parmesan', 'Mevsim çorbası'],
      'Ana Yemek': ['Akdeniz levrek fileto', 'Kuzu pirzola, taze kekik', 'Bahçe sebzeli risotto'],
      'Tatlı': ['Sıcak çikolata fondan', 'Limon parfait', 'Mevsim meyveleri']
    },
    hours: 'Her gün 18:00 — 23:30'
  },
  'korsan-kalamar': {
    tagline: 'Kalkan klasiği — taze balık, liman manzarası.',
    aboutTitle: 'Limanın Yanı Başında.',
    aboutP1: 'Korsan Kalamar, Kalamar Koyu\'nda hizmet veriyor. Gün taze balık, ev yapımı mezeler ve sıcak misafirperverlik — Kalkan\'ın eski havasını koruyan az sayıdaki yerden biri.',
    aboutP2: 'Mevsimine göre balıkçımızın kıyıya getirdiği taze ürünleri masada görüyorsunuz. Klasik tarifler, taze otlar, sade sunum.',
    menuTitle: 'Günlük Taze Balık',
    menuSub: 'Menümüz her gün limana göre değişir. Aşağıdakiler değişmez klasiklerimiz.',
    menu: {
      'Mezeler': ['Topik', 'Haydari', 'Patlıcan ezme', 'Lakerda', 'Roka salatası'],
      'Ana Yemek': ['Izgara çipura', 'Levrek buğulama', 'Kalamar ızgara', 'Karides güveç', 'Lüfer mevsim'],
      'Sonrası': ['Lokum tabağı', 'Karpuz & beyaz peynir', 'Türk kahvesi']
    },
    hours: 'Her gün 12:00 — 24:00'
  },
  'harbor-lights': {
    tagline: 'Sabahtan geceye — sanatkâr kahve, brunch, kokteyl.',
    aboutTitle: 'Limanın Işığı.',
    aboutP1: 'Harbor Lights, Kalkan iskelesinde artisan cafe & cocktail bar. Sabah erken brunch ile başlar, gün boyu kahve ritüeli, akşam el yapımı kokteyl ile devam eder.',
    aboutP2: 'Liman kıyısındaki konumumuz, kahve içerken Kalkan teknelerini izlemenizi sağlar. İçeride ev yapımı pastalar, dışarıda Lykia rüzgârı.',
    menuTitle: 'Gün Boyu Menü',
    menuSub: 'Üç ana saatte üç farklı menü: kahvaltı, öğle, akşam.',
    menu: {
      'Kahvaltı': ['Avokado toast', 'Eggs Benedict', 'Türk kahvaltı tabağı', 'Açai bowl'],
      'Kahve & İçecek': ['Filter kahve (origin)', 'Cortado', 'Soğuk demleme', 'Matcha latte'],
      'Akşam': ['Sezar salata', 'Trüf mantar tabağı', 'El yapımı kokteyl seti', 'Mezze tabağı']
    },
    hours: 'Her gün 08:00 — 24:00'
  }
};

// HTML escape
const esc = (s) => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Yildizlar — full + half + empty (5'lik sistem)
function starsHtml(rating) {
  if (!rating) return '';
  const v = Math.max(0, Math.min(5, Number(rating)));
  const full = Math.floor(v);
  const half = (v - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const star = (fill) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.4" style="display:inline-block;vertical-align:middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  return star('currentColor').repeat(full) + (half ? star('url(#half)') : '') + star('none').repeat(empty);
}

// AggregateRating JSON-LD objesi (Schema.org)
function aggregateRatingJson(cache) {
  const place = cache?.place || {};
  if (!place.rating && !place.reviews) return {};
  return {
    '@type': 'AggregateRating',
    ratingValue: place.rating ?? undefined,
    reviewCount: place.reviews ?? undefined,
    bestRating: 5,
    worstRating: 1
  };
}

// Review array JSON-LD (en fazla 5 yorum)
function reviewArrayJson(cache) {
  const reviews = cache?.reviews || [];
  if (!reviews.length) return [];
  return reviews.slice(0, 5).map(rv => {
    const obj = {
      '@type': 'Review',
      author: { '@type': 'Person', name: rv.user || 'Anonim' },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: rv.rating || 5,
        bestRating: 5
      }
    };
    // date: "3 gün önce" gibi göreceli tarihleri atla, ISO tarih varsa ekle
    if (rv.date && /\d{4}/.test(rv.date)) obj.datePublished = rv.date;
    if (rv.snippet) obj.reviewBody = rv.snippet.slice(0, 500);
    return obj;
  });
}

// Cache'den restoran review verisini oku (yoksa null)
async function loadReviewCache(slug) {
  const path = join(REVIEWS_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

// Reviews bolumu HTML (cache varsa veri ile, yoksa empty state)
function buildReviewsSection(r, cache) {
  const place = cache?.place || {};
  const reviews = cache?.reviews || [];
  const rating = place.rating ?? r.rating ?? null;
  const reviewCount = place.reviews ?? r.reviewCount ?? null;
  const mapsHref = place.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${esc(place.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' Kalkan')}`;

  // Empty state — cache yoksa veya hic yorum yoksa
  if (!reviews.length) {
    return `
<section id="reviews" class="py-24 md:py-32 px-6">
  <div class="max-w-5xl mx-auto text-center">
    <div class="section-label justify-center mb-6" data-i="reviews_label">Misafir Yorumları</div>
    <h2 class="font-display text-4xl md:text-5xl font-extrabold mb-6" data-i="reviews_title">Google'da Bizi Anlatanlar</h2>
    <p class="text-base max-w-xl mx-auto mb-10" style="color:var(--theme-muted);" data-i="reviews_empty">Yorumlar yakında eklenecek.</p>
    <a href="${esc(mapsHref)}" target="_blank" rel="noopener" class="btn-ghost" data-i="reviews_all">Tüm Yorumları Gör (Google)</a>
  </div>
</section>`;
  }

  const ratingBlock = rating ? `
    <div class="flex flex-col items-center mb-12">
      <div class="font-display text-7xl font-extrabold leading-none" style="color:var(--theme-accent);">${Number(rating).toFixed(1)}</div>
      <div class="flex gap-1 mt-3" style="color:var(--theme-accent);">${starsHtml(rating)}</div>
      ${reviewCount ? `<div class="text-sm mt-3" style="color:var(--theme-muted);">${esc(reviewCount)} Google ${rating ? 'yorum' : 'inceleme'}</div>` : ''}
    </div>` : '';

  const cards = reviews.slice(0, 6).map(rv => {
    const initial = (rv.user || '?').trim().charAt(0).toUpperCase();
    const snippet = (rv.snippet || '').slice(0, 320);
    return `
      <article class="border p-6 flex flex-col h-full" style="border-color:rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
        <div class="flex items-center gap-3 mb-4">
          ${rv.avatar
            ? `<img src="${esc(rv.avatar)}" alt="${esc(rv.user)}" class="w-10 h-10 rounded-full object-cover" loading="lazy">`
            : `<div class="w-10 h-10 rounded-full grid place-items-center font-bold" style="background:var(--theme-accent);color:var(--theme-bg);">${esc(initial)}</div>`}
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm truncate">${esc(rv.user)}${rv.local_guide ? ` <span class="text-[10px] uppercase tracking-wider ml-1" style="color:var(--theme-accent);">Local Guide</span>` : ''}</div>
            <div class="text-xs" style="color:var(--theme-muted);">${esc(rv.date || '')}</div>
          </div>
        </div>
        ${rv.rating ? `<div class="flex gap-0.5 mb-3" style="color:var(--theme-accent);">${starsHtml(rv.rating)}</div>` : ''}
        <p class="text-sm leading-relaxed" style="color:var(--theme-text);">${esc(snippet)}${(rv.snippet || '').length > 320 ? '…' : ''}</p>
      </article>`;
  }).join('');

  return `
<section id="reviews" class="py-24 md:py-32 px-6">
  <div class="max-w-7xl mx-auto">
    <div class="text-center mb-16">
      <div class="section-label justify-center mb-6" data-i="reviews_label">Misafir Yorumları</div>
      <h2 class="font-display text-4xl md:text-5xl font-extrabold mb-6" data-i="reviews_title">Google'da Bizi Anlatanlar</h2>
      <p class="max-w-2xl mx-auto text-base" style="color:var(--theme-muted);" data-i="reviews_sub">Aşağıdaki yorumlar Google Maps'ten alınmıştır.</p>
    </div>
    ${ratingBlock}
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
    <div class="text-center mt-12">
      <a href="${esc(mapsHref)}" target="_blank" rel="noopener" class="btn-primary" data-i="reviews_all">Tüm Yorumları Gör (Google)</a>
    </div>
  </div>
</section>`;
}

// Sosyal medya ikonları
function socialLinks(r){
  const icons = [];
  if (r.instagram) icons.push(`<a href="${esc(r.instagram)}" target="_blank" rel="noopener" aria-label="Instagram" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>`);
  if (r.facebook) icons.push(`<a href="${esc(r.facebook)}" target="_blank" rel="noopener" aria-label="Facebook" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>`);
  if (r.tripadvisor) icons.push(`<a href="${esc(r.tripadvisor)}" target="_blank" rel="noopener" aria-label="TripAdvisor" style="color:var(--theme-accent);">TR</a>`);
  // Daima Google Maps yorumlari
  icons.push(`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+' Kalkan')}" target="_blank" rel="noopener" aria-label="Google Yorumları" style="color:var(--theme-accent);" title="Google'da yorumları gör"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></a>`);
  return icons.join('');
}

// 5-dil i18n basit ceviri
const I18N_BASE = {
  tr: { about:'Hakkımızda', menu:'Menü', gallery:'Galeri', reserve:'Rezervasyon', contact:'İletişim', cta_reserve:'Rezervasyon', cta_menu:'Menüyü Gör', cta_reserve_send:'Talebi Gönder', about_label:'Hakkımızda', menu_label:'Menü', gallery_label:'Galeri', gallery_title:'Mekândan Kareler', reserve_label:'Rezervasyon', reserve_title:'Masanızı Ayırın', reserve_sub:'Doğrudan WhatsApp ile hızlı rezervasyon yapın veya formu doldurun — 60 saniye içinde döneriz.', contact_label:'İletişim', contact_title:'Bize Ulaşın', contact_addr:'Adres', contact_phone:'Telefon', contact_hours:'Açılış Saatleri', contact_social:'Sosyal Medya', menu_pdf:'Tam Menüyü İndir (PDF)', reviews:'Yorumlar', reviews_label:'Misafir Yorumları', reviews_title:'Google\'da Bizi Anlatanlar', reviews_sub:'Aşağıdaki yorumlar Google Maps\'ten alınmıştır. Tümünü Google\'da görmek için butona tıklayın.', reviews_all:'Tüm Yorumları Gör (Google)', reviews_empty:'Yorumlar yakında eklenecek.' },
  en: { about:'About', menu:'Menu', gallery:'Gallery', reserve:'Reservation', contact:'Contact', cta_reserve:'Reserve', cta_menu:'View Menu', cta_reserve_send:'Send Request', about_label:'About Us', menu_label:'Menu', gallery_label:'Gallery', gallery_title:'Moments', reserve_label:'Reservation', reserve_title:'Reserve Your Table', reserve_sub:'Reserve fast via WhatsApp or fill the form — we reply in 60 seconds.', contact_label:'Contact', contact_title:'Get In Touch', contact_addr:'Address', contact_phone:'Phone', contact_hours:'Opening Hours', contact_social:'Social Media', menu_pdf:'Download Full Menu (PDF)', reviews:'Reviews', reviews_label:'Guest Reviews', reviews_title:'What People Say on Google', reviews_sub:'The reviews below are sourced from Google Maps. Click to see all reviews on Google.', reviews_all:'See All Reviews (Google)', reviews_empty:'Reviews coming soon.' },
  de: { about:'Über uns', menu:'Speisekarte', gallery:'Galerie', reserve:'Reservierung', contact:'Kontakt', cta_reserve:'Reservieren', cta_menu:'Speisekarte', cta_reserve_send:'Anfrage senden', about_label:'Über uns', menu_label:'Speisekarte', gallery_label:'Galerie', gallery_title:'Momente', reserve_label:'Reservierung', reserve_title:'Tisch reservieren', reserve_sub:'Schnelle Reservierung per WhatsApp oder Formular — Antwort in 60 Sekunden.', contact_label:'Kontakt', contact_title:'Kontaktiere uns', contact_addr:'Adresse', contact_phone:'Telefon', contact_hours:'Öffnungszeiten', contact_social:'Soziale Medien', menu_pdf:'Speisekarte als PDF', reviews:'Bewertungen', reviews_label:'Gästebewertungen', reviews_title:'Was Gäste auf Google sagen', reviews_sub:'Die Bewertungen stammen von Google Maps. Klicken Sie, um alle auf Google zu sehen.', reviews_all:'Alle Bewertungen (Google)', reviews_empty:'Bewertungen folgen in Kürze.' },
  ru: { about:'О нас', menu:'Меню', gallery:'Галерея', reserve:'Бронирование', contact:'Контакты', cta_reserve:'Забронировать', cta_menu:'Меню', cta_reserve_send:'Отправить запрос', about_label:'О нас', menu_label:'Меню', gallery_label:'Галерея', gallery_title:'Моменты', reserve_label:'Бронирование', reserve_title:'Забронируйте столик', reserve_sub:'Быстрое бронирование в WhatsApp или заполните форму — ответ за 60 секунд.', contact_label:'Контакты', contact_title:'Свяжитесь с нами', contact_addr:'Адрес', contact_phone:'Телефон', contact_hours:'Часы работы', contact_social:'Социальные сети', menu_pdf:'Скачать меню (PDF)', reviews:'Отзывы', reviews_label:'Отзывы гостей', reviews_title:'Что говорят в Google', reviews_sub:'Отзывы ниже — из Google Карт. Нажмите, чтобы посмотреть все на Google.', reviews_all:'Все отзывы (Google)', reviews_empty:'Отзывы появятся скоро.' },
  fr: { about:'À propos', menu:'Menu', gallery:'Galerie', reserve:'Réservation', contact:'Contact', cta_reserve:'Réserver', cta_menu:'Voir le Menu', cta_reserve_send:'Envoyer la demande', about_label:'À propos', menu_label:'Menu', gallery_label:'Galerie', gallery_title:'Instants', reserve_label:'Réservation', reserve_title:'Réservez votre table', reserve_sub:'Réservation rapide via WhatsApp ou remplissez le formulaire — réponse en 60 secondes.', contact_label:'Contact', contact_title:'Contactez-nous', contact_addr:'Adresse', contact_phone:'Téléphone', contact_hours:'Horaires', contact_social:'Réseaux sociaux', menu_pdf:'Télécharger le menu (PDF)', reviews:'Avis', reviews_label:'Avis des clients', reviews_title:'Ce que disent les clients sur Google', reviews_sub:'Les avis ci-dessous proviennent de Google Maps. Cliquez pour les voir tous.', reviews_all:'Voir tous les avis (Google)', reviews_empty:'Avis bientôt disponibles.' }
};

let built = [];

for (const slug of targets) {
  const r = (data.items || []).find(x => x.id === slug);
  if (!r) { console.warn(`Atlandi: ${slug} restoranlar.json'da yok`); continue; }
  const c = CUSTOM[slug] || {};
  const t = theme(r.category);

  // Galeri: SADECE bu restoranin kendi fotograflari.
  // Sirayla: (a) fetch-restoran-photos.mjs indirdigi /assets/img/restoran/<slug>-{1..8}.jpg,
  // (b) restoranlar.json'daki gercek gallery,
  // (c) yetersizse Instagram link karti, (d) hala yetersizse kart sayisi azalir.
  const fetchedGallery = [];
  for (let i = 1; i <= 8; i++) {
    const rel = `/assets/img/restoran/${r.id}-${i}.jpg`;
    if (existsSync(join(root, rel.replace(/^\//, '')))) fetchedGallery.push(rel);
  }
  const jsonGallery = (r.gallery || []).filter(Boolean)
    .filter(g => g.startsWith('/') ? existsSync(join(root, g.replace(/^\//, ''))) : true);

  // Sirala: fetch'ten gelen restorana ozel + json'daki gercek galeri (dedup).
  const seenG = new Set();
  const ownGallery = [];
  for (const src of [...fetchedGallery, ...jsonGallery]) {
    if (!seenG.has(src)) { seenG.add(src); ownGallery.push(src); }
    if (ownGallery.length >= 8) break;
  }

  // Fetch indirdigi hero (kanonik degilse hero olarak kullan)
  const fetchedHeroRel = `/assets/img/restoran/${r.id}-hero.jpg`;
  const fetchedHeroExists = existsSync(join(root, fetchedHeroRel.replace(/^\//, '')));
  const baseImg = (!REAL_HEROES.has(r.id) && fetchedHeroExists) ? fetchedHeroRel : (r.image || (fetchedHeroExists ? fetchedHeroRel : ''));

  const galleryCards = ownGallery.map((src, i) => `
    <a href="${esc(src)}" target="_blank" class="gallery-item aspect-square block">
      <img src="${esc(src)}" alt="${esc(r.name)} ${i+1}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.background='var(--theme-bg-2)';this.style.opacity='0.3';">
    </a>`);

  // Instagram fallback: galeri yetersizse SON kart olarak "Instagram'da daha fazla" linki
  // (sadece galeri 0 veya az ise; >=6 ise gerek yok)
  if (ownGallery.length < 6 && r.instagram) {
    const igHandle = (r.instagram.match(/instagram\.com\/([^\/?#]+)/) || [])[1] || 'instagram';
    galleryCards.push(`
    <a href="${esc(r.instagram)}" target="_blank" rel="noopener" class="gallery-item aspect-square block grid place-items-center text-center p-4" style="background:var(--theme-bg-2);border:1px solid var(--theme-accent);">
      <div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--theme-accent);display:block;margin:0 auto 12px;"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        <div class="text-xs tracking-[0.2em] uppercase font-bold mb-1" style="color:var(--theme-accent);">Instagram</div>
        <div class="text-sm font-bold" style="color:var(--theme-text);">@${esc(igHandle)}</div>
        <div class="text-xs mt-1" style="color:var(--theme-muted);">Daha fazla foto</div>
      </div>
    </a>`);
  }

  const galleryItems = galleryCards.join('');
  // About image: galeride 2. gorsel varsa onu, yoksa ilk gorsel, son care hero
  const aboutImage = ownGallery[1] || ownGallery[0] || baseImg;

  // Menü kategorileri
  const menu = c.menu || { 'Menü': ['Tam menü için yandaki PDF butonuna tıklayın.'] };
  const cats = Object.keys(menu);
  const menuTabs = `<div class="menu-tab active" data-cat="all">Tümü</div>` +
    cats.map(cat => `<div class="menu-tab" data-cat="${esc(cat.toLowerCase())}">${esc(cat)}</div>`).join('');
  const menuItems = cats.map(cat => menu[cat].map(item => `
    <div class="menu-section p-6 border-l-2" data-cat="${esc(cat.toLowerCase())}" style="border-color:var(--theme-accent);">
      <div class="text-[10px] tracking-[0.2em] uppercase font-bold mb-2" style="color:var(--theme-accent);">${esc(cat)}</div>
      <div class="font-display text-lg font-bold">${esc(item)}</div>
    </div>`).join('')).join('');

  // Specialties pills
  const specs = (r.specialties || []).slice(0, 6).map(s => `
    <span class="inline-flex items-center px-3 py-1.5 text-xs tracking-wider uppercase font-semibold border" style="border-color:var(--theme-accent);color:var(--theme-accent);">${esc(s)}</span>
  `).join('');

  // SameAs JSON
  const sameAs = [];
  if (r.instagram) sameAs.push(r.instagram);
  if (r.website && r.website !== r.instagram) sameAs.push(r.website);
  sameAs.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+' Kalkan')}`);

  // Telefon WhatsApp
  const phone = r.phone || '+90 530 665 07 94'; // fallback: concierge
  const phoneRaw = phone.replace(/[^\d+]/g, '');
  const waRaw = (r.whatsappRaw || phoneRaw.replace(/^\+/,'') || '905306650794');

  // Hero image full URL
  const heroImage = baseImg;
  const heroImageFull = `https://kalkaninfo.com${baseImg}`;

  // OG image — ozel restoran OG gorseli varsa kullan, yoksa hero fallback
  const ogImagePath = `/assets/og/restoran/${r.id}.jpg`;
  const ogImageFull = existsSync(join(root, ogImagePath.replace(/^\//, '')))
    ? `https://kalkaninfo.com${ogImagePath}?v=2026-06-02`
    : heroImageFull;

  // Maps query
  const mapsQuery = encodeURIComponent((r.location || r.name + ' Kalkan'));

  // Google reviews cache (SerpApi'den) — yoksa empty state
  const reviewCache = await loadReviewCache(r.id);
  const reviewsSectionHtml = buildReviewsSection(r, reviewCache);

  // Template doldur
  const repl = {
    NAME: r.name,
    NAME_URL: encodeURIComponent(r.name),
    SLUG: r.id,
    CATEGORY: r.category,
    CUISINE: r.cuisine || r.category,
    PRICE_RANGE: r.priceRange || '₺₺',
    SUMMARY: r.summary || c.tagline || '',
    TAGLINE: c.tagline || r.summary || '',
    LOCATION: r.location || 'Kalkan, Antalya',
    PHONE: phone,
    PHONE_RAW: phoneRaw,
    WA_RAW: waRaw,
    HOURS: c.hours || (r.hours || 'Bilgi için arayın'),
    ABOUT_TITLE: c.aboutTitle || r.name,
    ABOUT_P1: c.aboutP1 || r.summary || '',
    ABOUT_P2: c.aboutP2 || '',
    ABOUT_IMAGE: aboutImage,
    HERO_IMAGE: heroImage,
    HERO_IMAGE_FULL: heroImageFull,
    OG_IMAGE_FULL: ogImageFull,
    MAPS_QUERY: mapsQuery,
    MENU_TITLE: c.menuTitle || 'Menümüz',
    MENU_SUB: c.menuSub || '',
    MENU_TABS: menuTabs,
    MENU_ITEMS: menuItems,
    MENU_PDF: `https://wa.me/${waRaw}?text=${encodeURIComponent('Merhaba, tam menüyü görmek istiyorum.')}`,
    GALLERY_TITLE: 'Mekândan Kareler',
    GALLERY_ITEMS: galleryItems,
    SPECIALTIES_PILLS: specs,
    SOCIAL_LINKS: socialLinks(r),
    REVIEWS_SECTION: reviewsSectionHtml,
    RESERVATIONS: r.reservation ? 'True' : 'True',
    AGGREGATE_RATING_JSON: JSON.stringify(aggregateRatingJson(reviewCache)),
    REVIEW_ARRAY_JSON: JSON.stringify(reviewArrayJson(reviewCache)),
    SAME_AS_JSON: JSON.stringify(sameAs),
    I18N_JSON: JSON.stringify(I18N_BASE),
    THEME_BG: t.bg,
    THEME_BG_2: t.bg2,
    THEME_ACCENT: t.accent,
    THEME_ACCENT_2: t.accent2,
    THEME_TEXT: t.text,
    THEME_MUTED: t.muted,
    FONT_DISPLAY: t.font
  };

  let html = template;
  for (const [k, v] of Object.entries(repl)) {
    html = html.replaceAll(`{{${k}}}`, String(v));
  }

  const outDir = join(root, 'restoran', r.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  built.push({ slug: r.id, name: r.name, url: `https://kalkaninfo.com/restoran/${r.id}/`, local: `http://localhost:3000/restoran/${r.id}/` });
  console.log(`  + ${r.name}  ->  restoran/${r.id}/`);
}

// Sitemap'e ekle
if (built.length) {
  const sitemapPath = join(root, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0,10);
  for (const b of built) {
    const url = `https://kalkaninfo.com/restoran/${b.slug}/`;
    if (!sitemap.includes(url)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
    }
  }
  await writeFile(sitemapPath, sitemap);
  console.log(`Sitemap'e ${built.length} URL eklendi.`);
}

console.log('\n--- ADRESLER ---');
built.forEach(b => console.log(`  ${b.name}\n    Local : ${b.local}\n    Canli : ${b.url}\n`));
