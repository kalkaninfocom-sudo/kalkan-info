#!/usr/bin/env node
// scripts/fb-lead-responder.mjs
//
// Facebook "Friends of Kalkan" lead responder — GÜVENLİ tasarım.
//
// AKIŞ: bir gönderi metni gelir → detectRequest() bunun bir ÖNERİ TALEBİ
// olup olmadığını + kategorisini çıkarır → matchBusiness() kalkaninfo
// veritabanından en uygun işletmeyi bulur → draftReply() samimi, spam'imsi
// OLMAYAN İngilizce bir cevap TASLAĞI üretir → submitForApproval() Telegram
// üzerinden Berkay'a onaya gönderir. Berkay onaylar ve TERCİHEN MANUEL paylaşır.
//
// ⚠️ DÜRÜST KISIT: "Friends of Kalkan" Berkay'a ait DEĞİL. Sahibi olunmayan bir
// FB grubuna/sayfasına OTOMATİK yorum atmak Meta ToS ihlalidir (spam algısı,
// hesap ban, itibar riski). Bu yüzden bu araç YAZMA işlemini OTOMATİK YAPMAZ.
// Sadece taslak üretir + onaya sunar. Yayın her zaman insan elinden geçer.
// Detay: docs/FB_RESPONDER.md
//
// Kullanım:
//   node scripts/fb-lead-responder.mjs --paste "<gönderi metni>"
//   node scripts/fb-lead-responder.mjs --paste "..." --no-telegram   (onay göndermeden test)
//   node scripts/fb-lead-responder.mjs --poll                        (fetchNewPosts stub — TODO)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cheapLLM, cheapJSON } from '../lib/cheap-llm.mjs';
import { sendMessage, escapeMd, approvalKeyboard } from '../lib/telegram.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = 'https://kalkaninfo.com';

// ───────────────────────────────────────────────────────────── veri yükleme

function loadJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

// Tüm kaynakları normalize edip tek bir işletme listesine indir.
// Her kaydı `_source` (restoranlar/hizmetler/villalar/oteller) ile etiketle.
function loadBusinesses() {
  const out = [];
  const push = (arr, source) => {
    for (const x of arr || []) out.push({ ...x, _source: source });
  };
  const items = (d) => (Array.isArray(d) ? d : d.items || Object.values(d).find(Array.isArray) || []);

  push(items(loadJson('data/restoranlar.json')), 'restoranlar');
  push(items(loadJson('data/hizmetler.json')), 'hizmetler');
  push(items(loadJson('data/villalar.json')), 'villalar');
  push(items(loadJson('data/oteller.json')), 'oteller');
  return out;
}

// Kaynak → sitedeki liste sayfası (URL'i olmayan kayıtlar için yedek).
const SECTION_PAGE = {
  restoranlar: '/restoranlar.html',
  hizmetler: '/hizmetler.html',
  villalar: '/villalar.html',
  oteller: '/oteller.html',
};

function businessUrl(b) {
  // En spesifik bağlantı önce.
  if (b.detailPath) return SITE + '/' + String(b.detailPath).replace(/^\/+/, '');
  if (b.listUrl) return SITE + (b.listUrl.startsWith('/') ? b.listUrl : '/' + b.listUrl);
  if (b.referenceUrl) return b.referenceUrl;
  return SITE + (SECTION_PAGE[b._source] || '');
}

// ───────────────────────────────────────────────────── kategori eşlemesi

// Talep kategorisi → hangi kaynaklarda + hangi anahtar kelimelerle aranacağı.
const CATEGORY_MAP = {
  catering: { sources: ['hizmetler', 'restoranlar'], kw: ['catering', 'cater', 'buffet', 'menü', 'menu'] },
  restoran: { sources: ['restoranlar'], kw: ['restaurant', 'restoran', 'dinner', 'lunch', 'eat', 'food', 'cuisine'] },
  cafe: { sources: ['restoranlar'], kw: ['cafe', 'café', 'kafe', 'coffee', 'breakfast', 'brunch'] },
  villa: { sources: ['villalar'], kw: ['villa', 'rental', 'accommodation', 'stay', 'pool'] },
  otel: { sources: ['oteller'], kw: ['hotel', 'otel', 'room', 'boutique'] },
  transfer: { sources: ['hizmetler'], kw: ['transfer', 'taxi', 'airport', 'transport', 'shuttle', 'ulaşım', 'car'] },
  aktivite: { sources: ['hizmetler', 'restoranlar'], kw: ['boat', 'tour', 'activity', 'diving', 'kayak', 'aktivite', 'spor'] },
  tamir: { sources: ['hizmetler'], kw: ['repair', 'fix', 'plumber', 'electric', 'tamir', 'service', 'maintenance'] },
  diger: { sources: ['hizmetler', 'restoranlar'], kw: [] },
};

