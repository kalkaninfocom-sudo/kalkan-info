#!/usr/bin/env node
/**
 * scripts/agency/fb-page-harvest.mjs — FACEBOOK SAYFA GÖNDERİLERİNİ HABER SEPETİNE BESLE
 * -------------------------------------------------------------------------------------------------
 * IG hasadının Facebook kardeşi. Graph API ile bir SAYFA'nın gönderilerini (message + tarih + link)
 * okur → aynı sinyal dosyasına (data/ig-venue-news.json) ekler → ig-news-harvest.mjs onları da
 * 3-kararlı + psikoloji/marka/yerleştirme kapısından geçirir → sepetler.
 *
 * DÜRÜST KISIT: Graph API bir sayfanın gönderisini yalnızca (a) o sayfayı YÖNETİYORSAN (Page Token),
 *   veya (b) "Page Public Content Access" app-onayın varsa okur. Yoksa o sayfa graceful atlanır.
 *   Varsayılan: FB_PAGE_ID (senin kendi sayfan, FB_PAGE_TOKEN ile). Başka sayfalar --pages ile denenir.
 *
 * Kullanım:
 *   node scripts/agency/fb-page-harvest.mjs                 # FB_PAGE_ID sayfasını oku → sinyal ekle
 *   node scripts/agency/fb-page-harvest.mjs --pages 123,456 # bu sayfa id'lerini de dene (erişim varsa)
 *   node scripts/agency/fb-page-harvest.mjs --limit 8       # sayfa başına gönderi (varsayılan 10)
 *   node scripts/agency/fb-page-harvest.mjs --dry           # sadece göster, dosyaya yazma
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry');
const LIMIT = (() => { const i = ARGS.indexOf('--limit'); return i >= 0 && /^\d+$/.test(ARGS[i + 1] || '') ? Number(ARGS[i + 1]) : 10; })();
const EXTRA_PAGES = (() => { const i = ARGS.indexOf('--pages'); return i >= 0 && ARGS[i + 1] ? ARGS[i + 1].split(',').map(s => s.trim()).filter(Boolean) : []; })();

// .env.local yükle (secret loglanmaz)
const env = { ...process.env };
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const GRAPH = 'https://graph.facebook.com/v21.0';
const PAGE_ID = env.FB_PAGE_ID;
const TOKEN = env.FB_PAGE_TOKEN || env.FB_SYSTEM_USER_TOKEN;

async function readJson(rel, fb) { try { return JSON.parse(await readFile(join(ROOT, rel), 'utf8')); } catch { return fb; } }

// Bir sayfanın adını çek (etiket için)
async function pageName(id) {
  try {
    const r = await fetch(`${GRAPH}/${id}?fields=name&access_token=${TOKEN}`, { signal: AbortSignal.timeout(15000) });
    const d = await r.json(); return d.name || id;
  } catch { return id; }
}

// Bir sayfanın son gönderileri → sinyal[]  (erişim yoksa null → graceful skip)
async function fetchPagePosts(id) {
  const fields = `message,created_time,permalink_url`;
  const url = `${GRAPH}/${id}/posts?fields=${encodeURIComponent(fields)}&limit=${LIMIT}&access_token=${TOKEN}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const d = await r.json();
    if (d.error) { console.warn(`  ⚠ @${id} okunamadı: ${d.error.message} (atlandı)`); return null; }
    return d.data || [];
  } catch (e) { console.warn(`  ⚠ @${id} hata: ${e.message} (atlandı)`); return null; }
}

async function main() {
  console.log('\n════ FB SAYFA HASADI ════');
  if (!TOKEN) { console.warn('⚠ FB_PAGE_TOKEN yok — FB hasadı atlandı (non-fatal).'); return; }
  if (!PAGE_ID && !EXTRA_PAGES.length) { console.warn('⚠ FB_PAGE_ID yok ve --pages verilmedi — atlandı.'); return; }

  const ids = [...(PAGE_ID ? [PAGE_ID] : []), ...EXTRA_PAGES];
  const news = await readJson('data/ig-venue-news.json', { items: [] });
  const items = news.items || [];
  const seen = new Set(items.map(i => i.permalink).filter(Boolean));

  const fresh = [];
  for (const id of ids) {
    const name = await pageName(id);
    const posts = await fetchPagePosts(id);
    if (!posts) continue;
    let n = 0;
    for (const p of posts) {
      const msg = (p.message || '').trim();
      const link = p.permalink_url || '';
      if (!msg || msg.length < 25) continue;         // boş/çok kısa gönderi = sinyal değil
      if (!link || seen.has(link)) continue;
      fresh.push({
        venueName: name,
        username: id,
        category: 'fb-sayfa',
        headline: msg.replace(/\s+/g, ' ').slice(0, 400),
        permalink: link,
        timestamp: p.created_time || '',
        _origin: 'fb-page',
      });
      seen.add(link); n++;
    }
    console.log(`  ✓ ${name} — ${n} yeni gönderi sinyali`);
  }

  console.log(`\nToplam ${fresh.length} yeni FB sinyali.`);
  if (DRY) { console.log('[dry] yazılmadı.\n', JSON.stringify(fresh, null, 2)); return; }
  if (!fresh.length) { console.log('Yeni sinyal yok — ig-venue-news.json değişmedi.'); return; }

  news.items = [...fresh, ...items];
  news.updated = new Date().toISOString().slice(0, 10);
  await writeFile(join(ROOT, 'data', 'ig-venue-news.json'), JSON.stringify(news, null, 2));
  console.log(`✓ ${fresh.length} FB sinyali → data/ig-venue-news.json → ig-news-harvest.mjs kapıdan geçirecek.`);
}

main().catch(e => { console.error('[fb-page-harvest]', e.message); process.exit(1); });
