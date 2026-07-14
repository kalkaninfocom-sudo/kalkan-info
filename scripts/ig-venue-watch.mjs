#!/usr/bin/env node
/**
 * scripts/ig-venue-watch.mjs — IG KÜRATÖRLÜ MEKAN İZLEME → HABER (Faz 3)
 * ---------------------------------------------------------------------------------
 * AMAÇ: Kalkan mekanlarının PUBLIC Instagram gönderilerinden (görsel + caption + tarih)
 *       haber içeriği hammaddesi topla. Editöryal/gazete katmanı bunu ek kaynak alabilir.
 *
 * DÜRÜST KISIT: IG Graph API keyfi takip edilen hesapları OKUYAMAZ. Yalnız `business_discovery`
 *   ile PUBLIC Business/Creator hesabı KULLANICI ADIYLA sorgulanabilir. "Video izleme" YOK —
 *   caption + media_url + timestamp + tür okunur. Bu yüzden küratörlü kullanıcı-adı listesi
 *   (data/ig-watch-accounts.json) kullanılır. Hedef hesap public business değilse → graceful skip.
 *
 * AKIŞ:
 *   1) data/ig-watch-accounts.json'daki active hesaplar için business_discovery çağır (son 6 gönderi).
 *   2) YENİ gönderileri (permalink dedup) data/ig-venue-intake.json'a ekle.
 *   3) (opsiyonel, varsayılan AÇIK) intake'teki YENİ "haber değeri olan" gönderileri cheapLLM ile
 *      KISA olgusal haber cümlesine çevir → data/ig-venue-news.json. Uydurma YOK; sadece caption.
 *
 * KISIT: Vercel api/*.js 12/12 + cron 2/2 DOLU → YENİ api/cron YOK. Bu script scheduler.mjs
 *   (data/agency/schedule.json, type:script) veya GitHub Actions ile tetiklenir.
 *
 * Kullanım:
 *   node scripts/ig-venue-watch.mjs                 # active hesapları tara + haber taslağı üret
 *   node scripts/ig-venue-watch.mjs --no-news       # sadece intake, haber taslağı üretme
 *   node scripts/ig-venue-watch.mjs --probe user1,user2   # listeyi atla, bu hesapları test et (JSON'a yazmadan)
 *   node scripts/ig-venue-watch.mjs --limit 4       # hesap başına gönderi limiti (varsayılan 6)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── IG foto İNDİRİCİ (Berkay: "IG görsellerini gazetede kullanın") ──
// IG CDN media_url'leri SÜRELİ (token birkaç saatte patlar) → gazetede doğrudan kullanılamaz.
// Bu yüzden URL TAZE iken (fetch anında) indirip kendi assets'imize koyuyoruz; gazete lokal
// (kalıcı, mutlak) yolu kullanır. Yalnız FOTO (image/carousel); video atlanır. Non-fatal.
const IG_PHOTO_REL = 'assets/img/ig-venue';
function igPhotoName(username, permalink) {
  let h = 0; const s = String(permalink || username || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${String(username || 'venue').replace(/[^a-z0-9]/gi, '').slice(0, 24)}-${Math.abs(h).toString(36)}.jpg`;
}
async function downloadIgPhoto(url, username, permalink, mediaType) {
  if (!url) return null;
  if (!/image|carousel/i.test(String(mediaType || ''))) return null; // video/other → atla
  const name = igPhotoName(username, permalink);
  const rel = `${IG_PHOTO_REL}/${name}`;
  const abs = join(ROOT, rel);
  const publicUrl = `https://kalkaninfo.com/${rel}`;
  try {
    if (existsSync(abs)) return publicUrl;                    // idempotent
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) return null;
    if (!/image\//.test(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1200) return null;                      // bozuk/çok küçük → atla
    await mkdir(join(ROOT, IG_PHOTO_REL), { recursive: true });
    await writeFile(abs, buf);
    return publicUrl;
  } catch { return null; }
}

// ── .env.local yükle (yerel çalıştırma; CI'da env zaten dolu) ──
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const GRAPH = 'https://graph.facebook.com/v21.0';
const IG_ID = process.env.IG_BUSINESS_ID;
const TOKEN = process.env.IG_LONG_LIVED_TOKEN;

const ARGS = process.argv.slice(2);
const NO_NEWS = ARGS.includes('--no-news');
const probeArg = ARGS[ARGS.indexOf('--probe') + 1];
const PROBE = ARGS.includes('--probe') && probeArg ? probeArg.split(',').map(s => s.trim()).filter(Boolean) : null;
const limArg = ARGS[ARGS.indexOf('--limit') + 1];
const LIMIT = ARGS.includes('--limit') && /^\d+$/.test(limArg || '') ? Number(limArg) : 6;

const ACCOUNTS_PATH = join(ROOT, 'data', 'ig-watch-accounts.json');
const INTAKE_PATH = join(ROOT, 'data', 'ig-venue-intake.json');
const NEWS_PATH = join(ROOT, 'data', 'ig-venue-news.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── business_discovery: tek PUBLIC business/creator hesabının son gönderileri ──
// Başarı → { followers, media[] } · public değil / hata → null (graceful).
async function discover(username) {
  const fields = `business_discovery.username(${username}){followers_count,media.limit(${LIMIT})` +
    `{caption,media_url,permalink,timestamp,media_type,like_count}}`;
  const url = `${GRAPH}/${IG_ID}?fields=${encodeURIComponent(fields)}&access_token=${TOKEN}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const data = await res.json();
    if (!res.ok || data.error) {
      // Tipik: hedef public business değil (#110/#100) → sessiz skip; başka hata → kısa logla.
      const msg = data?.error?.message || `HTTP ${res.status}`;
      return { ok: false, reason: msg.slice(0, 120) };
    }
    const bd = data.business_discovery;
    if (!bd) return { ok: false, reason: 'business_discovery boş' };
    return { ok: true, followers: bd.followers_count ?? null, media: bd.media?.data || [] };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 120) };
  }
}

async function loadJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

// ── "Haber değeri" sinyali: caption'da açılış/etkinlik/kampanya/tarih/menü ipucu ──
const NEWSY_RX = /(açıl|opening|open now|yeni|new|etkinlik|event|canlı|live|konser|dj|party|parti|festival|kampanya|indirim|discount|offer|özel|special|menü|menu|rezervasyon|reservation|bu akşam|tonight|bu hafta|this week|yarın|tomorrow|\bpazar\b|\bcumartesi\b|\b\d{1,2}\s?(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\b\d{1,2}[:.]\d{2}\b)/i;

function isNewsy(caption) {
  return !!caption && NEWSY_RX.test(caption);
}

async function main() {
  console.log(`\n════ IG MEKAN İZLEME — ${new Date().toISOString()} ════`);
  if (!IG_ID || !TOKEN) {
    console.warn('⚠ IG_BUSINESS_ID / IG_LONG_LIVED_TOKEN yok → atlandı (non-fatal).');
    return;
  }

  // Hesap listesi (veya --probe ile geçici liste)
  let accounts;
  if (PROBE) {
    accounts = PROBE.map(u => ({ username: u, name: u, category: 'probe', active: true }));
    console.log(`  PROBE modu: ${PROBE.join(', ')} (JSON'a yazılmaz)`);
  } else {
    const cfg = await loadJson(ACCOUNTS_PATH, { accounts: [] });
    accounts = (cfg.accounts || []).filter(a => a.active && a.username);
    console.log(`  ${accounts.length} active hesap taranıyor (toplam ${cfg.accounts?.length || 0} kayıtlı).`);
  }
  if (!accounts.length) { console.warn('⚠ İzlenecek active hesap yok. active:true yap veya --probe kullan.'); return; }

  const intake = await loadJson(INTAKE_PATH, { items: [], updatedAt: null });
  const seen = new Set((intake.items || []).map(i => i.permalink).filter(Boolean));

  const succeeded = [];
  const skipped = [];
  const fresh = [];

  for (const acc of accounts) {
    const r = await discover(acc.username);
    if (!r.ok) {
      skipped.push({ username: acc.username, reason: r.reason });
      console.log(`  ⊘ @${acc.username} — atlandı (${r.reason})`);
      await sleep(600); // rate-limit dostu
      continue;
    }
    let newForAcc = 0;
    for (const m of r.media) {
      if (!m.permalink || seen.has(m.permalink)) continue;
      seen.add(m.permalink);
      // Foto TAZE URL iken indir → kalıcı lokal yol (gazete bunu kullanır). Video → null.
      const image = await downloadIgPhoto(m.media_url, acc.username, m.permalink, m.media_type);
      const item = {
        username: acc.username,
        venueName: acc.name || acc.username,
        category: acc.category || null,
        caption: m.caption || '',
        media_url: m.media_url || null,
        image, // kalıcı lokal foto (https://kalkaninfo.com/assets/img/ig-venue/...) veya null
        permalink: m.permalink,
        timestamp: m.timestamp || null,
        media_type: m.media_type || null,
        like_count: m.like_count ?? null,
        fetchedAt: new Date().toISOString(),
      };
      intake.items.push(item);
      fresh.push(item);
      newForAcc++;
    }
    succeeded.push({ username: acc.username, followers: r.followers, total: r.media.length, fresh: newForAcc });
    console.log(`  ✓ @${acc.username} — ${r.media.length} gönderi (${newForAcc} yeni), ${r.followers ?? '?'} takipçi`);
    await sleep(600);
  }

  // intake'i büyümeye karşı sınırla (son 500 gönderi yeter)
  if (intake.items.length > 500) intake.items = intake.items.slice(-500);
  intake.updatedAt = new Date().toISOString();

  if (!PROBE) {
    await writeFile(INTAKE_PATH, JSON.stringify(intake, null, 2));
    console.log(`\n→ ${fresh.length} YENİ gönderi → data/ig-venue-intake.json (toplam ${intake.items.length})`);
  } else {
    console.log(`\n[PROBE] ${fresh.length} yeni gönderi bulundu (yazılmadı).`);
  }

  console.log(`  Başarılı: ${succeeded.map(s => '@' + s.username).join(', ') || '(yok)'}`);
  console.log(`  Atlandı : ${skipped.map(s => '@' + s.username).join(', ') || '(yok)'}`);

  // ── Haber taslağı (cheapLLM, olgusal) ──
  if (!NO_NEWS && !PROBE && fresh.length) {
    const newsy = fresh.filter(i => isNewsy(i.caption));
    if (newsy.length) {
      console.log(`\n  ${newsy.length} gönderi haber-değeri sinyali taşıyor → cheapLLM ile taslak...`);
      await draftNews(newsy);
    } else {
      console.log('\n  Yeni gönderilerde haber-değeri sinyali yok — taslak üretilmedi.');
    }
  }

  console.log('════ TAMAM ════\n');
}

// ── Yeni haber-değerli gönderileri KISA olgusal haber cümlesine çevir → ig-venue-news.json ──
async function draftNews(items) {
  let cheapLLM;
  try {
    ({ cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href));
  } catch (e) {
    console.warn('  ⚠ cheap-llm yüklenemedi — haber taslağı atlandı:', String(e.message || e).slice(0, 80));
    return;
  }

  const news = await loadJson(NEWS_PATH, { items: [], updatedAt: null });
  const seenNews = new Set((news.items || []).map(n => n.permalink).filter(Boolean));

  const SYSTEM =
    'Sen Kalkan Today gazetesi için yerel mekan haberlerini derleyen editörsün. ' +
    'Sana bir Instagram gönderisinin caption\'ı ve mekan adı verilir. ' +
    'OLGUSAL, tek cümlelik, abartısız bir haber cümlesi üret (haber-ajansı tonu). ' +
    'ASLA caption\'da OLMAYAN olgu/tarih/rakam/isim UYDURMA. Emin değilsen genel kal. ' +
    'Reklam/emoji/hashtag tonundan arındır. Türkçe. Sadece cümleyi döndür, tırnak/etiket yok.';

  let added = 0;
  for (const it of items) {
    if (seenNews.has(it.permalink)) continue;
    const cap = (it.caption || '').replace(/\s+/g, ' ').slice(0, 500);
    if (!cap) continue;
    try {
      const { text, provider } = await cheapLLM(
        `Mekan: ${it.venueName} (${it.category || 'mekan'})\nGönderi caption:\n"""${cap}"""\n\n` +
        'Bu gönderiden Kalkan tatilcisi için tek cümlelik olgusal haber cümlesi yaz (max 20 kelime).',
        { system: SYSTEM, maxTokens: 120, temperature: 0.3, order: ['ollama', 'groq', 'cerebras', 'nvidia', 'gemini', 'claude'] }
      );
      const sentence = String(text || '').trim().replace(/^["'`]|["'`]$/g, '');
      if (!sentence) continue;
      news.items.push({
        headline: sentence,
        venueName: it.venueName,
        username: it.username,
        category: it.category || null,
        permalink: it.permalink,
        media_url: it.media_url,
        image: it.image || null, // kalıcı lokal foto → gazete/magazin bunu kullanır
        timestamp: it.timestamp,
        provider,
        draftedAt: new Date().toISOString(),
      });
      seenNews.add(it.permalink);
      added++;
      console.log(`    • @${it.username}: ${sentence.slice(0, 80)}`);
    } catch (e) {
      console.warn(`    ⚠ @${it.username} taslak hatası:`, String(e.message || e).slice(0, 80));
    }
  }

  if (added) {
    if (news.items.length > 300) news.items = news.items.slice(-300);
    news.updatedAt = new Date().toISOString();
    await writeFile(NEWS_PATH, JSON.stringify(news, null, 2));
    console.log(`  → ${added} haber cümlesi → data/ig-venue-news.json (toplam ${news.items.length})`);
  } else {
    console.log('  Yeni haber cümlesi üretilmedi.');
  }
}

main().catch(e => { console.error('[ig-venue-watch]', e); process.exit(0); }); // non-fatal: bozma
