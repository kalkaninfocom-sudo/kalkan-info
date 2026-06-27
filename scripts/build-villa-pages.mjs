#!/usr/bin/env node
/**
 * Villa mini-site uretici (DERIN KISISELLESTIRME — 2026-06-04).
 * Her villaya FARKLI tema (renk + font + ikon set), 4 yatak odasi karti,
 * mutfak/salon/bahce detay bolumleri, depozito tam metni, ozel WhatsApp mesaji.
 *
 * Kullanim: node scripts/build-villa-pages.mjs [slug1 slug2 ...]
 *   - Slug verilmezse data/villalar.json'daki TUM villalar uretilir.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);

const data = JSON.parse(await readFile(join(root, 'data', 'villalar.json'), 'utf8'));
const template = await readFile(join(root, 'villa', '_template', 'index.html'), 'utf8');
const targets = args.length ? args : (data.items || []).map(it => it.id);

// Tum villalarin galeri/hero gorsellerinden pool
const allRealImages = new Set();
for (const it of (data.items || [])) {
  if (it.image) allRealImages.add(it.image);
  for (const g of (it.gallery || [])) if (g) allRealImages.add(g);
}
const POOL = Array.from(allRealImages).filter(src => {
  if (!src.startsWith('/assets/img/')) return false;
  return existsSync(join(root, src.replace(/^\//, '')));
});
console.log(`Pool: ${POOL.length} villa gorseli.`);

// =====================================================================
// PER-VILLA TEMA — her villaya OZEL renk + font + atmosfer
// =====================================================================
const THEMES = {
  'villa-ship-ahoy': {
    code: 'bahçe-klasiği',
    bg: '#0d1a14',
    bg2: '#16261d',
    accent: '#a8d5b0',
    accent2: '#7eba8a',
    text: '#ecf3ed',
    muted: '#8ea895',
    border: 'rgba(168,213,176,0.16)',
    border_strong: 'rgba(168,213,176,0.38)',
    accent_soft: 'rgba(168,213,176,0.10)',
    nav_bg: 'rgba(13,26,20,0.65)',
    nav_bg_scroll: 'rgba(13,26,20,0.92)',
    hero_overlay: 'linear-gradient(180deg, rgba(13,26,20,0.15) 0%, rgba(13,26,20,0.55) 60%, #0d1a14 100%)',
    font_display: "'Cormorant Garamond', serif",
    google_font: 'Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700',
    motif: 'Bahce Klasigi · Salincak · Somine'
  },
  'villa-poyraz': {
    code: 'modern-lüks',
    bg: '#0a0e16',
    bg2: '#141925',
    accent: '#d4af37',
    accent2: '#a8861f',
    text: '#f0ece0',
    muted: '#a0a0a8',
    border: 'rgba(212,175,55,0.16)',
    border_strong: 'rgba(212,175,55,0.42)',
    accent_soft: 'rgba(212,175,55,0.10)',
    nav_bg: 'rgba(10,14,22,0.70)',
    nav_bg_scroll: 'rgba(10,14,22,0.94)',
    hero_overlay: 'linear-gradient(180deg, rgba(10,14,22,0.18) 0%, rgba(10,14,22,0.58) 60%, #0a0e16 100%)',
    font_display: "'Playfair Display', serif",
    google_font: 'Playfair+Display:wght@500;600;700;800&family=Inter:wght@400;500;600;700',
    motif: 'Modern Luks · Bilardo · Jakuzi'
  },
  'villa-seascape': {
    code: 'akdeniz-premium',
    bg: '#06141a',
    bg2: '#0c2129',
    accent: '#4eb1b3',
    accent2: '#2f8e90',
    text: '#e6f1f3',
    muted: '#86a4ab',
    border: 'rgba(78,177,179,0.16)',
    border_strong: 'rgba(78,177,179,0.40)',
    accent_soft: 'rgba(78,177,179,0.10)',
    nav_bg: 'rgba(6,20,26,0.68)',
    nav_bg_scroll: 'rgba(6,20,26,0.92)',
    hero_overlay: 'linear-gradient(180deg, rgba(6,20,26,0.18) 0%, rgba(6,20,26,0.55) 60%, #06141a 100%)',
    font_display: "'Cormorant Garamond', serif",
    google_font: 'Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700',
    motif: 'Akdeniz Premium · Sonsuzluk · Cocuk Havuzu'
  }
};

const DEFAULT_THEME = THEMES['villa-poyraz'];

// =====================================================================
// PER-VILLA CUSTOM — atmospheric icin
// =====================================================================
const CUSTOM = {
  'villa-poyraz': {
    tagline: "Seyir Terası, Jakuzili Suite & Bilardo Masası",
    aboutTitle: "Modern Lüks, İki Jakuzili Suite, Bilardo Akşamları.",
    poolTitle: "Özel Havuz · Açık Hava Jakuzi",
    poolDesc: "Geniş özel havuzun yanı sıra, 1. ve 4. yatak odalarında özel jakuziler ve teras alanında açık hava jakuzisi yer alır. King-size yataklı 4. suit özel jakuzisiyle premium kaçışı tamamlar."
  },
  'villa-ship-ahoy': {
    tagline: "Kalamar'da Salıncaklı Bahçe & Üst Kat Jakuzi",
    aboutTitle: "Denize 1 km, Salıncaklı Bahçe, Şömineli Salon.",
    poolTitle: "Salıncaklı Bahçe & Özel Havuz",
    poolDesc: "Geniş bahçede özel havuz, şezlonglar, güneş şemsiyeleri, salıncak, oturma köşesi, barbekü ve yemek masası. Üst kat terasında jakuzi ile gün batımı keyfi bambaşka bir boyut kazanır."
  },
  'villa-seascape': {
    tagline: "Sonsuzluk Havuzu, Çocuk Havuzu & Denize 400 Metre",
    aboutTitle: "Akdeniz Ufkuyla Birleşen Bir Silüet · Aile Dostu.",
    poolTitle: "Sonsuzluk Havuzu & Çocuk Havuzu",
    poolDesc: "Modern sonsuzluk havuzu, Akdeniz ufkuyla bütünleşen siluetiyle benzersiz bir görsel yaratır. Yanında çocuklar için ayrı sığ havuz, akşam jakuzisi, şezlonglar ve oturma alanı bulunur."
  }
};

// HTML escape
const esc = (s) => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// =====================================================================
// I18N 5-DIL
// =====================================================================
const I18N_BASE = {
  tr: {
    about: 'Hakkımızda', amenities: 'Olanaklar', rooms: 'Yatak Odaları', kitchen: 'Mutfak', salon: 'Salon', garden: 'Bahçe & Havuz', gallery: 'Galeri', pricing: 'Fiyat', reserve: 'Rezervasyon',
    cta_reserve: 'Rezervasyon Talebi', cta_amenities: 'Olanakları Gör', cta_reserve_send: 'Talebi Gönder',
    about_label: 'Hakkımızda', amenities_label: 'Olanaklar', amenities_title: 'Villada Sunulan Tam Donanım', amenities_sub: 'Berkay\'ın listelediği her ekipman tek tek — mutfaktan teknolojiye, açık havadan iç mekâna.',
    included_label: 'Dahil Hizmetler',
    rooms_label: 'Yatak Odaları', rooms_title: '4 Yatak Odası · 8 Kişi', rooms_sub: 'Her oda bağımsız bir suit gibi tasarlandı — kendi özel banyosu, klimasi ve kişisel detaylarıyla.',
    kitchen_label: 'Mutfak', salon_label: 'Salon', garden_label: 'Bahçe & Havuz',
    pool_label: 'Havuz & Bahçe',
    gallery_label: 'Galeri', gallery_title: 'Villadan Kareler',
    distances_label: 'Mesafeler', distances_title: 'Çevredeki Önemli Noktalar',
    pricing_label: 'Fiyat & Depozito', pricing_title: 'Rezervasyon Koşulları', pricing_sub: 'Dönem fiyatları için concierge ekibimize yazın — 60 saniye içinde size özel teklif alın.',
    price_deposit_title: 'Depozito (İade Edilebilir)', price_short_title: 'Kısa Konaklama (7 Geceden Az)', price_pet_title: 'Evcil Hayvan Ücreti',
    logistics_label: 'Giriş & Çıkış', logistics_title: 'Saat & Kurallar', check_in_label: 'Check-in', check_out_label: 'Check-out', checkin_note_label: 'Önemli Not',
    transport_label: 'Ulaşım', transport_title: 'Havalimanı ve Transfer', transport_airport_label: 'En Yakın Havalimanı', transport_airport_val: 'Dalaman (DLM) — 125 km', transport_transit_label: 'Toplu Taşıma', transport_transit_val: 'Mevcut değil. Concierge ekibimiz ücretli özel transfer organize edebilir.', transport_cta: 'Transfer Talebi (WhatsApp)',
    faq_label: 'Sıkça Sorulan Sorular', faq_title: 'Aklınızdakileri Yanıtladık',
    reserve_label: 'Rezervasyon Talebi', reserve_title: 'Tatilinizi Planlayın', reserve_sub: 'Doğrudan WhatsApp ile hızlı rezervasyon yapın veya formu doldurun — concierge ekibimiz 60 saniye içinde size döner.',
    contact_label: 'İletişim', contact_title: 'Bize Ulaşın', contact_addr: 'Konum', contact_phone: 'Concierge Telefon', contact_concierge: 'Concierge', contact_social: 'Sosyal Medya',
    stat_bedrooms: 'Yatak Odası', stat_guests: 'Kişi', stat_baths: 'Banyo',
    pool_dim_label: 'Havuz Ölçüleri', pool_view_label: 'Manzara', pool_view_val: 'Deniz / Doğa'
  },
  en: {
    about: 'About', amenities: 'Amenities', rooms: 'Bedrooms', kitchen: 'Kitchen', salon: 'Living Room', garden: 'Garden & Pool', gallery: 'Gallery', pricing: 'Pricing', reserve: 'Reservation',
    cta_reserve: 'Request Booking', cta_amenities: 'View Amenities', cta_reserve_send: 'Send Request',
    about_label: 'About', amenities_label: 'Amenities', amenities_title: 'Complete Equipment List', amenities_sub: 'Every piece of equipment listed — from kitchen to tech, outdoor to interior.',
    included_label: 'Included Services',
    rooms_label: 'Bedrooms', rooms_title: '4 Bedrooms · 8 Guests', rooms_sub: 'Each bedroom is its own suite — ensuite bath, AC and personal touches.',
    kitchen_label: 'Kitchen', salon_label: 'Living Room', garden_label: 'Garden & Pool',
    pool_label: 'Pool & Garden',
    gallery_label: 'Gallery', gallery_title: 'Moments from the Villa',
    distances_label: 'Distances', distances_title: 'Key Points Nearby',
    pricing_label: 'Pricing & Deposit', pricing_title: 'Reservation Terms', pricing_sub: 'For seasonal rates contact our concierge — personal quote in 60 seconds.',
    price_deposit_title: 'Deposit (Refundable)', price_short_title: 'Short Stay (Less Than 7 Nights)', price_pet_title: 'Pet Fee',
    logistics_label: 'Check-in & Check-out', logistics_title: 'Times & Rules', check_in_label: 'Check-in', check_out_label: 'Check-out', checkin_note_label: 'Important Note',
    transport_label: 'Transport', transport_title: 'Airport & Transfers', transport_airport_label: 'Nearest Airport', transport_airport_val: 'Dalaman (DLM) — 125 km', transport_transit_label: 'Public Transport', transport_transit_val: 'Not available. Our concierge can arrange paid private transfers.', transport_cta: 'Request Transfer (WhatsApp)',
    faq_label: 'Frequently Asked Questions', faq_title: 'Your Questions Answered',
    reserve_label: 'Booking Request', reserve_title: 'Plan Your Holiday', reserve_sub: 'Reserve fast via WhatsApp or fill the form — our concierge replies in 60 seconds.',
    contact_label: 'Contact', contact_title: 'Get In Touch', contact_addr: 'Location', contact_phone: 'Concierge Phone', contact_concierge: 'Concierge', contact_social: 'Social',
    stat_bedrooms: 'Bedrooms', stat_guests: 'Guests', stat_baths: 'Bathrooms',
    pool_dim_label: 'Pool Size', pool_view_label: 'View', pool_view_val: 'Sea / Nature'
  },
  de: {
    about: 'Über uns', amenities: 'Ausstattung', rooms: 'Schlafzimmer', kitchen: 'Küche', salon: 'Wohnzimmer', garden: 'Garten & Pool', gallery: 'Galerie', pricing: 'Preis', reserve: 'Reservierung',
    cta_reserve: 'Anfrage senden', cta_amenities: 'Ausstattung ansehen', cta_reserve_send: 'Anfrage senden',
    about_label: 'Über uns', amenities_label: 'Ausstattung', amenities_title: 'Komplette Ausstattung', amenities_sub: 'Jedes aufgeführte Ausstattungsstück — von Küche bis Technik, von Außen bis Innen.',
    included_label: 'Inkludierte Leistungen',
    rooms_label: 'Schlafzimmer', rooms_title: '4 Schlafzimmer · 8 Gäste', rooms_sub: 'Jedes Schlafzimmer ist eine eigene Suite — eigenes Bad, Klimaanlage und persönliche Details.',
    kitchen_label: 'Küche', salon_label: 'Wohnzimmer', garden_label: 'Garten & Pool',
    pool_label: 'Pool & Garten',
    gallery_label: 'Galerie', gallery_title: 'Momente aus der Villa',
    distances_label: 'Entfernungen', distances_title: 'Wichtige Punkte in der Nähe',
    pricing_label: 'Preis & Kaution', pricing_title: 'Buchungsbedingungen', pricing_sub: 'Für saisonale Preise kontaktieren Sie unseren Concierge — in 60 Sekunden ein persönliches Angebot.',
    price_deposit_title: 'Kaution (erstattbar)', price_short_title: 'Kurzaufenthalt (weniger als 7 Nächte)', price_pet_title: 'Haustiergebühr',
    logistics_label: 'Check-in & Check-out', logistics_title: 'Zeiten & Regeln', check_in_label: 'Check-in', check_out_label: 'Check-out', checkin_note_label: 'Wichtiger Hinweis',
    transport_label: 'Transport', transport_title: 'Flughafen & Transfer', transport_airport_label: 'Nächster Flughafen', transport_airport_val: 'Dalaman (DLM) — 125 km', transport_transit_label: 'Öffentliche Verkehrsmittel', transport_transit_val: 'Nicht verfügbar. Unser Concierge organisiert kostenpflichtige Privattransfers.', transport_cta: 'Transferanfrage (WhatsApp)',
    faq_label: 'Häufig gestellte Fragen', faq_title: 'Ihre Fragen beantwortet',
    reserve_label: 'Buchungsanfrage', reserve_title: 'Planen Sie Ihren Urlaub', reserve_sub: 'Schnell via WhatsApp reservieren oder Formular ausfüllen — Concierge-Antwort in 60 Sekunden.',
    contact_label: 'Kontakt', contact_title: 'Kontaktieren Sie uns', contact_addr: 'Standort', contact_phone: 'Concierge Telefon', contact_concierge: 'Concierge', contact_social: 'Soziale Medien',
    stat_bedrooms: 'Schlafzimmer', stat_guests: 'Gäste', stat_baths: 'Badezimmer',
    pool_dim_label: 'Pool-Größe', pool_view_label: 'Aussicht', pool_view_val: 'Meer / Natur'
  },
  ru: {
    about: 'О вилле', amenities: 'Удобства', rooms: 'Спальни', kitchen: 'Кухня', salon: 'Гостиная', garden: 'Сад и бассейн', gallery: 'Галерея', pricing: 'Цена', reserve: 'Бронирование',
    cta_reserve: 'Запрос на бронирование', cta_amenities: 'Все удобства', cta_reserve_send: 'Отправить запрос',
    about_label: 'О вилле', amenities_label: 'Удобства', amenities_title: 'Полная комплектация', amenities_sub: 'Каждый элемент оборудования — от кухни до техники, от двора до интерьера.',
    included_label: 'Включённые услуги',
    rooms_label: 'Спальни', rooms_title: '4 спальни · 8 гостей', rooms_sub: 'Каждая спальня — отдельный люкс со своим санузлом, кондиционером и индивидуальными деталями.',
    kitchen_label: 'Кухня', salon_label: 'Гостиная', garden_label: 'Сад и бассейн',
    pool_label: 'Бассейн и сад',
    gallery_label: 'Галерея', gallery_title: 'Моменты на вилле',
    distances_label: 'Расстояния', distances_title: 'Важные точки рядом',
    pricing_label: 'Цены и депозит', pricing_title: 'Условия бронирования', pricing_sub: 'По сезонным ценам напишите нашему консьержу — персональное предложение в 60 секунд.',
    price_deposit_title: 'Депозит (возвратный)', price_short_title: 'Короткое пребывание (менее 7 ночей)', price_pet_title: 'Плата за питомца',
    logistics_label: 'Заезд и выезд', logistics_title: 'Время и правила', check_in_label: 'Заезд', check_out_label: 'Выезд', checkin_note_label: 'Важно',
    transport_label: 'Транспорт', transport_title: 'Аэропорт и трансфер', transport_airport_label: 'Ближайший аэропорт', transport_airport_val: 'Даламан (DLM) — 125 км', transport_transit_label: 'Общественный транспорт', transport_transit_val: 'Отсутствует. Консьерж может организовать платный трансфер.', transport_cta: 'Запросить трансфер (WhatsApp)',
    faq_label: 'Частые вопросы', faq_title: 'Ответы на ваши вопросы',
    reserve_label: 'Запрос бронирования', reserve_title: 'Планируйте отдых', reserve_sub: 'Быстрое бронирование через WhatsApp или заполните форму — консьерж ответит за 60 секунд.',
    contact_label: 'Контакты', contact_title: 'Свяжитесь с нами', contact_addr: 'Расположение', contact_phone: 'Телефон консьержа', contact_concierge: 'Консьерж', contact_social: 'Социальные сети',
    stat_bedrooms: 'Спальни', stat_guests: 'Гостей', stat_baths: 'Ванные',
    pool_dim_label: 'Размер бассейна', pool_view_label: 'Вид', pool_view_val: 'Море / Природа'
  },
  fr: {
    about: 'À propos', amenities: 'Équipements', rooms: 'Chambres', kitchen: 'Cuisine', salon: 'Salon', garden: 'Jardin & Piscine', gallery: 'Galerie', pricing: 'Tarifs', reserve: 'Réservation',
    cta_reserve: 'Demande de réservation', cta_amenities: 'Voir les équipements', cta_reserve_send: 'Envoyer la demande',
    about_label: 'À propos', amenities_label: 'Équipements', amenities_title: 'Équipement complet', amenities_sub: 'Chaque équipement listé — de la cuisine à la tech, de l\'extérieur à l\'intérieur.',
    included_label: 'Services inclus',
    rooms_label: 'Chambres', rooms_title: '4 chambres · 8 personnes', rooms_sub: 'Chaque chambre est une suite indépendante — salle de bain privée, climatisation et touches personnelles.',
    kitchen_label: 'Cuisine', salon_label: 'Salon', garden_label: 'Jardin & Piscine',
    pool_label: 'Piscine & Jardin',
    gallery_label: 'Galerie', gallery_title: 'Instants à la villa',
    distances_label: 'Distances', distances_title: 'Points clés à proximité',
    pricing_label: 'Tarifs & Caution', pricing_title: 'Conditions de réservation', pricing_sub: 'Pour les tarifs saisonniers, contactez notre concierge — devis personnalisé en 60 secondes.',
    price_deposit_title: 'Caution (remboursable)', price_short_title: 'Court séjour (moins de 7 nuits)', price_pet_title: 'Frais animaux',
    logistics_label: 'Arrivée & Départ', logistics_title: 'Heures & Règles', check_in_label: 'Arrivée', check_out_label: 'Départ', checkin_note_label: 'Note importante',
    transport_label: 'Transport', transport_title: 'Aéroport & Transfert', transport_airport_label: 'Aéroport le plus proche', transport_airport_val: 'Dalaman (DLM) — 125 km', transport_transit_label: 'Transport public', transport_transit_val: 'Non disponible. Notre concierge organise des transferts privés payants.', transport_cta: 'Demande de transfert (WhatsApp)',
    faq_label: 'Questions fréquentes', faq_title: 'Vos questions, nos réponses',
    reserve_label: 'Demande de réservation', reserve_title: 'Planifiez vos vacances', reserve_sub: 'Réservez rapidement via WhatsApp ou remplissez le formulaire — réponse du concierge en 60 secondes.',
    contact_label: 'Contact', contact_title: 'Contactez-nous', contact_addr: 'Emplacement', contact_phone: 'Téléphone concierge', contact_concierge: 'Concierge', contact_social: 'Réseaux sociaux',
    stat_bedrooms: 'Chambres', stat_guests: 'Personnes', stat_baths: 'Salles de bain',
    pool_dim_label: 'Taille piscine', pool_view_label: 'Vue', pool_view_val: 'Mer / Nature'
  }
};

// =====================================================================
// SVG icon set (genisletilmis)
// =====================================================================
const ICONS = {
  wifi: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 13a10 10 0 0 1 14 0"/><path d="M2 9a14 14 0 0 1 20 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/></svg>',
  fire: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-3-1.5 1-3 3-3 6a6 6 0 0 0 12 0c0-5-6-11-6-11Z"/></svg>',
  tv: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="13" rx="1.5"/><path d="M9 21h6"/></svg>',
  ac: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>',
  droplet: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2s5 6 5 11a5 5 0 0 1-10 0c0-5 5-11 5-11Z"/></svg>',
  pool: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 17c3 0 3-2 5-2s2 2 5 2 3-2 5-2 2 2 5 2"/><path d="M2 21c3 0 3-2 5-2s2 2 5 2 3-2 5-2 2 2 5 2"/><path d="M7 13V7a2 2 0 0 1 4 0"/><path d="M13 13V7a2 2 0 0 1 4 0"/></svg>',
  car: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13"/><rect x="3" y="13" width="18" height="6" rx="1"/><circle cx="7.5" cy="17" r="1"/><circle cx="16.5" cy="17" r="1"/></svg>',
  grill: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16l-2 8a3 3 0 0 1-3 2h-6a3 3 0 0 1-3-2L4 7Z"/><path d="M9 4c1 1 0 2 0 3M15 4c1 1 0 2 0 3M12 4c1 1 0 2 0 3"/><path d="M9 17l-1 4M15 17l1 4"/></svg>',
  fridge: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 11h14M8 7v2M8 14v3"/></svg>',
  oven: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18"/><circle cx="7" cy="6.5" r=".5"/><circle cx="11" cy="6.5" r=".5"/><circle cx="15" cy="6.5" r=".5"/><rect x="6" y="12" width="12" height="6"/></svg>',
  washer: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="1"/><circle cx="12" cy="14" r="4"/><circle cx="8" cy="6.5" r=".5"/><circle cx="11" cy="6.5" r=".5"/></svg>',
  microwave: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="1"/><rect x="5" y="8" width="10" height="8"/><circle cx="18" cy="10" r=".7"/><circle cx="18" cy="14" r=".7"/></svg>',
  balcony: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V11h14v10M9 21V14M15 21V14M5 11l7-7 7 7"/></svg>',
  speaker: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15 9a3 3 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>',
  chair: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 3v9a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V3"/><path d="M5 15v6M19 15v6M9 15v2M15 15v2"/></svg>',
  iron: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 17h16l-2-7a3 3 0 0 0-3-2H9a3 3 0 0 0-3 2l-2 7Z"/><path d="M4 17v2M20 17v2"/></svg>',
  towel: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 3v18M15 3v18"/></svg>',
  playstation: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="8" width="20" height="9" rx="3"/><circle cx="7" cy="12.5" r="1"/><circle cx="17" cy="12.5" r="1"/><path d="M10 12.5h4"/></svg>',
  billiard: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="9" width="18" height="11" rx="1.5"/><circle cx="8" cy="14.5" r="1.5"/><circle cx="14" cy="14.5" r="1.5"/><path d="M3 11h18"/></svg>',
  swing: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h18"/><path d="M7 4l3 12M17 4l-3 12"/><rect x="8" y="15" width="8" height="3" rx=".5"/><path d="M12 18v2"/></svg>',
  infinity: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18.4 6c-3.5 0-5.4 3.6-6.4 6-1-2.4-2.9-6-6.4-6a3.6 3.6 0 1 0 0 12c3.5 0 5.4-3.6 6.4-6 1 2.4 2.9 6 6.4 6a3.6 3.6 0 0 0 0-12Z"/></svg>',
  child: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="5" r="2"/><path d="M9 14l3-7 3 7"/><path d="M7 21l2-7M17 21l-2-7"/></svg>',
  umbrella: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12a10 10 0 0 1 20 0H2Z"/><path d="M12 12v7a2 2 0 0 1-4 0"/></svg>',
  table: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9h18"/><path d="M5 9v11M19 9v11"/><path d="M3 9l3-4h12l3 4"/></svg>',
  view: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  jacuzzi: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11h18l-1 7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L3 11Z"/><path d="M7 11V6a2 2 0 0 1 4 0"/><path d="M8 4c0 1 1 1 1 2M16 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2"/></svg>',
  king: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h18v6H3z"/><path d="M3 18v2M21 18v2"/><path d="M5 12V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><path d="M8 12V9h3v3M13 12V9h3v3"/></svg>',
  coffee: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h14v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/><path d="M18 9a3 3 0 0 1 0 6"/><path d="M8 3c0 1 1 1 1 2M12 3c0 1 1 1 1 2"/></svg>',
  bath: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h18l-1 5a3 3 0 0 1-3 2H7a3 3 0 0 1-3-2L3 12Z"/><path d="M6 12V6a2 2 0 0 1 2-2h1l1 1"/></svg>',
  wardrobe: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18M9 11h.01M15 11h.01"/></svg>',
  mirror: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="10" rx="6" ry="8"/><path d="M9 21h6M12 18v3"/></svg>',
  utensil: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 2v7c0 1.1.9 2 2 2h.5"/><path d="M5.5 2v9"/><path d="M3 2h2.5"/><path d="M17 2v20"/><path d="M21 2v6a3 3 0 0 1-3 3"/></svg>',
  island: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="8" rx="1"/><path d="M3 15h18"/><circle cx="8" cy="13" r=".7"/><circle cx="12" cy="13" r=".7"/><circle cx="16" cy="13" r=".7"/></svg>',
  cooktop: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="8" cy="11" r="1.5"/><circle cx="16" cy="11" r="1.5"/><circle cx="8" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/></svg>',
  dvd: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>',
  sofa: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11v6h18v-6"/><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 17v2M21 17v2"/></svg>',
  sink: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="9" width="18" height="11" rx="1"/><path d="M3 13h18"/><path d="M12 3v6M12 6h-2"/></svg>'
};

// Amenity name -> icon key
function amenityIconKey(name) {
  const n = name.toLowerCase();
  if (n.includes('wifi') || n.includes('internet')) return 'wifi';
  if (n.includes('şömine') || n.includes('somine')) return 'fire';
  if (n.includes('lcd') || n.includes('televizyon') || n.includes(' tv')) return 'tv';
  if (n.startsWith('tv')) return 'tv';
  if (n.includes('klima') || n.includes('air')) return 'ac';
  if (n.includes('jakuzi') || n.includes('jacuzzi')) return 'jacuzzi';
  if (n.includes('sonsuzluk')) return 'infinity';
  if (n.includes('çocuk havuz') || n.includes('cocuk havuz') || n.includes('child')) return 'child';
  if (n.includes('havuz') || n.includes('pool')) return 'pool';
  if (n.includes('özel otopark') || n.includes('ozel otopark')) return 'car';
  if (n.includes('otopark') || n.includes('parking')) return 'car';
  if (n.includes('barbekü') || n.includes('barbeku') || n.includes('barbecue') || n.includes('mangal')) return 'grill';
  if (n.includes('buzdolab') || n.includes('fridge')) return 'fridge';
  if (n.includes('mikrodalga') || n.includes('microwave')) return 'microwave';
  if (n.includes('4\'lü') || n.includes('4lü') || n.includes('ankastre ocak') || n.includes('ocak')) return 'cooktop';
  if (n.includes('fırın') || n.includes('firin') || n.includes('oven')) return 'oven';
  if (n.includes('bulaşık') || n.includes('bulasik') || n.includes('dishwasher')) return 'washer';
  if (n.includes('çamaşır') || n.includes('camasir') || n.includes('washer')) return 'washer';
  if (n.includes('balkon') || n.includes('balcony')) return 'balcony';
  if (n.includes('ses yalıt') || n.includes('ses yalit')) return 'speaker';
  if (n.includes('mobilya') || n.includes('açık hava') || n.includes('acik hava') || n.includes('oturma')) return 'chair';
  if (n.includes('salıncak') || n.includes('salincak')) return 'swing';
  if (n.includes('şezlong') || n.includes('sezlong') || n.includes('güneş şemsi') || n.includes('gunes semsi') || n.includes('umbrella')) return 'umbrella';
  if (n.includes('ütü') || n.includes('utu') || n.includes('iron')) return 'iron';
  if (n.includes('havlu') || n.includes('çarşaf') || n.includes('carsaf') || n.includes('towel')) return 'towel';
  if (n.includes('playstation') || n.includes('ps3') || n.includes('ps ')) return 'playstation';
  if (n.includes('bilardo') || n.includes('billiard')) return 'billiard';
  if (n.includes('türk kahve') || n.includes('turk kahve') || n.includes('coffee')) return 'coffee';
  if (n.includes('king')) return 'king';
  if (n.includes('ada mutfak') || n.includes('island')) return 'island';
  if (n.includes('amerikan mutfak') || n.includes('ayrı mutfak') || n.includes('ayri mutfak') || n.includes('kitchen')) return 'oven';
  if (n.includes('ekmek') || n.includes('toast')) return 'microwave';
  if (n.includes('su ısıt') || n.includes('su isit') || n.includes('water')) return 'droplet';
  if (n.includes('mutfak gereç') || n.includes('mutfak gerec') || n.includes('utensil') || n.includes('çatal') || n.includes('catal')) return 'utensil';
  if (n.includes('yemek takım') || n.includes('yemek takim') || n.includes('dinnerware')) return 'utensil';
  if (n.includes('yemek masası') || n.includes('yemek masasi') || n.includes('dining table')) return 'table';
  if (n.includes('seyir') || n.includes('manzara') || n.includes('view')) return 'view';
  if (n.includes('dvd')) return 'dvd';
  if (n.includes('uydu') || n.includes('satellite')) return 'tv';
  if (n.includes('oturma grub') || n.includes('sofa')) return 'sofa';
  if (n.includes('lavabo') || n.includes('sink')) return 'sink';
  if (n.includes('gardırop') || n.includes('gardirop') || n.includes('elbise dolab')) return 'wardrobe';
  if (n.includes('komodin')) return 'wardrobe';
  if (n.includes('makyaj') || n.includes('vanity')) return 'mirror';
  if (n.includes('banyo') || n.includes('bath') || n.includes('wc') || n.includes('tuvalet')) return 'bath';
  return 'wifi'; // fallback
}

function amenityIcon(name) {
  return ICONS[amenityIconKey(name)] || ICONS.wifi;
}

// =====================================================================
// Distance icon
// =====================================================================
function distanceIcon(key) {
  const icons = {
    airport: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h2a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>',
    market: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
    beach: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 18a4 4 0 0 0-7-2.7M9 16a4 4 0 0 0-7 2"/><path d="M14 8a3 3 0 1 1 6 0v3"/><path d="M2 22h20"/></svg>',
    restaurant: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 2v7c0 1.1.9 2 2 2h.5"/><path d="M5.5 2v9"/><path d="M3 2h2.5"/><path d="M17 2v20"/><path d="M21 2v6a3 3 0 0 1-3 3"/></svg>',
    transit: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/><path d="M8 17v4M16 17v4"/></svg>',
    center: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
  };
  return icons[key] || icons.center;
}

const DISTANCE_LABELS = {
  tr: { airport: 'Havalimanı', market: 'Market', beach: 'Plaj', restaurant: 'Restoran', transit: 'Toplu Taşıma', center: 'Merkez' },
  en: { airport: 'Airport', market: 'Market', beach: 'Beach', restaurant: 'Restaurant', transit: 'Transit', center: 'Center' },
  de: { airport: 'Flughafen', market: 'Markt', beach: 'Strand', restaurant: 'Restaurant', transit: 'ÖPNV', center: 'Zentrum' },
  ru: { airport: 'Аэропорт', market: 'Магазин', beach: 'Пляж', restaurant: 'Ресторан', transit: 'Транспорт', center: 'Центр' },
  fr: { airport: 'Aéroport', market: 'Marché', beach: 'Plage', restaurant: 'Restaurant', transit: 'Transport', center: 'Centre' }
};

// Sosyal medya
function socialLinks(v){
  const icons = [];
  if (v.instagram) icons.push(`<a href="${esc(v.instagram)}" target="_blank" rel="noopener" aria-label="Instagram" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>`);
  icons.push(`<a href="https://wa.me/905306650794?text=${encodeURIComponent('Merhaba, ' + v.name + ' hakkında bilgi almak istiyorum.')}" target="_blank" rel="noopener" aria-label="WhatsApp" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.92c0 1.92.55 3.78 1.6 5.39L2 22l4.86-1.7a9.93 9.93 0 0 0 5.18 1.45c5.46 0 9.91-4.45 9.91-9.92 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Z"/></svg></a>`);
  icons.push(`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name+' '+v.location)}" target="_blank" rel="noopener" aria-label="Google Maps" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></a>`);
  return icons.join('');
}

// =====================================================================
// RELATED SECTION — I18N + BUILDER
// =====================================================================
const RELATED_I18N = {
  tr: { related_label:'Keşfet', related_title:"Kalkan'da Benzer Villalar", related_sub:'Tatiliniz için keşfedebileceğiniz diğer Kalkan kiralık villaları.', related_all:'Tüm Kalkan Villaları →' },
  en: { related_label:'Discover', related_title:'Similar Villas in Kalkan', related_sub:'Other Kalkan holiday villas worth exploring.', related_all:'All Kalkan Villas →' },
  de: { related_label:'Entdecken', related_title:'Ähnliche Villen in Kalkan', related_sub:'Weitere Ferienvillen in Kalkan zum Entdecken.', related_all:'Alle Villen in Kalkan →' },
  ru: { related_label:'Откройте', related_title:'Похожие виллы в Калкане', related_sub:'Другие виллы Калкана для вашего отдыха.', related_all:'Все виллы Калкана →' },
  fr: { related_label:'Découvrir', related_title:'Villas similaires à Kalkan', related_sub:'D’autres villas de vacances à Kalkan à explorer.', related_all:'Toutes les villas de Kalkan →' }
};
for (const l of Object.keys(I18N_BASE)) Object.assign(I18N_BASE[l], RELATED_I18N[l]);

function relatedSection(current, allItems) {
  const sameCat = allItems.filter(x => x.id !== current.id && x.category === current.category);
  const others = allItems.filter(x => x.id !== current.id && x.category !== current.category);
  const picks = [...sameCat, ...others].slice(0, 6);
  if (!picks.length) return '';
  const cards = picks.map(x => {
    const href = `/villa/${x.id}`;
    const sub = esc(x.category || x.location || '');
    return `
      <a href="${href}" class="related-card block p-5 transition" style="border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
        <div class="text-[10px] tracking-[0.2em] uppercase font-bold mb-2" style="color:var(--theme-accent);">${esc(x.category || 'Villa')}</div>
        <div class="font-display text-xl font-bold mb-1" style="color:var(--theme-text);">${esc(x.name)}</div>
        <div class="text-sm" style="color:var(--theme-muted);">${sub}</div>
      </a>`;
  }).join('');
  return `
<section class="py-24 md:py-32 px-6" style="background:var(--theme-bg-2);">
  <div class="max-w-7xl mx-auto">
    <div class="section-label mb-6" data-i="related_label">Keşfet</div>
    <h2 class="font-display text-4xl md:text-5xl font-extrabold mb-4" data-i="related_title">Kalkan'da Benzer Villalar</h2>
    <p class="mb-12 text-base max-w-2xl" style="color:var(--theme-muted);" data-i="related_sub">Tatiliniz için keşfedebileceğiniz diğer Kalkan kiralık villaları.</p>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">${cards}</div>
    <div class="mt-12">
      <a href="/villalar" class="btn-ghost" data-i="related_all">Tüm Kalkan Villaları →</a>
    </div>
  </div>
</section>`;
}

// =====================================================================
// BUILD LOOP
// =====================================================================
let built = [];

for (const slug of targets) {
  const v = (data.items || []).find(x => x.id === slug);
  if (!v) { console.warn(`Atlandi: ${slug} villalar.json'da yok`); continue; }
  const c = CUSTOM[slug] || {};
  const T = THEMES[slug] || DEFAULT_THEME;

  // Galeri: gerçek galeri + havuzdan deterministik fallback (8 toplam)
  const baseImg = v.image;
  const realGallery = (v.gallery || []).filter(Boolean);
  const used = new Set(realGallery);
  const need = Math.max(0, 8 - realGallery.length);
  const seed = v.id.split('').reduce((a,c)=>a*31+c.charCodeAt(0),7) & 0x7fffffff;
  const candidates = POOL.filter(p => !used.has(p));
  const picks = [];
  for (let i = 0; i < need && candidates.length; i++) {
    const idx = (seed + i * 37) % candidates.length;
    picks.push(candidates.splice(idx, 1)[0]);
  }
  const gallerySources = [...realGallery, ...picks].slice(0, 8);
  const galleryItems = gallerySources.map((src, i) => {
    return `
    <a href="${esc(src)}" target="_blank" class="gallery-item aspect-square block">
      <img src="${esc(src)}" alt="${esc(v.name)} ${i+1}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.background='var(--theme-bg-2)';this.style.opacity='0.3';">
    </a>`;
  }).join('');

  const aboutImage = realGallery[1] || realGallery[0] || baseImg;
  const poolImage = realGallery[2] || gallerySources[2] || baseImg;
  const kitchenImage = realGallery[0] || baseImg;
  const salonImage = realGallery[realGallery.length-1] || baseImg;

  // About paragraphs
  const aboutParas = (v.description_long || [v.summary || '']).map(p =>
    `<p class="text-base md:text-lg leading-relaxed mb-5" style="color:var(--theme-muted);">${esc(p)}</p>`
  ).join('');

  // Hero tags
  const heroTags = (v.tags || []).slice(0, 5).map(t =>
    `<span class="tag-chip">${esc(t)}</span>`
  ).join('');

  // Amenities grid (TUM amenityler)
  const amenities = v.amenities || v.features || [];
  const amenitiesGrid = amenities.map(a => `
    <div class="amenity-card">
      <div class="amenity-icon">${amenityIcon(a)}</div>
      <div class="text-sm font-medium" style="color:var(--theme-text);">${esc(a)}</div>
    </div>
  `).join('');

  // Included services pills
  const included = v.included_services || [];
  const includedPills = included.map(s => `
    <span class="feature-pill on">${esc(s)}</span>
  `).join('');

  // ====== KITCHEN BLOCK ======
  const k = v.kitchen_detail || { title: 'Mutfak', intro: '', items: [] };
  const kitchenItemsGrid = (k.items || []).map(it => `
    <div class="detail-card">
      <div class="detail-icon">${amenityIcon(it)}</div>
      <div class="detail-text">${esc(it)}</div>
    </div>
  `).join('');

  // ====== SALON BLOCK ======
  const s = v.salon_detail || { title: 'Salon', intro: '', items: [] };
  const salonItemsGrid = (s.items || []).map(it => `
    <div class="detail-card">
      <div class="detail-icon">${amenityIcon(it)}</div>
      <div class="detail-text">${esc(it)}</div>
    </div>
  `).join('');

  // ====== GARDEN BLOCK ======
  const g = v.garden_detail || { title: 'Bahçe', intro: '', items: [] };
  const gardenItemsGrid = (g.items || []).map(it => {
    if (typeof it === 'string') {
      return `<div class="garden-card"><div class="garden-icon">${amenityIcon(it)}</div><div class="garden-label">${esc(it)}</div></div>`;
    }
    const ic = it.icon && ICONS[it.icon] ? ICONS[it.icon] : amenityIcon(it.label || '');
    return `
      <div class="garden-card">
        <div class="garden-icon">${ic}</div>
        <div class="garden-label">${esc(it.label || '')}</div>
        ${it.value ? `<div class="garden-value">${esc(it.value)}</div>` : ''}
      </div>
    `;
  }).join('');

  // ====== ROOMS — 4 AYRI KART ======
  const rooms = v.bedrooms_detail || [];
  const roomsGrid = rooms.map(r => {
    const highlights = (r.highlights || []).map(h => {
      const lower = h.toLowerCase();
      let cls = 'feature-pill on';
      if (lower.includes('jakuzi') || lower.includes('jacuzzi')) cls = 'feature-pill star';
      if (lower.includes('king')) cls = 'feature-pill star';
      if (lower.includes('lcd')) cls = 'feature-pill star';
      return `<span class="${cls}">${esc(h)}</span>`;
    }).join('');
    const items = (r.items || []).map(it => `
      <li class="room-item">
        <span class="room-item-icon">${amenityIcon(it)}</span>
        <span class="room-item-text">${esc(it)}</span>
      </li>
    `).join('');
    const titleText = r.title || `${r.number}. Yatak Odası`;
    return `
    <article class="room-card">
      <div class="room-card-head">
        <div class="room-num">${r.number}</div>
        <div>
          <div class="room-card-eyebrow">${r.number}. Yatak Odası</div>
          <h3 class="font-display text-2xl font-bold">${esc(titleText)}</h3>
        </div>
      </div>
      <div class="room-beds">${esc(r.beds || '')}</div>
      <div class="room-highlights">${highlights}</div>
      <ul class="room-items">${items}</ul>
    </article>`;
  }).join('');

  // ====== DISTANCES ======
  const distances = v.distances || {};
  const distOrder = ['airport', 'center', 'beach', 'market', 'restaurant', 'transit'];
  const distancesGrid = distOrder.filter(k => distances[k]).map(k => `
    <div class="metric-card">
      <div class="metric-icon">${distanceIcon(k)}</div>
      <div class="metric-value">${esc(distances[k])}</div>
      <div class="metric-label" data-i="dist_${k}">${esc(DISTANCE_LABELS.tr[k])}</div>
    </div>
  `).join('');

  // ====== FAQS ======
  const faqs = v.faqs || [];
  const faqItems = faqs.map((f, i) => `
    <div class="faq-item${i === 0 ? ' open' : ''}">
      <div class="faq-q">${esc(f.q)}</div>
      <div class="faq-a"><div class="faq-a-inner">${esc(f.a)}</div></div>
    </div>
  `).join('');

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  const amenityFeatureJson = amenities.slice(0, 25).map(a => ({
    '@type': 'LocationFeatureSpecification',
    name: a,
    value: true
  }));

  const sameAs = [];
  if (v.instagram) sameAs.push(v.instagram);
  if (v.referenceUrl) sameAs.push(v.referenceUrl);
  sameAs.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name+' '+v.location)}`);

  const phone = v.phone_concierge || '+905306650794';
  const phoneRaw = phone.replace(/[^\d+]/g, '');
  const waRaw = phoneRaw.replace(/^\+/,'') || '905306650794';

  const capacityNumber = (v.capacity || '8 kişi').match(/\d+/)?.[0] || '8';

  const heroImage = baseImg;
  const heroImageFull = `https://kalkaninfo.com${baseImg}`;

  const ogImagePath = `/assets/og/villa/${v.id}.jpg`;
  const ogImageFull = existsSync(join(root, ogImagePath.replace(/^\//, '')))
    ? `https://kalkaninfo.com${ogImagePath}?v=2026-06-04`
    : heroImageFull;

  const mapsQuery = encodeURIComponent((v.location || '') + ' Kalkan');

  // WhatsApp messages (villa-spesifik)
  const villaWaMessage = v.wa_message || `Merhaba, ${v.name} hakkında bilgi almak istiyorum.`;
  const helloMsg = encodeURIComponent(villaWaMessage);
  const transferMsg = encodeURIComponent(`Merhaba, ${v.name} için Dalaman havalimanı transferi planlamak istiyorum.`);

  const fmtTL = (n) => new Intl.NumberFormat('tr-TR').format(n);

  // ====== ACCEPTED PAYMENT (Schema.org) ======
  const paymentMethods = ['Cash', 'CreditCard', 'BankTransfer'];

  // Template doldur
  // Geo — gercek koordinat varsa uretilir, yoksa cikar (sahte merkez koordinat basma).
  const _vlat = (v.coordinates && (v.coordinates.latitude ?? v.coordinates.lat)) ?? (v.geo && (v.geo.lat ?? v.geo.latitude)) ?? null;
  const _vlng = (v.coordinates && (v.coordinates.longitude ?? v.coordinates.lng)) ?? (v.geo && (v.geo.lng ?? v.geo.longitude)) ?? null;
  const geoBlock = (_vlat != null && _vlng != null)
    ? `"geo":{"@type":"GeoCoordinates","latitude":${Number(_vlat)},"longitude":${Number(_vlng)}},\n  `
    : '';

  const repl = {
    NAME: v.name,
    NAME_URL: encodeURIComponent(v.name),
    SLUG: v.id,
    GEO_BLOCK: geoBlock,
    CATEGORY: v.category,
    SUMMARY: v.summary || c.tagline || '',
    TAGLINE: c.tagline || v.summary || '',
    LOCATION: v.location || 'Kalamar, Kalkan',
    PHONE: phone,
    PHONE_RAW: phoneRaw,
    WA_RAW: waRaw,
    HELLO_MSG: helloMsg,
    TRANSFER_MSG: transferMsg,
    BEDROOMS: v.bedrooms || 4,
    BATHROOMS: v.bathrooms || 4,
    CAPACITY_NUMBER: capacityNumber,
    CHECK_IN: v.check_in || '16:00',
    CHECK_OUT: v.check_out || '10:00',
    CHECKIN_FULL_TEXT: v.checkin_full_text || '',
    DEPOSIT_FULL_TEXT: v.deposit_full_text || '',
    ABOUT_TITLE: c.aboutTitle || v.name,
    ABOUT_PARAS: aboutParas,
    ABOUT_IMAGE: aboutImage,
    HERO_IMAGE: heroImage,
    HERO_IMAGE_FULL: heroImageFull,
    HERO_TAGS: heroTags,
    OG_IMAGE_FULL: ogImageFull,
    MAPS_QUERY: mapsQuery,
    AMENITIES_GRID: amenitiesGrid,
    INCLUDED_PILLS: includedPills,
    ROOMS_GRID: roomsGrid,
    KITCHEN_TITLE: k.title || 'Mutfak',
    KITCHEN_INTRO: k.intro || '',
    KITCHEN_ITEMS_GRID: kitchenItemsGrid,
    KITCHEN_IMAGE: kitchenImage,
    SALON_TITLE: s.title || 'Salon',
    SALON_INTRO: s.intro || '',
    SALON_ITEMS_GRID: salonItemsGrid,
    SALON_IMAGE: salonImage,
    GARDEN_TITLE: g.title || 'Bahçe & Havuz',
    GARDEN_INTRO: g.intro || '',
    GARDEN_ITEMS_GRID: gardenItemsGrid,
    POOL_IMAGE: poolImage,
    POOL_TITLE: c.poolTitle || (v.pool || 'Özel Havuz'),
    POOL_DESC: c.poolDesc || '',
    POOL_DIMENSIONS: v.pool_dimensions || '9.5m × 3.5m',
    DISTANCES_GRID: distancesGrid,
    DEPOSIT_TL: fmtTL(v.deposit_tl || 20000),
    SHORT_STAY_TL: fmtTL(v.short_stay_fee_tl || 10000),
    PET_FEE_TL: fmtTL(v.pet_fee_tl || 15000),
    FAQ_ITEMS: faqItems,
    FAQ_JSON_LD: JSON.stringify(faqJsonLd),
    GALLERY_ITEMS: galleryItems,
    SOCIAL_LINKS: socialLinks(v),
    AMENITY_FEATURE_JSON: JSON.stringify(amenityFeatureJson),
    SAME_AS_JSON: JSON.stringify(sameAs),
    PAYMENT_METHODS_JSON: JSON.stringify(paymentMethods),
    RELATED_SECTION: relatedSection(v, data.items || []),
    I18N_JSON: JSON.stringify(I18N_BASE),
    THEME_BG: T.bg,
    THEME_BG_2: T.bg2,
    THEME_ACCENT: T.accent,
    THEME_ACCENT_2: T.accent2,
    THEME_TEXT: T.text,
    THEME_MUTED: T.muted,
    THEME_BORDER: T.border,
    THEME_BORDER_STRONG: T.border_strong,
    THEME_ACCENT_SOFT: T.accent_soft,
    THEME_NAV_BG: T.nav_bg,
    THEME_NAV_BG_SCROLL: T.nav_bg_scroll,
    THEME_HERO_OVERLAY: T.hero_overlay,
    THEME_FONT_DISPLAY: T.font_display,
    THEME_GOOGLE_FONT: T.google_font,
    THEME_CODE: T.code,
    THEME_MOTIF: T.motif
  };

  let html = template;
  for (const [k, val] of Object.entries(repl)) {
    html = html.replaceAll(`{{${k}}}`, String(val));
  }

  const outDir = join(root, 'villa', v.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  built.push({ slug: v.id, name: v.name, url: `https://kalkaninfo.com/villa/${v.id}/`, local: `http://localhost:3000/villa/${v.id}/`, theme: T.code });
  console.log(`  + ${v.name}  [${T.code}]  ->  villa/${v.id}/`);
}

// Sitemap'e ekle
if (built.length) {
  const sitemapPath = join(root, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0,10);
  for (const b of built) {
    const url = `https://kalkaninfo.com/villa/${b.slug}`;
    if (!sitemap.includes(url)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
    }
  }
  await writeFile(sitemapPath, sitemap);
  console.log(`Sitemap'e ${built.length} URL eklendi.`);
}

console.log('\n--- ADRESLER ---');
built.forEach(b => console.log(`  ${b.name} [${b.theme}]\n    Local : ${b.local}\n    Canli : ${b.url}\n`));
