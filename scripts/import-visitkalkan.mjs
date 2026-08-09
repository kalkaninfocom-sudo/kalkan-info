// import-visitkalkan.mjs — visitkalkan.online'dan çekilen YENİ işletmeleri kalkaninfo envanterine ekler.
// Dedup: normalize edilmiş isme göre. Idempotent — tekrar çalıştırmak güvenli.
// Kaynak: https://www.visitkalkan.online (2026-07-29 hasadı)
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = new URL('../data/', import.meta.url);
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/beachclub|beach|club|hotel|kalkan|the/g, '');
const digits = (p) => (p || '').replace(/[^0-9]/g, '');
const today = '2026-07-29';
const load = (f) => JSON.parse(readFileSync(new URL(f, DATA), 'utf8'));
const save = (f, o) => writeFileSync(new URL(f, DATA), JSON.stringify(o, null, 2) + '\n', 'utf8');

let added = { beach: [], transfer: [], spa: [], gym: [], grocery: [] };

// ---------- 1) PLAJLAR: yeni beach club'lar ----------
const plaj = load('plajlar.json');
const plajNorms = new Set(plaj.items.map((i) => norm(i.name)));
const newBeaches = [
  { name: 'Mahal Beach Club', region: 'Kışla', ig: 'https://www.instagram.com/hotelvillamahal', web: 'https://villamahal.com', phone: '+90 531 721 88 61', sunbed: '750 TL' },
  { name: 'Zest Beach Club', region: 'Kömürlük', ig: 'https://www.instagram.com/zestbeachclubkalkan', web: 'https://zestbeachclub.com', phone: '+90 530 360 86 96', sunbed: '650 TL' },
  { name: 'Likya Beach Club', region: 'Liman', ig: null, web: 'https://likyagardens.com', phone: '+90 533 082 87 05', sunbed: '500 TL' },
  { name: 'Green Beach Club', region: 'Kışla', ig: 'https://www.instagram.com/greenbeachhotels', web: 'https://greenbeachhotels.com', phone: '+90 545 525 83 42', sunbed: '500 TL' },
  { name: 'Patara Prince Beach Club', region: 'Patara Prince', ig: 'https://www.instagram.com/patara.prince', web: 'https://pataraprince.com', phone: '+90 541 287 17 40', sunbed: '750 TL' },
  { name: 'Caretta Beach Club', region: 'Liman', ig: 'https://www.instagram.com/kalkancarettahoteloffical', web: 'https://kalkancarettahotel.com', phone: '+90 507 924 70 08', sunbed: '250 TL' },
];
for (const b of newBeaches) {
  if (plajNorms.has(norm(b.name))) continue;
  plaj.items.push({
    id: 'bc-' + norm(b.name).slice(0, 20),
    name: b.name, category: 'Beach Club', region: b.region, tags: [],
    image: null, gallery: [], rating: null, distance: 'Kalkan bölgesi', drive: null,
    summary: `${b.name} — Kalkan sahilinde deniz keyfi sunan plaj kulübü.`,
    paid: true, phone: b.phone, phoneRaw: digits(b.phone), instagram: b.ig, website: b.web,
    pricing: { sunbed: b.sunbed, umbrella: 'dahil', entry: null, minSpend: null, mandatory: false, note: '', source: 'visitkalkan.online', updated: today },
    source: 'visitkalkan.online', needsReview: true, needsPhoto: true, addedAt: today,
  });
  added.beach.push(b.name);
}
if (added.beach.length) save('plajlar.json', plaj);

// ---------- 2) HİZMET SAĞLAYICILARI ----------
const hiz = load('hizmet-saglayicilari.json');
const provider = (id, name, cat, { phone, web, ig, summary, specialties, location }) => ({
  id, name, type: 'İşletme', rating: null, reviewCount: 0, image: null,
  summary, specialties: specialties || [], experience: '',
  website: web || null, phone: phone || null, phoneRaw: digits(phone),
  whatsapp: phone || null, whatsappRaw: digits(phone), instagram: ig || null,
  location: location || 'Kalkan', verified: false, featured: false,
  contactVia: phone ? 'direct' : 'concierge', source: 'visitkalkan.online', needsReview: true, addedAt: today,
});
const ensureCat = (key, title, icon) => {
  if (!hiz.services[key]) hiz.services[key] = { title, icon, providers: [] };
  return hiz.services[key];
};
const addProviders = (catKey, title, icon, list, bucket) => {
  const cat = ensureCat(catKey, title, icon);
  const seen = new Set(cat.providers.map((p) => norm(p.name)));
  for (const p of list) {
    if (seen.has(norm(p.name))) continue;
    cat.providers.push(provider(p.id, p.name, catKey, p));
    added[bucket].push(p.name);
  }
};

