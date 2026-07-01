// scripts/approval-reminder.mjs
// Workflow 4 (Takip/Tırmandırma) + Gap C (seed→onay köprüsü) — TEK script.
//
// Ne yapar:
//   1. status=pending_approval tüm post'ları tarar.
//   2. telegram_message_id YOKSA  → ilk onay mesajını gönderir (Gap C: seed-30day
//      pending_approval ekliyor ama onay göndermiyordu). message_id kaydeder.
//   3. telegram_message_id VARSA + yaş eşiği geçtiyse → kademeli hatırlatma:
//        H1  → nazik hatırlatma (orijinal mesaja reply)
//        H2  → ikinci hatırlatma + Berkay'a ping
//        H3  → son çare: APPROVAL_ESCALATION'a göre
//                'default' → status=approved, scheduled_at=now (publish-queue yayınlar)
//                'skip'    → status=rejected, reject_reason=auto_skip_timeout (o gün boş)
//   Aynı kademe iki kez tetiklenmesin diye engagement_metrics.reminder_stage izlenir.
//
// Kullanım:
//   node scripts/approval-reminder.mjs            # canlı
//   node scripts/approval-reminder.mjs --dry-run  # yazma yok, sadece rapor
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
// Config (opsiyonel):
//   APPROVAL_REMIND_H1=4  APPROVAL_REMIND_H2=12  APPROVAL_REMIND_H3=24
//   APPROVAL_ESCALATION=skip   # 'skip' (varsayılan) | 'default'

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');

