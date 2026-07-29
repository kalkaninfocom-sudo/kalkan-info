/**
 * build-events-page.mjs — Kalkan haftalık etkinlik sayfası üreticisi
 *
 * events-lib.mjs'ten içinde bulunulan haftanın (Pazartesi→Pazar) 7 günlük
 * takvimini açar, iki çıktı üretir:
 *   1) data/etkinlik-haftalik.json — statik veri (tarayıcı fetch eder, harita pinleri)
 *   2) etkinlikler/index.html      — server-side render edilmiş statik sayfa
 *                                    (tüm etkinlikler gömülü, JS'siz de okunur)
 *
 * Kullanım:
 *   node scripts/build-events-page.mjs            (bugünün haftası)
 *   node scripts/build-events-page.mjs 2026-07-06 (verilen tarihin haftası)
 *
 * Not: cleanUrls aktif olduğu için tüm varlık/yol referansları kök-mutlak (/...).
 *      Yeni api/ veya package bağımlılığı YOK — Leaflet CDN'den (unpkg) gelir.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventsForWeek } from './events-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const KALKAN_CENTER = { lat: 36.2658, lng: 29.4118 };

const DAY_ORDER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Etkinlik tipine göre marka içi renk + ikon (badge ve harita pini)
const TYPE_STYLE = {
  'Canlı Müzik': { color: '#e89812', icon: '🎸' },
  DJ:            { color: '#8b5cf6', icon: '🎧' },
  Akustik:       { color: '#0ea5a4', icon: '🎻' },
  Karaoke:       { color: '#ec4899', icon: '🎤' },
  'Quiz Gecesi': { color: '#3b82f6', icon: '🧠' },
  'Happy Hour':  { color: '#22c55e', icon: '🍹' },
  'Türk Gecesi': { color: '#ef4444', icon: '🪕' },
  Parti:         { color: '#8b5cf6', icon: '🎉' },
  Festival:      { color: '#e89812', icon: '🎪' },
  'Sinema Gecesi': { color: '#7c3aed', icon: '🎬' },
};
const DEFAULT_STYLE = { color: '#0a2e4c', icon: '🎶' };
const styleFor = (type) => TYPE_STYLE[type] || DEFAULT_STYLE;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateTR(iso) {
  const d = new Date(iso + 'T08:00:00');
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}

function timeRange(ev) {
  if (ev.time && ev.endTime) return `${ev.time} – ${ev.endTime}`;
  return ev.time || '';
}

/* Opsiyonel açıklama + fiyat/bilet linki (ücretli etkinlikler için) */
function metaHtml(ev) {
  const parts = [];
  if (ev.note) parts.push(`<p class="text-xs text-sea-600/90 mt-1.5 leading-snug">${esc(ev.note)}</p>`);
  if (ev.price || ev.ticketUrl) {
    const price = ev.price ? `<span class="font-display font-bold text-sea-800 text-sm">${esc(ev.price)}</span>` : '';
    const btn = ev.ticketUrl
      ? `<a href="${esc(ev.ticketUrl)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs font-bold text-white bg-sun-600 hover:bg-sun-700 rounded-full px-3 py-1 transition">🎟️ Bilet al</a>`
      : '';
    parts.push(`<div class="flex items-center gap-2 flex-wrap mt-2">${price}${btn}</div>`);
  }
  return parts.join('');
}

/* ----------------------------- KART (SSR) ----------------------------- */
function eventCard(ev) {
  const st = styleFor(ev.type);
  const venueHtml = ev.detailUrl
    ? `<a href="${esc(ev.detailUrl)}" target="_blank" rel="noopener" class="font-display font-bold text-sea-800 hover:text-sun-600 underline-grow">${esc(ev.venueName)}</a>`
    : `<span class="font-display font-bold text-sea-800">${esc(ev.venueName)}</span>`;

  const isDaily = /^her\s*g[üu]n$/i.test(String(ev.day || ''));
  const badges = [];
  if (isDaily) badges.push('<span class="evt-chip-daily">Her gün</span>');
  if (!ev.verified) badges.push('<span class="evt-chip-draft" title="Henüz doğrulanmadı">Taslak</span>');

  const media = ev.photo
    ? `<img src="${esc(ev.photo)}" alt="" loading="lazy" class="evt-media-img" onerror="this.remove()">`
    : '';

  return `
        <article class="evt-card card-hover" data-type="${esc(ev.type)}">
          <div class="evt-media" style="--evt-c:${st.color};">
            ${media}<div class="evt-media-grad"></div>
            <span class="evt-media-icon" aria-hidden="true">${st.icon}</span>
            <span class="evt-type-badge"><span aria-hidden="true">${st.icon}</span> ${esc(ev.type)}</span>
            ${badges.length ? `<div class="evt-badges">${badges.join('')}</div>` : ''}
            <span class="evt-time-badge">${esc(timeRange(ev))}</span>
          </div>
          <div class="evt-body">
            <div class="evt-venue">${venueHtml}</div>
            ${ev.title ? `<p class="evt-title">${esc(ev.title)}</p>` : ''}
            <div class="evt-area">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              ${esc(ev.area || 'Kalkan')}
            </div>
            ${metaHtml(ev)}
          </div>
        </article>`;
}

