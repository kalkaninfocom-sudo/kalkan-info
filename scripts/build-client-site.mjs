#!/usr/bin/env node
/**
 * build-client-site.mjs — KOBİ mini-site generator
 *
 * Kullanım:
 *   node scripts/build-client-site.mjs <slug>          # tek müşteri
 *   node scripts/build-client-site.mjs --all           # tüm client'lar
 *   node scripts/build-client-site.mjs <slug> --force  # mevcut override et
 *
 * Veri kaynağı: data/clients.json (source:"client" işletmeler)
 * Çıktı:        site/<slug>/index.html
 * Otomatik:     sitemap.xml günceller + IndexNow push
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheapLLM } from '../lib/cheap-llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const ALL  = args.includes('--all');
const FORCE = args.includes('--force');

if (!slug && !ALL) {
  console.error('Kullanım: node scripts/build-client-site.mjs <slug> [--force]');
  console.error('          node scripts/build-client-site.mjs --all');
  process.exit(1);
}

// ─── Template yükle ───
const TEMPLATE = await readFile(join(ROOT, 'site', '_template-client', 'index.html'), 'utf8');

// ─── Veri yükle ───
const DATA_FILE = join(ROOT, 'data', 'clients.json');
let clients = [];
try {
  const raw = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  clients = Array.isArray(raw) ? raw : (raw.items || []);
} catch (e) {
  console.error(`❌ data/clients.json okunamadı: ${e.message}`);
  process.exit(1);
}

// ─── Yardımcılar ───
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

function waRaw(phone) {
  return (phone || '').replace(/[^+0-9]/g, '').replace(/^\+/, '');
}

function ratingStars(item) {
  if (!item.rating) return '';
  const full = Math.round(item.rating);
  const stars = '★'.repeat(full) + '☆'.repeat(5 - full);
  return `<div class="stars-row">
    <span class="stars">${stars}</span>
    <span class="stars-meta">${item.rating}${item.reviewCount ? ` &middot; ${item.reviewCount} yorum` : ''}</span>
  </div>`;
}

function serviceCards(items) {
  if (!items || !items.length) return '<p style="color:var(--muted);text-align:center;grid-column:1/-1;">Menü yakında eklenecek.</p>';
  return items.map(s => `
  <div class="scard reveal">
    ${s.category ? `<div class="scard-cat">${esc(s.category)}</div>` : ''}
    <div class="scard-name">${esc(s.name)}</div>
    ${s.description ? `<div class="scard-desc">${esc(s.description)}</div>` : ''}
    ${s.price ? `<div class="scard-price">${esc(s.price)}</div>` : ''}
  </div>`).join('\n');
}

function svgPlaceholder(label, bg = '#c47a1e', fg = '#faf7f2') {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><rect width='600' height='600' fill='${bg}'/><text x='50%' y='50%' font-family='sans-serif' font-size='28' font-weight='bold' fill='${fg}' text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function galleryItems(images, accentColor = '#c47a1e', bgColor = '#2d1a0a') {
  if (!images || !images.length) {
    // 5 items: first spans 2×2, remaining 4 fill the right column — perfect 4-col grid
    const labels = ['Mekan', 'Lezzet', 'Izgara', 'Sunum', 'Teras'];
    return labels.map(l =>
      `<div class="gitem"><img src="${svgPlaceholder(l, bgColor, accentColor)}" alt="${l}" loading="eager" tabindex="0"></div>`
    ).join('\n');
  }
  return images.slice(0, 8).map(src =>
    `<div class="gitem"><img src="${esc(src)}" alt="galeri" loading="eager" tabindex="0"></div>`
  ).join('\n');
}

function highlightPills(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="pill">${esc(t)}</span>`).join('');
}

function hoursBlock(item) {
  if (!item.hours) return '';
  return `<div>
    <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;color:var(--accent);margin-bottom:6px;" data-i="lbl_hours">Çalışma Saatleri</div>
    <div style="font-size:14px;color:var(--text);line-height:1.6;">${esc(item.hours)}</div>
  </div>`;
}

function socialBlock(item) {
  const links = [];
  if (item.instagram) links.push(`<a href="${esc(item.instagram)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:13px;font-weight:600;text-decoration:none;">Instagram</a>`);
  if (item.website)   links.push(`<a href="${esc(item.website)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:13px;font-weight:600;text-decoration:none;">Web Sitesi</a>`);
  if (!links.length) return '';
  return `<div>
    <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;color:var(--accent);margin-bottom:8px;" data-i="lbl_social">Sosyal Medya</div>
    <div style="display:flex;gap:16px;">${links.join('')}</div>
  </div>`;
}

function winterBanner(item) {
  if (!item.winterMode) return '';
  const msg = item.winterMessage || 'Sezon kapalı — Nisan\'da görüşürüz! Rezervasyon almaya devam ediyoruz.';
  return `<div class="winter-banner">${esc(msg)}</div>`;
}

function robotsMeta(item) {
  // noindex=true (varsayılan demo) veya item.noindex=true ise noindex
  if (item.noindex !== false) {
    return '<meta name="robots" content="noindex,nofollow">';
  }
  return '<meta name="robots" content="index,follow,max-image-preview:large">';
}

function schemaJson(item) {
  const type = item.schemaType || 'LocalBusiness';
  const obj = {
    '@context': 'https://schema.org',
    '@type': type,
    name: item.name,
    description: item.summary || '',
    address: {
      '@type': 'PostalAddress',
      streetAddress: item.location || '',
      addressLocality: item.locationShort || 'Kalkan',
      addressRegion: 'Antalya',
      addressCountry: 'TR',
    },
    telephone: item.phone || undefined,
    url: item.website || `https://kalkaninfo.com/site/${item.id}/`,
    image: item.heroImage || undefined,
  };
  if (item.rating && item.reviewCount) {
    obj.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: item.rating,
      reviewCount: item.reviewCount,
    };
  }
  if (item.coordinates) {
    obj.geo = {
      '@type': 'GeoCoordinates',
      latitude: item.coordinates.latitude,
      longitude: item.coordinates.longitude,
    };
  }
  return JSON.stringify(obj, null, 2);
}

// ─── LLM ile içerik üret (cheap-llm) ───
async function generateContent(item) {
  const prompt = `
Sen bir yerel işletme tanıtım yazarısın. Aşağıdaki işletme için kısa, doğal Türkçe içerik üret.
İşletme: ${item.name}
Kategori: ${item.category}
Konum: ${item.location || item.locationShort}
Notlar: ${item.notes || ''}
Özellikler: ${(item.highlights || []).join(', ')}

JSON formatında döndür:
{
  "tagline": "tek cümle slogan (max 12 kelime)",
  "aboutTitle": "hakkımızda başlık (max 8 kelime)",
  "aboutP1": "birinci paragraf (2-3 cümle, samimi)",
  "aboutP2": "ikinci paragraf (2 cümle, ne sunuyorlar)",
  "metaDescription": "SEO meta açıklama (max 155 karakter)"
}
`.trim();

  try {
    const result = await cheapLLM(prompt, { json: true, maxTokens: 400, timeoutMs: 25000 });
    const text = result.text || result;
    // JSON parse
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    console.warn(`⚠️  cheap-llm içerik üretemedi (${e.message}), varsayılan kullanılıyor`);
  }

  // Fallback
  return {
    tagline: item.tagline || `${item.name} — ${item.locationShort || 'Kalkan'}'da hizmetinizdeyiz.`,
    aboutTitle: `${item.name} Hakkında`,
    aboutP1: item.aboutP1 || `${item.name}, ${item.category} alanında kaliteli hizmet sunmaktadır.`,
    aboutP2: item.aboutP2 || 'Deneyimli ekibimizle müşteri memnuniyetini her zaman ön planda tutuyoruz.',
    metaDescription: item.summary || `${item.name} — ${item.locationShort || 'Kalkan'}'da ${item.category}.`,
  };
}

// ─── i18n JSON minimal ───
function buildI18N(item, content) {
  // Sadece TR tam dolu, diğerleri en kritik stringleri içerir
  return {
    tr: {
      about: 'Hakkımızda',
      services: item.servicesLabel || 'Menü & Hizmetler',
      gallery: 'Galeri',
      contact: 'İletişim',
      hero_sub: content.tagline,
      about_label: 'Hakkımızda',
      about_title: content.aboutTitle,
      about_p1: content.aboutP1,
      about_p2: content.aboutP2,
      services_label: item.servicesLabel || 'Menü & Hizmetler',
      services_title: item.servicesTitle || 'Ne Sunuyoruz?',
      gallery_label: 'Galeri',
      gallery_title: 'Fotoğraflar',
      contact_label: 'İletişim',
      contact_title: 'Bize Ulaşın',
      cta_contact: 'İletişime Geç',
      cta_services: item.servicesLabel || 'Menü & Hizmetler',
      cta_send: 'Gönder (WhatsApp)',
      cta_call: 'Ara',
      lbl_addr: 'Adres',
      lbl_phone: 'Telefon',
      lbl_hours: 'Çalışma Saatleri',
      lbl_social: 'Sosyal Medya',
      services_cta: 'Fiyat / Menü Sor',
    },
    en: {
      about: 'About',
      services: item.servicesLabelEn || 'Menu & Services',
      gallery: 'Gallery',
      contact: 'Contact',
      hero_sub: item.taglineEn || content.tagline,
      about_label: 'About Us',
      about_title: item.aboutTitleEn || content.aboutTitle,
      about_p1: item.aboutP1En || content.aboutP1,
      about_p2: item.aboutP2En || content.aboutP2,
      services_label: item.servicesLabelEn || 'Menu & Services',
      services_title: item.servicesTitleEn || 'What We Offer',
      gallery_label: 'Gallery',
      gallery_title: 'Photos',
      contact_label: 'Contact',
      contact_title: 'Get in Touch',
      cta_contact: 'Contact Us',
      cta_services: item.servicesLabelEn || 'Menu & Services',
      cta_send: 'Send (WhatsApp)',
      cta_call: 'Call',
      lbl_addr: 'Address',
      lbl_phone: 'Phone',
      lbl_hours: 'Opening Hours',
      lbl_social: 'Social Media',
      services_cta: 'Ask for Price / Menu',
    },
    de: {
      about: 'Über uns', services: 'Menü & Leistungen', gallery: 'Galerie', contact: 'Kontakt',
      cta_contact: 'Kontakt aufnehmen', cta_call: 'Anrufen',
    },
    ru: {
      about: 'О нас', services: 'Меню & Услуги', gallery: 'Галерея', contact: 'Контакты',
      cta_contact: 'Связаться', cta_call: 'Позвонить',
    },
    fr: {
      about: 'À propos', services: 'Menu & Services', gallery: 'Galerie', contact: 'Contact',
      cta_contact: 'Nous contacter', cta_call: 'Appeler',
    },
  };
}

// ─── Tek sayfa render ───
async function renderPage(item) {
  const content = await generateContent(item);

  const theme = item.theme || {};
  const wa = waRaw(item.phone);
  const mapsQ = encodeURIComponent(item.name + ' ' + (item.location || item.locationShort || 'Kalkan'));
  // Hero: gerçek foto yoksa düz renk gradyan (text YOK — h1 üstüne binmesin)
  const heroBg = theme.bg || '#2d1a0a';
  const heroAccent = theme.accent || '#c47a1e';
  const heroSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${heroBg}'/><stop offset='100%' stop-color='${heroAccent}' stop-opacity='0.35'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/></svg>`;
  const heroImg = item.heroImage || ('data:image/svg+xml;base64,' + Buffer.from(heroSvg).toString('base64'));
  // About image: dark-bg SVG with accent label
  const aboutBg = theme.text || '#1a1209';
  const aboutImg = item.aboutImage || svgPlaceholder('📷 Ambiyans', aboutBg, heroAccent);

  const i18n = buildI18N(item, content);

  const map = {
    NAME:            esc(item.name),
    SLUG:            item.id,
    CATEGORY:        esc(item.category || ''),
    LOCATION:        esc(item.location || ''),
    LOCATION_SHORT:  esc(item.locationShort || 'Kalkan'),
    SUMMARY:         esc(content.metaDescription),
    TAGLINE:         esc(content.tagline),
    HERO_IMAGE:      esc(heroImg),
    ABOUT_IMAGE:     esc(aboutImg),
    ABOUT_TITLE:     esc(content.aboutTitle),
    ABOUT_P1:        esc(content.aboutP1),
    ABOUT_P2:        esc(content.aboutP2),
    HIGHLIGHT_PILLS: highlightPills(item.highlights),
    SERVICES_LABEL:  esc(item.servicesLabel || 'Menü & Hizmetler'),
    SERVICES_TITLE:  esc(item.servicesTitle || 'Ne Sunuyoruz?'),
    SERVICE_CARDS:   serviceCards(item.services),
    GALLERY_ITEMS:   galleryItems(item.gallery, theme.accent || '#c47a1e', theme.text || '#1a1209'),
    PHONE:           esc(item.phone || ''),
    PHONE_RAW:       esc(item.phone || ''),
    WA_RAW:          wa,
    WA_MENU_TEXT:    encodeURIComponent(`Merhaba ${item.name}, menü ve fiyat bilgisi almak istiyorum.`),
    NAME_URL:        encodeURIComponent(item.name),
    MAPS_QUERY:      mapsQ,
    GEO_LAT:         String(item.coordinates?.latitude  || 36.265),
    GEO_LNG:         String(item.coordinates?.longitude || 29.412),
    RATING_STARS_HTML: ratingStars(item),
    HOURS_BLOCK:     hoursBlock(item),
    SOCIAL_BLOCK:    socialBlock(item),
    WINTER_BANNER:   winterBanner(item),
    ROBOTS_META:     robotsMeta(item),
    SCHEMA_JSON:     schemaJson(item),
    I18N_JSON:       JSON.stringify(i18n),
    CONCIERGE_LINE:  '',
    // Tema renkleri (açık/krem — KOYU YASAK)
    THEME_BG:         theme.bg      || '#faf8f4',
    THEME_BG2:        theme.bg2     || '#f2efe8',
    THEME_BG_FLOAT:   theme.bgFloat || '#ffffff',
    THEME_ACCENT:     theme.accent  || '#c47a1e',   // amber/altın
    THEME_ACCENT2:    theme.accent2 || '#2a7d6b',   // teal
    THEME_TEXT:       theme.text    || '#1a1209',
    THEME_MUTED:      theme.muted   || '#6b5c3e',
    THEME_BORDER:     theme.border  || 'rgba(180,140,60,0.18)',
  };

  return TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] !== undefined ? String(map[k]) : '');
}

// ─── Sitemap güncelle ───
async function updateSitemap(slug) {
  const sitemapPath = join(ROOT, 'sitemap.xml');
  let xml = '';
  try { xml = await readFile(sitemapPath, 'utf8'); } catch { return; }

  const url = `https://kalkaninfo.com/site/${slug}/`;
  if (xml.includes(url)) return; // zaten var

  const entry = `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;

  const updated = xml.replace('</urlset>', entry + '\n</urlset>');
  await writeFile(sitemapPath, updated, 'utf8');
  console.log(`   📋 sitemap.xml güncellendi: ${url}`);
}

// ─── Ana iş ───
const targets = ALL
  ? clients
  : clients.filter(c => c.id === slug);

if (!targets.length) {
  console.error(`❌ slug bulunamadı: ${slug}`);
  console.error(`   Mevcut slug'lar: ${clients.map(c => c.id).join(', ')}`);
  process.exit(1);
}

for (const item of targets) {
  const outDir  = join(ROOT, 'site', item.id);
  const outPath = join(outDir, 'index.html');

  if (!FORCE && existsSync(outPath)) {
    console.log(`⏭  ${item.id} — zaten var, atlanıyor (--force ile override)`);
    continue;
  }

  console.log(`\n🏗  ${item.name} (${item.id}) üretiliyor...`);
  const html = await renderPage(item);
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, html, 'utf8');
  await updateSitemap(item.id);
  console.log(`✅  site/${item.id}/index.html → kalkaninfo.com/site/${item.id}/`);
}

console.log('\n🎉 Bitti.');
