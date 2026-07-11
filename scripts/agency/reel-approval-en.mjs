#!/usr/bin/env node
/**
 * scripts/agency/reel-approval-en.mjs — İNGİLİZCE GAZETE REEL ONAY (reel-approval.mjs ikizi).
 * --------------------------------------------------------------------------------------------
 * Akış:
 *   1. EN reel'i render et (build-gazete-reel-en.mjs) → dist/social/gazete/gazete-reel-en.mp4
 *   2. mp4'ü Supabase storage'a yükle → public URL
 *   3. social_posts satırı: content_pack_id='gazete-reel-en-<date>', language='en', status='pending_approval'
 *   4. Telegram'a VİDEO olarak İngilizce caption ile onaya sun (pub:<id>:... callback'leri aynı).
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
    [{ text: '✅ Publish Now', callback_data: `pub:${postId}:now` },
     { text: '⏰ Publish 08:00', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '❌ Reject', callback_data: `pub:${postId}:reject` }],
  ]};
}

async function sendVideoUpload(mp4Path, caption, postId) {
  if (!TG_TOKEN || !TG_CHAT) { console.warn('  ℹ TELEGRAM env yok — onay atlandı (EN reel diskte hazır)'); return null; }
  const buf = await readFile(mp4Path);
  const form = new FormData();
  form.append('chat_id', String(TG_CHAT));
  form.append('video', new Blob([buf], { type: 'video/mp4' }), 'gazete-reel-en.mp4');
  form.append('caption', caption.slice(0, 1024));
  form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVideo`, { method: 'POST', body: form });
  const j = await res.json();
  if (!j.ok) { console.error('  ✗ Telegram sendVideo:', j.description); return null; }
  return j.result?.message_id || null;
}

async function main() {
  console.log(`\n════ GAZETE REEL EN ONAY — ${date} ════`);

  // 1) Render
  console.log('── EN Reel render (build-gazete-reel-en) ──');
  const r = spawnSync('node', ['scripts/agency/build-gazete-reel-en.mjs', date], { cwd: ROOT, stdio: 'inherit' });
  const mp4 = join(ROOT, 'dist', 'social', 'gazete', 'gazete-reel-en.mp4');
  if (r.status !== 0 || !existsSync(mp4)) { console.error('❌ EN Reel render edilemedi:', mp4); process.exit(1); }
  console.log('✓ EN Reel hazır:', mp4);

  if (!SUPA_URL || !SUPA_KEY) { console.warn('ℹ Supabase env yok — yükleme/onay atlandı. (EN reel diskte.)'); return; }

  // 2) Storage'a yükle
  const objectPath = `gazete-reel/gazete-reel-en-${date}.mp4`;
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
  const packId = `gazete-reel-en-${date}`;
  let post;
  const q = await supa(`/social_posts?content_pack_id=eq.${packId}&select=id,telegram_message_id&limit=1`);
  post = (q.ok ? await q.json() : [])[0];
  if (post?.telegram_message_id) { console.log('ℹ Bu EN reel için onay zaten gönderilmiş, tekrar gönderilmiyor.'); return; }

  // Caption: bugünün İngilizce manşetinden
  let headline = "Today's Kalkan headlines";
  try { headline = JSON.parse(await readFile(join(ROOT, 'data', 'gazete-today.en.json'), 'utf8')).lead_headline || headline; } catch {}
  const caption = `📰 ${headline}\n\nToday's Kalkan news — full paper: ${SITE_BASE}/en`;
  const hashtags = ['#kalkan', '#kalkaninfo', '#kalkantoday', '#kas', '#antalya', '#turkey', '#travel'];

  if (!post) {
    const row = {
      content_pack_id: packId,
      content_type: 'reels',
      language: 'en',
      caption,
      hashtags,
      local_assets: [videoUrl],
      status: 'pending_approval',
      scheduled_at: `${date}T08:30:00+03:00`,
      telegram_chat_id: TG_CHAT ? Number(TG_CHAT) : null,
    };
    const ins = await supa('/social_posts?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    if (!ins.ok) { console.error('  ✗ social_posts insert fail:', ins.status, (await ins.text()).slice(0, 160)); return; }
    post = (await ins.json())[0];
    console.log('✓ social_posts (reels EN) oluşturuldu:', post.id);
  }

  // 4) Telegram video onayı (İngilizce)
  console.log('── Telegram EN video onayı gönderiliyor ──');
  // KALİTE KAPISI (Düzeltme C): Telegram'dan ÖNCE eleştirmen değerlendirmesi.
  //   Yayını engellemez; düşük puanda onay mesajına "DÜŞÜK PUAN" uyarısı eklenir.
  let kaliteUyari = '';
  try {
    const kapi = await qualityGate('gazete-reel-en', { baslik: headline, metin: caption });
    if (!kapi.pass && kapi.warning) kaliteUyari = kapi.warning + '\n\n';
  } catch (e) { console.warn('  ℹ kalite kapısı atlandı (hata):', e.message); }

  const capTg = `${kaliteUyari}🎬 TODAY'S REEL (EN) — ${date}\n${headline}\n\nApprove to publish to Instagram Reels (English edition).`;
  const msgId = await sendVideoUpload(mp4, capTg, post.id);
  if (msgId) {
    await supa(`/social_posts?id=eq.${post.id}`, {
      method: 'PATCH', body: JSON.stringify({ telegram_message_id: msgId, scheduled_at: `${date}T08:30:00+03:00` }),
    }).catch(() => {});
    console.log(`✅ EN Reel onayı gönderildi (message_id ${msgId}). Onaylanınca IG Reels.`);
  }
}

main().catch(e => { console.error('[reel-approval-en]', e); process.exit(1); });