// Curated overlay: data'da yapısal karşılığı zayıf olan ama Berkay'ın gerçek
// işletmesi olan eşleşmeler. (Kalimera Kitchen = Berkay'ın catering markası.)
const CURATED = {
  catering: {
    name: 'Kalimera Kitchen',
    category: 'Catering',
    summary: 'Bespoke catering for villa parties, weddings and special events in Kalkan — open buffet, custom menus and service staff.',
    url: SITE + '/hizmetler.html',
    _curated: true,
  },
};

// ──────────────────────────────────────────────────────── 1) detectRequest

// Bir gönderinin ÖNERİ TALEBİ olup olmadığını ve kategorisini çıkarır.
// Anthropic (haiku) ile; key yoksa/başarısızsa keyword fallback'e düşer.
export async function detectRequest(postText) {
  const text = String(postText || '').trim();
  if (!text) return { isRequest: false, category: null, confidence: 0, reason: 'empty', _source: 'guard' };

  const system =
    'You analyse Facebook group posts from "Friends of Kalkan" (an English-speaking expat/tourist community for Kalkan, Turkey). ' +
    'Decide if the post is ASKING for a recommendation for a local business or service. ' +
    'Reply ONLY with JSON: {"isRequest": boolean, "category": one of ' +
    '["catering","restoran","cafe","villa","otel","transfer","aktivite","tamir","diger"] or null, ' +
    '"confidence": 0..1, "language": "en"|"tr"|other, "reason": short string}. ' +
    'isRequest is false for statements, photos, thank-you notes, or general chat.';

  try {
    const { data: parsed, provider } = await cheapJSON(text, { system, maxTokens: 300 });
    console.log(`  [cheap-llm] detectRequest ✓ ${provider}`);
    if (parsed && typeof parsed === 'object' && 'isRequest' in parsed) {
      return { ...parsed, _source: provider };
    }
    throw new Error('unparseable');
  } catch (e) {
    return { ...heuristicDetect(text), _source: 'fallback', _note: String(e.message || e) };
  }
}

// Anthropic erişilemezse: basit anahtar kelime tespiti (çökmemek için).
function heuristicDetect(text) {
  const t = text.toLowerCase();
  const asks = /\b(recommend|recommendation|suggest|anyone know|looking for|any good|where can|can anyone|advice on|best place)\b/.test(t)
    || /\?\s*$/.test(t.trim());
  let category = null;
  let best = 0;
  for (const [cat, cfg] of Object.entries(CATEGORY_MAP)) {
    if (cat === 'diger') continue;
    const hits = cfg.kw.filter((k) => t.includes(k.toLowerCase())).length;
    if (hits > best) { best = hits; category = cat; }
  }
  if (asks && !category) category = 'diger';
  return { isRequest: asks && !!category, category, confidence: asks ? (best ? 0.55 : 0.3) : 0.1, language: 'en', reason: 'keyword heuristic' };
}

// ──────────────────────────────────────────────────────── 2) matchBusiness

