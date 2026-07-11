#!/usr/bin/env node
/**
 * scripts/agency/website-leads.mjs — WEB SİTESİ SATIŞ HATTI (asıl varlık: lead listesi)
 *
 * Kalkan Info verisinden KENDİ web sitesi OLMAYAN işletmeleri çıkarır → satış hattı.
 * Kalkan Info markası altında "gerçek verinizle + fotoğraflarınızla tasarlanmış modern site" satmak için
 * hedef listesi. Fotolu + iletişimli + puanlı olanlar en değerli (site hemen kurulabilir, işletme ulaşılabilir).
 *
 * Çıktı: data/agency/website-leads.json (+ konsol özeti)
 * Kullanım: node scripts/agency/website-leads.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (p) => { try { const d = JSON.parse(readFileSync(join(ROOT, p), 'utf8')); return d.items || d; } catch { return []; } };
// Gerçek KENDİ sitesi mi? (aggregator/sosyal/harita linki sayılmaz)
const isOwnSite = (w) => w && /^https?:\/\//.test(w) && !/kalkanyemek|instagram\.com|facebook\.com|google\.|goo\.gl|maps\.|wa\.me|linktr|\.gov/i.test(w);
const realPhotos = (b) => (b.gallery || []).filter((p) => p && existsSync(join(ROOT, p.replace(/^\//, ''))));

function collect() {
  const out = [];
  for (const [file, seg] of [['data/restoranlar.json', 'restoran/kafe/bar'], ['data/oteller.json', 'otel']]) {
    for (const b of load(file)) {
      if (isOwnSite(b.website)) continue; // sitesi VAR → lead değil
      const photos = realPhotos(b);
      out.push({
        name: b.name, segment: seg, category: b.category || '', cuisine: b.cuisine || '',
        rating: b.rating || 0, reviewCount: b.reviewCount || 0,
        phone: b.phone || '', instagram: b.instagram || '', location: b.location || 'Kalkan',
        photoCount: photos.length, photos: photos.slice(0, 8),
        summary: (b.summary || '').slice(0, 240), slug: b.slug || b.id,
      });
    }
  }
  // Lead skoru: puan + foto + yorum + ulaşılabilirlik → en değerli önce
  for (const l of out) {
    l.score = +(
      (l.rating || 0) * 2 +
      Math.min(l.photoCount, 10) * 0.6 +
      Math.log10((l.reviewCount || 0) + 1) * 1.5 +
      (l.phone ? 1.5 : 0) + (l.instagram ? 0.5 : 0)
    ).toFixed(2);
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function main() {
  const leads = collect();
  const ready = leads.filter((l) => l.photoCount >= 1 && (l.phone || l.instagram));
  const meta = {
    generatedAt: new Date().toISOString(),
    total: leads.length,
    ready: ready.length,
    note: 'KENDİ web sitesi olmayan işletmeler. ready = fotolu + iletişimli (site hemen kurulabilir, işletmeye ulaşılabilir).',
    tiers: {
      sicak: ready.filter((l) => l.rating >= 4.5 && l.photoCount >= 3).length,
      iyi: ready.filter((l) => l.rating >= 4.3).length,
    },
  };
  mkdirSync(join(ROOT, 'data', 'agency'), { recursive: true });
  writeFileSync(join(ROOT, 'data', 'agency', 'website-leads.json'), JSON.stringify({ meta, leads }, null, 2), 'utf8');

  console.log('═══ WEB SİTESİ SATIŞ HATTI ═══');
  console.log(`Sitesi olmayan işletme: ${meta.total} · siteye hazır (foto+iletişim): ${meta.ready}`);
  console.log(`🔥 SICAK lead (4.5★+ & 3+ foto): ${meta.tiers.sicak} · 👍 iyi (4.3★+): ${meta.tiers.iyi}`);
  console.log('\nEN İYİ 12 LEAD (önce bunları ara):');
  for (const l of ready.slice(0, 12)) {
    console.log(`  ${String(l.score).padStart(5)} · ${l.rating}★ ${String(l.photoCount).padStart(2)}foto · ${l.phone ? '📞' : '  '}${l.instagram ? 'IG' : '  '} · ${l.name}`);
  }
  console.log(`\n✓ data/agency/website-leads.json (${meta.total} lead)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