/* ----------------- YAKLAŞAN ÖNE ÇIKAN (bu hafta dışı, tarihli özel etkinlik) ----------------- */
function featuredCard(ev) {
  const st = styleFor(ev.type);
  const d = new Date(ev.date + 'T08:00:00');
  const dayTR = DAY_ORDER[(d.getDay() + 6) % 7];
  return `
        <article class="card-base card-hover rounded-2xl overflow-hidden flex flex-col sm:flex-row" style="border-left:5px solid ${st.color};">
          <div class="shrink-0 grid place-items-center px-5 py-4 sm:py-0 text-white" style="background:linear-gradient(135deg,${st.color} 0%,${st.color}cc 100%);min-width:112px;">
            <div class="text-center">
              <div class="font-display font-extrabold text-3xl leading-none">${d.getDate()}</div>
              <div class="text-[11px] uppercase tracking-widest mt-1 opacity-90">${MONTHS_TR[d.getMonth()]}</div>
              <div class="text-[11px] mt-0.5 opacity-80">${dayTR}</div>
            </div>
          </div>
          <div class="p-4 md:p-5 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1" style="color:${st.color};background:${st.color}1a;">
                <span aria-hidden="true">${st.icon}</span> ${esc(ev.type)}
              </span>
              <span class="font-display font-extrabold text-sea-900 text-sm">${esc(timeRange(ev))}</span>
            </div>
            <div class="mt-2 font-display font-bold text-sea-800 text-lg leading-tight">${esc(ev.venueName)}</div>
            ${ev.title ? `<p class="text-sm text-sea-700/80 mt-1 leading-snug">${esc(ev.title)}</p>` : ''}
            ${metaHtml(ev)}
            <div class="flex items-center gap-1 text-xs text-sea-600 mt-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              ${esc(ev.area || 'Kalkan')}
            </div>
          </div>
        </article>`;
}

function featuredSection(featured) {
  if (!featured || !featured.length) return '';
  const cards = featured.map(featuredCard).join('\n');
  return `
  <section class="mb-8">
    <div class="flex items-baseline gap-3 mb-4">
      <h2 class="font-display font-extrabold text-xl text-sea-900">🎬 Yaklaşan Öne Çıkanlar</h2>
      <span class="text-xs text-sea-500">— önümüzdeki günlerin özel etkinlikleri</span>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${cards}
    </div>
  </section>`;
}

/* ----------------------------- GÜN BÖLÜMÜ ----------------------------- */
function daySection(day, isActive) {
  const dn = day.day;
  const cards = day.events.length
    ? day.events.map(eventCard).join('\n')
    : `<p class="col-span-full text-sea-600/70 text-sm py-6 text-center bg-white/50 rounded-xl border border-dashed border-sea-200">Bu gün için planlanmış etkinlik yok.</p>`;

  return `
      <section class="day-panel" data-day="${esc(dn)}"${isActive ? '' : ' hidden'}>
        <div class="flex items-baseline gap-3 mb-4">
          <h2 class="font-display font-extrabold text-2xl text-sea-900">${esc(dn)}</h2>
          <span class="text-sm text-sea-600">${esc(fmtDateTR(day.date))}</span>
          <span class="ml-auto text-xs font-semibold text-sea-500">${day.events.length} etkinlik</span>
        </div>
        <div class="evt-grid">
          ${cards}
        </div>
      </section>`;
}

