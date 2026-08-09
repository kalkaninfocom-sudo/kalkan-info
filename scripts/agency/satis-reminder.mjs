#!/usr/bin/env node
/**
 * Satış hatırlatıcı — Telegram'a düzenli "kimi ara / kimi takip et" bildirimi.
 * Kaynak durum: data/satis-takip.json (Berkay sonuç yazar → Claude günceller).
 * Telegram deseni health-check.mjs ile aynı (TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID).
 * Vercel'e DOKUNMAZ — GitHub Actions cron ile çalışır (.github/workflows/satis-reminder.yml).
 *
 * Kullanım:
 *   node scripts/agency/satis-reminder.mjs         # Telegram'a gönder
 *   node scripts/agency/satis-reminder.mjs --dry    # sadece ekrana yaz (test)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dry = process.argv.includes('--dry');
const today = new Date().toISOString().slice(0, 10);

const data = JSON.parse(readFileSync(join(ROOT, 'data', 'satis-takip.json'), 'utf8'));
const h = data.hedefler || [];

const ETIKET = {
  aranacak: '📞 Aranacak', ulasilamadi: '🔁 Ulaşılamadı', ulasildi: '🗣️ Ulaşıldı',
  'demo-gonderildi': '📤 Demo gönderildi', ilgilendi: '👀 İlgilendi',
  'fiyat-sordu': '💬 Fiyat sordu', takip: '🔔 Takip', reddetti: '❌ Reddetti', satis: '✅ SATIŞ',
};

// bugün ele alınacaklar: hiç aranmamış + ulaşılamamış + takip günü gelmiş
const aranacak = h.filter(x => x.durum === 'aranacak' || x.durum === 'ulasilamadi');
const takip = h.filter(x => x.durum === 'takip' && (!x.takipTarih || x.takipTarih <= today));
const sicak = h.filter(x => ['ilgilendi', 'fiyat-sordu', 'demo-gonderildi'].includes(x.durum));

// skorbord
const say = {};
for (const x of h) say[x.durum] = (say[x.durum] || 0) + 1;
const skor = Object.entries(say).map(([k, v]) => `${ETIKET[k] || k}: ${v}`).join(' · ');

let msg = `☀️ KALKAN INFO — Satış Hatırlatıcı (${today})\n`;
msg += `Kart: docs/SATIS-ARAMA-KARTI.md · PDF: dist/satis-pdf/<slug>.pdf\n\n`;

if (aranacak.length) {
  msg += `📞 BUGÜN ARA (${aranacak.length}):\n`;
  msg += aranacak.map(x => `• ${x.isim} — ${x.tel}${x.yorum ? ` (${x.yorum} yorum)` : ''}${x.not ? ` — ${x.not}` : ''}`).join('\n') + '\n\n';
}
if (takip.length) {
  msg += `🔔 TAKİP ZAMANI (${takip.length}):\n`;
  msg += takip.map(x => `• ${x.isim} — ${x.tel}${x.not ? ` — ${x.not}` : ''}`).join('\n') + '\n\n';
}
if (sicak.length) {
  msg += `🔥 SICAK (kapatmaya yakın):\n`;
  msg += sicak.map(x => `• ${x.isim} [${ETIKET[x.durum]}]${x.not ? ` — ${x.not}` : ''}`).join('\n') + '\n\n';
}
if (!aranacak.length && !takip.length) {
  msg += `🎉 Bugün bekleyen arama/takip yok. Yeni hedef eklemek için arama listesini genişlet.\n\n`;
}
msg += `📊 Skorbord: ${skor || '—'}\n`;
msg += `Sonuç bildir: "Zeugma — ulaştım — demo istedi — yarın takip"`;

async function sendTelegram(text) {
  const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!TG || !CHAT) { console.log('ℹ Telegram env yok — gönderilemedi (CI\'da secret var).'); return false; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    if (!j.ok) { console.log('⚠ Telegram:', j.description); return false; }
    return true;
  } catch (e) { console.log('⚠ Telegram hata:', e.message); return false; }
}

if (dry) {
  console.log('--- DRY (gönderilmedi) ---\n' + msg);
} else {
  const ok = await sendTelegram(msg);
  console.log(ok ? '✅ Hatırlatıcı gönderildi.' : 'ℹ Gönderilemedi (yukarıya bak).');
}
