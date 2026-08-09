// scripts/sync-villa-visionary.mjs
// Kök `villa-<slug>-visionary.html` PREMIUM sayfalarını canlı route yapısına
// (`villa/<slug>/index.html`) senkronlar. Bu, canonical URL'in (kalkaninfo.com/villa/<slug>)
// gerçekten premium sayfayı sunmasını sağlar.
//
// NEDEN AYRI: scripts/build-villa-pages.mjs eski `villalar.json + _template`
// üreticisidir ve premium visionary tasarımı kapsamaz. build-all.mjs bu iki
// script'ten HİÇBİRİNİ çağırmadığı için canlıda villa/<slug>/index.html Jul-9
// eski sürümde kalıyordu. Bu script build-all zincirine eklenir.
//
// Asset yolları: visionary sayfalar mutlak yol (/assets/...) + CDN kullanır,
// göreli yol yoktur → alt dizine taşımak güvenlidir (doğrulandı 2026-08-09).
//
// Fail-safe: bir villa hata verirse diğerleri devam, build kırılmaz.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const sources = readdirSync(ROOT).filter((f) => /^villa-.+-visionary\.html$/.test(f));

if (sources.length === 0) {
  console.log('ℹ️  [sync-villa-visionary] villa-*-visionary.html yok, atlanıyor.');
  process.exit(0);
}

let ok = 0, fail = 0, unchanged = 0;

for (const file of sources) {
  try {
    const slug = file.replace(/^(villa-.+)-visionary\.html$/, '$1'); // villa-poyraz
    let html = readFileSync(join(ROOT, file), 'utf8');

    // Trailing-slash normalize: kalkaninfo.com/villa/<slug>/ → /villa/<slug>
    // (vercel.json trailingSlash:false + cleanUrls:true — slash'lı canonical/hreflang
    //  308 redirect'e uğrar; canonical redirect'e gitmemeli.)
    html = html.replace(
      /(https:\/\/(?:www\.)?kalkaninfo\.com\/villa\/[a-z0-9-]+)\/(?=["?])/g,
      '$1'
    );

    const outDir = join(ROOT, 'villa', slug);
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, 'index.html');

    const prev = existsSync(outFile) ? readFileSync(outFile, 'utf8') : null;
    if (prev === html) {
      console.log(`⏭️  [sync-villa-visionary] ${slug} zaten güncel`);
      unchanged++;
      continue;
    }

    writeFileSync(outFile, html);
    console.log(`✅ [sync-villa-visionary] ${file} → villa/${slug}/index.html (${html.length} bytes)`);
    ok++;
  } catch (e) {
    console.error(`❌ [sync-villa-visionary] ${file} hata: ${e.message}`);
    fail++;
  }
}

console.log(`\n[sync-villa-visionary] ${ok} yazıldı, ${unchanged} değişmedi, ${fail} hata (${sources.length} kaynak)`);
process.exit(0);
