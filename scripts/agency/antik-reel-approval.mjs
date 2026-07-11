#!/usr/bin/env node
/**
 * scripts/agency/antik-reel-approval.mjs — HAFTANIN ANTİK KENTİ reel ONAY.
 * ------------------------------------------------------------------------
 * restoran-reel-approval.mjs ikizi; antik kent reel'ine uyarlanmış. Akış:
 *   1. Reel render (build-antik-reel.mjs) → dist/social/antik/antik-reel.mp4
 *   2. mp4'ü Supabase storage'a yükle → public URL
 *   3. social_posts satırı: content_type='reels', local_assets=[videoUrl], status='pending_approval'
 *   4. Telegram'a VİDEO onayı (pub:<id>:... — webhook publishReels → IG Reels).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID.
 * Eksikse: reel yine render edilir (diskte), Telegram/kuyruk graceful atlanır.
 *
 * Kullanım: node scripts/agency/antik-reel-approval.mjs [slug|isim]
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
const SITE_BASE = process.env.SITE_BASE || 'https://kalkaninfo.com';

const forceArg = process.argv.slice(2).find(a => !a.startsWith('-'));
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

function approvalKeyboard(postId) {
  return { inline_keyboard: [
    [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
     { text: '⏰ 20:00’de Yayınla', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '❌ Reddet', callback_data: `pub:${postId}:reject` }],
  ]};
}

async function sendVideoUpload(mp4Path, caption, postId) {
  if (!TG_TOKEN || !TG_CHAT) { console.warn('  ℹ TELEGRAM env yok — onay atlandı (reel diskte hazır)'); return null; }
  const buf = await readFile(mp4Path);
  const form = new FormData();
  form.append('chat_id', String(TG_CHAT));
  form.append('video', new Blob([buf], { type: 'video/mp4' }), 'antik-reel.mp4');
  form.append('caption', caption.slice(0, 1024));
  form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVideo`, { method: 'POST', body: form });
  const j = await res.json();
  if (!j.ok) { console.error('  ✗ Telegram sendVideo:', j.description); return null; }
  return j.result?.message_id || null;
}

async function main() {
  console.log(`\n════ ANTİK REEL ONAY — Haftanın Antik Kenti (${date}) ════`);

  // 1) Render
  console.log('── Reel render (build-antik-reel) ──');
  const args = ['scripts/agency/build-antik-reel.mjs'];
  if (forceArg) args.push(forceArg);
  const r = spawnSync('node', args, { cwd: ROOT, stdio: 'inherit' });
  const mp4 = join(ROOT, 'dist', 'social', 'antik', 'antik-reel.mp4');
  if (r.status !== 0 || !existsSync(mp4)) { console.error('❌ Reel render edilemedi:', mp4); process.exit(1); }
  console.log('✓ Reel hazır:', mp4);

  // Props'tan kent bilgisi (caption için)
  let p = {};
  try { p = JSON.parse(await readFile(join(ROOT, 'remotion', 'props-antik.json'), 'utf8')); } catch {}
  const name = p.name || 'Likya antik kenti';
  const slug = (p.cta || '').split('/').filter(Boolean).pop()?.replace(/\.html$/, '') || '';

  if (!SUPA_URL || !SUPA_KEY) { console.warn('ℹ Supabase env yok — yükleme/onay atlandı. (Reel diskte.)'); return; }

  // 2) Storage'a yükle (kent bazlı benzersiz yol → tekrar üretimde üzerine yazar)
  const objectPath = `antik-reel/antik-reel-${date}${slug ? '-' + slug : ''}.mp4`;
  const buf = await readFile(mp4);
  const up = await fetch(`${SUPA_URL}/storage/v1/object/social-media/${objectPath}`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
    body: buf,
  });
  if (!up.ok) { console.error('  ✗ storage upload fail:', up.status, (await up.text()).slice(0, 160)); process.exit(1); }
  const videoUrl = `${SUPA_URL}/storage/v1/object/public/social-media/${objectPath}`;
  console.log('✓ Yüklendi:', videoUrl);

  // 3) social_posts satırı (app-seviyesi upsert; haftada bir kent → packId tarihli)
  const packId = `antik-reel-${date}`;
  let post;
  const q = await supa(`/social_posts?content_pack_id=eq.${packId}&select=id,telegram_message_id&limit=1`);
  post = (q.ok ? await q.json() : [])[0];
  if (post?.telegram_message_id) { console.log('ℹ Bu reel için onay zaten gönderilmiş, tekrar gönderilmiyor.'); return; }

  const cta = p.cta || 'kalkaninfo.com/antik-kentler.html';
  const caption = `🏛️ HAFTANIN ANTİK KENTİ · ${name}\n\n${p.tagline || ''}\n\nDetay & ziyaret: ${cta}

🇬🇧 This week’s featured ancient city near Kalkan — ${name}. Guide: ${cta}`;
  const hashtags = ['#kalkan', '#kalkaninfo', '#likya', '#kaş', '#antikkent'].slice(0, 5);

  if (!post) {
    const row = {
      content_pack_id: packId,
      content_type: 'reels',
      language: 'tr',
      caption,
      hashtags,
      local_assets: [videoUrl],
      status: 'pending_approval',
      scheduled_at: `${date}T20:00:00+03:00`,
      telegram_chat_id: TG_CHAT ? Number(TG_CHAT) : null,
    };
    const ins = await supa('/social_posts?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    if (!ins.ok) { console.error('  ✗ social_posts insert fail:', ins.status, (await ins.text()).slice(0, 160)); return; }
    post = (await ins.json())[0];
    console.log('✓ social_posts (reels) oluşturuldu:', post.id);
  }

  // 4) Telegram video onayı
  console.log('── Telegram video onayı gönderiliyor ──');
  // 3.5) KALİTE KAPISI (Düzeltme C): Telegram'dan ÖNCE eleştirmen değerlendirmesi.
  //      Yayını engellemez; düşük puanda onay mesajına "DÜŞÜK PUAN" uyarısı eklenir.
  let kaliteUyari = '';
  try {
    const kapi = await qualityGate('antik-reel', { baslik: name, tagline: p.tagline, metin: caption });
    if (!kapi.pass && kapi.warning) kaliteUyari = kapi.warning + '\n\n';
  } catch (e) { console.warn('  ℹ kalite kapısı atlandı (hata):', e.message); }

  const capTg = `${kaliteUyari}🎬 HAFTANIN ANTİK KENTİ REEL'İ — ${name}\n${p.period || ''}${p.rating ? ` · ${p.rating}★` : ''}\n\nOnaylarsan Instagram Reels'e yayınlanır.`;
  const msgId = await sendVideoUpload(mp4, capTg, post.id);
  if (msgId) {
    await supa(`/social_posts?id=eq.${post.id}`, {
      method: 'PATCH', body: JSON.stringify({ telegram_message_id: msgId, scheduled_at: `${date}T20:00:00+03:00` }),
    }).catch(() => {});
    console.log(`✅ Reel onayı gönderildi (message_id ${msgId}). Onaylanınca IG Reels.`);
  }
}

main().catch(e => { console.error('[antik-reel-approval]', e); process.exit(1); });
