#!/usr/bin/env node
/**
 * Tum ana sayfalarda "Villalar" navi linkinin yanina "Oteller" linki ekler.
 * Hem ust navi (sticky nav) hem footer'da calisir.
 * Idempotent — daha onceki insert'i tespit edip atlar.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const PAGES = [
  'index.html', 'restoranlar.html', 'villalar.html', 'plajlar.html',
  'antik-kentler.html', 'turlar.html', 'aktiviteler.html', 'haberler.html',
  'hakkimizda.html', 'hizmetler.html', 'hizmet-ekle.html', 'ilanlar.html',
  'tatil-asistani.html'
];

// Sticky nav (px-4 py-3 hover:bg-sea-700 underline-grow ...) icindeki villalar linki
// `<a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="villalar.html" ...>Villalar</a>`
// Onun arkasina ayni stilde Oteller ekle (eger zaten yoksa)
const NAV_OTEL_LINK = `<a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="oteller.html" data-en="Hotels" data-de="Hotels" data-ru="Отели" data-fr="Hôtels">Oteller</a>`;

// Footer'da: `<li><a class="hover:text-sun-400" href="villalar.html" ...>Villalar</a></li>`
const FOOTER_OTEL_LINE = `<li><a class="hover:text-sun-400" href="oteller.html" data-en="Hotels" data-de="Hotels" data-ru="Отели" data-fr="Hôtels">Oteller</a></li>`;

// Index.html'deki "kart grid" tarzi villalar buton (mainpage shortcut)
// Bu sadece index.html'de bulunur, yine de regex genel
// `<a id="villalar" href="villalar.html" class="...">` ... `</a>`
// Bunlari atla; sadece nav ve footer'i guncelle (kart grid'i icin manuel karar).

// Top sticky nav: <a class="px-4 py-3 hover:bg-sea-700 underline-grow..." ...href="villalar.html"...>Villalar</a>
// href ve class siralamasi karisik olabilir, gevsek pattern
const VILLALAR_NAV_REGEX = /(<a\s+class="px-4 py-3 hover:bg-sea-700 underline-grow[^"]*"[^>]*href="villalar\.html"[^>]*>[\s\S]*?<\/a>)/g;
const VILLALAR_FOOTER_REGEX = /(<li>\s*<a class="hover:text-sun-400" href="villalar\.html"[^>]*>[\s\S]*?<\/a>\s*<\/li>)/g;

let changed = [];
let skipped = [];

for (const page of PAGES) {
  const path = join(root, page);
  let html;
  try { html = await readFile(path, 'utf8'); }
  catch(e) { skipped.push({ page, reason: 'not found' }); continue; }

  let modified = false;

  // 1. Sticky nav — Villalar arkasina Oteller ekle (zaten yoksa)
  html = html.replace(VILLALAR_NAV_REGEX, (m) => {
    // Bu match'in hemen arkasinda zaten oteller.html linki var mi kontrol et
    const idx = html.indexOf(m);
    const after = html.slice(idx + m.length, idx + m.length + 200);
    if (/href="oteller\.html"/.test(after)) return m; // zaten ekli
    modified = true;
    return m + '\n      ' + NAV_OTEL_LINK;
  });

  // 2. Footer — Villalar <li>'sinin arkasina Oteller <li> ekle
  html = html.replace(VILLALAR_FOOTER_REGEX, (m) => {
    const idx = html.indexOf(m);
    const after = html.slice(idx + m.length, idx + m.length + 200);
    if (/href="oteller\.html"/.test(after)) return m; // zaten ekli
    modified = true;
    return m + '\n        ' + FOOTER_OTEL_LINE;
  });

  if (modified) {
    await writeFile(path, html);
    changed.push(page);
  } else {
    skipped.push({ page, reason: 'no insertion point or already done' });
  }
}

console.log(`Updated: ${changed.length} pages.`);
changed.forEach(p => console.log(`  + ${p}`));
if (skipped.length) {
  console.log(`Skipped: ${skipped.length} pages.`);
  skipped.forEach(s => console.log(`  - ${s.page}: ${s.reason}`));
}
