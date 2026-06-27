#!/usr/bin/env node
// scripts/build-whatsapp-photo-campaign.mjs
// Görseli eksik restoranlar için WhatsApp fotoğraf kampanyası listesi üretir.
// İdempotent — tekrar çalıştırılabilir, çıktıyı üzerine yazar.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Yardımcı: telefon → E.164 (+90XXXXXXXXXX) ─────────────────────────────
function normalizePhone(raw) {
  if (!raw || !raw.trim()) return null;
  // Sadece rakamları al
  let digits = raw.replace(/\D/g, '');
  // Başında 90 varsa (+90 xxx gibi) — zaten ülke kodu
  if (digits.startsWith('90') && digits.length === 12) {
    return `+${digits}`;
  }
  // Başında 0 varsa (0532...) — yerel format
  if (digits.startsWith('0') && digits.length === 11) {
    return `+9${digits}`;
  }
  // 10 haneli, başında 5 (532...) — ülke kodu yok
  if (digits.length === 10 && digits.startsWith('5')) {
    return `+90${digits}`;
  }
  // 12 haneli başka bir kombinasyon (nadir)
  if (digits.length >= 11) {
    return `+${digits}`;
  }
  return null; // parse edilemedi
}

// ─── Mesaj üretici ──────────────────────────────────────────────────────────
function buildMessages(restaurant) {
  const slug = restaurant.id || restaurant.detailPath?.replace('/restoran/', '').replace('/', '') || '';
  const pageUrl = `https://kalkaninfo.com/restoran/${slug}/`;
  const name = restaurant.name;

  const tr = `Merhaba ${name}! Ben Berkay — kalkaninfo.com kurucusu. Mekanınız sitemizde listelendi ama fotoğrafınız yok: ${pageUrl} WhatsApp'tan 2-3 yatay fotoğraf gönderebilirseniz çok iyi olur. Telif size kalır, sadece kalkaninfo.com'da kullanırız. Yanıtlamak istemezseniz görmezden gelebilirsiniz. Teşekkürler!`;

  const en = `Hi ${name}! I'm Berkay from kalkaninfo.com. Your venue is listed on our site but has no photos yet: ${pageUrl} — could you send 2-3 landscape photos via WhatsApp? You keep the copyright; we'd use them only on kalkaninfo.com. Feel free to ignore this if you prefer. Thanks!`;

  return { tr, en, pageUrl };
}

// ─── Main ───────────────────────────────────────────────────────────────────
const data = JSON.parse(readFileSync(resolve(ROOT, 'data/restoranlar.json'), 'utf8'));
const items = data.items;

// Görseli eksik olanları filtrele
function hasVisual(r) {
  if (r.image && r.image.trim() && !r.image.includes('placehold')) return true;
  if (r.cover && r.cover.trim()) return true;
  if (r.photo && r.photo.trim()) return true;
  if (r.gallery && r.gallery.some(g => g && g.trim() && !g.includes('placehold'))) return true;
  return false;
}

const missing = items.filter(r => !hasVisual(r));

let withPhone = 0;
let withoutPhone = 0;

const campaign = missing.map(r => {
  const rawPhone = r.phone || r.whatsapp || r.mobile || '';
  const phone_e164 = normalizePhone(rawPhone);
  const missing_phone = !phone_e164;

  if (missing_phone) withoutPhone++;
  else withPhone++;

  const { tr, en, pageUrl } = buildMessages(r);

  const whatsapp_url = phone_e164
    ? `https://wa.me/${phone_e164.replace('+', '')}?text=${encodeURIComponent(tr)}`
    : null;

  return {
    id: r.id,
    name: r.name,
    category: r.category || '',
    location: r.location || '',
    phone_raw: rawPhone.trim() || null,
    phone_e164,
    whatsapp_url,
    page_url: pageUrl,
    message_tr: tr,
    message_en: en,
    missing_phone,
  };
});

// Telefonu olanları önce sırala
campaign.sort((a, b) => {
  if (!a.missing_phone && b.missing_phone) return -1;
  if (a.missing_phone && !b.missing_phone) return 1;
  return a.name.localeCompare(b.name, 'tr');
});

const out = resolve(ROOT, 'data/whatsapp-photo-campaign.json');
writeFileSync(out, JSON.stringify(campaign, null, 2), 'utf8');

console.log('=== WhatsApp Fotoğraf Kampanyası ===');
console.log(`Toplam restoran        : ${items.length}`);
console.log(`Görseli eksik          : ${missing.length}`);
console.log(`Telefonlu (mesaj hazır): ${withPhone}`);
console.log(`Telefonsuz (manuel)    : ${withoutPhone}`);
console.log(`Çıktı                  : data/whatsapp-photo-campaign.json`);
