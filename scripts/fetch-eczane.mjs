// scripts/fetch-eczane.mjs
// Antalya Eczacı Odası'ndan Kaş ilçesi nöbetçi eczane listesini çeker,
// Kalkan'daki eczaneyi tespit edip data/eczane.json'a yazar.
//
// Vercel build sırasında çalışır (vercel.json buildCommand).
// Vercel cron her gün deploy tetikleyince güncel veri canlıya çıkar.
//
// Hata durumunda mevcut data/eczane.json'a dokunmaz (graceful degrade).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'data', 'eczane.json');
const SOURCE_URL = 'https://www.antalyaeo.org.tr/tr/nobetci-eczaneler';

function log(...a) { console.log('[fetch-eczane]', ...a); }
function warn(...a) { console.warn('[fetch-eczane]', ...a); }

async function fetchHtml() {
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KalkanInfoBot/1.0)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// Kaş ilçesinin <div class="ilce"> bloğunu çıkar — sonraki "ilce" başlığına kadar
function extractKasBlock(html) {
  const kasIdx = html.search(/<span>\s*Kaş\s*<\/span>/i);
  if (kasIdx === -1) throw new Error('Kaş bloğu bulunamadı');
  // sonraki <div class="ilce"> başlangıcına kadar al
  const after = html.slice(kasIdx);
  const nextIlceIdx = after.search(/<div class="ilce">/i);
  return nextIlceIdx === -1 ? after : after.slice(0, nextIlceIdx);
}

// Bloktan eczane kayıtlarını çıkar
function parseEczaneList(block) {
  const items = [];
  const nesneRegex = /<div class="nesne row nobetciDiv[^>]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let m;
  while ((m = nesneRegex.exec(block)) !== null) {
    const chunk = m[1];

    const nameMatch = chunk.match(/<a[^>]*href="tel:[^"]*"[^>]*>([^<]+)<\/a>/i);
    const phoneMatch = chunk.match(/<a[^>]*href="tel:([^"]+)"[^>]*>\s*0\([^)]*\)[^<]*<\/a>/i);
    const addrMatch = chunk.match(/<a[^>]*class="nadres"[^>]*>[\s\S]*?>\s*([^<]+?)\s*<\/a>/i);
    const geoMatch = chunk.match(/maps\.google\.com\/maps\?q=([\d.]+),([\d.]+)/i);

    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    const phoneRaw = (phoneMatch?.[1] || '').replace(/[^\d]/g, '');
    const address = (addrMatch?.[1] || '').replace(/\s+/g, ' ').trim();
    const lat = geoMatch ? parseFloat(geoMatch[1]) : null;
    const lng = geoMatch ? parseFloat(geoMatch[2]) : null;

    items.push({
      name: titleCase(name),
      address,
      phone: formatPhone(phoneRaw),
      phoneRaw,
      mapUrl: lat && lng ? `https://maps.google.com/maps?q=${lat},${lng}` : '',
      lat, lng,
    });
  }
  return items;
}

function formatPhone(raw) {
  if (!raw || raw.length < 10) return '';
  const r = raw.replace(/^0/, '');
  // 2428441138 → +90 242 844 11 38
  if (r.length === 10) {
    return `+90 ${r.slice(0,3)} ${r.slice(3,6)} ${r.slice(6,8)} ${r.slice(8,10)}`;
  }
  return raw;
}

function titleCase(s) {
  // ECZANESİ → Eczanesi, DOĞA → Doğa (Türkçe lowercase için locale-aware)
  return s.toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map(w => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
    .join(' ');
}

function isKalkan(item) {
  // Adres Kalkan içeriyor mu (case-insensitive)
  return /kalkan/i.test(item.address);
}

function todayIstanbul(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

async function main() {
  log('Fetching', SOURCE_URL);
  let html;
  try {
    html = await fetchHtml();
  } catch (e) {
    warn('Fetch failed, mevcut veriye dokunmuyorum:', e.message);
    process.exit(0);
  }

  let kasBlock;
  try {
    kasBlock = extractKasBlock(html);
  } catch (e) {
    warn('Parse failed:', e.message);
    process.exit(0);
  }

  const items = parseEczaneList(kasBlock);
  log(`Kaş ilçesinde ${items.length} nöbetçi bulundu`);
  for (const it of items) log(' -', it.name, '·', it.address.slice(0, 50));

  const kalkan = items.find(isKalkan);
  if (!kalkan) {
    warn('Bugün Kalkan\'da nöbetçi yok. En yakın Kaş ilçesi eczanesini today olarak yazıyorum.');
  }

  const today = kalkan || items[0];
  if (!today) {
    warn('Hiç eczane bulunamadı, mevcut veriye dokunmuyorum.');
    process.exit(0);
  }

  const bugun = todayIstanbul(0);

  // Mevcut JSON'u oku, today'i güncelle, tomorrow'u koru
  let existing = {};
  try { existing = JSON.parse(readFileSync(outPath, 'utf8')); } catch {}

  const next = {
    _meta: {
      title: 'Bugün Nöbetçi Eczane',
      lastUpdated: new Date().toISOString(),
      source: SOURCE_URL,
      note: 'Antalya Eczacı Odası sayfasından otomatik çekilir (her gün 06:00 TR).',
      updated: bugun,
    },
    today: {
      date: bugun,
      name: today.name,
      address: today.address,
      phone: today.phone,
      phoneRaw: today.phoneRaw,
      mapUrl: today.mapUrl,
      hours: '09:00 (kapanış sonrası 24 saat nöbetçi)',
      isKalkan: isKalkan(today),
    },
    // Tomorrow EO sayfasında ayrı yayınlanmıyor — boş bırak veya rotation tahmini
    tomorrow: existing.tomorrow && existing.tomorrow.date > bugun ? existing.tomorrow : {},
    allKasToday: items,  // Kaş ilçesindeki tüm bugün nöbetçileri (3 tane yaklaşık)
    verifiedAt: bugun,
    verifiedBy: 'Antalya Eczacı Odası (otomatik)',
  };

  writeFileSync(outPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  log('✅ Yazıldı:', outPath, '→ today:', today.name);
}

main().catch(err => {
  warn('Beklenmedik hata:', err);
  process.exit(0); // build'i kırma
});
