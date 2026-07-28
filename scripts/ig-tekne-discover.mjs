#!/usr/bin/env node
/**
 * scripts/ig-tekne-discover.mjs — TEKNE / SU SPORLARI ENVANTERİ TASLAK ÜRETİCİ
 * ---------------------------------------------------------------------------------
 * @kalkan.info'nun takip ettiği tekne/dalış/SUP/yat IG hesaplarından (public business)
 * su-sporlari.json için TASLAK kayıt üret. Uydurma YOK — IG name/bio/caption + foto grounded.
 * GÜVENLİ: su-sporlari.json'a DOKUNMAZ → çıktı data/su-sporlari-draft.json (Berkay inceler).
 *
 * node scripts/ig-tekne-discover.mjs [--limit-accounts N] [--no-llm] [--photos N]
 *      [--only user1,user2]   # sadece bu hesaplar (rate-limit retry için)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
const onlyArg = ARGS[ARGS.indexOf('--only') + 1];
const ONLY = ARGS.includes('--only') && onlyArg ? onlyArg.split(',').map(s => s.trim()).filter(Boolean) : null;

const DRAFT_PATH = join(ROOT, 'data', 'su-sporlari-draft.json');
const PHOTO_REL = 'assets/img/ig-tekne';

// Tekne/su sporları adayları (2026-07-28 following analizi — DB'de olmayan)
const CANDIDATES = ONLY || [
  'atesboatkalkan', 'batinboattours', 'emirboatkalkan', 'kalkan_sup', 'kalkan_tekne_turlari',
  'lyciayachting', 'maya_boat', 'mutidivingcenter', 'nirvanaboatkalkan', 'pinaxboatkalkan',
  'serenityboat_kalkan', 'star1_boat_kalkan', 'vf_charter_kassiopi', 'yachtpointbarkalkan',
  'yildizboats', 'zeusboatkalkan',
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
  try {
    if (existsSync(abs)) return `/${rel}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok || !/image\//.test(res.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1200) return null;
    await mkdir(join(ROOT, PHOTO_REL), { recursive: true });
    await writeFile(abs, buf);
    return `/${rel}`;
  } catch { return null; }
}

async function discover(username) {
  const fields = `business_discovery.username(${username}){name,biography,website,followers_count,media_count,profile_picture_url,` +
    `media.limit(8){caption,media_url,permalink,media_type,timestamp,like_count}}`;
  const url = `${GRAPH}/${IG_ID}?fields=${encodeURIComponent(fields)}&access_token=${TOKEN}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const data = await res.json();
    if (!res.ok || data.error) return { ok: false, reason: (data?.error?.message || `HTTP ${res.status}`).slice(0, 120) };
    if (!data.business_discovery) return { ok: false, reason: 'business_discovery boş' };
    return { ok: true, bd: data.business_discovery };
  } catch (e) { return { ok: false, reason: String(e.message || e).slice(0, 120) }; }
}

const TYPE_ENUM = 'tekne turu | özel tekne kiralama | yat charter | dalış merkezi | SUP/kürek | jet ski / su sporları | balık avı turu | karışık';

async function extractAttrs(cheapLLM, bd, username) {
  const bio = (bd.biography || '').replace(/\s+/g, ' ').slice(0, 400);
  const caps = (bd.media?.data || []).map(m => (m.caption || '').replace(/\s+/g, ' ')).filter(Boolean).slice(0, 4).join(' ||| ').slice(0, 900);
  const SYSTEM = 'Sen bir turizm veri çıkarım asistanısın. Sana bir Kalkan tekne/su sporları Instagram hesabının adı, bio ve caption\'ları verilir. ' +
    'SADECE metinde AÇIKÇA geçen bilgiyi çıkar; emin değilsen null bırak — ASLA uydurma. ' +
    `Yanıtı SADECE şu JSON ile ver: {"hizmetTipi":"${TYPE_ENUM} içinden biri","ozelTur":true|false|null,"kapasite":"N kişi"|null,"konum":"..."|null,"telefon":"..."|null,"ozet":"tek cümle olgusal Türkçe, max 22 kelime, reklamsız"}. ` +
    'hizmetTipi metinden çıkmıyorsa "karışık" yaz. telefon caption/bio\'da varsa al, yoksa null.';
  const { text } = await cheapLLM(
    `Hesap: @${username}\nAd: ${bd.name || ''}\nBio: ${bio}\nCaptionlar: ${caps}`,
    { system: SYSTEM, json: true, maxTokens: 240, temperature: 0.2, order: ['ollama', 'groq', 'cerebras', 'nvidia', 'gemini', 'claude'] }
  );
  try { return JSON.parse(String(text).replace(/```json|```/g, '').trim()); } catch { return null; }
}

async function main() {
  console.log(`\n════ TEKNE / SU SPORLARI DISCOVERY — ${new Date().toISOString()} ════`);
  if (!IG_ID || !TOKEN) { console.error('⚠ IG_BUSINESS_ID / IG_LONG_LIVED_TOKEN yok.'); process.exit(1); }

  let cheapLLM = null;
  if (!NO_LLM) {
    try { ({ cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href)); }
    catch (e) { console.warn('⚠ cheap-llm yüklenemedi, ham modda:', String(e.message || e).slice(0, 80)); }
  }

  // mevcut draft'ı koru (retry'de birleştir)
  let existing = { items: [], skipped: [] };
  try { existing = JSON.parse(await readFile(DRAFT_PATH, 'utf8')); } catch {}
  const byIg = new Map((existing.items || []).map(i => [i.instagram, i]));

  const list = CANDIDATES.slice(0, LIMIT_ACCOUNTS);
  const skipped = [];
  let idx = 0;

  for (const username of list) {
    idx++;
    process.stdout.write(`  [${idx}/${list.length}] @${username} ... `);
    const r = await discover(username);
    if (!r.ok) { skipped.push({ username, reason: r.reason }); console.log(`⊘ (${r.reason})`); await sleep(500); continue; }
    const bd = r.bd;

    const gallery = [];
    for (const m of (bd.media?.data || [])) {
      if (gallery.length >= MAX_PHOTOS) break;
      const img = await downloadPhoto(m.media_url, username, m.permalink, m.media_type);
      if (img) gallery.push(img);
    }

    let attrs = null;
    if (cheapLLM) { try { attrs = await extractAttrs(cheapLLM, bd, username); } catch {} }
    if (attrs) {
      if (typeof attrs.kapasite === 'string' && /^n\s*kişi$/i.test(attrs.kapasite.trim())) attrs.kapasite = null;
      if (typeof attrs.konum === 'string' && /^\.{3}$|^\.*$/.test(attrs.konum.trim())) attrs.konum = null;
      if (typeof attrs.ozet === 'string') attrs.ozet = attrs.ozet.trim();
    }

    byIg.set(username, {
      id: 'watersports-' + slugify(username),
      name: bd.name || username,
      instagram: username,
      category: 'Su Sporları',
      categoryKey: 'watersports',
      type: attrs?.hizmetTipi || null,
      privateTour: attrs?.ozelTur ?? null,
      capacity: attrs?.kapasite ?? null,
      location: attrs?.konum || 'Kalkan',
      phone: attrs?.telefon || null,
      image: gallery[0] || null,
      gallery,
      summary: attrs?.ozet || '',
      website: bd.website || null,
      biography: (bd.biography || '').replace(/\s+/g, ' ').slice(0, 300),
      followers: bd.followers_count ?? null,
      media_count: bd.media_count ?? null,
      permalink: bd.media?.data?.[0]?.permalink || `https://instagram.com/${username}`,
      source: 'ig-business_discovery',
      needsReview: true,
      fetchedAt: new Date().toISOString(),
    });
    console.log(`✓ ${bd.name || username} | ${attrs?.hizmetTipi || '?'} | ${gallery.length} foto | ${bd.followers_count ?? '?'} tk`);
    await sleep(600);
  }

  const items = [...byIg.values()];
  const out = {
    _meta: {
      title: 'Tekne / Su Sporları Taslakları (IG discovery)',
      note: 'ig-tekne-discover.mjs çıktısı. needsReview:true. su-sporlari.json\'a promote etmeden önce Berkay inceler.',
      generatedAt: new Date().toISOString(), total: items.length, atlanan: skipped.length,
    },
    skipped,
    items,
  };
  await writeFile(DRAFT_PATH, JSON.stringify(out, null, 2));

  console.log(`\n──────── ÖZET ────────`);
  console.log(`  Taslak (toplam): ${items.length}  |  bu turda atlanan: ${skipped.length}${skipped.length ? ' → ' + skipped.map(s => '@' + s.username).join(', ') : ''}`);
  console.log(`  → data/su-sporlari-draft.json`);
  console.log(`════ TAMAM ════\n`);
}

main().catch(e => { console.error('[ig-tekne-discover]', e); process.exit(1); });
