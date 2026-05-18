// lib/telegram.js
// Minimal Telegram Bot API client — Vercel serverless'da kullanım için.
// Bağımlılık yok, sadece global fetch.

const API_BASE = 'https://api.telegram.org';

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN env tanımlı değil');
  return t;
}

async function call(method, body) {
  const url = `${API_BASE}/bot${token()}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(`telegram ${method} fail: ${json.description || res.status}`);
  }
  return json.result;
}

// Markdown V2 escape — Telegram requires escaping certain chars
export function escapeMd(s) {
  return String(s ?? '').replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

export function sendMessage(chatId, text, opts = {}) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: opts.parse_mode || 'MarkdownV2',
    disable_web_page_preview: opts.disable_web_page_preview ?? true,
    reply_markup: opts.reply_markup,
  });
}

export function editMessageText(chatId, messageId, text, opts = {}) {
  return call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts.parse_mode || 'MarkdownV2',
    disable_web_page_preview: opts.disable_web_page_preview ?? true,
    reply_markup: opts.reply_markup,
  });
}

export function answerCallbackQuery(callbackQueryId, opts = {}) {
  return call('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: opts.text || '',
    show_alert: opts.show_alert || false,
  });
}

export function sendPhoto(chatId, photoUrl, caption, opts = {}) {
  return call('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: opts.parse_mode || 'MarkdownV2',
    reply_markup: opts.reply_markup,
  });
}

export function setWebhook(url, secretToken) {
  return call('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['callback_query', 'message'],
  });
}

// Inline keyboard helper: 2x2 grid for approval flow
export function approvalKeyboard(postId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Yayınla Şimdi', callback_data: `pub:${postId}:now` },
        { text: '⏰ Önerilen Saatte', callback_data: `pub:${postId}:scheduled` },
      ],
      [
        { text: '✏️ Değiştir', callback_data: `pub:${postId}:edit` },
        { text: '❌ Reddet', callback_data: `pub:${postId}:reject` },
      ],
    ],
  };
}
