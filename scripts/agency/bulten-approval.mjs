#!/usr/bin/env node
/**
 * scripts/agency/bulten-approval.mjs — HAFTANIN BÜLTENİ (Pazar) reel ONAY.
 * ----------------------------------------------------------------------
 * reel-approval.mjs ikizi, haftalık bültene uyarlı. Akış:
 *   1. Render (build-bulten-reel.mjs) → dist/social/bulten/bulten-reel.mp4
 *   2. Supabase storage upload → public URL
 *   3. social_posts (content_type='reels', pending_approval)
 *   4. Telegram video onayı (pub:<id>:...) → onaylanınca IG Reels.
 * Env yoksa reel yine diskte üretilir, yayın graceful atlanır.
 * Kullanım: node scripts/agency/bulten-approval.mjs [YYYY-MM-DD]
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const SITE_BASE = process.env.SITE_BASE || 'https://kalkaninfo.com';
const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

function approvalKeyboard(postId) {
  return { inline_keyboard: [
    [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
     { text: '⏰ 09:00’de Yayınla', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '❌ Reddet', callback_data: `pub:${postId}:reject` }],
  ]};
}

async function sendVideoUpload(mp4Path, caption, postId) {
  if (!TG_TOKEN || !TG_CHAT) { console.warn('  ℹ TELEGRAM env yok — onay atlandı (reel diskte hazır)'); return null; }
  const buf = await readFile(mp4Path);
  const form = new FormData();
  form.append('chat_id', String(TG_CHAT));
  form.append('video', new Blob([buf], { type: 'video/mp4' }), 'bulten-reel.mp4');
  form.append('caption', caption.slice(0, 1024));
  form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVideo`, { method: 'POST', body: form });
  const j = await res.json();
  if (!j.ok) { console.error('  ✗ Telegram sendVideo:', j.description); return null; }
  return j.result?.message_id || null;
}

async function main() {
  console.log(`\n════ HAFTANIN BÜLTENİ ONAY — ${date} ════`);

  console.log('── Reel render (build-bulten-reel) ──');
  const r = spawnSync('node', ['scripts/agency/build-bulten-reel.mjs', date], { cwd: ROOT, stdio: 'inherit' });
  const mp4 = join(ROOT, 'dist', 'social', 'bulten', 'bulten-reel.mp4');
  if (r.status !== 0 || !existsSync(mp4)) { console.error('❌ Reel render edilemedi:', mp4); process.exit(1); }
  console.log('✓ Reel hazır:', mp4);

  let p = {};
  try { p = JSON.parse(await readFile(join(ROOT, 'remotion', 'props-bulten.json'), 'utf8')); } catch {}
  const range = p.range_label || '';

  if (!SUPA_URL || !SUPA_KEY) { console.warn('ℹ Supabase env yok — yükleme/onay atlandı. (Reel diskte.)'); return; }

  const objectPath = `bulten-reel/bulten-reel-${date}.mp4`;
  const buf = await readFile(mp4);
  const up = await fetch(`${SUPA_URL}/storage/v1/object/social-media/${objectPath}`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
    body: buf,
  });
  if (!up.ok) { console.error('  ✗ storage upload fail:', up.status, (await up.text()).slice(0, 160)); process.exit(1); }
  const videoUrl = `${SUPA_URL}/storage/v1/object/public/social-media/${objectPath}`;
  console.log('✓ Yüklendi:', videoUrl);

  const packId = `bulten-reel-${date}`;
  let post;
  const q = await supa(`/social_posts?content_pack_id=eq.${packId}&select=id,telegram_message_id&limit=1`);
  post = (q.ok ? await q.json() : [])[0];
  if (post?.telegram_message_id) { console.log('ℹ Bu bülten için onay zaten gönderilmiş.'); return; }

  const topTitles = (p.items || []).slice(0, 3).map(i => `• ${i.title}`).join('\n');
  const caption = `🗞️ HAFTANIN BÜLTENİ${range ? ` · ${range}` : ''}\n\n${topTitles}\n\nHaftanın tüm haberleri: ${SITE_BASE}/gazete

🇬🇧 Kalkan’s weekly roundup. All news: ${SITE_BASE}/gazete`;
  const hashtags = ['#kalkan', '#kalkaninfo', '#haftanınbülteni', '#kaş', '#antalya'];

  if (!post) {
    const row = {
      content_pack_id: packId,
      content_type: 'reels',
      language: 'tr',
      caption,
      hashtags,
      local_assets: [videoUrl],
      status: 'pending_approval',
      scheduled_at: `${date}T09:00:00+03:00`,
      telegram_chat_id: TG_CHAT ? Number(TG_CHAT) : null,
    };
    const ins = await supa('/social_posts?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    if (!ins.ok) { console.error('  ✗ social_posts insert fail:', ins.status, (await ins.text()).slice(0, 160)); return; }
    post = (await ins.json())[0];
    console.log('✓ social_posts (reels) oluşturuldu:', post.id);
  }

  console.log('── Telegram video onayı gönderiliyor ──');
  const capTg = `🎬 HAFTANIN BÜLTENİ — ${range}\n\nOnaylarsan Instagram Reels'e yayınlanır.`;
  const msgId = await sendVideoUpload(mp4, capTg, post.id);
  if (msgId) {
    await supa(`/social_posts?id=eq.${post.id}`, {
      method: 'PATCH', body: JSON.stringify({ telegram_message_id: msgId, scheduled_at: `${date}T09:00:00+03:00` }),
    }).catch(() => {});
    console.log(`✅ Bülten onayı gönderildi (message_id ${msgId}). Onaylanınca IG Reels.`);
  }
}

main().catch(e => { console.error('[bulten-approval]', e); process.exit(1); });
