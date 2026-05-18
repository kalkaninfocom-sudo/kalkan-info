// scripts/setup-telegram.mjs
// Telegram bot setup helper — Berkay BotFather'dan token aldıktan sonra
// bu script ile webhook'u kayıt eder + ilk test mesajını atar.
//
// Kullanım:
//   1. BotFather'dan bot oluştur (/newbot), token al
//   2. PowerShell: $env:TELEGRAM_BOT_TOKEN = "12345:ABCD..."
//   3. node scripts/setup-telegram.mjs
//
// Veya .env.local'a TELEGRAM_BOT_TOKEN ekleyip script çalıştır.

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// .env.local fallback
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN tanımlı değil');
  console.error('   .env.local\'a ekle: TELEGRAM_BOT_TOKEN=12345:ABCD...');
  process.exit(1);
}

const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL ||
  'https://www.kalkaninfo.com/api/telegram-webhook';

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ||
  randomBytes(24).toString('hex');

const API = `https://api.telegram.org/bot${TOKEN}`;

async function call(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

console.log('📡 Telegram setup başlıyor...\n');

// 1. Bot bilgisi
const me = await call('getMe');
if (!me.ok) { console.error('❌ getMe fail:', me); process.exit(1); }
console.log(`✅ Bot: @${me.result.username} (id ${me.result.id})`);

// 2. Webhook info
const info = await call('getWebhookInfo');
console.log(`📍 Mevcut webhook: ${info.result.url || '(yok)'}`);

// 3. Set webhook
const setRes = await call('setWebhook', {
  url: WEBHOOK_URL,
  secret_token: SECRET,
  allowed_updates: ['callback_query', 'message'],
});
if (!setRes.ok) { console.error('❌ setWebhook fail:', setRes); process.exit(1); }
console.log(`✅ Webhook set: ${WEBHOOK_URL}`);
console.log(`🔑 Webhook secret: ${SECRET}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SONRAKİ ADIMLAR:');
console.log(`1. Vercel env (production scope) ekle:`);
console.log(`   TELEGRAM_BOT_TOKEN = ${TOKEN.slice(0, 12)}...`);
console.log(`   TELEGRAM_WEBHOOK_SECRET = ${SECRET}`);
console.log(`2. Telegram'da @${me.result.username} botuna /start mesajı at`);
console.log(`   Webhook chat_id'yi response'ta gösterecek`);
console.log(`3. TELEGRAM_ADMIN_CHAT_ID env'e o chat_id'yi ekle`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
