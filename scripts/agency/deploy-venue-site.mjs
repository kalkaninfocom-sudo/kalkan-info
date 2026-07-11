#!/usr/bin/env node
/**
 * scripts/agency/deploy-venue-site.mjs — SATILAN işletme sitesini KENDİ domainine deploy'a hazırla.
 *
 * `build-venue-site.mjs` demo/<slug>/ altında site + admin üretir ama fotoğraflar/JS
 * kalkaninfo.com kök yollarına (/assets, /js, /vendor) bağlıdır. Müşteriye kendi
 * domaininde teslim etmek için bu script demo'yu SELF-CONTAINED bir pakete kopyalar:
 *
 *   dist/venue-deploy/<slug>/
 *     index.html  admin.html          (demo'dan)
 *     assets/img/...  js/...  vendor/…  (yalnızca referans edilen dosyalar)
 *     vercel.json                       (cleanUrls — kalkaninfo davranışıyla aynı)
 *     README.txt                        (deploy adımları)
 *
 * Absolute yollar (/assets/..) domain kökünde aynen çalışır → HTML'i yeniden yazmaya gerek yok.
 *
 * Kullanım:
 *   node scripts/agency/deploy-venue-site.mjs zeugma-restorant
 *   node scripts/agency/deploy-venue-site.mjs zeugma-restorant --deploy   # vercel CLI varsa canlıya
 *
 * Not: js/supabase-config.js yalnızca PUBLIC anon key içerir (RLS korumalı) — pakette güvenli.
 *      Site, venue_sites satırı yoksa baked gerçek veriye düşer; Supabase olmadan da çalışır.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith('--'));
const doDeploy = argv.includes('--deploy');

if (!slug) {
  console.error('Kullanım: node scripts/agency/deploy-venue-site.mjs <slug> [--deploy]');
  process.exit(1);
}

const srcDir = join(ROOT, 'demo', slug);
if (!existsSync(join(srcDir, 'index.html'))) {
  console.error(`✗ demo/${slug}/index.html yok. Önce üret: node scripts/agency/build-venue-site.mjs ${slug}`);
  process.exit(1);
}

const outDir = join(ROOT, 'dist', 'venue-deploy', slug);
mkdirSync(outDir, { recursive: true });

// ── referans edilen kök-mutlak varlıkları HTML'den çıkar ──────────────
// /assets/... /js/... /vendor/... /css/... /img/... (tırnak/parantez içinde)
const ASSET_RE = /["'(](\/(?:assets|js|vendor|css|img|fonts)\/[^"')?#]+)/g;
const referenced = new Set();
const pages = ['index.html', 'admin.html'].filter((f) => existsSync(join(srcDir, f)));

for (const page of pages) {
  const html = readFileSync(join(srcDir, page), 'utf8');
  let m;
  while ((m = ASSET_RE.exec(html))) referenced.add(m[1]);
  // sayfayı pakete kopyala (aynen — absolute yollar kökte çalışır)
  writeFileSync(join(outDir, page), html);
}

// ── varlıkları yapı koruyarak kopyala ─────────────────────────────────
let copied = 0;
const missing = [];
for (const rel of referenced) {
  const from = join(ROOT, rel.replace(/^\//, ''));
  const to = join(outDir, rel.replace(/^\//, ''));
  if (!existsSync(from)) { missing.push(rel); continue; }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied++;
}

// ── vercel.json (kalkaninfo davranışıyla aynı: cleanUrls) ─────────────
writeFileSync(
  join(outDir, 'vercel.json'),
  JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2)
);

// ── README (deploy adımları) ──────────────────────────────────────────
writeFileSync(
  join(outDir, 'README.txt'),
  [
    `${slug} — self-contained deploy paketi`,
    ``,
    `Bu klasör tek başına bir web sitesidir (kalkaninfo.com'a bağımlı değil).`,
    `Kendi domainine deploy için:`,
    ``,
    `  cd dist/venue-deploy/${slug}`,
    `  vercel deploy --prod            # veya Netlify/herhangi statik host`,
    ``,
    `Sonra Vercel/DNS panelinden müşterinin domainini bu deploy'a bağla.`,
    `Admin panel: <domain>/admin.html  (Supabase auth — owner_id atanınca müşteri düzenler)`,
    ``,
    `İçerik: ${pages.join(', ')} + ${copied} varlık (foto/js/vendor).`,
  ].join('\n')
);

console.log(`✓ Paket hazır: dist/venue-deploy/${slug}/`);
console.log(`  Sayfa   : ${pages.join(', ')}`);
console.log(`  Varlık  : ${copied} kopyalandı${missing.length ? ` · ${missing.length} EKSİK` : ''}`);
if (missing.length) missing.slice(0, 8).forEach((r) => console.log(`    ⚠ eksik: ${r}`));

if (doDeploy) {
  let hasVercel = false;
  try { execSync('vercel --version', { stdio: 'ignore' }); hasVercel = true; } catch {}
  if (!hasVercel) {
    console.log(`\n⚠ vercel CLI bulunamadı. Kur: npm i -g vercel  → sonra: cd dist/venue-deploy/${slug} && vercel deploy --prod`);
  } else {
    console.log(`\n▶ vercel deploy --prod çalıştırılıyor…`);
    try {
      const out = execSync('vercel deploy --prod --yes', { cwd: outDir, encoding: 'utf8' });
      console.log(out.trim());
    } catch (e) {
      console.error(`✗ Deploy hata: ${e.message}\n  Elle: cd dist/venue-deploy/${slug} && vercel deploy --prod`);
    }
  }
} else {
  console.log(`\n→ Canlıya almak için: node scripts/agency/deploy-venue-site.mjs ${slug} --deploy`);
  console.log(`  veya elle: cd dist/venue-deploy/${slug} && vercel deploy --prod`);
}