// İlgili kategoride kalkaninfo veritabanından en uygun işletmeyi bul.
// Curated overlay öncelikli (ör. catering → Kalimera Kitchen).
export function matchBusiness(category, text, businesses = loadBusinesses()) {
  const cat = category && CATEGORY_MAP[category] ? category : 'diger';
  const cfg = CATEGORY_MAP[cat];
  const t = String(text || '').toLowerCase();

  // Curated eşleşme varsa onu döndür (data'daki ham kaydı da iliştir).
  if (CURATED[cat]) {
    const dataHit = businesses.find((b) => cfg.sources.includes(b._source)
      && cfg.kw.some((k) => (b.name || '').toLowerCase().includes(k) || (b.category || '').toLowerCase().includes(k)));
    return { ...CURATED[cat], _dataRef: dataHit ? dataHit.name : null, url: CURATED[cat].url };
  }

  const pool = businesses.filter((b) => cfg.sources.includes(b._source));
  if (!pool.length) return null;

  const scored = pool.map((b) => {
    const hay = `${b.name || ''} ${b.category || ''} ${b.cuisine || ''} ${b.summary || ''} ${(b.tags || []).join(' ')}`.toLowerCase();
    let score = 0;
    for (const k of cfg.kw) if (hay.includes(k.toLowerCase())) score += 2;
    for (const w of t.split(/\W+/).filter((x) => x.length > 3)) if (hay.includes(w)) score += 1;
    if (b.featured) score += 1.5;
    if (typeof b.rating === 'number') score += Math.min(b.rating, 5) / 5;
    return { b, score };
  }).sort((a, z) => z.score - a.score);

  const top = scored[0]?.b;
  if (!top) return null;
  return {
    name: top.name,
    category: top.category || top.cuisine || cat,
    summary: top.summary || '',
    url: businessUrl(top),
    phone: top.phone || null,
    _source: top._source,
  };
}

// ──────────────────────────────────────────────────────── 3) draftReply

// Samimi, spam OLMAYAN, tek işletme öneren İngilizce kısa cevap üret.
// Anthropic erişilemezse şablon fallback (çökmez).
export async function draftReply(post, business) {
  if (!business) return null;

  const system =
    'You are a helpful LOCAL member of the "Friends of Kalkan" Facebook community (English-speaking expats/tourists in Kalkan, Turkey). ' +
    'Someone asked for a recommendation. Write a SHORT, warm, genuinely helpful reply (2-3 sentences max) recommending ONE business. ' +
    'Tone: friendly neighbour, NOT an advert. No hype words ("amazing!!!", "best ever"), no emojis spam, no hard sell. ' +
    'Mention the business by name once, say briefly why it fits, and include the kalkaninfo.com link naturally as "more info / details here". ' +
    'Never claim personal experience you do not have — phrase as "people often recommend" / "worth a look". Plain text only.';

  const user = `Post: "${post}"\n\nRecommend this business:\nName: ${business.name}\nWhat: ${business.summary || business.category}\nLink: ${business.url}`;

  try {
    const { text: llmText, provider } = await cheapLLM(user, { system, maxTokens: 300 });
    console.log(`  [cheap-llm] draftReply ✓ ${provider}`);
    const clean = String(llmText || '').trim();
    if (clean) return { text: clean, _source: provider };
    throw new Error('empty');
  } catch (e) {
    return { text: fallbackReply(business), _source: 'fallback', _note: String(e.message || e) };
  }
}

function fallbackReply(b) {
  // Anthropic yokken İngilizce kalmalı; data summary'leri Türkçe olabildiği için
  // yalnızca İngilizce (Türkçe karaktersiz) ve kısa summary'leri iliştir.
  const isEnglish = b.summary && !/[çğıöşüÇĞİÖŞÜ]/.test(b.summary) && b.summary.length <= 160;
  const why = isEnglish ? ` ${b.summary}` : '';
  return `Hi! For this, people often recommend ${b.name} here in Kalkan.${why} You can find the details and contact info on ${b.url} — hope it helps!`;
}

// ──────────────────────────────────────────────────── 4) submitForApproval

// Taslağı Telegram'dan Berkay'a onaya gönder. Token yoksa konsola yaz (çökmez).
// Onay/Red butonları lib/telegram.js'deki approvalKeyboard ile gelir; webhook
// tarafı (api/telegram veya benzeri) callback'i işler — bu script sadece sunar.
export async function submitForApproval(post, draft, business, opts = {}) {
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  const postId = 'fb-' + Date.now().toString(36);

  const body =
    `*🟦 Friends of Kalkan — Öneri Taslağı*\n\n` +
    `*Gönderi:*\n_${escapeMd(post.slice(0, 350))}_\n\n` +
    `*Eşleşen işletme:* ${escapeMd(business?.name || '—')}\n` +
    `*Link:* ${escapeMd(business?.url || '—')}\n\n` +
    `*Önerilen cevap \\(İngilizce\\):*\n${escapeMd(draft?.text || '—')}\n\n` +
    `⚠️ _Onaylarsan TERCİHEN MANUEL paylaş \\(Meta ToS\\)\\._`;

  if (opts.noTelegram || !chatId || !process.env.TELEGRAM_BOT_TOKEN) {
    console.log('\n[submitForApproval] Telegram gönderilmedi (token/chat yok veya --no-telegram).');
    console.log('  postId:', postId);
    return { sent: false, postId, reason: 'no-telegram-config' };
  }

  try {
    const res = await sendMessage(chatId, body, { reply_markup: approvalKeyboard(postId) });
    return { sent: true, postId, messageId: res.message_id };
  } catch (e) {
    console.error('[submitForApproval] Telegram hata:', e.message);
    return { sent: false, postId, error: e.message };
  }
}

