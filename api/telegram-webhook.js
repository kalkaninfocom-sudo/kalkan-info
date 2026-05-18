// api/telegram-webhook.js
// Telegram bot inline-button callback'lerini handle eder.
// Berkay "Yayınla Şimdi" / "Önerilen Saatte" / "Değiştir" / "Reddet" tıkladığında
// burası tetiklenir.
//
// Setup:
//   1. Bot oluştur (BotFather): /newbot → Kalkan Info Social Manager
//   2. Token al, Vercel env: TELEGRAM_BOT_TOKEN
//   3. Berkay'ın chat_id'sini al (/start gönderince webhook'a düşer)
//      → Vercel env: TELEGRAM_ADMIN_CHAT_ID
//   4. Webhook secret (random string), Vercel env: TELEGRAM_WEBHOOK_SECRET
//   5. setWebhook: POST https://www.kalkaninfo.com/api/telegram-webhook
//      → scripts/setup-telegram.mjs ile otomatik

import { answerCallbackQuery, editMessageText, escapeMd } from '../lib/telegram.js';

export default async function handler(req, res) {
  // Telegram secret token doğrulaması
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    return res.status(401).json({ ok: false, error: 'invalid secret' });
  }

  const update = req.body || {};

  try {
    // Message handler — /start ile chat_id öğrenmek için
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || '';

      if (text === '/start' || text === '/id') {
        await import('../lib/telegram.js').then(t => t.sendMessage(chatId,
          `Merhaba Berkay\\! ✅\n\nChat ID: \`${chatId}\`\n\nBu ID'yi Vercel env \`TELEGRAM_ADMIN_CHAT_ID\` olarak ekleyince onay flow çalışır\\.`,
        ));
      }
      return res.status(200).json({ ok: true });
    }

    // Callback query — inline button click
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

      // Şimdilik stub — Supabase social_posts tablosu eklendikten sonra
      // gerçek state update yapılacak (Faz 2).
      const responseMap = {
        now:       { toast: '✅ Yayın kuyruğa alındı (şimdi)',         status: 'PUBLISH_NOW' },
        scheduled: { toast: '⏰ Önerilen saate planlandı',              status: 'SCHEDULED' },
        edit:      { toast: '✏️ Düzenleme link\'i hazırlanıyor',       status: 'EDIT_REQUESTED' },
        reject:    { toast: '❌ Reddedildi, taslak silindi',           status: 'REJECTED' },
      };

      const r = responseMap[action] || { toast: 'Bilinmeyen aksiyon', status: 'UNKNOWN' };

      await answerCallbackQuery(cb.id, { text: r.toast });

      // Mesajı güncelle — buton kaldır, status göster
      if (chatId && messageId) {
        const originalText = cb.message?.text || '';
        await editMessageText(chatId, messageId,
          `${escapeMd(originalText)}\n\n━━━━━━━━━━\n*Durum:* ${escapeMd(r.status)}\n*İşlem:* ${escapeMd(new Date().toISOString())}`,
          { reply_markup: { inline_keyboard: [] } },
        );
      }

      // TODO Faz 2: Supabase social_posts.status = r.status
      // TODO Faz 2: status === PUBLISH_NOW ise IG publish trigger
      return res.status(200).json({ ok: true, action: r.status, postId });
    }

    return res.status(200).json({ ok: true, handled: false });
  } catch (err) {
    console.error('[telegram-webhook]', err);
    return res.status(200).json({ ok: false, error: String(err.message || err) });
  }
}
