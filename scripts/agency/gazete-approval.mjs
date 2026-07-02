#!/usr/bin/env node
/**
 * scripts/agency/gazete-approval.mjs — GAZETE GÖRSEL ONAY (Faz 1b)
 * ----------------------------------------------------------------
 * Yayından ~5 dk önce (07:55) çalışır. Berkay'ın ZORUNLU kuralı:
 *   Onaya prompt/metin DEĞİL, birebir yayınlanacak NİHAİ GÖRSEL gider.
 *
 * Akış:
 *   1. Bugünün gazetesini üret + 4:5 kapak kartlarını render et + social_posts'a
 *      kuyruğa al  → mevcut `scripts/newspaper-daily.mjs` (web anında yayında).
 *   2. social_posts satır id'sini çek (content_pack_id = gazete-<date>).
 *   3. Kapak kartını (morning-card.png) Telegram'a FOTO olarak yükle +
 *      ✅ Yayınla / ⏰ 08:00'de / ❌ Reddet butonları (pub:<id>:...).
 *      → Onay callback'i MEVCUT api/telegram-webhook.js tarafından işlenir →
 *        onaylanınca api/social-publish-queue IG/FB'ye yayınlar (web zaten canlı).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID.
 * Eksikse: kart yine üretilir (dosya diskte), Telegram/kuyruk adımı graceful atlanır.
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle
try {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SITE_BASE = process.env.SITE_BASE || 'https://www.kalkaninfo.com';

const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD (TR)

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

// Telegram'a yerel PNG'yi FOTO olarak yükle (multipart) — URL değil, birebir görsel
async function sendPhotoUpload(cardPath, caption, postId) {
  if (!TG_TOKEN || !TG_CHAT) { console.warn('  ℹ TELEGRAM env yok — onay mesajı atlandı (kart diskte hazır)'); return null; }
  const buf = await readFile(cardPath);
  const form = new FormData();
  form.append('chat_id', String(TG_CHAT));
  form.append('photo', new Blob([buf], { type: 'image/png' }), 'gazete-kapak.png');
  form.append('caption', caption.slice(0, 1024));
  form.append('reply_markup', JSON.stringify(approvalKeyboard(postId)));
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: form });
  const j = await res.json();
  if (!j.ok) { console.error('  ✗ Telegram sendPhoto:', j.description); return null; }
  return j.result?.message_id || null;
}

async function main() {
  console.log(`\n════ GAZETE ONAY — ${date} (görselli) ════`);

  // 1) Üret + kart render + social_posts kuyruğu (mevcut akış; web anında canlı)
  console.log('── Gazete üret + kapak render + kuyruk (newspaper-daily) ──');
  const r = spawnSync('node', ['scripts/newspaper-daily.mjs', date], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) console.warn('⚠ newspaper-daily hata verdi ama kartlar üretilmiş olabilir, devam.');

  const cardPath = join(ROOT, 'newspaper', 'archive', date, 'morning-card.png');
  if (!existsSync(cardPath)) { console.error(`❌ Kapak kartı yok: ${cardPath} — onay gönderilemez.`); process.exit(1); }
  console.log(`✓ Kapak görseli hazır: newspaper/archive/${date}/morning-card.png`);

  // 2) social_posts satır id'si
  if (!SUPA_URL || !SUPA_KEY) { console.warn('ℹ Supabase env yok — id çekilemedi, Telegram onayı atlandı. (Kart hazır.)'); return; }
  const q = await supa(`/social_posts?content_pack_id=eq.gazete-${date}&select=id,telegram_message_id&limit=1`);
  const rows = q.ok ? await q.json() : [];
  const post = rows[0];
  if (!post) { console.warn('ℹ social_posts satırı bulunamadı (newspaper-daily kuyruğa alamadı — env?). Kart hazır.'); return; }
  if (post.telegram_message_id) { console.log('ℹ Bu sayı için onay zaten gönderilmiş, tekrar gönderilmiyor.'); return; }

  // 3) Kartı FOTO olarak onaya gönder
  const caption =
    `📰 BUGÜNÜN GAZETESİ — ${date}\n` +
    `Ön Sayfa + Magazin hazır. Yayına planlandı: bugün 08:00 (web + Instagram + Facebook).\n` +
    `Aşağıdaki görsel birebir yayınlanacak kapaktır. Onaylıyor musun?`;
  console.log('── Telegram görselli onay gönderiliyor ──');
  const msgId = await sendPhotoUpload(cardPath, caption, post.id);
  if (msgId) {
    // Planlanan yayın saati = bugün 08:00 TR (⏰ butonu bunu kullanır)
    const scheduledAt = `${date}T08:00:00+03:00`;
    await supa(`/social_posts?id=eq.${post.id}`, {
      method: 'PATCH', body: JSON.stringify({ telegram_message_id: msgId, scheduled_at: scheduledAt }),
    }).catch(() => {});
    console.log(`✅ Onay gönderildi (message_id ${msgId}). Onaylanınca ${SITE_BASE}/gazete + IG/FB (08:00).`);
  }
}

main().catch(e => { console.error('[gazete-approval]', e); process.exit(1); });
