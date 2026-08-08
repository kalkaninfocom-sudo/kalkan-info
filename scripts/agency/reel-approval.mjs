#!/usr/bin/env node
/**
 * scripts/agency/reel-approval.mjs — GÜNLÜK GAZETE REEL ONAY (Faz 1.5)
 * -------------------------------------------------------------------
 * Akış (gazete-approval.mjs ikizi, video versiyonu):
 *   1. Reel'i render et (build-gazete-reel.mjs) → dist/social/gazete/gazete-reel.mp4
 *   2. mp4'ü Supabase storage'a yükle → public URL
 *   3. social_posts satırı: content_type='reels', local_assets=[videoUrl], status='pending_approval'
 *   4. Telegram'a VİDEO olarak onaya sun (✅ Yayınla / ⏰ 08:00'de / ❌ Reddet — pub:<id>:...)
 *      → onay callback'i api/telegram-webhook (publishNow → publishReels) IG Reels'e yayınlar.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID.
 * Eksikse: reel yine render edilir (diskte), Telegram/kuyruk graceful atlanır.
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualityGate } from './content-critic.mjs';
import { publishReelTranslations } from './reel-i18n.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

try {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SITE_BASE = process.env.SITE_BASE || 'https://www.kalkaninfo.com';

const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

function approvalKeyboard(postId) {
  return { inline_keyboard: [
    [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
     { text: '⏰ 08:00’de Yayınla', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '❌ Reddet', callback_data: `pub:${postId}:reject` }],
  ]};
}

async function sendVideoUpload(mp4Path, caption, postId) {
  if (!TG_TOKEN || !TG_CHAT) { console.warn('  ℹ TELEGRAM env yok — onay atlandı (reel diskte hazır)'); return null; }
  const buf = await readFile(mp4Path);
  const form = new FormData();
  form.append('chat_id', String(TG_CHAT));
  form.append('video', new Blob([buf], { type: 'video/mp4' }), 'gazete-reel.mp4');
  form.append('caption', caption.slice(0, 1024));
  form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVideo`, { method: 'POST', body: form });
  const j = await res.json();
  if (!j.ok) { console.error('  ✗ Telegram sendVideo:', j.description); return null; }
  return j.result?.message_id || null;
}

async function main() {
  console.log(`\n════ GAZETE REEL ONAY — ${date} ════`);

  // 1) Render
  console.log('── Reel render (build-gazete-reel) ──');
  const r = spawnSync('node', ['scripts/agency/build-gazete-reel.mjs', date], { cwd: ROOT, stdio: 'inherit' });
  const mp4 = join(ROOT, 'dist', 'social', 'gazete', 'gazete-reel.mp4');
  if (r.status !== 0 || !existsSync(mp4)) { console.error('❌ Reel render edilemedi:', mp4); process.exit(1); }
  console.log('✓ Reel hazır:', mp4);

  if (!SUPA_URL || !SUPA_KEY) { console.warn('ℹ Supabase env yok — yükleme/onay atlandı. (Reel diskte.)'); return; }

  // 2) Storage'a yükle
  const objectPath = `gazete-reel/gazete-reel-${date}.mp4`;
  const buf = await readFile(mp4);
  const up = await fetch(`${SUPA_URL}/storage/v1/object/social-media/${objectPath}`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
    body: buf,
  });
  if (!up.ok) { console.error('  ✗ storage upload fail:', up.status, (await up.text()).slice(0, 160)); process.exit(1); }
  const videoUrl = `${SUPA_URL}/storage/v1/object/public/social-media/${objectPath}`;
  console.log('✓ Yüklendi:', videoUrl);

  // 3) social_posts satırı (uygulama-seviyesi upsert)
  const packId = `gazete-reel-${date}`;
  let post;
  const q = await supa(`/social_posts?content_pack_id=eq.${packId}&select=id,telegram_message_id&limit=1`);
  post = (q.ok ? await q.json() : [])[0];
  if (post?.telegram_message_id) { console.log('ℹ Bu reel için onay zaten gönderilmiş, tekrar gönderilmiyor.'); return; }

  // Caption: bugünün manşetinden
  let headline = 'Bugünün Kalkan gündemi';
  try { headline = JSON.parse(await readFile(join(ROOT, 'data', 'gazete-today.json'), 'utf8')).lead_headline || headline; } catch {}
  const caption = `📰 ${headline}\n\nGünün Kalkan haberleri — tamamı: ${SITE_BASE}/gazete

🇬🇧 Today’s Kalkan headlines. Full paper: ${SITE_BASE}/gazete`;
  const hashtags = ['#kalkan', '#kalkaninfo', '#kalkantoday', '#kaş', '#gündem', '#antalya'];

  if (!post) {
    const row = {
      content_pack_id: packId,
      content_type: 'reels',
      language: 'tr',
      caption,
      hashtags,
      local_assets: [videoUrl],
      status: 'pending_approval',
      scheduled_at: `${date}T08:00:00+03:00`,
      telegram_chat_id: TG_CHAT ? Number(TG_CHAT) : null,
    };
    const ins = await supa('/social_posts?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    if (!ins.ok) { console.error('  ✗ social_posts insert fail:', ins.status, (await ins.text()).slice(0, 160)); return; }
    post = (await ins.json())[0];
    console.log('✓ social_posts (reels) oluşturuldu:', post.id);
  }

  // 4) Telegram video onayı
  console.log('── Telegram video onayı gönderiliyor ──');
  // KALİTE KAPISI (Düzeltme C): Telegram'dan ÖNCE eleştirmen değerlendirmesi.
  //   Yayını engellemez; düşük puanda onay mesajına "DÜŞÜK PUAN" uyarısı eklenir.
  let kaliteUyari = '';
  try {
    const kapi = await qualityGate('gazete-reel', { baslik: headline, metin: caption });
    if (!kapi.pass && kapi.warning) kaliteUyari = kapi.warning + '\n\n';
  } catch (e) { console.warn('  ℹ kalite kapısı atlandı (hata):', e.message); }

  const capTg = `${kaliteUyari}🎬 BUGÜNÜN REEL'İ — ${date}\n${headline}\n\nOnaylarsan Instagram Reels'e yayınlanır (web zaten canlı).`;
  const msgId = await sendVideoUpload(mp4, capTg, post.id);
  if (msgId) {
    await supa(`/social_posts?id=eq.${post.id}`, {
      method: 'PATCH', body: JSON.stringify({ telegram_message_id: msgId, scheduled_at: `${date}T08:00:00+03:00` }),
    }).catch(() => {});
    console.log(`✅ Reel onayı gönderildi (message_id ${msgId}). Onaylanınca IG Reels.`);
  }

  // 5) ÇOK-DİL (P2): DE/RU/FR gazete reel caption+onay (EN zaten reel-approval-en.mjs'de).
  // Manşet varsa dile-özel editöryal çeviriden (gazete-editorial-i18n) alınır; yoksa TR manşet çevrilir.
  const CTAL = { de: 'Ganze Ausgabe', ru: 'Полный выпуск', fr: 'Édition complète' };
  const localeSeg = { de: '/de', ru: '/ru', fr: '/fr' };
  const localHeadline = {};
  for (const lang of ['de', 'ru', 'fr']) {
    try { localHeadline[lang] = JSON.parse(await readFile(join(ROOT, 'data', `gazete-today.${lang}.json`), 'utf8')).lead_headline || ''; } catch {}
  }
  await publishReelTranslations({
    typeKey: 'gazete', mp4Path: mp4, videoUrl, packIdBase: packId,
    scheduledAt: `${date}T08:00:00+03:00`, hashtags, isAI: false, langs: ['de', 'ru', 'fr'],
    // headline hazırsa çeviri gerekmesin diye alan olarak veriyoruz; yoksa TR manşet çevrilir.
    captionFields: { headline },
    buildCaption: (f, lang) => `📰 ${localHeadline[lang] || f.headline}\n\n${CTAL[lang]}: ${SITE_BASE}${localeSeg[lang]}`,
    context: "Günlük gazete manşeti Instagram reel caption (Kalkan Today)",
  }).catch(e => console.warn('  ℹ çok-dil gazete reel atlandı (non-fatal):', e.message));
}

main().catch(e => { console.error('[reel-approval]', e); process.exit(1); });
