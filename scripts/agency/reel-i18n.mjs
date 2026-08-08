#!/usr/bin/env node
/**
 * scripts/agency/reel-i18n.mjs — REEL 5-DİL ORTAK KATMANI (paylaşılan yardımcı)
 * ---------------------------------------------------------------------------
 * "Her içerik 5 dilde" vizyonunun P2'si (haftalık reeller). Bir TR reel'i ONAYA
 * girdikten SONRA, AYNI mp4'ü paylaşarak DE/RU/FR (+ istenirse EN) için ek
 * `social_posts` satırları üretir ve Telegram'a video onayı gönderir.
 *
 * NEDEN AYNI mp4: reel görselleri dile bağımsız (Remotion metni dekoratif);
 * yayını belirleyen `caption`'dır (webhook local_assets[0] videoyu + caption'ı yayınlar).
 * → Dil başına render/upload TEKRARLANMAZ; sadece çeviri + satır + onay eklenir.
 *
 * KANITLANMIŞ KALIP: gazete-editorial-i18n.mjs (idempotency + alan-alan çeviri +
 * dile-özel etiket + "uydurma yok" + non-fatal). Çeviri: lib/i18n-translate.mjs
 * (ücretsiz LLM önce). Büyük tek-batch değil → alanlar KÜÇÜK JSON, dil başına paralel.
 *
 * KURAL: TR akışını BOZMAZ. Bu katman EK'tir; her adımı graceful (bir dil/adım
 * patlarsa diğerleri + TR etkilenmez). Supabase/Telegram env yoksa sessizce atlar.
 *
 * Kullanım (üretici scriptten):
 *   import { publishReelTranslations } from './reel-i18n.mjs';
 *   await publishReelTranslations({
 *     typeKey: 'villa', date, videoUrl, packIdBase: `villa-reel-${date}`,
 *     scheduledTime: '20:00', hashtags, isAI: false,
 *     captionFields: { name, tagline, cta },     // TR kaynak alanlar (küçük JSON)
 *     buildCaption: (f, lang) => `...${f.name}...`, // çevrilmiş alanlardan caption kur
 *     context: 'Haftanın villası reel caption',
 *   });
 */
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateFields, LANGS } from '../../lib/i18n-translate.mjs';
import { withAiDisclosure } from '../../lib/reklam-uyum.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel; CI'da env dolu). Üretici zaten yükleyebilir ama bağımsız da çalışsın.
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;

// Bayrak + Telegram onay-başlığı için dil adları (TR ekip mesajı).
const LANG_FLAG = { en: '🇬🇧', de: '🇩🇪', ru: '🇷🇺', fr: '🇫🇷' };
const LANG_TR = { en: 'İngilizce', de: 'Almanca', ru: 'Rusça', fr: 'Fransızca' };

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

function approvalKeyboard(postId) {
  return { inline_keyboard: [
    [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
     { text: '⏰ Zamanla Yayınla', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '❌ Reddet', callback_data: `pub:${postId}:reject` }],
  ]};
}

