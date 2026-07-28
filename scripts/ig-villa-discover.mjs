#!/usr/bin/env node
/**
 * scripts/ig-villa-discover.mjs — VILLA ENVANTERİ TASLAK ÜRETİCİ (IG business_discovery)
 * ---------------------------------------------------------------------------------
 * AMAÇ: @kalkan.info'nun takip ettiği villa IG hesaplarından (public business) villalar.json
 *       için TASLAK kayıt üret. Uydurma YOK — yalnız IG name/bio/caption + foto grounded.
 *
 * GÜVENLİ: villalar.json'a DOKUNMAZ. Çıktı → data/villalar-draft.json (Berkay inceler → promote).
 * Foto: TAZE media_url iken indirilir → assets/img/ig-villa/ (kalıcı lokal yol).
 * cheapLLM: bio+caption'dan {tekVilla?, yatakOdasi, kapasite, havuz, denizManzara, konum, ozet}
 *           çıkarır. Emin değilse null. Acente/platform hesapları tekVilla:false ile işaretlenir.
 *
 * Kullanım:
 *   node scripts/ig-villa-discover.mjs                # tüm villa adaylarını tara
 *   node scripts/ig-villa-discover.mjs --limit-accounts 5   # ilk 5 hesap (test)
 *   node scripts/ig-villa-discover.mjs --no-llm      # LLM çıkarımı yapma (sadece ham veri)
 *   node scripts/ig-villa-discover.mjs --photos 4    # villa başına max foto (varsayılan 4)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── .env.local ──
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
const NO_LLM = ARGS.includes('--no-llm');
const laArg = ARGS[ARGS.indexOf('--limit-accounts') + 1];
const LIMIT_ACCOUNTS = ARGS.includes('--limit-accounts') && /^\d+$/.test(laArg || '') ? Number(laArg) : Infinity;
const phArg = ARGS[ARGS.indexOf('--photos') + 1];
const MAX_PHOTOS = ARGS.includes('--photos') && /^\d+$/.test(phArg || '') ? Number(phArg) : 4;

const DRAFT_PATH = join(ROOT, 'data', 'villalar-draft.json');
const PHOTO_REL = 'assets/img/ig-villa';

// ── Villa adayları (2026-07-28 following analizinden — DB'de olmayan) ──
const CANDIDATES = [
  'bizimvilla','buvilla','delphinvillas','kalkan_villa','kalkannirvanarent','kalkanserenityvillas',
  'kalkanvillas','kalkanvillasimsek','kayaapartments','kozyholiday','kransalvillalari','likyakaryavillas',
  'likyavillam','lovevillasevgi','mehmetapartkas','mulberrysuitaparts','myvillacity','nurvilla07',
  'seninvillan','teramareholidays','villa.sura','villa_bahce','villa_erdem','villa_everestt','villa_henna',
  'villa_karma_kalkan','villa_lidya','villa_velis','villa_yigit07','villaaras','villabahcekalkan','villacentam',
  'villacim','villaciniz','villaerdem','villaeternity','villagervivi','villagezegeni','villahazirann',
  'villahuzuruzumlu','villainci_mercan','villakalkan','villaladinn','villandvilla','villanizburadacom',
  'villapaketi','villapuhu','villarentalkalkan','villasepeti','villasunsetkalkan','villatatilinde',
  'zeinapataravillas','cinarapartkalkan','butterflyholidays.co.uk',
];

const slugify = (u) => u.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function photoName(username, permalink) {
  let h = 0; const s = String(permalink || username || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${username.replace(/[^a-z0-9]/gi, '').slice(0, 24)}-${Math.abs(h).toString(36)}.jpg`;
}
async function downloadPhoto(url, username, permalink, mediaType) {
  if (!url || !/image|carousel/i.test(String(mediaType || ''))) return null;
  const rel = `${PHOTO_REL}/${photoName(username, permalink)}`;
  const abs = join(ROOT, rel);
  const publicUrl = `/${rel}`;
  try {
    if (existsSync(abs)) return publicUrl;
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok || !/image\//.test(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1200) return null;
    await mkdir(join(ROOT, PHOTO_REL), { recursive: true });
    await writeFile(abs, buf);
    return publicUrl;
  } catch { return null; }
}

// ── business_discovery: zengin alanlar ──
async function discover(username) {
  const fields = `business_discovery.username(${username}){name,biography,website,followers_count,media_count,profile_picture_url,` +
    `media.limit(8){caption,media_url,permalink,media_type,timestamp,like_count}}`;
  const url = `${GRAPH}/${IG_ID}?fields=${encodeURIComponent(fields)}&access_token=${TOKEN}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const data = await res.json();
    if (!res.ok || data.error) return { ok: false, reason: (data?.error?.message || `HTTP ${res.status}`).slice(0, 120) };
    const bd = data.business_discovery;
    if (!bd) return { ok: false, reason: 'business_discovery boş' };
    return { ok: true, bd };
  } catch (e) { return { ok: false, reason: String(e.message || e).slice(0, 120) }; }
}

// ── heuristik: acente/platform mı? ──
function looksAgency(username, bd) {
  const u = username.toLowerCase();
  if (/(sepeti|paketi|nizburadacom|villavillam|rentalkalkan|myvillacity|holidays|kozyholiday|butterflyholidays|teramare)/.test(u)) return true;
  if ((bd.followers_count || 0) > 20000) return true; // tek villa 20k+ takipçi nadir
  return false;
}

async function extractAttrs(cheapLLM, bd, username) {
  const bio = (bd.biography || '').replace(/\s+/g, ' ').slice(0, 400);
  const caps = (bd.media?.data || []).map(m => (m.caption || '').replace(/\s+/g, ' ')).filter(Boolean).slice(0, 4).join(' ||| ').slice(0, 900);
  const SYSTEM = 'Sen bir emlak veri çıkarım asistanısın. Sana bir Kalkan villa/kiralık konaklama Instagram hesabının adı, bio ve gönderi caption\'ları verilir. ' +
    'SADECE metinde AÇIKÇA geçen bilgiyi çıkar. Emin değilsen null bırak — ASLA uydurma. ' +
    'Yanıtı SADECE şu JSON şemasıyla ver: {"tekVilla":true|false,"yatakOdasi":sayı|null,"kapasite":"X kişi"|null,"havuz":true|false|null,"denizManzara":true|false|null,"konum":"...":null,"ozet":"tek cümle olgusal Türkçe özet"}. ' +
    'tekVilla: hesap tek bir villayı mı temsil ediyor (true) yoksa çok-villa acente/platform mu (false). ozet: reklam/emoji arındırılmış, caption\'a dayalı, max 22 kelime.';
  const { text } = await cheapLLM(
    `Hesap: @${username}\nAd: ${bd.name || ''}\nBio: ${bio}\nCaptionlar: ${caps}`,
    { system: SYSTEM, json: true, maxTokens: 220, temperature: 0.2, order: ['ollama', 'groq', 'cerebras', 'nvidia', 'gemini', 'claude'] }
  );
  try {
    const j = JSON.parse(String(text).replace(/```json|```/g, '').trim());
    return j;
  } catch { return null; }
}

async function main() {
  console.log(`\n════ VILLA DISCOVERY — ${new Date().toISOString()} ════`);
  if (!IG_ID || !TOKEN) { console.error('⚠ IG_BUSINESS_ID / IG_LONG_LIVED_TOKEN yok.'); process.exit(1); }

  let cheapLLM = null;
  if (!NO_LLM) {
    try { ({ cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href)); }
    catch (e) { console.warn('⚠ cheap-llm yüklenemedi, ham modda devam:', String(e.message || e).slice(0, 80)); }
  }

  const list = CANDIDATES.slice(0, LIMIT_ACCOUNTS);
  const drafts = [];
  const skipped = [];
  let idx = 0;

  for (const username of list) {
    idx++;
    process.stdout.write(`  [${idx}/${list.length}] @${username} ... `);
    const r = await discover(username);
    if (!r.ok) { skipped.push({ username, reason: r.reason }); console.log(`⊘ (${r.reason})`); await sleep(500); continue; }
    const bd = r.bd;

    // fotolar (max MAX_PHOTOS image)
    const gallery = [];
    for (const m of (bd.media?.data || [])) {
      if (gallery.length >= MAX_PHOTOS) break;
      const img = await downloadPhoto(m.media_url, username, m.permalink, m.media_type);
      if (img) gallery.push(img);
    }

    let attrs = null;
    if (cheapLLM) { try { attrs = await extractAttrs(cheapLLM, bd, username); } catch {} }
    // LLM placeholder temizliği (bazen şema örneğini literal döndürüyor)
    if (attrs) {
      if (typeof attrs.kapasite === 'string' && /^x\s*kişi$/i.test(attrs.kapasite.trim())) attrs.kapasite = null;
      if (typeof attrs.konum === 'string' && /^\.{3}$|^x+$/i.test(attrs.konum.trim())) attrs.konum = null;
      if (typeof attrs.ozet === 'string') attrs.ozet = attrs.ozet.trim();
      if (attrs.yatakOdasi != null && !(Number.isFinite(+attrs.yatakOdasi) && +attrs.yatakOdasi > 0 && +attrs.yatakOdasi < 15)) attrs.yatakOdasi = null;
    }
    const agency = attrs ? (attrs.tekVilla === false) : looksAgency(username, bd);

    drafts.push({
      id: 'villa-' + slugify(username),
      name: bd.name || username,
      instagram: username,
      type: agency ? 'acente/platform' : 'tek-villa',
      category: 'Taslak',
      bedrooms: attrs?.yatakOdasi ?? null,
      capacity: attrs?.kapasite ?? null,
      pool: attrs?.havuz === true ? 'Özel havuz' : null,
      seaView: attrs?.denizManzara ?? null,
      location: attrs?.konum || 'Kalkan',
      image: gallery[0] || null,
      gallery,
      summary: attrs?.ozet || '',
      website: bd.website || null,
      biography: (bd.biography || '').replace(/\s+/g, ' ').slice(0, 300),
      followers: bd.followers_count ?? null,
      media_count: bd.media_count ?? null,
      permalink: (bd.media?.data?.[0]?.permalink) || `https://instagram.com/${username}`,
      source: 'ig-business_discovery',
      needsReview: true,
      fetchedAt: new Date().toISOString(),
    });
    console.log(`✓ ${bd.name || username} | ${agency ? 'ACENTE' : 'villa'} | ${gallery.length} foto | ${bd.followers_count ?? '?'} tk`);
    await sleep(600);
  }

  const single = drafts.filter(d => d.type === 'tek-villa');
  const agencies = drafts.filter(d => d.type === 'acente/platform');
  const out = {
    _meta: {
      title: 'Villa Taslakları (IG discovery)',
      note: 'ig-villa-discover.mjs çıktısı. needsReview:true. villalar.json\'a promote etmeden önce Berkay inceler.',
      generatedAt: new Date().toISOString(),
      total: drafts.length, tekVilla: single.length, acente: agencies.length, atlanan: skipped.length,
    },
    skipped,
    items: drafts,
  };
  await writeFile(DRAFT_PATH, JSON.stringify(out, null, 2));

  console.log(`\n──────── ÖZET ────────`);
  console.log(`  Taslak üretilen : ${drafts.length}  (tek-villa: ${single.length} | acente/platform: ${agencies.length})`);
  console.log(`  Atlanan (okunamadı): ${skipped.length}${skipped.length ? ' → ' + skipped.map(s => '@' + s.username).join(', ') : ''}`);
  console.log(`  → data/villalar-draft.json`);
  console.log(`════ TAMAM ════\n`);
}

main().catch(e => { console.error('[ig-villa-discover]', e); process.exit(1); });
