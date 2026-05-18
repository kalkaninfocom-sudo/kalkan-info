// scripts/weekly-content-planner.mjs
// Pazartesi 09:00 TR cron — content/antik-reels.json'dan 7 günlük plan üret.
// Tekrar etmemek için son 30 günde yayınlananları Supabase'ten kontrol et.
// Her gün için 1 reels seç + scheduled_at hesapla + Telegram approval mesajı.
//
// Kullanım:
//   node scripts/weekly-content-planner.mjs            # production cron
//   node scripts/weekly-content-planner.mjs --dry-run  # test
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
//      TELEGRAM_ADMIN_CHAT_ID

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');

// .env.local fallback for local runs
try {
  const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!SUPA_URL || !SUPA_KEY) { console.error('❌ Supabase env eksik'); process.exit(1); }
if (!DRY && (!TG_TOKEN || !TG_CHAT)) { console.error('❌ Telegram env eksik'); process.exit(1); }

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: {
    apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  },
});

const tg = (method, body) => fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json());

const mdEscape = s => String(s ?? '').replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');

function approvalKeyboard(postId) {
  return { inline_keyboard: [
    [{ text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
     { text: '⏰ Önerilen Saatte', callback_data: `pub:${postId}:scheduled` }],
    [{ text: '✏️ Değiştir', callback_data: `pub:${postId}:edit` },
     { text: '❌ Reddet',  callback_data: `pub:${postId}:reject` }],
  ]};
}

// Pick 7 distinct items, prefer least-recently-used
function pickWeekly(items, recentlyPublished) {
  const recent = new Set(recentlyPublished.map(p => p.content_pack_id));
  const fresh = items.filter(i => !recent.has(i.id));
  const stale = items.filter(i => recent.has(i.id));
  const pool = [...fresh, ...stale].slice(0, 7);
  // pad if fewer than 7
  while (pool.length < 7) pool.push(items[pool.length % items.length]);
  return pool.slice(0, 7);
}

// Optimal schedule: günde 1 reels, best_post_times_tr[0] kullan
function scheduleDays(items) {
  const now = new Date();
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  // bu hafta pazartesi 12:00 TR'den başla
  return items.map((item, i) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + i);
    const [hh, mm] = (item.best_post_times_tr?.[0] || '19:00').split(':').map(Number);
    // TR = UTC+3, scheduled time UTC
    date.setUTCHours(hh - 3, mm, 0, 0);
    return { ...item, scheduled_at: date.toISOString() };
  });
}

async function main() {
  // Load content pack
  const pack = JSON.parse(readFileSync(
    resolve(__dirname, '..', 'content', 'antik-reels.json'), 'utf8'
  ));
  console.log(`[planner] ${pack.items.length} antik kent yüklendi`);

  // Recent published (last 30 days)
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const recRes = await supa(`/social_posts?status=eq.published&published_at=gte.${since}&select=content_pack_id`);
  const recent = recRes.ok ? await recRes.json() : [];
  console.log(`[planner] son 30 gün yayınlananlar: ${recent.length}`);

  // Pick + schedule
  const picks = scheduleDays(pickWeekly(pack.items, recent));
  console.log(`[planner] 7 günlük plan oluşturuldu`);

  if (DRY) {
    picks.forEach((p, i) => console.log(` ${i+1}. ${p.name} @ ${p.scheduled_at}`));
    process.exit(0);
  }

  // Insert + Telegram approval
  let sent = 0;
  for (const item of picks) {
    const post = {
      content_pack_id: item.id,
      content_type: 'reels',
      language: 'en',
      voiceover_text: item.voiceover_en,
      caption: item.caption_en,
      hashtags: item.hashtags || [],
      music_mood: item.music_mood,
      footage_queries: item.footage_queries || [],
      local_assets: item.local_assets || [],
      duration_s: item.duration_s || 25,
      target_audience: item.target_audience || [],
      status: 'pending_approval',
      scheduled_at: item.scheduled_at,
      telegram_chat_id: Number(TG_CHAT),
    };

    const ins = await supa('/social_posts?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(post),
    });
    if (!ins.ok) { console.error('insert fail:', ins.status, await ins.text()); continue; }
    const [created] = await ins.json();
    const postId = created.id;

    const dateStr = new Date(item.scheduled_at).toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric',
      month: 'long', hour: '2-digit', minute: '2-digit'
    });

    const txt = `🎬 *YENI REELS — Haftalık Plan*

*Konu:* ${mdEscape(item.name)}
*Tarih/Saat:* ${mdEscape(dateStr)}
*Süre:* ${item.duration_s}s · Müzik: ${mdEscape(item.music_mood)}

━━━━━━━━━━
*Voice\\-over:*
_${mdEscape(item.voiceover_en.slice(0, 250))}\\.\\.\\._

*Caption preview:*
${mdEscape(item.caption_en.slice(0, 150))}\\.\\.\\.

*Hashtag:* ${item.hashtags.slice(0,5).map(h=>mdEscape(h)).join(' ')} \\+${item.hashtags.length-5} daha
━━━━━━━━━━`;

    const res = await tg('sendMessage', {
      chat_id: Number(TG_CHAT), text: txt, parse_mode: 'MarkdownV2',
      disable_web_page_preview: true, reply_markup: approvalKeyboard(postId),
    });
    if (res.ok) {
      sent++;
      // Save message_id for later edit
      await supa(`/social_posts?id=eq.${postId}`, {
        method: 'PATCH', body: JSON.stringify({ telegram_message_id: res.result.message_id })
      });
    } else {
      console.error('telegram fail:', res);
    }
    await new Promise(r => setTimeout(r, 400)); // rate-limit nicety
  }

  console.log(`[planner] ✅ ${sent}/${picks.length} onay mesajı gönderildi`);
}

main().catch(e => { console.error('[planner] fatal:', e); process.exit(1); });