async function sendVideoUpload(mp4Buf, filename, caption, postId) {
  if (!TG_TOKEN || !TG_CHAT) return null;
  const form = new FormData();
  form.append('chat_id', String(TG_CHAT));
  form.append('video', new Blob([mp4Buf], { type: 'video/mp4' }), filename);
  form.append('caption', caption.slice(0, 1024));
  form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVideo`, { method: 'POST', body: form });
  const j = await res.json();
  if (!j.ok) { console.warn(`  ⚠ Telegram sendVideo (i18n): ${j.description}`); return null; }
  return j.result?.message_id || null;
}

/**
 * Bir dil için: çeviri → social_posts satırı (idempotent) → Telegram video onayı.
 * Her adım non-fatal; hata o dili atlar, diğerlerini/TR'yi etkilemez.
 */
async function publishOne(ctx, lang, mp4Buf) {
  const { typeKey, videoUrl, packIdBase, scheduledAt, hashtags, isAI, captionFields, buildCaption, context, headline } = ctx;
  const packId = `${packIdBase}-${lang}`;

  // 0) Idempotency: bu dil satırı zaten onaya gönderilmişse atla.
  try {
    const q = await supa(`/social_posts?content_pack_id=eq.${packId}&select=id,telegram_message_id&limit=1`);
    const existing = (q.ok ? await q.json() : [])[0];
    if (existing?.telegram_message_id) { console.log(`  ℹ ${lang}: onay zaten gönderilmiş — atlandı`); return; }
    if (existing?.id) { /* satır var, onay yok → aşağıda tekrar onay dene */ }
  } catch {}

  // 1) Çeviri (alan-alan küçük JSON → güvenilir; başarısızsa o dil atlanır).
  const translated = await translateFields(captionFields, lang, { context, maxTokens: 700, verbose: true });
  if (!translated) { console.warn(`  ⚠ ${lang}: çeviri alınamadı — atlandı`); return; }

  // 2) Caption'ı çevrilmiş alanlardan kur + (AI ise) dile-özel şeffaflık ibaresi.
  let caption = buildCaption(translated, lang);
  let tags = Array.isArray(hashtags) ? [...hashtags] : [];
  if (isAI) { const d = withAiDisclosure(caption, { hashtags: tags, lang }); caption = d.caption; tags = d.hashtags; }

  // 3) social_posts satırı (yoksa insert; app-seviyesi upsert).
  let post;
  try {
    const q = await supa(`/social_posts?content_pack_id=eq.${packId}&select=id,telegram_message_id&limit=1`);
    post = (q.ok ? await q.json() : [])[0];
  } catch {}
  if (!post) {
    const row = {
      content_pack_id: packId,
      content_type: 'reels',
      language: lang,
      caption,
      hashtags: tags,
      local_assets: [videoUrl],
      status: 'pending_approval',
      scheduled_at: scheduledAt,
      telegram_chat_id: TG_CHAT ? Number(TG_CHAT) : null,
    };
    const ins = await supa('/social_posts?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    if (!ins.ok) { console.warn(`  ⚠ ${lang}: social_posts insert fail (${ins.status}) — atlandı`); return; }
    post = (await ins.json())[0];
    console.log(`  ✓ ${lang}: social_posts oluşturuldu (${post.id})`);
  }

  // 4) Telegram video onayı (TR ekip başlığı + çevrilmiş caption önizleme).
  const title = translated.name || translated.headline || headline || packIdBase;
  const capTg = `${LANG_FLAG[lang] || ''} ${LANG_TR[lang] || lang.toUpperCase()} REEL — ${typeKey}\n${title}\n\nOnaylarsan Instagram Reels'e (${LANG_TR[lang] || lang}) yayınlanır.`;
  const msgId = await sendVideoUpload(mp4Buf, `${typeKey}-reel-${lang}.mp4`, capTg, post.id);
  if (msgId) {
    await supa(`/social_posts?id=eq.${post.id}`, {
      method: 'PATCH', body: JSON.stringify({ telegram_message_id: msgId }),
    }).catch(() => {});
    console.log(`  ✅ ${lang}: onay gönderildi (message_id ${msgId})`);
  }
}

/**
 * Bir TR reel'ini hedef dillere çevirip ek social_posts satırları + Telegram onayı üretir.
 *
 * @param {object} ctx
 * @param {string} ctx.typeKey            reel tipi kısa anahtarı (villa/restoran/plaj/antik/gazete)
 * @param {string} ctx.mp4Path            render edilmiş TR mp4 (paylaşılan video)
 * @param {string} ctx.videoUrl           Supabase public video URL (TR ile aynı; paylaşılır)
 * @param {string} ctx.packIdBase         `<type>-reel-<date>` (dil eki helper ekler)
 * @param {string} ctx.scheduledAt        ISO scheduled_at (TR ile aynı slot)
 * @param {string[]} ctx.hashtags         ortak hashtag'ler
 * @param {boolean} [ctx.isAI]            AI şeffaflık ibaresi eklensin mi (antik=true)
 * @param {object} ctx.captionFields      çevrilecek TR kaynak alanlar (KÜÇÜK JSON)
 * @param {(fields:object, lang:string)=>string} ctx.buildCaption  çevrilmiş alanlardan caption
 * @param {string} [ctx.context]          çeviriye bağlam ipucu
 * @param {string[]} [ctx.langs]          hedef diller (varsayılan LANGS = en/de/ru/fr)
 * @returns {Promise<void>} her zaman resolve (non-fatal); TR akışını asla bozmaz.
 */
export async function publishReelTranslations(ctx) {
  const langs = ctx.langs || LANGS;
  if (!SUPA_URL || !SUPA_KEY) { console.warn('  ℹ i18n reel: Supabase env yok — çok-dil atlandı (TR reel diskte/onayda).'); return; }
  if (!ctx.videoUrl || !ctx.captionFields || typeof ctx.buildCaption !== 'function') {
    console.warn('  ℹ i18n reel: eksik parametre — çok-dil atlandı.'); return;
  }
  let mp4Buf = null;
  if (ctx.mp4Path) { try { mp4Buf = await readFile(ctx.mp4Path); } catch { mp4Buf = null; } }

  console.log(`── ${ctx.typeKey} reel çok-dil (${langs.join('/')}) ──`);
  // Diller SIRAYLA (rate-limit dostu; içeride alanlar paralel çevrilir). Biri patlarsa diğerleri sürer.
  for (const lang of langs) {
    try { await publishOne(ctx, lang, mp4Buf); }
    catch (e) { console.warn(`  ⚠ ${lang}: i18n reel adımı hata (atlandı): ${e.message}`); }
  }
}

export default { publishReelTranslations };