// 2a) Transferler → mevcut transfer-havalimani kategorisine
addProviders('transfer-havalimani', 'Havalimanı Transferi', '🚐', [
  { id: 'transfer-volume', name: 'Volume Travel', phone: '+90 531 625 69 59', web: 'https://volumetravelturkey.com', summary: 'Dalaman/Antalya havalimanı özel transfer.', specialties: ['Havalimanı transfer', 'Özel araç'] },
  { id: 'transfer-lukka', name: 'Lukka Travel', phone: '+90 533 056 07 40', web: 'https://lukkatravel.com', summary: 'Kalkan havalimanı transfer ve tur hizmeti.', specialties: ['Havalimanı transfer'] },
  { id: 'transfer-kalkansun', name: 'Kalkan Sun Travel', phone: '+90 533 282 58 19', web: 'https://kalkansuntravel.net', summary: 'Kalkan bölgesi özel transfer.', specialties: ['Havalimanı transfer'] },
  { id: 'transfer-unlimited', name: 'Unlimited Travel', phone: '+90 533 338 50 52', web: 'https://kalkan-turkey.com', summary: 'Kalkan transfer ve seyahat hizmetleri.', specialties: ['Havalimanı transfer'] },
  { id: 'transfer-gumus', name: 'Gümüş Travel Shuttle', phone: null, web: 'https://kasgumustravel.com', summary: 'Kaş/Kalkan paylaşımlı shuttle transfer.', specialties: ['Paylaşımlı shuttle'] },
  { id: 'transfer-define', name: 'Define Tours', phone: '+90 530 080 01 22', web: 'https://definetours.com', ig: 'https://www.instagram.com/definetours', summary: 'Tur, transfer ve araç kiralama acentesi.', specialties: ['Transfer', 'Tur'] },
  { id: 'transfer-alper', name: 'Alper Tourism', phone: '+90 545 480 82 84', web: 'https://alpertourism.com', summary: 'Kalkan seyahat acentesi — transfer ve tur.', specialties: ['Transfer', 'Tur'] },
], 'transfer');

// 2b) Hamam & Spa → yeni kategori
addProviders('hamam-spa', 'Hamam & Spa', '💆', [
  { id: 'spa-atlantis', name: 'Atlantis Turkish Bath & Spa', phone: '+90 530 523 48 49', web: 'https://kalkanhamam.com', summary: 'Geleneksel Türk hamamı, masaj ve spa hizmetleri.', specialties: ['Türk hamamı', 'Masaj', 'Spa'] },
  { id: 'spa-arcadia', name: 'Arcadia Turkish Bath & Spa', phone: '+90 530 991 42 41', web: 'https://kalkanturkishbath.com', summary: 'Kalkan merkezde hamam ve spa deneyimi.', specialties: ['Türk hamamı', 'Masaj', 'Spa'] },
  { id: 'spa-nurhakan', name: 'Nur and Hakan Spa', phone: '+90 541 411 14 99', summary: 'Masaj ve spa hizmeti.', specialties: ['Masaj', 'Spa'] },
], 'spa');

// 2c) Spor & Fitness → yeni kategori
addProviders('spor-fitness', 'Spor & Fitness', '🏋️', [
  { id: 'gym-kalkangym', name: 'Kalkan Gym', phone: '+90 530 080 01 22', ig: 'https://www.instagram.com/gymkalkan', summary: 'Kalkan merkez spor salonu.', specialties: ['Fitness', 'Gym'] },
  { id: 'gym-sportline', name: 'Sportline', phone: '+90 532 781 60 33', ig: 'https://www.instagram.com/sportline_kalkan', summary: 'Fitness ve kondisyon salonu.', specialties: ['Fitness', 'Gym'] },
  { id: 'gym-shapeup', name: 'Shape Up', phone: '+90 530 378 57 08', ig: 'https://www.instagram.com/shapeup.fitnesss', summary: 'Fitness merkezi.', specialties: ['Fitness', 'Gym'] },
  { id: 'gym-soothe', name: 'Soothe Hotel Spa & Gym', phone: '+90 549 778 57 87', web: 'https://soothehotels.com', summary: 'Otel bünyesinde spa ve fitness.', specialties: ['Spa', 'Gym'] },
  { id: 'gym-swimclub', name: 'Kalkan Swimming Club', phone: null, summary: 'Yüzme kulübü ve antrenman.', specialties: ['Yüzme', 'Antrenman'] },
], 'gym');

// 2d) Market & Teslimat → yeni kategori
addProviders('market-teslimat', 'Market & Teslimat', '📦', [
  { id: 'teslimat-karagul', name: 'Karagül Market', phone: '+90 507 810 63 31', summary: 'WhatsApp ile market alışverişi villaya teslimat.', specialties: ['Market teslimat', 'WhatsApp sipariş'] },
  { id: 'teslimat-yaliexpress', name: 'Yali Express', phone: '+90 539 669 27 60', summary: 'Market ürünleri villa/konaklama teslimat.', specialties: ['Market teslimat'] },
  { id: 'teslimat-bringeverything', name: 'Bring Everything', phone: '+90 530 655 95 31', summary: 'İstediğiniz ürünleri WhatsApp ile teslim eden servis.', specialties: ['Market teslimat', 'WhatsApp sipariş'] },
  { id: 'teslimat-cancan', name: 'Can Can Market', phone: '+90 542 680 57 58', summary: 'Market teslimat ve İngiliz ürünleri.', specialties: ['Market teslimat', 'İngiliz ürünleri'] },
], 'grocery');

const totalHiz = added.transfer.length + added.spa.length + added.gym.length + added.grocery.length;
if (totalHiz) save('hizmet-saglayicilari.json', hiz);

// ---------- RAPOR ----------
console.log('=== visitkalkan.online → kalkaninfo import ===');
console.log(`Beach club (plajlar.json):       +${added.beach.length}  ${added.beach.join(', ') || '—'}`);
console.log(`Transfer (hizmet):               +${added.transfer.length}  ${added.transfer.join(', ') || '—'}`);
console.log(`Hamam & Spa (hizmet, yeni kat):  +${added.spa.length}  ${added.spa.join(', ') || '—'}`);
console.log(`Spor & Fitness (hizmet, yeni):   +${added.gym.length}  ${added.gym.join(', ') || '—'}`);
console.log(`Market & Teslimat (hizmet, yeni):+${added.grocery.length}  ${added.grocery.join(', ') || '—'}`);
console.log(`TOPLAM yeni işletme: ${added.beach.length + totalHiz}`);
