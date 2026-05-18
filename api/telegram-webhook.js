// api/telegram-webhook.js
// Telegram bot inline-button callback handler — onay flow.
//
// Setup tamamlandı:
//   ✅ TELEGRAM_BOT_TOKEN (Vercel env)
//   ✅ TELEGRAM_WEBHOOK_SECRET (Vercel env)
//   ✅ TELEGRAM_ADMIN_CHAT_ID (Vercel env)
//   ✅ Webhook URL: https://www.kalkaninfo.com/api/telegram-webhook

import { answerCallbackQuery, editMessageText, escapeMd, sendMessage } from '../lib/telegram.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(path, opts = {}) {
  return fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

async function updateStatus(postId, patch) {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const res = await supa(`/social_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error('[telegram-webhook] supabase patch fail', res.status, await res.text());
    return null;
  }
  const [updated] = await res.json();
  return updated;
}

export default async function handler(req, res) {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    return res.status(401).json({ ok: false, error: 'invalid secret' });
  }

  const update = req.body || {};

  try {
    // ── Message: /start, /id, /plan
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').trim();

      if (text === '/start' || text === '/id') {
        await sendMessage(chatId,
          `Merhaba Berkay\\! ✅\n\nChat ID: \`${chatId}\`\n\nBu ID Vercel env \`TELEGRAM_ADMIN_CHAT_ID\` olarak eklendi\\. Onay flow aktif\\.\n\nKomutlar:\n/plan — bu haftaki planı göster\n/pending — onay bekleyenleri listele`);
      } else if (text === '/plan' || text === '/pending') {
        if (SUPA_URL && SUPA_KEY) {
          const r = await supa('/social_posts?status=eq.pending_approval&order=scheduled_at.asc&select=id,content_pack_id,scheduled_at&limit=10');
          const list = r.ok ? await r.json() : [];
          const body = list.length
            ? list.map(p => `• ${escapeMd(p.content_pack_id)} → ${escapeMd(new Date(p.scheduled_at).toLocaleString('tr-TR'))}`).join('\n')
            : '_Onay bekleyen post yok\\._';
          await sendMessage(chatId, `📋 *Bekleyen Post'lar*\n\n${body}`);
        } else {
          await sendMessage(chatId, '_Supabase yapılandırılmadı\\._');
        }
      }
      return res.status(200).json({ ok: true });
    }

    // ── Callback query: 4-button approval
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      const [verb, postId, action] = data.split(':');
      if (verb !== 'pub') {
        await answerCallbackQuery(cb.id, { text: 'Bilinmeyen komut' });
        return res.status(200).json({ ok: true });
      }

      // Test post handling (postId === 'test-patara' etc)
      const isTest = postId && postId.startsWith('test-');
      let post = null;

      if (!isTest) {
        // Real DB update
        const now = new Date();
        let patch = {};
        if (action === 'now') {
          patch = { status: 'approved', scheduled_at: new Date(now.getTime() + 60_000).toISOString() };
        } else if (action === 'scheduled') {
          patch = { status: 'approved' }; // scheduled_at zaten set
        } else if (action === 'edit') {
          patch = { status: 'draft' }; // Berkay admin panelden düzenleyecek
        } else if (action === 'reject') {
          patch = { status: 'rejected', reject_reason: 'admin_telegram_reject' };
        }
        post = await updateStatus(postId, patch);
      }

      const toastMap = {
        now:       '✅ Yayın kuyruğa alındı (1dk içinde)',
        scheduled: '⏰ Önerilen saate planlandı',
        edit:      '✏️ Taslağa alındı — admin panelden düzenle',
        reject:    '❌ Reddedildi',
      };
      const statusLabel = {
        now: 'APPROVED — Yayında 1dk içinde',
        scheduled: 'APPROVED — Planlandı',
        edit: 'DRAFT — Düzenle',
        reject: 'REJECTED',
      };

      await answerCallbackQuery(cb.id, { text: toastMap[action] || 'Aksiyon alındı' });

      if (chatId && messageId) {
        const orig = cb.message?.text || '';
        const sched = post?.scheduled_at
          ? new Date(post.scheduled_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
          : new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        await editMessageText(chatId, messageId,
          `${escapeMd(orig)}\n\n━━━━━━━━━━\n*Durum:* ${escapeMd(statusLabel[action] || 'UPDATED')}\n*Zaman:* ${escapeMd(sched)}`,
          { reply_markup: { inline_keyboard: [] } });
      }

      return res.status(200).json({ ok: true, action, postId, status: post?.status || 'test' });
    }

    return res.status(200).json({ ok: true, handled: false });
  } catch (err) {
    console.error('[telegram-webhook]', err);
    return res.status(200).json({ ok: false, error: String(err.message || err) });
  }
}