// ──────────────────────────────────────────────────── okuma katmanı (stub)

// PLUGGABLE READ LAYER.
// "Friends of Kalkan" Berkay'a ait olmadığı için resmi/güvenli bir okuma yolu
// yoktur. Seçenekler:
//   1) Manuel: gönderiyi kopyala-yapıştır → --paste (varsayılan, ücretsiz, güvenli).
//   2) Apify Facebook Group/Page scraper (~$30-49/ay) — GRİ ALAN, kendi riskinizle.
//      docs/FB_RESPONDER.md'deki maliyet/risk notuna bakın.
// Aşağısı yalnızca arayüz iskeleti; gerçek scraping BİLİNÇLİ olarak bağlanmadı.
export async function fetchNewPosts() {
  // TODO(apify): const posts = await apifyRun('apify/facebook-groups-scraper', {...});
  //   return posts.map(p => ({ id: p.id, text: p.text, author: p.author, url: p.url }));
  console.warn('[fetchNewPosts] Otomatik okuma bağlı değil. --paste ile manuel test edin. (docs/FB_RESPONDER.md)');
  return [];
}

// ─────────────────────────────────────────────────────────── orchestrator

export async function processPost(postText, opts = {}) {
  const detection = await detectRequest(postText);
  if (!detection.isRequest) {
    return { postText, detection, skipped: true, reason: 'not a recommendation request' };
  }
  const business = matchBusiness(detection.category, postText);
  const draft = await draftReply(postText, business);
  let approval = null;
  if (!opts.dryRun) {
    approval = await submitForApproval(postText, draft, business, opts);
  }
  return { postText, detection, business, draft, approval, skipped: false };
}

// ─────────────────────────────────────────────────────────────────── CLI

function parseArgs(argv) {
  const a = { paste: null, poll: false, noTelegram: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--paste') a.paste = argv[++i];
    else if (v === '--poll') a.poll = true;
    else if (v === '--no-telegram') a.noTelegram = true;
    else if (v === '--dry-run') a.dryRun = true;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.poll) {
    const posts = await fetchNewPosts();
    for (const p of posts) await processPost(p.text, args);
    return;
  }

  if (!args.paste) {
    console.log('Kullanım: node scripts/fb-lead-responder.mjs --paste "<gönderi metni>" [--no-telegram] [--dry-run]');
    process.exit(1);
  }

  const result = await processPost(args.paste, args);

  console.log('\n──────────────────────────────────────────────');
  console.log('GÖNDERİ:', args.paste);
  console.log('──────────────────────────────────────────────');
  console.log('TESPİT:', JSON.stringify(result.detection));
  if (result.skipped) {
    console.log('\n→ Bu bir öneri talebi değil. Atlanıyor.');
    return;
  }
  console.log('\nEŞLEŞEN İŞLETME:', result.business ? `${result.business.name}  (${result.business.url})` : '— bulunamadı');
  console.log('\nÖNERİLEN CEVAP TASLAĞI (İngilizce):');
  console.log('  "' + (result.draft?.text || '') + '"');
  console.log('  [kaynak: ' + (result.draft?._source || '-') + ']');
  if (result.approval) {
    console.log('\nONAY:', result.approval.sent ? `Telegram'a gönderildi (postId ${result.approval.postId})` : `Gönderilmedi (${result.approval.reason || result.approval.error})`);
  }
  console.log('\n⚠️  Onayladıktan sonra cevabı TERCİHEN MANUEL paylaş (Meta ToS). docs/FB_RESPONDER.md');
}

// Yalnızca doğrudan çalıştırıldığında main() (import edildiğinde değil).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
}
