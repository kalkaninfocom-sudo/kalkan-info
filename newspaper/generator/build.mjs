#!/usr/bin/env node
/**
 * Kalkan Today — A4 günlük gazete PDF generator
 *
 * Kullanım:
 *   node newspaper/generator/build.mjs morning            # bugün, demo veri
 *   node newspaper/generator/build.mjs morning 2026-06-26 # belirli tarih
 *
 * Çıktı: newspaper/archive/<YYYY-MM-DD>/<type>.pdf + .html
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildData as buildRealData, buildMagazineData } from './sources.mjs';
import { translateFields, LANGS } from '../../lib/i18n-translate.mjs';
import { aiContentMeta } from '../../lib/reklam-uyum.mjs';
import { createCache } from '../../lib/i18n-cache.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// .env.local yükle (yerel çalıştırma; CI'da env zaten dolu). Çeviri (cheap-llm) için.
try {
  const envp = join(__dirname, '..', '..', '.env.local');
  if (existsSync(envp)) for (const line of readFileSync(envp, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const argv = process.argv.slice(2);
const useDemo = argv.includes('--demo');
const positional = argv.filter(a => !a.startsWith('--'));
const type = positional[0] || 'morning';
const today = positional[1] || new Date().toISOString().slice(0, 10);
// 5 DİL: --lang=de → morning.de.html üret (TR base + çeviri). Varsayılan tr (mevcut akış, bozulmaz).
const lang = (argv.find(a => a.startsWith('--lang=')) || '').split('=')[1] || 'tr';

// Tüm diller (tr kaynak + hedefler) — hreflang cross-link + dil switcher için.
const ALL_LANGS = ['tr', ...LANGS]; // tr, en, de, ru, fr
const LOCALE = { tr: 'tr-TR', en: 'en-GB', de: 'de-DE', ru: 'ru-RU', fr: 'fr-FR' };
const LANG_LABEL = { tr: 'TR', en: 'EN', de: 'DE', ru: 'RU', fr: 'FR' };
// Template'in SABİT UI etiketleri (bölüm başlıkları vb.) — TR kaynak; çeviri havuzuna katılır.
// Böylece manuel 5-dil sözlüğü tutmaya gerek yok: tek çeviri motoru hepsini çevirir.
const UI_TR = {
  ui_masthead_tag: 'Kalkan’ın nabzı, bir sayfada.',
  ui_gazette_sub: 'GAZETESİ',
  ui_weather_label: 'Kalkan Hava Durumu',
  ui_wind_label: 'Rüzgar',
  ui_year: 'YIL', ui_issue: 'SAYI', ui_price: 'FİYAT: 10 TL',
  ui_kicker: 'Manşet',
  ui_headlines: 'Günün Başlıkları',
  ui_visit: 'Bugün Kalkan’da Gezilecek Yerler',
  ui_restaurants: 'Haftanın Restoranları',
  ui_reviews: 'Google Puanları',
  ui_events: 'Canlı Etkinlikler',
  ui_tomorrow: 'Yarın İçin Yapılacaklar',
  // magazine.html
  ui_mag_kicker: 'Kalkan Today · Gece Hayatı Eki',
  ui_mag_title: 'MAGAZİN',
  ui_issue_no: 'Sayı',
  ui_tonight_program: 'Bu Akşam Programı',
  ui_events_word: 'Etkinlik',
  ui_sponsor_note: 'İLAN içeriklerinde sponsor etiketi zorunludur',
  ui_ai_disclosure: 'Yapay zeka destekli hazırlanmıştır',
  ui_full_program: 'Tüm program',
};

// Web sayfasında çevrilecek metin alanları (düz metin + HTML-liste; yapı LLM'de korunur).
// URL/foto/hava/eczane/otobüs/tarih ÇEVRİLMEZ (dile bağlı değil ya da ayrı işlenir).
const TRANSLATABLE = [
  'lead_headline', 'lead_deck', 'lead_caption', 'feature_title', 'feature_body',
  'headlines_list', 'gezilecek_list', 'resto_list', 'reviews_list', 'events_list', 'tomorrow_list',
  'ad_title', 'ad_body', 'ad_cta', 'col1_title', 'col1_body', 'col2_title', 'col2_body',
  'col3_title', 'col3_body',
  ...Object.keys(UI_TR), // sabit UI etiketleri de çevrilir
];

const fileFor = (t, l) => (l === 'tr' ? `${t}.html` : `${t}.${l}.html`);

function hreflangLinks(t) {
  return ALL_LANGS
    .map((l) => `<link rel="alternate" hreflang="${l}" href="./${fileFor(t, l)}">`)
    .join('\n');
}

function langSwitcher(t, cur) {
  const items = ALL_LANGS.map((l) => l === cur
    ? `<span class="cur" aria-current="true">${LANG_LABEL[l]}</span>`
    : `<a href="./${fileFor(t, l)}">${LANG_LABEL[l]}</a>`).join(' · ');
  return `<nav class="lang-switch" style="position:fixed;top:8px;right:10px;z-index:99;font:600 12px/1 system-ui,sans-serif;background:rgba(255,255,255,.92);padding:5px 9px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.15)">${items}</nav>`;
}

function formatDateLongLocale(iso, l) {
  if (l === 'tr') return formatDateLong(iso);
  try { return new Date(iso + 'T08:00:00').toLocaleDateString(LOCALE[l] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return formatDateLong(iso); }
}

function dayLocale(iso, l) {
  if (l === 'tr') return dayOf(iso);
  try { return new Date(iso + 'T08:00:00').toLocaleDateString(LOCALE[l] || 'en-GB', { weekday: 'long' }); }
  catch { return dayOf(iso); }
}

// TR data'nın çevrilebilir alanlarını hedef dile çevir.
// Her alan AYRI + PARALEL çevrilir (tek dev JSON batch'i groq json-mode'u 400'e düşürüyor;
// HTML-liste'ler uzun → maxTokens taşıyor). Küçük tek-alan JSON'ları güvenilir. Başarısız alan TR kalır.
const I18N_CTX = 'Günlük gazete web bölümü — HTML etiketlerini AYNEN koru, sadece metni çevir';
// Sayfanın "gerçekten çevrildi" sayılması için gereken kritik metin alanları (eskalasyon + gate hedefi).
const I18N_CRITICAL = new Set(['lead_headline', 'lead_deck', 'feature_title', 'feature_body', 'col1_title', 'col1_body', 'col2_title', 'col2_body', 'col3_title', 'col3_body']);

// Bir alanı çevir (opsiyonel sağlayıcı sırası = eskalasyon). Echo/boş → null (başarısız).
async function translateOne(k, data, l, order) {
  const t = await translateFields({ [k]: data[k] }, l, { context: I18N_CTX, maxTokens: 1400, ...(order ? { order } : {}) }).catch(() => null);
  return (t && typeof t[k] === 'string' && t[k].trim() && t[k] !== data[k]) ? t[k] : null;
}

// SAĞLAM 5-dil çeviri: KALICI CACHE → throttle → sıralı retry → kritik eskalasyon.
// "Hep ya da hiç" free-tier çöküşünü bitirir: her alan bir kez çevrilince git'e yazılır, bir daha çevrilmez;
// kısmi ilerleme birikir; her sayı yalnız YENİ haber metnini çevirir (yük ~%80 düşer → rate-limit çökmez).
async function translateWebData(data, l) {
  const keys = TRANSLATABLE.filter((k) => data[k] && String(data[k]).trim());
  if (!keys.length) return data;
  const cache = createCache(l);
  const out = {};

  // Faz 0 — KALICI CACHE: önceden çevrilmiş alanları LLM'siz doldur (UI/tekrar eden metin ömür boyu 1 kez).
  const pending = [];
  for (const k of keys) { const c = cache.get(data[k]); if (c !== null) out[k] = c; else pending.push(k); }
  if (cache.hits()) console.log(`   ${l}: cache ✓ ${cache.hits()}/${keys.length} alan (LLM'siz)`);

  // Faz 1 — THROTTLED paralel (yalnız cache-miss). Eşzamanlılık 4 → free-tier burst'ü keser.
  const failed = [];
  const CONC = Math.max(1, Number(process.env.I18N_CONCURRENCY || 4));
  let idx = 0;
  const worker = async () => {
    while (idx < pending.length) {
      const k = pending[idx++];
      const v = await translateOne(k, data, l);
      if (v !== null) { out[k] = v; cache.set(data[k], v); } else failed.push(k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, pending.length) }, worker));

  // Faz 2 — başarısızları SIRALI + gecikmeyle tekrar dene (burst yok → rate-limit penceresi yenilenir).
  const stillFailed = [];
  for (const k of failed) {
    const v = await translateOne(k, data, l);
    if (v !== null) { out[k] = v; cache.set(data[k], v); } else stillFailed.push(k);
    await new Promise((r) => setTimeout(r, 250));
  }

  // Faz 3 — ESKALASYON: hâlâ başarısız KRİTİK alanları gemini-önce farklı sırayla zorla (kota tükenen sağlayıcıyı atla).
  const finalFailed = stillFailed.filter((k) => !I18N_CRITICAL.has(k));
  for (const k of stillFailed.filter((k) => I18N_CRITICAL.has(k))) {
    const v = await translateOne(k, data, l, ['gemini', 'groq', 'cerebras', 'nvidia', 'claude']);
    if (v !== null) { out[k] = v; cache.set(data[k], v); } else finalFailed.push(k);
    await new Promise((r) => setTimeout(r, 300));
  }

  cache.flush(); // kazanımları diske yaz (git commit ile kalıcı → sonraki run/gün tekrar çevirmez)
  const ok = keys.length - finalFailed.length;
  console.log(`   ${l}: ${ok}/${keys.length} alan hazır${finalFailed.length ? ' — başarısız: ' + finalFailed.join(',') : ''}`);
  // KRİTİK GATE: manşet çevrilmediyse sayfa aslında TR → GÜRÜLTÜLÜ uyar (heartbeat de yakalar).
  if (data.lead_headline && out.lead_headline === undefined) {
    console.error(`   ⛔ ${l}: MANŞET çevrilemedi → sayfa TR içerikle "${l}" çıkıyor! (I18N_LLM_ORDER/anahtar/kota kontrol)`);
  }
  return { ...data, ...out };
}

const DAY_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function formatDateLong(iso) {
  const d = new Date(iso + 'T08:00:00');
  return `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${d.getFullYear()}`;
}

function dayOf(iso) {
  return DAY_TR[new Date(iso + 'T08:00:00').getDay()];
}

function issueOf(iso) {
  const start = new Date('2026-06-01T00:00:00');
  const d = new Date(iso + 'T00:00:00');
  return String(Math.max(1, Math.round((d - start) / 86400000) + 1)).padStart(3, '0');
}

// ─── Demo veri (Aşama 1'de Supabase/Claude Haiku ile değiştirilecek) ───
function demoData(iso) {
  return {
    date: iso,
    date_long: formatDateLong(iso),
    day: dayOf(iso),
    issue: issueOf(iso),
    vol: '1',

    weather_air: '28',
    weather_sea: '24',
    weather_uv: '9',
    weather_wind: 'GB 12 km/h',
    sunrise: '05:42',
    sunset: '20:31',

    lead_headline: 'Kalkan Sezonu Açıldı: Üç Yeni Plaj Kulübü Hizmete Girdi',
    lead_deck: 'Kalamar koyundan Kaputaş\'a uzanan hatta yeni dönem başladı; belediye haziran sonu rekoru bekliyor.',
    lead_byline: 'Kalkan Today Haber Merkezi · 26 Haziran 2026',
    lead_body: `<p>Akdeniz\'in en sakin koylarından Kalkan, 2026 yaz sezonunu üç yeni plaj kulübünün açılışıyla karşıladı. Belediye yetkilileri, geçen yıla göre rezervasyonlarda yüzde 32\'lik artış kaydedildiğini belirtti.</p>
<p>Yeni kulüplerden Kalamar Yacht Beach, sabah yedide kahvaltı servisiyle başlıyor; akşam DJ etkinlikleriyle uzanıyor. Bölge esnafı gece hayatının da bu yıl daha hareketli olacağına işaret ediyor.</p>`,
    lead_image: 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=1200&q=80',
    lead_caption: 'Foto: Kalamar koyu, gün doğumu — Kalkan Today arşivi',

    col1_title: 'Bugün 14 Etkinlik · Patara Antik Tiyatro\'da Akşam Konseri',
    col1_byline: 'Etkinlik · 19:30 itibarıyla',
    col1_body: 'Patara Antik Kenti\'nde bu akşam saat 21:00\'de açıkhava klasik müzik konseri var. Bilet kalkaninfo.com\'dan ücretsiz; kapasite 400 kişi ile sınırlı.',

    col2_title: 'Şefin Önerisi · Bugün Kalkan Sofrası',
    col2_byline: 'Restoran · Mekan editörü',
    col2_body: 'Kalkan\'ın marina ve koy manzaralı restoranlarında akşam yemeği için taze deniz mahsulü ve zeytinyağlı mezeler öne çıkıyor. Güncel öneriler kalkaninfo.com/restoranlar.',

    col3_title: 'Kaputaş\'ta Dalga Uyarısı · Plaj Trafiği Sabah 11\'de Açılıyor',
    col3_byline: 'Plaj · Sahil Güvenlik bülteni',
    col3_body: 'Lodos nedeniyle Kaputaş Plajı 09:00–11:00 arası dalga uyarısı altında. Antik kent rotasında Patara ve Letoon dün gün boyu 1.200\'ün üzerinde ziyaretçi ağırladı.',

    ad_title: 'Kalkan Restoranları — Akşam Yemeği Rehberi',
    ad_body: 'Marina, koy ve eski köy sokaklarındaki mekanları keşfedin. Rezervasyon ve menüler: kalkaninfo.com/restoranlar',
    ad_cta: 'Mekanları Keşfet',
    ad_qr_url: 'https://kalkaninfo.com/restoranlar/',

    pharmacy_name: 'Merkez Eczanesi',
    pharmacy_addr: 'Yalı Cad. No:8',
    pharmacy_phone: '0242 844 31 22',

    bus_next: '08:15 → Kaş',
    bus_route: 'Kalkan Otogar · saat başı',

    water_temp: '24',
  };
}

function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] !== undefined ? String(data[k]) : ''));
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function main() {
  const tplPath = join(ROOT, 'templates', `${type}.html`);
  try {
    await access(tplPath);
  } catch {
    console.error(`✗ Şablon yok: ${tplPath}`);
    process.exit(1);
  }
  const tpl = await readFile(tplPath, 'utf8');

  const demo = demoData(today);
  let data;
  if (useDemo) {
    data = demo;
    console.log('ℹ --demo: sahte veri kullanılıyor');
  } else if (type === 'magazine') {
    try {
      data = await buildMagazineData(today, demo);
      console.log('✓ Magazin verisi (gece hayatı + etkinlik takvimi)');
    } catch (err) {
      console.warn(`⚠ Magazin verisi çekilemedi (${err.message}) — demo veriye düşülüyor`);
      data = demo;
    }
  } else {
    try {
      data = await buildRealData(today, demo);
      console.log('✓ Gerçek veri çekildi (Open-Meteo + haberler + restoran + eczane + etkinlik)');
    } catch (err) {
      console.warn(`⚠ Gerçek veri çekilemedi (${err.message}) — demo veriye düşülüyor`);
      data = demo;
    }
  }
  // Sabit UI etiketleri (TR) — data'ya kat (lang=tr'de aynen kalır, diğer dilde çevrilir)
  data = { ...UI_TR, ...data };

  // ─── 5 DİL: hedef dile çevir + locale tarih (lang=tr ise dokunulmaz) ───
  if (lang !== 'tr') {
    console.log(`🌍 ${lang} çevirisi yapılıyor...`);
    data = await translateWebData(data, lang);
    data.date_long = formatDateLongLocale(today, lang);
    data.day = dayLocale(today, lang);
  }
  // Dil meta (her dilde): html lang attr + hreflang cross-link + dil switcher
  data.lang = lang;
  data.hreflang_links = hreflangLinks(type);
  data.lang_switcher = langSwitcher(type, lang);

  let html = render(tpl, data);

  // ─── AB AI Act Madde 50: makine-okunur işaret + görünür AI ibaresi (dile göre) ───
  // Gazete = kamuyu bilgilendirme amaçlı AI-üretimi metin → şeffaflık zorunlu (yür. 2 Ağu 2026).
  // Idempotent: zaten işaretliyse tekrar eklemez (şablona sonradan gömülse de çift olmaz).
  if (!/name="ai-generated"/.test(html)) {
    const { metaTags, footerHtml } = aiContentMeta({ lang });
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${metaTags}\n</head>`) : `${metaTags}\n${html}`;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footerHtml}\n</body>`) : `${html}\n${footerHtml}`;
  }

  const outDir = join(ROOT, 'archive', today);
  await ensureDir(outDir);

  const htmlOut = join(outDir, fileFor(type, lang));
  await writeFile(htmlOut, html, 'utf8');
  console.log(`✓ HTML  → ${htmlOut}`);

  // ─── Puppeteer ile PDF render (yalnız TR — PDF dile bağlı değil, maliyet) ───
  if (lang !== 'tr') { console.log(`ℹ ${lang}: PDF atlandı (TR PDF yeterli)`); return; }
  const puppeteer = await import('puppeteer').catch(() => null);
  if (!puppeteer) {
    console.log('ℹ Puppeteer yok — sadece HTML üretildi. PDF için: npm i -D puppeteer');
    return;
  }
  const browser = await puppeteer.default.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfOut = join(outDir, `${type}.pdf`);
  await page.pdf({
    path: pdfOut,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log(`✓ PDF   → ${pdfOut}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