/* ----------------------------- SAYFA ----------------------------- */
function pageHtml(week, payload, featured) {
  const totalEvents = week.reduce((n, d) => n + d.events.length, 0);
  const weekStart = fmtDateTR(week[0].date);
  const weekEnd = fmtDateTR(week[6].date);
  const todayDow = (new Date().getDay() + 6) % 7; // Pazartesi=0
  const activeIdx = todayDow >= 0 && todayDow < 7 ? todayDow : 0;

  // Sekme: bugün aktif olsun; SSR'de panelleri ona göre aç/gizle
  const tabs = week.map((d, i) => {
    const active = i === activeIdx;
    return `<button type="button" class="evt-tab whitespace-nowrap px-3.5 py-2 rounded-lg text-sm font-display font-semibold border transition ${active ? 'bg-sea-800 text-white border-sea-800' : 'bg-white text-sea-700 border-sea-200 hover:border-sea-400'}" data-day="${esc(d.day)}" aria-pressed="${active}">
        ${esc(d.day)} <span class="opacity-60 font-normal">${d.events.length}</span>
      </button>`;
  }).join('\n');

  const sections = week.map((d, i) => daySection(d, i === activeIdx)).join('\n');

  // Yatay gün pill'i — mobilde kaydırmalı, kompakt. Bugün aktif.
  const dayPills = week.map((d, i) => {
    const active = i === activeIdx;
    return `<button type="button" class="evt-daypill" data-day="${esc(d.day)}" aria-pressed="${active}">
        <span class="dp-day">${esc(d.day)}${i === activeIdx ? ' <span class="dp-today">bugün</span>' : ''}</span>
        <span class="dp-date">${esc(fmtDateTR(d.date))}</span>
        <span class="dp-count">${d.events.length} etkinlik</span>
      </button>`;
  }).join('\n');

  // Tip filtre çipleri — haftadaki benzersiz etkinlik tipleri.
  const allTypes = [...new Set(week.flatMap((d) => d.events.map((e) => e.type)))];
  const typeChips = ['<button type="button" class="evt-fchip" data-filter="all" aria-pressed="true">Tümü</button>']
    .concat(allTypes.map((t) => {
      const st = styleFor(t);
      return `<button type="button" class="evt-fchip" data-filter="${esc(t)}" aria-pressed="false"><span class="fdot" style="background:${st.color}"></span>${esc(t)}</button>`;
    })).join('\n');

  const inlineData = JSON.stringify(payload).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="tr" style="scroll-behavior:smooth;">
<head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PLWTGK2G');</script>
<!-- End Google Tag Manager -->
<script src="/js/gtm-events.js" defer></script>

<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" href="/dist/tw.css">
<title>Kalkan Etkinlik Takvimi — Bu Hafta Canlı Müzik, DJ & Parti | Kalkan Info</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0a2e4c">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<!-- Leaflet (CDN — yeni paket bağımlılığı yok) -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
html,body{font-family:'Inter',system-ui,sans-serif;color:#0a2e4c;background:#dce6ef;}
h1,h2,h3,h4,.font-display{font-family:'Montserrat',system-ui,sans-serif;letter-spacing:-0.02em;}
.ribbon-bg{background:repeating-linear-gradient(90deg,#072136 0 12px,#0d3a5f 12px 24px);}
.grain{background-image:radial-gradient(rgba(255,255,255,0.05) 1px,transparent 1px);background-size:3px 3px;}
.marquee{animation:marquee 35s linear infinite;}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.underline-grow{position:relative;}
.underline-grow::after{content:'';position:absolute;left:0;right:0;bottom:-4px;height:2px;background:#e89812;transform:scaleX(0);transform-origin:left;transition:transform .25s ease;}
.underline-grow:hover::after{transform:scaleX(1);}
.breaking::before{content:'';display:inline-block;width:6px;height:6px;border-radius:9999px;background:#fff;margin-right:8px;animation:pulse 1.4s ease infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.card-base{background:#fff;box-shadow:0 1px 3px rgba(7,33,54,0.07),0 6px 20px -6px rgba(7,33,54,0.14);}
.card-hover{transition:box-shadow .22s ease, transform .22s ease;}
.card-hover:hover{box-shadow:0 4px 8px rgba(7,33,54,0.09),0 16px 40px -8px rgba(7,33,54,0.24);transform:translateY(-2px);}
.nav-active{color:#f4b53d!important;}
#evt-map{height:380px;border-radius:0.75rem;z-index:0;}
.leaflet-popup-content{font-family:'Inter',sans-serif;margin:10px 12px;}
.evt-pin{display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(7,33,54,.4);border:2px solid #fff;}
.evt-pin span{transform:rotate(45deg);font-size:14px;line-height:1;}
.evt-rail{cursor:pointer;}
.evt-rail-bar{width:4px;height:36px;border-radius:999px;background:currentColor;opacity:.18;flex:none;transition:opacity .2s, background .2s;}
.evt-tab[aria-pressed="true"] .evt-rail-bar{opacity:1;background:#f4b53d;}
.evt-rail-count{background:rgba(10,46,76,.08);color:#0a2e4c;}
.evt-tab[aria-pressed="true"] .evt-rail-count{background:rgba(244,181,61,.25);color:#fff;}
.evt-today{font-family:'Inter',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;vertical-align:middle;margin-left:6px;background:#e89812;color:#fff;border-radius:999px;padding:1px 7px;}
.evt-program{display:grid;gap:1.5rem;align-items:start;}
@media(min-width:1024px){.evt-program{grid-template-columns:300px minmax(0,1fr);gap:2rem;}}
/* ---- Yenilenmiş etkinlik kartı (görsel header + cila) ---- */
.evt-grid{display:grid;grid-template-columns:1fr;gap:1rem;}
@media(min-width:640px){.evt-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(min-width:1024px){.evt-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
.evt-card{background:#fff;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(7,33,54,.07),0 10px 28px -10px rgba(7,33,54,.20);}
.evt-media{position:relative;height:130px;overflow:hidden;background:linear-gradient(135deg,var(--evt-c) 0%,color-mix(in srgb,var(--evt-c) 52%,#04141f) 100%);}
.evt-media-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.evt-media-grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,33,54,.12) 0%,rgba(7,33,54,.60) 100%);}
.evt-media-icon{position:absolute;right:12px;bottom:6px;font-size:46px;line-height:1;opacity:.92;filter:drop-shadow(0 3px 10px rgba(0,0,0,.4));}
.evt-type-badge{position:absolute;left:12px;top:12px;display:inline-flex;align-items:center;gap:4px;font-family:'Montserrat';font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:rgba(7,33,54,.40);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:4px 10px;}
.evt-time-badge{position:absolute;left:13px;bottom:11px;font-family:'Montserrat';font-weight:800;font-size:15px;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.55);}
.evt-badges{position:absolute;right:11px;top:11px;display:flex;flex-direction:column;gap:5px;align-items:flex-end;}
.evt-chip-daily{font-family:'Montserrat';font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#062136;background:#f4b53d;border-radius:999px;padding:3px 9px;box-shadow:0 2px 10px rgba(244,181,61,.55);}
.evt-chip-draft{font-family:'Montserrat';font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:rgba(150,100,8,.82);border-radius:999px;padding:3px 8px;}
.evt-body{padding:13px 15px 15px;display:flex;flex-direction:column;flex:1;}
.evt-venue{font-family:'Montserrat';font-weight:700;font-size:15.5px;color:#0a2e4c;line-height:1.18;}
.evt-title{font-size:12.5px;color:rgba(10,46,76,.72);line-height:1.4;margin-top:3px;}
.evt-area{display:flex;align-items:center;gap:4px;font-size:11.5px;color:rgba(10,46,76,.52);margin-top:7px;}
/* ---- Tip filtre çipleri ---- */
.evt-filter{display:flex;flex-wrap:wrap;gap:8px;}
.evt-fchip{cursor:pointer;font-family:'Montserrat';font-size:12.5px;font-weight:600;color:#0a2e4c;background:#fff;border:1px solid rgba(10,46,76,.14);border-radius:999px;padding:6px 13px;transition:transform .16s,border-color .18s,background .18s,color .18s;display:inline-flex;align-items:center;gap:6px;}
.evt-fchip:hover{border-color:#e89812;transform:translateY(-1px);}
.evt-fchip[aria-pressed="true"]{background:#0a2e4c;color:#fff;border-color:#0a2e4c;}
.evt-fchip .fdot{width:8px;height:8px;border-radius:50%;}
/* ---- Yatay gün pill ---- */
.evt-days{display:flex;gap:8px;overflow-x:auto;padding-bottom:5px;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.evt-days::-webkit-scrollbar{display:none;}
.evt-daypill{flex:0 0 auto;cursor:pointer;text-align:center;border-radius:14px;border:1px solid rgba(10,46,76,.13);background:#fff;padding:9px 15px;transition:transform .16s,border-color .18s,background .18s,color .18s;box-shadow:0 1px 3px rgba(7,33,54,.05);}
.evt-daypill:hover{border-color:#f4b53d;transform:translateY(-1px);}
.evt-daypill[aria-pressed="true"]{background:#0a2e4c;border-color:#0a2e4c;color:#fff;box-shadow:0 6px 16px -6px rgba(10,46,76,.5);}
.evt-daypill .dp-day{font-family:'Montserrat';font-weight:700;font-size:13.5px;display:block;line-height:1.1;}
.evt-daypill .dp-date{font-size:10.5px;opacity:.68;display:block;margin-top:2px;}
.evt-daypill .dp-count{font-size:10px;font-weight:700;display:inline-block;margin-top:3px;opacity:.62;}
.evt-daypill[aria-pressed="true"] .dp-today{background:#f4b53d;color:#062136;border-radius:999px;padding:0 6px;font-size:9px;font-weight:800;text-transform:uppercase;margin-left:3px;}
/* katlanır harita */
.evt-map-toggle{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:8px;font-family:'Montserrat';font-weight:700;font-size:14px;color:#0a2e4c;background:#fff;border:1px solid rgba(10,46,76,.13);border-radius:12px;padding:10px 16px;transition:border-color .18s;}
.evt-map-toggle:hover{border-color:#e89812;}
.evt-map-toggle::-webkit-details-marker{display:none;}
.evt-map-wrap[open] .evt-map-toggle{border-bottom-left-radius:0;border-bottom-right-radius:0;}
.evt-map-caret{transition:transform .2s;}
.evt-map-wrap[open] .evt-map-caret{transform:rotate(180deg);}
</style>
<!-- SEO -->
<meta name="description" content="Kalkan'da bu hafta: gün gün canlı müzik, DJ, parti ve gece programı. ${esc(weekStart)} – ${esc(weekEnd)} haftası ${totalEvents} etkinlik, mekan ve saat bilgisiyle.">
<meta name="keywords" content="Kalkan etkinlik, Kalkan canlı müzik, Kalkan gece hayatı, Kalkan parti, Kalkan DJ, Kalkan bu hafta, Kalkan konser, Kalkan bar program, Kaş etkinlik">
<meta name="author" content="Kalkan Info">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="https://kalkaninfo.com/etkinlikler">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kalkan Info">
<meta property="og:title" content="Kalkan Etkinlik Takvimi — Bu Hafta">
<meta property="og:description" content="Kalkan'da bu hafta gün gün canlı müzik, DJ ve parti programı.">
<meta property="og:url" content="https://kalkaninfo.com/etkinlikler">
<meta property="og:image" content="https://kalkaninfo.com/assets/og-default.png">
<meta name="geo.region" content="TR-07">
<meta name="geo.placename" content="Kalkan, Antalya">
<meta name="geo.position" content="36.2658;29.4118">
<!-- /SEO -->
<script src="/js/site-drawer.js?v=20260516b" defer></script>
<script src="/js/supabase-window.js"></script>
<script src="/js/i18n.js?v=20260519a" defer></script>
<script src="/js/cookie-banner.js" defer></script>
<script src="/js/bottom-nav.js?v=20260516b" defer></script>
<script src="/js/analytics.js" defer></script>
<script src="/js/concierge-modal.js?v=20260517b" defer></script>
</head>
<body class="bg-[#dce6ef]">
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PLWTGK2G"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<!-- HERO -->
<header class="relative overflow-hidden" style="background:#072136;">
  <div class="absolute inset-0 z-0">
    <div class="absolute inset-0" style="background:radial-gradient(ellipse 80% 60% at 60% 40%,rgba(212,175,55,0.25) 0%,transparent 70%),radial-gradient(ellipse 50% 80% at 10% 80%,rgba(232,152,18,0.12) 0%,transparent 60%),linear-gradient(180deg,rgba(7,33,54,0.65) 0%,rgba(7,33,54,0.3) 40%,rgba(7,33,54,0.92) 100%);"></div>
  </div>
  <div class="relative z-10 max-w-7xl mx-auto px-4 pt-6 pb-3 flex items-center justify-between text-white">
    <button class="w-9 h-9 grid place-items-center rounded-md bg-white/10 backdrop-blur hover:bg-white/20 transition" aria-label="Menü">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
    <div class="flex items-center gap-2 text-xs md:text-sm">
      <span class="hidden md:inline opacity-70 tracking-wide">Bugün</span>
      <span class="opacity-95 font-semibold tracking-wide" id="today-date"></span>
      <span class="hidden md:inline opacity-40 mx-1">·</span>
      <span data-weather class="hidden md:inline opacity-80">—</span>
    </div>
    <button class="w-9 h-9 grid place-items-center rounded-md bg-white/10 backdrop-blur hover:bg-white/20 transition" aria-label="Ara">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    </button>
  </div>
  <div class="relative z-10 max-w-7xl mx-auto px-4 pt-12 md:pt-16 pb-12 md:pb-16 text-white">
    <div class="inline-flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase bg-white/10 border border-white/20 text-sun-400 px-3 py-1.5 rounded-full font-semibold" style="backdrop-filter:blur(4px);">
      <span class="w-1.5 h-1.5 rounded-full bg-sun-400"></span> ${esc(weekStart)} – ${esc(weekEnd)} · ${totalEvents} etkinlik
    </div>
    <h1 class="font-display text-5xl md:text-7xl font-extrabold mt-4 max-w-3xl leading-[1.0]" style="letter-spacing:-0.03em;text-shadow:0 2px 32px rgba(7,33,54,0.6);">Etkinlikler</h1>
    <p class="mt-3 text-white/80 max-w-xl text-base md:text-lg leading-relaxed">Kalkan'da bu hafta — gün gün canlı müzik, DJ, parti ve gece programı.</p>
  </div>
</header>

<!-- STICKY NAV -->
<nav class="text-white sticky top-0 z-40" style="background:linear-gradient(180deg,#0c3858 0%,#0a2e4c 100%);box-shadow:0 4px 24px -4px rgba(7,33,54,0.55);">
  <div class="max-w-7xl mx-auto px-4 flex items-center justify-between" style="border-bottom:1px solid rgba(255,255,255,0.08);">
    <div class="flex items-center -ml-3">
      <button class="flex items-center gap-2 px-3 py-3.5 hover:bg-white/8">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        <span class="font-display font-semibold tracking-[0.12em] text-sm">MENÜ</span>
      </button>
      <a href="/index.html" aria-label="Ana Sayfa" title="Ana Sayfa" class="grid place-items-center w-11 h-11 hover:bg-white/10 rounded-md ml-1" style="transition:background .18s ease;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>
      </a>
    </div>
    <a href="/index.html" class="font-display font-extrabold text-lg md:text-xl tracking-tight flex items-center gap-2">
      <span class="text-sun-500">◆</span> KALKAN <span class="text-sun-500">INFO</span>
    </a>
    <button class="w-10 h-10 grid place-items-center" aria-label="Ara">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    </button>
  </div>
  <div style="background:#072136;">
    <div class="max-w-7xl mx-auto px-4 hidden md:flex items-center gap-0 text-[12px] uppercase tracking-[0.1em] font-display font-semibold">
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="/haberler.html">Haberler</a>
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="/villalar.html">Villalar</a>
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="/oteller.html">Oteller</a>
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="/restoranlar.html">Restoran &amp; Bar</a>
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="/plajlar.html">Plajlar</a>
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="/turlar.html">Turlar</a>
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow nav-active" href="/etkinlikler">Etkinlikler</a>
      <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="/hizmetler.html">Hizmetler</a>
      <span class="ml-auto"></span>
      <a class="px-4 py-3 text-sun-400 hover:bg-sea-700 flex items-center gap-2" href="#" data-concierge-trigger>Concierge</a>
    </div>
  </div>
  <div class="ribbon-bg grain text-[12px]">
    <div class="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-white/90 overflow-hidden">
      <span class="breaking inline-flex items-center bg-coral-500/90 text-white text-[11px] font-bold px-2 py-0.5 rounded">DUYURU</span>
      <div class="flex-1 overflow-hidden">
        <div class="marquee whitespace-nowrap">
          <span class="mr-10">🎶 Kalkan'da bu hafta ${totalEvents} etkinlik — gün gün program aşağıda</span>
          <span class="mr-10">🎧 Cuma & Cumartesi gece partileri · 23:00 sonrası</span>
          <span class="mr-10">🛎️ Masa/rezervasyon için Concierge: +90 530 665 07 94</span>
          <span class="mr-10">🎶 Kalkan'da bu hafta ${totalEvents} etkinlik — gün gün program aşağıda</span>
          <span class="mr-10">🎧 Cuma & Cumartesi gece partileri · 23:00 sonrası</span>
        </div>
      </div>
    </div>
  </div>
</nav>

<main class="max-w-7xl mx-auto px-4 py-8 md:py-12">

  <!-- YAKLAŞAN ÖNE ÇIKANLAR -->
  ${featuredSection(featured)}

  <!-- HAFTALIK PROGRAM -->
  <section>
    <div class="flex items-baseline gap-2 mb-4">
      <h2 class="font-display font-extrabold text-xl md:text-2xl text-sea-900">Haftalık Program</h2>
      <span class="text-xs text-sea-500">— gün seç</span>
    </div>

    <!-- yatay gün seçici -->
    <div class="evt-days" role="tablist" aria-label="Gün seçimi">
      ${dayPills}
    </div>

    <!-- tip filtresi -->
    <div class="evt-filter mt-4 mb-6" role="group" aria-label="Etkinlik tipi filtresi">
      ${typeChips}
    </div>

    <!-- seçilen günün kartları -->
    <div class="min-w-0">
      ${sections}
    </div>

    <p class="text-[11px] text-sea-600/80 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-6 inline-flex items-start gap-2">
      <span class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-1.5 py-0.5 shrink-0">Taslak</span>
      rozetli etkinlikler henüz doğrulanmadı; saat/mekan değişebilir.
    </p>
  </section>

  <!-- MEKAN HARİTASI (katlanır, ikincil) -->
  <details class="evt-map-wrap mt-10">
    <summary class="evt-map-toggle">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      Mekanları haritada gör
      <svg class="evt-map-caret" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
    </summary>
    <div class="mt-3">
      <div id="evt-map" role="img" aria-label="Kalkan etkinlik mekanları haritası"></div>
      <p class="text-[11px] text-sea-500/80 mt-2">Seçili güne ait mekanlar haritada vurgulanır. Pinler etkinlik tipine göre renklidir.</p>
    </div>
  </details>

  <!-- CONCIERGE CTA -->
  <section class="mt-12 rounded-2xl section-dark text-white p-6 md:p-8 text-center" style="background:#0d3a5f;">
    <h2 class="font-display font-extrabold text-2xl">Mekan sahibi misiniz?</h2>
    <p class="text-white/75 mt-2 max-w-xl mx-auto text-sm md:text-base">Etkinliğinizi bu takvime ekletmek veya hafta programınızı güncellemek için Kalkan Info Concierge ile iletişime geçin.</p>
    <a href="#" data-concierge-trigger class="inline-flex items-center gap-2 mt-5 px-5 py-3 rounded-xl font-display font-bold text-sm shadow-lg transition" style="background:linear-gradient(135deg,#e89812 0%,#c97b09 100%);color:#fff;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg>
      Concierge'e Yaz
    </a>
  </section>
</main>

<footer class="bg-gradient-to-b from-sea-800 to-sea-900 text-white">
  <div class="max-w-7xl mx-auto px-4 pt-12 pb-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
    <div class="col-span-2">
      <a href="/index.html" class="font-display font-extrabold text-2xl tracking-tight flex items-center gap-2">
        <span class="text-sun-500">◆</span> KALKAN <span class="text-sun-500">INFO</span>
      </a>
      <p class="text-white/70 mt-3 max-w-sm">Sessiz ama güçlü — yerel bilgi, seçili tavsiyeler, kurumsal hizmet.</p>
    </div>
    <div>
      <div class="text-xs uppercase tracking-widest text-sun-400 font-bold mb-3">Keşfet</div>
      <ul class="space-y-2 text-white/80">
        <li><a class="hover:text-sun-400" href="/restoranlar.html">Restoran &amp; Bar</a></li>
        <li><a class="hover:text-sun-400" href="/etkinlikler">Etkinlikler</a></li>
        <li><a class="hover:text-sun-400" href="/oteller.html">Oteller</a></li>
        <li><a class="hover:text-sun-400" href="/turlar.html">Turlar</a></li>
      </ul>
    </div>
    <div>
      <div class="text-xs uppercase tracking-widest text-sun-400 font-bold mb-3">İletişim</div>
      <p class="text-white/70 text-xs leading-relaxed">Atatürk Cad. No:1<br>Kalkan / Kaş / Antalya<br><a href="mailto:info@kalkaninfo.com" class="hover:text-sun-400">info@kalkaninfo.com</a></p>
    </div>
  </div>
  <div class="border-t border-white/10 max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between text-xs text-white/60">
    <div>© 2026 Kalkan Info — Tüm hakları saklıdır.</div>
    <div class="flex items-center gap-3 mt-3 md:mt-0">
      <a class="hover:text-sun-400" href="/hakkimizda.html">Hakkımızda</a>
      <a class="hover:text-sun-400" href="/privacy.html">Gizlilik</a>
      <a class="hover:text-sun-400" href="/kvkk.html">KVKK</a>
    </div>
  </div>
</footer>

<a href="#" data-concierge-trigger class="fixed bottom-5 right-5 z-50 bg-sun-600 hover:bg-sun-700 text-white rounded-full shadow-lg flex items-center gap-2 pl-4 pr-5 py-3 transition">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg>
  <span class="font-display font-bold text-sm">Concierge</span>
</a>

<!-- Gömülü veri (SSR ile aynı kaynak; harita ve sekme filtresi bunu kullanır) -->
<script id="evt-data" type="application/json">${inlineData}</script>
<!-- Leaflet (CDN) -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function(){
  // Bugünün tarihini hero üst barına yaz
  try {
    var td = document.getElementById('today-date');
    if (td) td.textContent = new Date().toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'});
  } catch(e){}

  var TYPE_COLOR = ${JSON.stringify(Object.fromEntries(Object.entries(TYPE_STYLE).map(([k, v]) => [k, v.color])))};
  var DEFAULT_COLOR = '${DEFAULT_STYLE.color}';
  var ICONS = ${JSON.stringify(Object.fromEntries(Object.entries(TYPE_STYLE).map(([k, v]) => [k, v.icon])))};
  var KALKAN = [${KALKAN_CENTER.lat}, ${KALKAN_CENTER.lng}];

  // Veriyi statik dosyadan çek; başarısız olursa gömülü JSON'a düş
  function loadData(){
    return fetch('/data/etkinlik-haftalik.json', {cache:'no-cache'})
      .then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); })
      .catch(function(){
        try { return JSON.parse(document.getElementById('evt-data').textContent); }
        catch(e){ return null; }
      });
  }

  function pinIcon(type){
    var color = TYPE_COLOR[type] || DEFAULT_COLOR;
    var icon = ICONS[type] || '🎶';
    return L.divIcon({
      className: '',
      html: '<div class="evt-pin" style="background:'+color+'"><span>'+icon+'</span></div>',
      iconSize: [30,30], iconAnchor: [15,30], popupAnchor: [0,-28]
    });
  }

  var map, markers = [];
  function initMap(data){
    map = L.map('evt-map', {scrollWheelZoom:false}).setView(KALKAN, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    (data.days || []).forEach(function(day){
      (day.events || []).forEach(function(ev){
        if (!ev.coordinates || ev.coordinates.lat == null || ev.coordinates.lng == null) return;
        var m = L.marker([ev.coordinates.lat, ev.coordinates.lng], {icon: pinIcon(ev.type)});
        var t = (ev.time||'') + (ev.endTime ? ' – '+ev.endTime : '');
        m.bindPopup('<strong>'+(ev.venueName||'')+'</strong><br>'+
          '<span style="color:#0a2e4c">'+(ev.type||'')+' · '+day.day+' '+t+'</span>'+
          (ev.title ? '<br><span style="color:#555">'+ev.title+'</span>' : '') +
          (ev.detailUrl ? '<br><a href="'+ev.detailUrl+'" target="_blank" rel="noopener" style="color:#e89812;font-weight:600">Mekan sayfası →</a>' : ''));
        m._evtDay = day.day;
        markers.push(m);
        m.addTo(map);
      });
    });
    filterMarkers(currentDay);
  }

  var currentDay = ${JSON.stringify(week[activeIdx].day)};
  function filterMarkers(day){
    var group = [];
    markers.forEach(function(m){
      var on = m._evtDay === day;
      m.setOpacity(on ? 1 : 0.25);
      m.setZIndexOffset(on ? 1000 : 0);
      if (on) group.push(m.getLatLng());
    });
    if (map && group.length){
      try { map.fitBounds(L.latLngBounds(group).pad(0.4), {maxZoom:16}); } catch(e){}
    } else if (map){ map.setView(KALKAN, 15); }
  }

  var currentFilter = 'all';
  // Aktif günün kartlarını seçili tipe göre göster/gizle
  function applyFilter(){
    var panel = document.querySelector('.day-panel[data-day="'+currentDay+'"]');
    if(!panel) return;
    var shown = 0;
    panel.querySelectorAll('.evt-card').forEach(function(c){
      var on = currentFilter === 'all' || c.getAttribute('data-type') === currentFilter;
      c.style.display = on ? '' : 'none';
      if(on) shown++;
    });
    var empty = panel.querySelector('.evt-filter-empty');
    if(empty) empty.style.display = shown ? 'none' : '';
  }

  // Gün seçici (panel + harita + filtre)
  function showDay(day){
    currentDay = day;
    document.querySelectorAll('.day-panel').forEach(function(p){
      p.hidden = p.getAttribute('data-day') !== day;
    });
    document.querySelectorAll('.evt-daypill').forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-day') === day ? 'true' : 'false');
    });
    applyFilter();
    if (markers.length) filterMarkers(day);
  }
  document.querySelectorAll('.evt-daypill').forEach(function(b){
    b.addEventListener('click', function(){ showDay(b.getAttribute('data-day')); });
  });

  // Tip filtre çipleri
  document.querySelectorAll('.evt-fchip').forEach(function(b){
    b.addEventListener('click', function(){
      currentFilter = b.getAttribute('data-filter');
      document.querySelectorAll('.evt-fchip').forEach(function(x){
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      applyFilter();
    });
  });

  // Harita: katlanır panel ilk açıldığında lazy başlat + boyut düzelt
  var mapReady = false;
  var mapWrap = document.querySelector('.evt-map-wrap');
  function ensureMap(){
    if (!window.L) return;
    loadData().then(function(data){
      if (!data) return;
      if (!mapReady){ initMap(data); mapReady = true; }
      setTimeout(function(){ try { map.invalidateSize(); filterMarkers(currentDay); } catch(e){} }, 80);
    });
  }
  if (mapWrap){
    mapWrap.addEventListener('toggle', function(){ if (mapWrap.open) ensureMap(); });
  }
})();
</script>
</body>
</html>
`;
}

/* ----------------------------- ÇALIŞTIR ----------------------------- */
const refIso = process.argv[2] || new Date().toISOString().slice(0, 10);
const week = await eventsForWeek(refIso);

// Yaklaşan öne çıkanlar: bu haftanın DIŞINDA, önümüzdeki 21 gün içindeki DOĞRULANMIŞ tarihli (oneoff) etkinlikler.
const weekEndIso = week[6].date;
const horizon = new Date(week[6].date + 'T00:00:00');
horizon.setDate(horizon.getDate() + 21);
const cal = JSON.parse(await readFile(join(ROOT, 'data', 'etkinlik-takvimi.json'), 'utf8'));
const featured = (cal.oneoff || [])
  .filter((e) => e.verified && e.date > weekEndIso && new Date(e.date + 'T00:00:00') <= horizon)
  .sort((a, b) => a.date.localeCompare(b.date));

// Statik veri çıktısı (tarayıcı fetch eder)
const payload = {
  generatedAt: new Date().toISOString(),
  weekStart: week[0].date,
  weekEnd: week[6].date,
  center: KALKAN_CENTER,
  total: week.reduce((n, d) => n + d.events.length, 0),
  days: week.map((d) => ({
    date: d.date,
    day: d.day,
    events: d.events.map((e) => ({
      id: e.id,
      type: e.type,
      time: e.time || null,
      endTime: e.endTime || null,
      venueName: e.venueName,
      area: e.area || 'Kalkan',
      title: e.title || null,
      photo: e.photo || null,
      coordinates: e.coordinates || null,
      detailUrl: e.detailUrl || null,
      verified: !!e.verified,
      recurring: !!e.recurring,
    })),
  })),
};

await writeFile(join(ROOT, 'data', 'etkinlik-haftalik.json'), JSON.stringify(payload, null, 2), 'utf8');

await mkdir(join(ROOT, 'etkinlikler'), { recursive: true });
await writeFile(join(ROOT, 'etkinlikler', 'index.html'), pageHtml(week, payload, featured), 'utf8');

console.log(`✓ data/etkinlik-haftalik.json  (${payload.total} etkinlik, ${payload.weekStart} → ${payload.weekEnd})`);
console.log(`✓ etkinlikler/index.html  (${featured.length} yaklaşan öne çıkan)`);
