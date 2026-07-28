#!/usr/bin/env node
/**
 * _add-beaches-20260728.mjs — 9 yeni plajı plajlar.json'a ekle + IG görsellerini çek.
 * Fiyatlar: yoldakikiki (IG) · Berkay listesi (2026-07-28). Görseli olan 4 plaj için IG business_discovery.
 * Görselsizler needsReview:true + image:null (sonra Google/manuel).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}
const GRAPH = 'https://graph.facebook.com/v21.0';
const IG_ID = process.env.IG_BUSINESS_ID, TOKEN = process.env.IG_LONG_LIVED_TOKEN;
const U = '2026-07-28', SRC = 'yoldakikiki (IG) · Berkay';
const PHOTO_REL = 'assets/img/plaj-ig';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function photoName(u, permalink, i) {
  let h = 0; const s = String(permalink || u); for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0;
  return `${u.replace(/[^a-z0-9]/gi, '').slice(0, 20)}-${Math.abs(h).toString(36)}.jpg`;
}
async function dl(url, u, permalink, mediaType) {
  if (!url || !/image|carousel/i.test(String(mediaType || ''))) return null;
  const rel = `${PHOTO_REL}/${photoName(u, permalink)}`; const abs = join(ROOT, rel);
  try {
    if (existsSync(abs)) return `/${rel}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok || !/image\//.test(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer()); if (buf.length < 1200) return null;
    await mkdir(join(ROOT, PHOTO_REL), { recursive: true }); await writeFile(abs, buf); return `/${rel}`;
  } catch { return null; }
}
async function igPhotos(username, max = 4) {
  if (!IG_ID || !TOKEN) return [];
  const fields = `business_discovery.username(${username}){media.limit(8){media_url,permalink,media_type}}`;
  try {
    const res = await fetch(`${GRAPH}/${IG_ID}?fields=${encodeURIComponent(fields)}&access_token=${TOKEN}`, { signal: AbortSignal.timeout(20000) });
    const data = await res.json(); if (data.error) { console.log(`   ⊘ @${username}: ${data.error.message.slice(0, 60)}`); return []; }
    const out = [];
    for (const m of (data.business_discovery?.media?.data || [])) { if (out.length >= max) break; const img = await dl(m.media_url, username, m.permalink, m.media_type); if (img) out.push(img); }
    return out;
  } catch (e) { console.log(`   ⊘ @${username}: ${String(e.message).slice(0, 60)}`); return []; }
}

// 9 yeni plaj
const NEW = [
  { id: 'derya-beach', name: 'Derya Beach', category: 'Beach Club', region: 'Kaş', ig: null,
    pricing: { sunbed: null, umbrella: null, entry: null, minSpend: null, mandatory: false, note: 'Giriş ücreti yok; içeride yaptığınız harcama üzerinden ödeme (fiyatlandırma revize edilecek)' },
    summary: 'Kaş bölgesinde giriş ücreti olmayan, harcama bazlı bir plaj kulübü.' },
  { id: 'leymona-beach', name: 'Leymona Beach', category: 'Beach Club', region: 'Kaş', ig: null,
    pricing: { sunbed: null, umbrella: null, entry: null, minSpend: '1500 TL', mandatory: false, note: '1500 TL harcama limiti' },
    summary: 'Kaş bölgesinde harcama limitli bir plaj kulübü.' },
  { id: 'kas-kamping', name: 'Kaş Kamping', category: 'Kamp & Plaj', region: 'Kaş', ig: null,
    pricing: { sunbed: 'dahil', umbrella: 'dahil', entry: '500 TL', minSpend: null, mandatory: false, note: 'Giriş 500 TL; şezlong+şemsiye dahil' },
    summary: 'Kaş merkeze yakın, çam ağaçları altında kamp ve deniz imkânı sunan tarihi plaj alanı.' },
  { id: 'doria-beach', name: 'Doria Beach', category: 'Beach Club', region: 'Kaş', ig: null,
    pricing: { sunbed: null, umbrella: null, entry: '1500 TL', minSpend: null, mandatory: true, note: 'Sadece giriş ücreti 1500 TL' },
    summary: 'Kaş bölgesinde giriş ücretli premium bir plaj kulübü.' },
  { id: 'denizim-beach', name: 'Denizim Beach', category: 'Beach Club', region: 'Kalkan', ig: 'denizim_beach_speedboat_tour',
    pricing: { sunbed: '500 TL', umbrella: 'dahil', entry: null, minSpend: null, mandatory: false, note: 'Şezlong 500 TL, şemsiye dahil' },
    summary: 'Kalkan\'da şezlong-şemsiye ve tekne turu imkânı sunan plaj kulübü.' },
  { id: 'palm-beach-kalkan', name: 'Palm Beach Club', category: 'Beach Club', region: 'Kalkan', ig: 'palmbeachclubkalkan',
    pricing: { sunbed: '600 TL', umbrella: 'dahil', entry: null, minSpend: null, mandatory: false, note: 'Şezlong 600 TL, şemsiye dahil' },
    summary: 'Kalkan\'da palmiyeler eşliğinde deniz keyfi sunan plaj kulübü.' },
  { id: 'cakil-beach-club', name: 'Çakıl Beach Club', category: 'Beach Club', region: 'Kalkan', ig: 'cakilbeach_kalkan',
    pricing: { sunbed: '500 TL', umbrella: 'dahil', entry: null, minSpend: null, mandatory: false, note: 'Şezlong 500 TL, şemsiye dahil. Küçük Çakıl koyundaki ticari plaj kulübü.' },
    summary: 'Kalkan Küçük Çakıl koyunda konumlanan ticari plaj kulübü — şezlong, şemsiye ve bar hizmeti.' },
  { id: 'kalkan-beach-park', name: 'Kalkan Beach Park', category: 'Beach Club', region: 'Kalkan', ig: 'kalkanbeachpark',
    pricing: { sunbed: '750 TL', umbrella: 'dahil', entry: null, minSpend: null, mandatory: false, note: 'Şezlong 750 TL, şemsiye dahil. Haftalık DJ/canlı müzik programı var.' },
    summary: 'Kalkan\'da şezlong-şemsiye ve haftalık DJ/canlı müzik (One & Only Beach) programı sunan plaj kulübü.' },
  { id: 'kalkan-halk-plaji', name: 'Kalkan Halk Plajı', category: 'Halk plajı', region: 'Kalkan', ig: null,
    pricing: { sunbed: '200 TL', umbrella: '200 TL', entry: null, minSpend: null, mandatory: false, note: 'Şezlong/şemsiye almak zorunlu değil' },
    summary: 'Kalkan merkezde herkese açık halk plajı; şezlong ve şemsiye ücretli ama zorunlu değil.' },
];

async function main() {
  const path = join(ROOT, 'data', 'plajlar.json');
  const j = JSON.parse(await readFile(path, 'utf8'));
  const arr = j.items || j;
  const have = new Set(arr.map(x => x.id));
  let added = 0;
  for (const b of NEW) {
    if (have.has(b.id)) { console.log(`= ${b.name} zaten var, atlandı`); continue; }
    let gallery = [];
    if (b.ig) { console.log(`  📷 @${b.ig} görselleri çekiliyor...`); gallery = await igPhotos(b.ig); await sleep(500); }
    const entry = {
      id: b.id, name: b.name, category: b.category, region: b.region,
      tags: [], image: gallery[0] || null, gallery,
      rating: null, distance: b.region === 'Kaş' ? 'Kaş bölgesi' : 'Kalkan bölgesi', drive: null,
      summary: b.summary,
      paid: !!(b.pricing.entry || b.pricing.minSpend),
      instagram: b.ig ? `https://www.instagram.com/${b.ig}` : null,
      pricing: { ...b.pricing, source: SRC, updated: U },
      source: 'berkay-fiyat-listesi', needsReview: true, addedAt: U,
    };
    arr.push(entry);
    added++;
    console.log(`✓ ${b.name} (${b.region}) | ${gallery.length} foto | ${entry.paid ? 'ücretli' : 'halk/serbest'}`);
  }
  await writeFile(path, JSON.stringify(j, null, 2));
  console.log(`\n→ ${added} yeni plaj eklendi. Toplam: ${arr.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
