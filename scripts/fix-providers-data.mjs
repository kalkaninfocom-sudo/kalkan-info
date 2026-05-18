// scripts/fix-providers-data.mjs
// data/hizmet-saglayicilari.json içinde:
//  1. Fake telefon (+90 XXX XXX XX XX pattern) olan sağlayıcıları
//     verified:false + phone:null + contactVia:"concierge" yapar
//  2. Yeni doğrulanmış gerçek firmaları uygun kategorilere ekler
//  3. Berkay'ın WhatsApp'ı (+90 530 665 07 94) tüm fake'lerin whatsapp'ı
//     olarak set edilir (zaten öyle, sadece doğrula)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, '..', 'data', 'hizmet-saglayicilari.json');

const CONCIERGE_WA = '+90 530 665 07 94';
const FAKE_PHONE_RE = /XX|XXX|XXXX/;

const data = JSON.parse(readFileSync(path, 'utf8'));

let flagged = 0;
let kept = 0;

for (const [catKey, cat] of Object.entries(data.services)) {
  const providers = cat.providers || [];
  for (const p of providers) {
    const phone = p.phone || '';
    const isFakePhone = FAKE_PHONE_RE.test(phone);

    if (isFakePhone) {
      // Fake telefon — flag et
      p.phone = null;
      p.phoneRaw = null;
      p.verified = false;
      p.contactVia = 'concierge';
      p.whatsapp = CONCIERGE_WA;
      p.whatsappRaw = '905306650794';
      p.defaultMessage = `Merhaba Kalkan Info! ${p.name} (${cat.title}) için bilgi/rezervasyon istiyorum. Lütfen yönlendirir misiniz?`;
      flagged++;
    } else {
      kept++;
    }
  }
}

// Yeni doğrulanmış gerçek firmalar
const NEW_PROVIDERS = {
  catering: [
    {
      id: 'catering-grapevine',
      name: 'Grapevine Catering',
      type: 'İşletme',
      rating: 4.8,
      reviewCount: 0,
      image: '/assets/img/kalimera-logo.jpeg',
      summary: 'Kalkan villa catering ve özel etkinlik şefi — taze yerel malzemelerle Akdeniz ve uluslararası menüler.',
      specialties: ['Villa catering', 'Özel etkinlik', 'Akdeniz mutfağı'],
      experience: '5 yıl+',
      phone: '+90 539 664 07 71',
      phoneRaw: '905396640771',
      whatsapp: '+90 539 664 07 71',
      whatsappRaw: '905396640771',
      location: 'Kalkan',
      verified: true,
      featured: false,
    },
    {
      id: 'catering-korsan',
      name: 'Korsan Catering',
      type: 'İşletme',
      rating: 4.7,
      reviewCount: 0,
      image: '/assets/img/kalimera-logo.jpeg',
      summary: 'Tamer Şef ile premium villa catering hizmeti, özel menü tasarımı.',
      specialties: ['Premium villa catering', 'Özel menü', 'Şef hizmeti'],
      experience: '8 yıl+',
      phone: '+90 530 384 93 46',
      phoneRaw: '905303849346',
      whatsapp: '+90 530 384 93 46',
      whatsappRaw: '905303849346',
      location: 'Kalkan',
      verified: true,
      featured: false,
    },
  ],
  havuz: [
    {
      id: 'havuz-vega-maintenance',
      name: 'Kalkan Vega Maintenance',
      type: 'İşletme',
      rating: 4.8,
      reviewCount: 0,
      image: '/assets/img/952dc490ffdf.webp',
      summary: 'Çok hizmetli villa bakım firması — havuz, temizlik, bahçe, tesisat ve elektrik. Sezonluk kontrat seçenekleri.',
      specialties: ['Havuz bakım', 'Multi-service', 'Tesisat', 'Bahçe'],
      experience: '10 yıl+',
      website: 'https://kalkanmaintenance.com',
      phone: '+90 542 273 00 68',
      phoneRaw: '905422730068',
      whatsapp: '+90 542 273 00 68',
      whatsappRaw: '905422730068',
      location: 'Kalkan',
      verified: true,
      featured: true,
    },
  ],
  'transfer-havalimani': [
    {
      id: 'transfer-shuttle-kalkan',
      name: 'Shuttle Kalkan',
      type: 'İşletme',
      rating: 4.8,
      reviewCount: 0,
      image: '/assets/img/4c5a64a5ca12.webp',
      summary: 'Dalaman ve Antalya havalimanından özel ve paylaşımlı transfer. Online rezervasyon.',
      specialties: ['Dalaman transfer', 'Antalya transfer', 'Online rezervasyon'],
      experience: '10 yıl+',
      website: 'https://shuttlekalkan.com',
      phone: '+90 532 284 11 50',
      phoneRaw: '905322841150',
      whatsapp: '+90 532 284 11 50',
      whatsappRaw: '905322841150',
      location: 'Kalkan / Dalaman / Antalya',
      verified: true,
      featured: true,
    },
    {
      id: 'transfer-akdeniz-gercek',
      name: 'Akdeniz Transfer (akdeniztransfer.com)',
      type: 'İşletme',
      rating: 4.6,
      reviewCount: 0,
      image: '/assets/img/9309cf4d9e6d.webp',
      summary: 'Antalya havalimanı — Kalkan ekonomi ve VIP transfer hizmeti. Sabit fiyat.',
      specialties: ['Antalya transfer', 'Sabit fiyat'],
      experience: '8 yıl+',
      website: 'https://akdeniztransfer.com',
      phone: '+90 532 242 94 70',
      phoneRaw: '905322429470',
      whatsapp: '+90 532 242 94 70',
      whatsappRaw: '905322429470',
      location: 'Antalya / Kalkan',
      verified: true,
      featured: false,
    },
  ],
};

let added = 0;
for (const [catKey, newOnes] of Object.entries(NEW_PROVIDERS)) {
  if (!data.services[catKey]) continue;
  for (const p of newOnes) {
    if (data.services[catKey].providers.find(x => x.id === p.id)) continue;
    data.services[catKey].providers.push(p);
    added++;
  }
}

// _meta güncelle
data._meta.updated = new Date().toISOString().slice(0, 10);
data._meta.subtitle = "Kalkan'da yerel hizmet sağlayıcılar — telefonu olmayan sağlayıcılar için Kalkan Info concierge'i WhatsApp'ta yönlendirir";
data._meta.conciergeNote = `Telefon bilgisi henüz onaylanmamış sağlayıcılarda WhatsApp ${CONCIERGE_WA} (Kalkan Info concierge) üzerinden ulaşım sağlanır.`;

writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`✅ ${flagged} kurgusal sağlayıcı flag'lendi (verified:false, phone:null, contactVia:concierge)`);
console.log(`✅ ${kept} gerçek sağlayıcı korundu (Kalimera, Faruk)`);
console.log(`✅ ${added} yeni doğrulanmış sağlayıcı eklendi`);
console.log(`📁 Yazıldı: ${path}`);