// .env.local fallback (weekly-content-planner.mjs ile aynı desen)
try {
  const env = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_ADMIN_CHAT_ID;

const H1 = Number(process.env.APPROVAL_REMIND_H1 || 4);
const H2 = Number(process.env.APPROVAL_REMIND_H2 || 12);
const H3 = Number(process.env.APPROVAL_REMIND_H3 || 24);
const ESCALATION = (process.env.APPROVAL_ESCALATION || 'skip').toLowerCase();

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

const trTime = iso => new Date(iso).toLocaleString('tr-TR', {
  timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric',
  month: 'long', hour: '2-digit', minute: '2-digit',
});

function firstApprovalText(p) {
  const tags = Array.isArray(p.hashtags) ? p.hashtags : [];
  const tagLine = tags.length
    ? `${tags.slice(0, 5).map(mdEscape).join(' ')}${tags.length > 5 ? ` \\+${tags.length - 5} daha` : ''}`
    : '_yok_';
  return `🎬 *ONAY BEKLİYOR — ${mdEscape(p.content_type || 'post')}*

*Paket:* ${mdEscape(p.content_pack_id)}
*Önerilen:* ${mdEscape(trTime(p.scheduled_at))}
${p.duration_s ? `*Süre:* ${p.duration_s}s\n` : ''}━━━━━━━━━━
*Caption:*
${mdEscape((p.caption || '').slice(0, 200))}${(p.caption || '').length > 200 ? '\\.\\.\\.' : ''}

*Hashtag:* ${tagLine}
━━━━━━━━━━`;
}

async function patch(postId, body) {
  if (DRY) return { ok: true };
  const res = await supa(`/social_posts?id=eq.${postId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body),
  });
  if (!res.ok) console.error('  patch fail', res.status, await res.text());
  return res;
}

async function main() {
  const sel = 'id,content_pack_id,content_type,caption,hashtags,duration_s,scheduled_at,'
            + 'telegram_message_id,created_at,engagement_metrics';
  const res = await supa(`/social_posts?status=eq.pending_approval&order=created_at.asc&select=${sel}&limit=100`);
  if (!res.ok) { console.error('fetch fail:', res.status, await res.text()); process.exit(1); }
  const posts = await res.json();
  console.log(`[remind] ${posts.length} pending_approval post · eşikler H1=${H1} H2=${H2} H3=${H3} · escalation=${ESCALATION} · ${DRY ? 'DRY' : 'LIVE'}`);

  const now = Date.now();
  let sentInitial = 0, reminded = 0, escalated = 0;

  for (const p of posts) {
    const em = (p.engagement_metrics && typeof p.engagement_metrics === 'object') ? p.engagement_metrics : {};

    // ── Gap C: onay mesajı hiç gönderilmemiş → gönder
    if (!p.telegram_message_id) {
      console.log(` • ${p.content_pack_id}: onay mesajı YOK → gönderiliyor`);
      if (!DRY) {
        const r = await tg('sendMessage', {
          chat_id: Number(TG_CHAT), text: firstApprovalText(p), parse_mode: 'MarkdownV2',
          disable_web_page_preview: true, reply_markup: approvalKeyboard(p.id),
        });
        if (r.ok) {
          await patch(p.id, { telegram_message_id: r.result.message_id, telegram_chat_id: Number(TG_CHAT) });
          sentInitial++;
        } else {
          console.error('  telegram fail:', JSON.stringify(r).slice(0, 200));
        }
        await new Promise(r => setTimeout(r, 400));
      } else { sentInitial++; }
      continue;
    }

    // ── Workflow 4: yaş bazlı eskalasyon
    const ageH = (now - new Date(p.created_at).getTime()) / 3600000;
    const stage = Number(em.reminder_stage || 0);

    if (ageH >= H3 && stage < 3) {
      escalated++;
      if (ESCALATION === 'default') {
        console.log(` • ${p.content_pack_id}: H3 (${ageH.toFixed(1)}s) → SON ÇARE auto-approve`);
        await patch(p.id, {
          status: 'approved', scheduled_at: new Date(now).toISOString(),
          engagement_metrics: { ...em, reminder_stage: 3, auto_action: 'default_approved' },
        });
        if (!DRY) await tg('sendMessage', {
          chat_id: Number(TG_CHAT), parse_mode: 'MarkdownV2',
          reply_to_message_id: p.telegram_message_id,
          text: `⚙️ *Otomatik onaylandı* \\(son çare, ${Math.round(ageH)}s onaysız\\)\n${mdEscape(p.content_pack_id)} → publish\\-queue yayınlayacak\\.`,
        });
      } else {
        console.log(` • ${p.content_pack_id}: H3 (${ageH.toFixed(1)}s) → ATLANDI (skip)`);
        await patch(p.id, {
          status: 'rejected', reject_reason: 'auto_skip_timeout',
          engagement_metrics: { ...em, reminder_stage: 3, auto_action: 'skipped' },
        });
        if (!DRY) await tg('sendMessage', {
          chat_id: Number(TG_CHAT), parse_mode: 'MarkdownV2',
          reply_to_message_id: p.telegram_message_id,
          text: `⏭️ *Atlandı* \\(${Math.round(ageH)}s onaysız kaldı\\)\n${mdEscape(p.content_pack_id)} bu tur yayınlanmayacak\\.`,
        });
      }
      if (!DRY) await new Promise(r => setTimeout(r, 400));
      continue;
    }

    if (ageH >= H2 && stage < 2) {
      reminded++;
      console.log(` • ${p.content_pack_id}: H2 (${ageH.toFixed(1)}s) → 2. hatırlatma + ping`);
      if (!DRY) {
        await tg('sendMessage', {
          chat_id: Number(TG_CHAT), parse_mode: 'MarkdownV2', reply_to_message_id: p.telegram_message_id,
          text: `🔔🔔 *2\\. hatırlatma* \\(${Math.round(ageH)}s onaysız\\)\n${mdEscape(p.content_pack_id)} hâlâ bekliyor\\. ${H3 - Math.round(ageH)}s sonra ${ESCALATION === 'default' ? 'otomatik onaylanır' : 'atlanır'}\\.`,
        });
        await patch(p.id, { engagement_metrics: { ...em, reminder_stage: 2 } });
        await new Promise(r => setTimeout(r, 400));
      }
      continue;
    }

    if (ageH >= H1 && stage < 1) {
      reminded++;
      console.log(` • ${p.content_pack_id}: H1 (${ageH.toFixed(1)}s) → nazik hatırlatma`);
      if (!DRY) {
        await tg('sendMessage', {
          chat_id: Number(TG_CHAT), parse_mode: 'MarkdownV2', reply_to_message_id: p.telegram_message_id,
          text: `🔔 *Hatırlatma* — ${mdEscape(p.content_pack_id)} onay bekliyor \\(${Math.round(ageH)}s\\)\\.`,
        });
        await patch(p.id, { engagement_metrics: { ...em, reminder_stage: 1 } });
        await new Promise(r => setTimeout(r, 400));
      }
      continue;
    }
  }

  console.log(`[remind] ✅ ilk-onay: ${sentInitial} · hatırlatma: ${reminded} · eskalasyon: ${escalated}`);
}

main().catch(e => { console.error('[remind] fatal:', e); process.exit(1); });
