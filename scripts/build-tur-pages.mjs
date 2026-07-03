#!/usr/bin/env node
/**
 * Tur mini-site uretici (10 tur).
 * Kullanim: node scripts/build-tur-pages.mjs [slug1 slug2 ...]
 *   - Slug verilmezse data/turlar.json'daki TUM turlar uretilir.
 *
 * Pool fallback YOK — galeri SADECE turun kendi fotograflarindan.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PHOTOS_CACHE_DIR = join(root, 'data', 'tur-photos');

const args = process.argv.slice(2);
const data = JSON.parse(await readFile(join(root, 'data', 'turlar.json'), 'utf8'));
const template = await readFile(join(root, 'tur', '_template', 'index.html'), 'utf8');
const targets = args.length ? args : (data.items || []).map(it => it.id);

// =====================================================================
// Kategori-bazli tema (Berkay'in talimati)
// =====================================================================
function theme(category){
  const map = {
    'Tekne Turu': { bg:'#06141a', bg2:'#0c2129', accent:'#f0c87a', accent2:'#d4a85e', text:'#e6f1f3', muted:'#86a4ab', font:'Cormorant+Garamond' },
    'Safari':     { bg:'#1a120a', bg2:'#241710', accent:'#8b6b3d', accent2:'#6b8e23', text:'#f0e5d6', muted:'#a89882', font:'Playfair+Display' },
    'At Turu':    { bg:'#1a0a10', bg2:'#2a0e18', accent:'#7a2a3a', accent2:'#a8485a', text:'#e8d4b8', muted:'#a89484', font:'Cormorant+Garamond' },
    'Kano Turu':  { bg:'#051528', bg2:'#0a2236', accent:'#4eb1b3', accent2:'#c4a67d', text:'#e1ecf2', muted:'#7f9aae', font:'Cormorant+Garamond' }
  };
  return map[category] || map['Tekne Turu'];
}

// HTML escape
const esc = (s) => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ── i18n attribute uretici ── {tr,en,de,ru,fr} -> `data-en="..." data-de="..."` (TR taban DOM'da).
// js/inline i18n icerik metnini bu data-* attribute'larindan okur (fallback: hedef->en->tr).
const I18N_LANGS = ['en', 'de', 'ru', 'fr'];
function i18nAttrs(i18n){
  if (!i18n || typeof i18n !== 'object') return '';
  const out = [];
  for (const l of I18N_LANGS){ const v = i18n[l]; if (typeof v === 'string' && v.trim()) out.push(`data-${l}="${esc(v)}"`); }
  return out.join(' ');
}

// Yildizlar
function starsHtml(rating) {
  if (!rating) return '';
  const v = Math.max(0, Math.min(5, Number(rating)));
  const full = Math.floor(v);
  const half = (v - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const star = (fill) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.4" style="display:inline-block;vertical-align:middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  return star('currentColor').repeat(full) + (half ? star('url(#half)') : '') + star('none').repeat(empty);
}

function ratingBlock(rating) {
  if (!rating) return '';
  return `<div class="star-row mb-4 justify-center" style="display:inline-flex;color:#f0c87a;">${starsHtml(rating)} <span class="ml-2 text-sm font-bold" style="color:#f0c87a;">${Number(rating).toFixed(1)}</span></div>`;
}

// =====================================================================
// Per-tur CUSTOM — tagline, program, hatirlatmalar, sss
// =====================================================================
const CUSTOM = {
  'gunluk-tekne': {
    tagline: '12 Koy · Sarı Limon · Beyaz Ada',
    aboutTitle: 'Akdeniz\'in 12 Saklı Koyu.',
    aboutP1: 'Kalkan Yat Limanı\'ndan saat 08:30\'da hareket eden klasik günlük tekne turu, Sarı Limon, Beyaz Ada, Soğuk Su ve diğer koylarda toplam 12 yüzme molası verir. Snorkel ekipmanı tekneden temin edilir.',
    aboutP2: 'Öğle yemeği teknede taze pişer — ızgara balık veya tavuk seçenekleri, Türk salatası, ekmek ve çay/kahve dahil. Akşam 18:00 civarı limana dönüş, gün batımı önce.',
    program: [
      {time:'08:30', text:'Kalkan Yat Limanı\'ndan kalkış, otelden transfer dahil.'},
      {time:'09:30', text:'Sarı Limon koyu — ilk yüzme molası, snorkel.'},
      {time:'11:00', text:'Beyaz Ada — sığ koy, çocuk dostu yüzme.'},
      {time:'12:30', text:'Teknede sıcak öğle yemeği servisi.'},
      {time:'14:00', text:'Soğuk Su koyu — pınar suyu, kayalıklar.'},
      {time:'16:00', text:'Mavi Mağara önü demirleme, isteğe bağlı yüzme.'},
      {time:'18:00', text:'Kalkan limanına dönüş, otel transferi.'}
    ]
  },
  'kekova-tekne': {
    tagline: 'Batık Şehir · Simena Kalesi · Cam Tabanlı Tekne',
    aboutTitle: 'Batık Lykia Şehrini Cam Tabandan İzleyin.',
    aboutP1: 'Üçağız limanından kalkan tur, cam tabanlı tekneyle Kekova\'nın batık antik şehrinin üzerinden geçer — duvar kalıntıları, basamaklar ve amforalar net görülür.',
    aboutP2: 'Simena Kalesi durağında yürüyüş, Kale Köy\'de öğle yemeği. Rehber eşliğinde tarih + deniz, çocuklu aileler için uygun.',
    program: [
      {time:'08:00', text:'Otellerden alım — Kalkan\'dan Üçağız\'a transfer.'},
      {time:'09:30', text:'Üçağız limanından cam tabanlı tekneye binis.'},
      {time:'10:00', text:'Batık şehir üzerinden seyir — Lykia kalıntıları.'},
      {time:'11:30', text:'Simena Kalesi durağı — yürüyüş + fotoğraf.'},
      {time:'13:00', text:'Kale Köy\'de tradisyonel öğle yemeği.'},
      {time:'15:00', text:'Aquarium Bay\'de yüzme molası.'},
      {time:'17:00', text:'Üçağız\'a dönüş.'},
      {time:'19:00', text:'Otellere transfer.'}
    ]
  },
  'sunset-cruise': {
    tagline: 'Kokteyl · Meze · Canlı Müzik',
    aboutTitle: 'Akdeniz\'in En Güzel Gün Batımı.',
    aboutP1: 'Akşamüstü Kalkan limanından kalkan 3.5 saatlik gün batımı seyiri. Açık büfe meze tabağı, sınırsız kokteyl ve canlı akustik müzik dahil.',
    aboutP2: 'Çiftler ve küçük gruplar için ideal — 20 kişilik küçük tekne, kalabalıksız bir keyif. Akşam yemeği yerine de tercih edilebilir.',
    program: [
      {time:'18:00', text:'Kalkan Yat Limanı\'ndan kalkış.'},
      {time:'18:30', text:'Hoşgeldin kokteyli, meze servisi başlar.'},
      {time:'19:30', text:'Gün batımı — Likya kıyısının silüeti.'},
      {time:'20:00', text:'Canlı akustik müzik başlar.'},
      {time:'21:30', text:'Limana dönüş, yıldızlı gökyüzü altında.'}
    ]
  },
  'patara-tekne': {
    tagline: '18 km Beyaz Kum · Antik Patara · Yüzme',
    aboutTitle: 'Türkiye\'nin En Uzun Plajı Patara\'ya Deniz Yoluyla.',
    aboutP1: 'Kalkan\'dan tekneyle Patara plajına varış — yol boyunca koylarda mola, açık denizde rota. Antik Patara kentine rehberli kısa gezi.',
    aboutP2: 'Patara plajının uçsuz bucaksız beyaz kumunda 2-3 saat yüzme + güneşlenme. Akşamüstü Kalkan limanına dönüş.',
    program: [
      {time:'09:00', text:'Kalkan Yat Limanı\'ndan kalkış.'},
      {time:'10:30', text:'Sarı Limon\'da yüzme molası.'},
      {time:'12:00', text:'Patara açıklarında demirleme + öğle yemeği.'},
      {time:'13:00', text:'Patara plajına çıkış, antik kent gezisi (rehberli).'},
      {time:'15:00', text:'Patara plajında serbest yüzme + güneşlenme.'},
      {time:'17:00', text:'Kalkan\'a dönüş.'}
    ]
  },
  'jeep-safari': {
    tagline: 'Saklıkent Kanyonu · Tlos · Köy Yolları',
    aboutTitle: 'Toros Dağları\'nda 8 Saat Macera.',
    aboutP1: 'Otelden alıp jeep konvoyu eşliğinde Saklıkent kanyonuna doğru. 18 km uzunluğundaki kanyona kısa yürüyüş + Eşen Çayı\'nda serinleme.',
    aboutP2: 'Tlos antik kenti — Likya kaya mezarları ve amfitiyatro. Yamaç köylerinde geleneksel öğle yemeği. Konvoy şoförü deneyimli — su geçişleri, çamur, eğlenceli rota.',
    program: [
      {time:'09:30', text:'Otelden jeep konvoyu alımı.'},
      {time:'10:30', text:'Yakaköy yamaçlarında kısa fotoğraf molası.'},
      {time:'11:30', text:'Saklıkent kanyonu — yürüyüş + serinleme.'},
      {time:'13:00', text:'Yörük köyünde sıcak öğle yemeği (gözleme, ızgara).'},
      {time:'14:30', text:'Tlos antik kenti — rehberli gezi.'},
      {time:'16:00', text:'Su geçişli macera rotası, eğlenceli kısım.'},
      {time:'17:30', text:'Otelinize varış.'}
    ]
  },
  'quad-safari': {
    tagline: 'Tepelerden Kalkan Manzarası · Gün Batımı',
    aboutTitle: 'Direksiyon Sizde — Kalkan\'ın Yüksek Yolları.',
    aboutP1: '15:00\'de Kalkan ATV merkezinden başlayan 3 saatlik quad turu. Kısa eğitim sonrası tek veya çift kişilik ATV ile Kalkan tepelerinde keşif.',
    aboutP2: 'Toz, çakıl, eğlence — rehber öncülüğünde güvenli rota. Gün batımı saatinde tepeden Kalkan koyu manzarası eşsiz. 18 yaş altı binemez.',
    program: [
      {time:'15:00', text:'Kalkan ATV merkezinde eğitim ve ekipman.'},
      {time:'15:30', text:'Tepelere doğru tırmanış başlar.'},
      {time:'16:30', text:'Kalkan manzaralı fotoğraf molası.'},
      {time:'17:15', text:'Çakıl yolda eğlenceli rota.'},
      {time:'18:00', text:'Merkeze dönüş, gün batımı izleme.'}
    ]
  },
  'patara-at': {
    tagline: '18 km Patara Plajı · At Sırtında · Antik Kent Yanından',
    aboutTitle: 'Patara\'da Şafakta At Binme Deneyimi.',
    aboutP1: 'Sabah erken Patara çiftliğine transfer. Kısa eğitim ve at seçimi sonrası 18 km uzunluğundaki Patara plajının kenarında at sırtında yürüyüş.',
    aboutP2: 'Antik Patara kentinin yanından geçiş, kumsalda toynak izi. Tecrübeli eğitmen eşliğinde — başlangıç seviyeleri için de uygun. Kask zorunludur.',
    program: [
      {time:'08:00', text:'Otelden Patara at çiftliğine transfer.'},
      {time:'08:30', text:'Eğitmenle kısa eğitim ve at tanışması.'},
      {time:'09:00', text:'Patara plajına doğru hareket.'},
      {time:'09:45', text:'Plaj boyunca yürüyüş, antik kent kenarı.'},
      {time:'10:30', text:'Su molası, fotoğraf.'},
      {time:'11:00', text:'Çiftliğe dönüş, otele transfer.'}
    ]
  },
  'koy-at': {
    tagline: 'Kalkan Tepeleri · Köy Sokakları · Çay Molası',
    aboutTitle: 'Kalkan\'ın Üst Köylerinde At Sırtında.',
    aboutP1: 'Öğleden sonra Kalkan tepesindeki ata binme merkezinden başlayan 2.5 saatlik tur. Köy yollarında, zeytinliklerde ve manzara duraklarında yürüyüş.',
    aboutP2: 'Bir yöre köyünde geleneksel ev ziyareti — Türk çayı ve yöresel atıştırmalık ikramı. Manzara durağında uzun mola, fotoğraf molası.',
    program: [
      {time:'15:30', text:'Kalkan tepesinde merkez, kısa eğitim.'},
      {time:'16:00', text:'Köy yollarına hareket, zeytinlik manzarası.'},
      {time:'16:45', text:'Yöre köyünde Türk çayı ikramı.'},
      {time:'17:15', text:'Manzara durağı — Kalkan koyu fotoğrafı.'},
      {time:'18:00', text:'Merkeze dönüş.'}
    ]
  },
  'xanthos-kano': {
    tagline: 'Xanthos Nehri · 12 km Kano · Patara Bitiş',
    aboutTitle: 'Likya Başkenti Xanthos\'tan Patara\'ya Su Yolculuğu.',
    aboutP1: 'Xanthos nehri akıntısıyla 2 kişilik kano ile 12 km lik bir nehir yolculuğu. Antik Xanthos kentinin yakınından başlar, sazlık + ormanlık bölgelerden geçer.',
    aboutP2: 'Patara antik kentinin yakınında biter. Su kuşları, kaplumbağa görme şansı yüksek. Eğitmen + emniyet teknesi turla birlikte gider. Yüzme bilmek tavsiye edilir.',
    program: [
      {time:'09:00', text:'Otelden kano başlangıç noktasına transfer.'},
      {time:'09:45', text:'Ekipman dağıtımı, kısa güvenlik brifingi.'},
      {time:'10:00', text:'Nehirde kanolama başlar.'},
      {time:'11:30', text:'Sazlık alanda mola — atıştırmalık + su.'},
      {time:'13:00', text:'Patara yakınında bitiş, atıştırmalık servis.'},
      {time:'14:00', text:'Otele dönüş transferi.'}
    ]
  },
  'saklikent-kano': {
    tagline: 'Eşen Çayı · Kanyon Girişi · Suyun Soğuk Akıntısı',
    aboutTitle: 'Saklıkent Kanyonunun Buz Gibi Sularında Kano.',
    aboutP1: 'Saklıkent kanyonu girişindeki Eşen çayı üzerinde kanolama. Sulara mevsime göre az veya çok akıntı eşlik eder. Ortalama 5 km lik rota.',
    aboutP2: 'Öğle yemeği nehir kenarı restoranda ızgara alabalık servisi (yemek dahil). Su ayakkabısı ve yüzme bilmek tavsiye edilir.',
    program: [
      {time:'10:00', text:'Otelden Saklıkent\'e transfer.'},
      {time:'11:00', text:'Ekipman dağıtımı, kısa brifing.'},
      {time:'11:30', text:'Kanyon girişinde kanolama başlar.'},
      {time:'13:00', text:'Nehir kenarı restoranda alabalık öğle yemeği.'},
      {time:'14:00', text:'İkinci yarı kanolama — daha sakin akıntı.'},
      {time:'15:00', text:'Bitiş, otele dönüş.'}
    ]
  }
};

// Kategori-bazli jenerik hatirlatmalar
const REMIND_GENERIC = {
  'Tekne Turu': [
    {ico:'sun', title:'Güneş Koruması', text:'Şapka, güneş gözlüğü ve SPF 50+ güneş kremi mutlaka getirin. Açık denizde güneş 2 kat etkilidir.'},
    {ico:'shirt', title:'Mayo + Havlu', text:'Mayonuzun altına bir yedek de getirin. Havluyu tekne sağlar ama küçük bir yedek havlu pratiktir.'},
    {ico:'child', title:'Çocuk Dostu', text:'Tekne çocuklara uygun, can yeleği boyutları tekne sağlar. 3 yaş üstü tavsiye edilir.'}
  ],
  'Safari': [
    {ico:'sun', title:'Toz + Güneş', text:'Toz olur — gözlük ve baş örtüsü/şapka getirin. Açık renk kıyafet daha rahattır.'},
    {ico:'shoe', title:'Kapalı Ayakkabı', text:'Sandalet değil, spor ayakkabı veya bot. Kanyon yürüyüşü kayalıktır.'},
    {ico:'water', title:'Su + Atıştırmalık', text:'1 lt su getirin. Tur boyunca su molaları olur ama yedek almak iyi olur.'}
  ],
  'At Turu': [
    {ico:'shoe', title:'Kapalı Ayakkabı', text:'Topuğu olan, kapalı ayakkabı zorunludur. Açık sandalet uygun değil.'},
    {ico:'shirt', title:'Pantolon Tercih', text:'Şort yerine pantolon önerilir — iç bacak rahatsızlığını engeller.'},
    {ico:'child', title:'Yaş Sınırı', text:'7 yaş üstü tavsiye edilir. 12 yaş altı eğitmenle birlikte biner.'}
  ],
  'Kano Turu': [
    {ico:'shoe', title:'Su Ayakkabısı', text:'Yüzme ayakkabısı veya eski spor ayakkabı tavsiye edilir. Sandaletler düşebilir.'},
    {ico:'dry', title:'Su Geçirmez Çanta', text:'Telefon/kamera için su geçirmez çanta kullanın. Eğitmen ekstra çanta sağlar.'},
    {ico:'swim', title:'Yüzme Bilgisi', text:'Temel yüzme bilgisi tavsiye edilir. Yelek tüm tur boyunca zorunludur.'}
  ]
};

const REMIND_ICONS = {
  sun: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93"/></svg>',
  shirt: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 2l3 3-3 4M8 2L5 5l3 4M8 2h8l4 5v15H4V7l4-5z"/></svg>',
  child: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="5" r="2"/><path d="M9 14l3-7 3 7M7 21l2-7M17 21l-2-7"/></svg>',
  shoe: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 17h4l2-2h6l2 4h4v-3l-3-2-2-3-3-1H8L5 11l-2 2v4z"/></svg>',
  water: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2s5 6 5 11a5 5 0 0 1-10 0c0-5 5-11 5-11Z"/></svg>',
  dry: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 8h16M9 12h6"/></svg>',
  swim: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 18c3-2 5 2 8 0s5 2 8 0M2 22c3-2 5 2 8 0s5 2 8 0"/><circle cx="6" cy="8" r="2"/></svg>'
};

// Jenerik program (CUSTOM yoksa kullanilir)
function genericProgram(r) {
  // duration formati: "08:30 – 18:00" veya "10:00 – 15:00"
  const m = (r.duration || '').match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/);
  const start = m ? m[1] : '09:00';
  const end = m ? m[2] : '17:00';
  return [
    {time: start, text: `Toplanma noktasında buluşma — ${r.meetingPoint || 'Kalkan'}. Kısa brifing.`},
    {time: 'Sabah', text: `${r.category} aktivitesinin ilk yarısı — molalar dahildir.`},
    {time: 'Öğle', text: `Öğle molası — ${(r.includes || []).find(i => /yemek/i.test(i)) || 'atıştırmalık servis'}.`},
    {time: 'Öğleden Sonra', text: `İkinci yarı — manzara durakları, fotoğraf molaları.`},
    {time: end, text: 'Bitiş — toplanma noktasına dönüş.'}
  ];
}

// SSS jenerik
function genericFaq(r) {
  return [
    {q:'Rezervasyon iptal koşulları nedir?', a:'24 saatten önceki iptaller ücretsiz. 24 saatten sonra %50, 6 saat içinde tam ücret alınır.'},
    {q:'Hava kötü olursa ne olur?', a:'Hava şartları nedeniyle tur iptal edilirse ücret iade veya farklı bir güne aktarma seçeneklerinden birini seçebilirsiniz.'},
    {q:'Otel transferi dahil mi?', a: (r.includes || []).some(i => /transfer/i.test(i)) ? 'Evet, otelden alım ve bırakma fiyata dahildir.' : 'Otel transferi standart pakete dahil değildir, talep ederseniz concierge ek ücretle organize eder.'},
    {q:'Çocuklarla katılabilir miyim?', a: r.category === 'At Turu' ? '7 yaş üstü tavsiye edilir, 12 yaş altı eğitmenle birlikte.' : (r.category === 'Quad ATV' || /quad/i.test(r.id)) ? '18 yaş altı binemez.' : 'Çocuklarla uygundur, yaş sınırı yok.'},
    {q:'Ne giymeliyim?', a: r.category === 'Tekne Turu' ? 'Mayo, havlu, şapka, güneş gözlüğü, plaj sandaleti.' : r.category === 'Safari' ? 'Spor ayakkabı, açık renk pantolon/şort, şapka.' : r.category === 'At Turu' ? 'Kapalı ayakkabı (topuklu), pantolon, kask sağlanır.' : 'Yüzme ayakkabısı, kuru kıyafet yedeği, mayo.'}
  ];
}

// =====================================================================
// 5-DIL I18N
// =====================================================================
const I18N_BASE = {
  tr: { about:'Hakkımızda', program:'Program', includes:'Dahil', gallery:'Galeri', info:'Bilgi', reserve:'Rezervasyon',
        cta_reserve:'Şimdi Rezervasyon', cta_program:'Programı Gör', cta_reserve_send:'Talebi Gönder', cta_reserve_2:'Yerimi Ayır',
        hero_sub:'', about_label:'Hakkımızda', about_title:'',
        info_label:'Toplanma & Süre', info_title:'Pratik Bilgiler', info_duration:'Süre', info_meeting:'Toplanma Noktası', info_capacity:'Kapasite', info_languages:'Diller',
        program_label:'Tur Programı', program_title:'Saat Saat Akış', program_sub:'Günün başından sonuna kadar planlanan duraklar ve aktiviteler.',
        includes_label:'Dahil & Hariç', includes_title:'Fiyata Dahil Olanlar', includes_yes:'Dahil', includes_no:'Hariç',
        price_label:'Fiyat', price_title:'Kişi Başı Fiyat', price_group:'10 kişi ve üzeri gruplar için özel indirim — concierge ile pazarlık edin.',
        gallery_label:'Galeri', gallery_title:'Turdan Kareler',
        remind_label:'Önemli Hatırlatmalar', remind_title:'Tura Çıkmadan Önce',
        faq_label:'Sıkça Sorulan Sorular', faq_title:'Aklınızdakileri Yanıtladık',
        reserve_label:'Rezervasyon', reserve_title:'Yerinizi Ayırın', reserve_sub:'WhatsApp ile hızlı rezervasyon yapın veya formu doldurun — 60 saniye içinde döneriz.',
        contact_label:'İletişim', contact_title:'Concierge Ekibi', contact_addr:'Toplanma Noktası', contact_phone:'Concierge Telefon', contact_social:'Sosyal Medya' },
  en: { about:'About', program:'Program', includes:'Included', gallery:'Gallery', info:'Info', reserve:'Reservation',
        cta_reserve:'Reserve Now', cta_program:'View Program', cta_reserve_send:'Send Request', cta_reserve_2:'Reserve My Spot',
        hero_sub:'', about_label:'About', about_title:'',
        info_label:'Meeting & Duration', info_title:'Practical Info', info_duration:'Duration', info_meeting:'Meeting Point', info_capacity:'Capacity', info_languages:'Languages',
        program_label:'Tour Program', program_title:'Hour by Hour', program_sub:'Stops and activities planned from start to end.',
        includes_label:'Included & Excluded', includes_title:'What\'s Included', includes_yes:'Included', includes_no:'Not Included',
        price_label:'Price', price_title:'Per Person', price_group:'Special discount for groups of 10+ — negotiate via concierge.',
        gallery_label:'Gallery', gallery_title:'Tour Moments',
        remind_label:'Reminders', remind_title:'Before You Go',
        faq_label:'FAQ', faq_title:'Your Questions Answered',
        reserve_label:'Reservation', reserve_title:'Reserve Your Spot', reserve_sub:'Reserve fast via WhatsApp or fill the form — we reply in 60 seconds.',
        contact_label:'Contact', contact_title:'Concierge Team', contact_addr:'Meeting Point', contact_phone:'Concierge Phone', contact_social:'Social' },
  de: { about:'Über uns', program:'Programm', includes:'Inklusive', gallery:'Galerie', info:'Info', reserve:'Reservierung',
        cta_reserve:'Jetzt reservieren', cta_program:'Programm ansehen', cta_reserve_send:'Anfrage senden', cta_reserve_2:'Platz sichern',
        hero_sub:'', about_label:'Über uns', about_title:'',
        info_label:'Treffpunkt & Dauer', info_title:'Praktische Infos', info_duration:'Dauer', info_meeting:'Treffpunkt', info_capacity:'Kapazität', info_languages:'Sprachen',
        program_label:'Tour-Programm', program_title:'Stunde für Stunde', program_sub:'Stationen und Aktivitäten von Anfang bis Ende.',
        includes_label:'Inklusive & Exklusive', includes_title:'Im Preis enthalten', includes_yes:'Inklusive', includes_no:'Nicht inklusive',
        price_label:'Preis', price_title:'Pro Person', price_group:'Rabatt für Gruppen ab 10 Personen — beim Concierge anfragen.',
        gallery_label:'Galerie', gallery_title:'Tour-Momente',
        remind_label:'Erinnerungen', remind_title:'Bevor Sie losziehen',
        faq_label:'FAQ', faq_title:'Ihre Fragen beantwortet',
        reserve_label:'Reservierung', reserve_title:'Platz reservieren', reserve_sub:'Schnelle Reservierung per WhatsApp oder Formular — Antwort in 60 Sekunden.',
        contact_label:'Kontakt', contact_title:'Concierge-Team', contact_addr:'Treffpunkt', contact_phone:'Concierge Telefon', contact_social:'Soziale Medien' },
  ru: { about:'О туре', program:'Программа', includes:'Включено', gallery:'Галерея', info:'Информация', reserve:'Бронирование',
        cta_reserve:'Забронировать', cta_program:'Смотреть программу', cta_reserve_send:'Отправить запрос', cta_reserve_2:'Забронировать место',
        hero_sub:'', about_label:'О туре', about_title:'',
        info_label:'Сбор и длительность', info_title:'Практическая информация', info_duration:'Длительность', info_meeting:'Место сбора', info_capacity:'Вместимость', info_languages:'Языки',
        program_label:'Программа тура', program_title:'Час за часом', program_sub:'Остановки и активности с начала до конца.',
        includes_label:'Включено и не включено', includes_title:'Что входит в цену', includes_yes:'Включено', includes_no:'Не включено',
        price_label:'Цена', price_title:'С человека', price_group:'Скидка для групп от 10 человек — обсудите с консьержем.',
        gallery_label:'Галерея', gallery_title:'Моменты тура',
        remind_label:'Напоминания', remind_title:'Перед поездкой',
        faq_label:'FAQ', faq_title:'Ответы на ваши вопросы',
        reserve_label:'Бронирование', reserve_title:'Забронируйте место', reserve_sub:'Быстрое бронирование в WhatsApp или заполните форму — ответ за 60 секунд.',
        contact_label:'Контакты', contact_title:'Команда консьержа', contact_addr:'Место сбора', contact_phone:'Телефон консьержа', contact_social:'Социальные сети' },
  fr: { about:'À propos', program:'Programme', includes:'Inclus', gallery:'Galerie', info:'Info', reserve:'Réservation',
        cta_reserve:'Réserver maintenant', cta_program:'Voir le programme', cta_reserve_send:'Envoyer la demande', cta_reserve_2:'Réserver ma place',
        hero_sub:'', about_label:'À propos', about_title:'',
        info_label:'Rendez-vous & Durée', info_title:'Infos pratiques', info_duration:'Durée', info_meeting:'Point de rendez-vous', info_capacity:'Capacité', info_languages:'Langues',
        program_label:'Programme', program_title:'Heure par heure', program_sub:'Étapes et activités planifiées du début à la fin.',
        includes_label:'Inclus & Non inclus', includes_title:'Ce qui est inclus', includes_yes:'Inclus', includes_no:'Non inclus',
        price_label:'Tarif', price_title:'Par personne', price_group:'Remise pour groupes de 10+ — négociez via le concierge.',
        gallery_label:'Galerie', gallery_title:'Moments du tour',
        remind_label:'Rappels', remind_title:'Avant de partir',
        faq_label:'FAQ', faq_title:'Vos questions, nos réponses',
        reserve_label:'Réservation', reserve_title:'Réservez votre place', reserve_sub:'Réservation rapide via WhatsApp ou remplissez le formulaire — réponse en 60 secondes.',
        contact_label:'Contact', contact_title:'Équipe concierge', contact_addr:'Point de rendez-vous', contact_phone:'Téléphone concierge', contact_social:'Réseaux sociaux' }
};

// =====================================================================
// BUILD LOOP
// =====================================================================
let built = [];
const concierge = '+90 530 665 07 94';
const conciergeRaw = '905306650794';

for (const slug of targets) {
  const r = (data.items || []).find(x => x.id === slug);
  if (!r) { console.warn(`Atlandi: ${slug} turlar.json'da yok`); continue; }
  const c = CUSTOM[slug] || {};
  const t = theme(r.category);

  // Photos manifest (fetch script ile dolduruldu)
  let photoManifest = null;
  const mfPath = join(PHOTOS_CACHE_DIR, `${slug}.json`);
  if (existsSync(mfPath)) {
    try { photoManifest = JSON.parse(await readFile(mfPath, 'utf8')); } catch {}
  }

  // Hero ve galeri — pool fallback YOK, sadece turun kendi fotograflari
  const heroImage = photoManifest?.files?.hero || r.image || '/assets/img/4fec24c9524d.webp';
  const galleryRaw = photoManifest?.files?.gallery || (r.gallery || []);
  const gallerySources = galleryRaw.slice(0, 8);

  // Galeri kartlari
  const galleryItems = gallerySources.map((src, i) => `
    <a href="${esc(src)}" target="_blank" class="gallery-item aspect-square block">
      <img src="${esc(src)}" alt="${esc(r.name)} ${i+1}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.background='var(--theme-bg-2)';this.style.opacity='0.3';">
    </a>`).join('');

  // About image (galeride 2.)
  const aboutImage = gallerySources[1] || gallerySources[0] || heroImage;

  // Hero tags
  const heroTags = [r.category, r.duration, r.capacity].filter(Boolean).map(x =>
    `<span class="tag-chip">${esc(x)}</span>`
  ).join('');

  // Program rows
  const program = c.program || genericProgram(r);
  const programRows = program.map(p => `
    <div class="program-row">
      <div class="program-time">${esc(p.time)}</div>
      <div class="program-text">${esc(p.text)}</div>
    </div>`).join('');

  // Includes / excludes
  const yesIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l5 5L20 7"/></svg>';
  const noIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const includesList = (r.includes || []).map(it => `
    <div class="list-row list-yes">${yesIcon}<span>${esc(it)}</span></div>`).join('');
  const excludesList = (r.excludes || []).map(it => `
    <div class="list-row list-no">${noIcon}<span>${esc(it)}</span></div>`).join('');

  // Remind cards
  const reminders = REMIND_GENERIC[r.category] || REMIND_GENERIC['Tekne Turu'];
  const remindCards = reminders.map(rd => `
    <div class="info-tile" style="flex-direction:column;align-items:flex-start;gap:14px;">
      ${REMIND_ICONS[rd.ico] || REMIND_ICONS.sun}
      <div>
        <div class="ititle">${esc(rd.title)}</div>
        <p class="text-sm leading-relaxed mt-2" style="color:var(--theme-muted);">${esc(rd.text)}</p>
      </div>
    </div>`).join('');

  // FAQ
  const faqs = genericFaq(r);
  const faqItems = faqs.map(f => `
    <div class="faq-item">
      <div class="faq-q">${esc(f.q)}</div>
      <div class="faq-a">${esc(f.a)}</div>
    </div>`).join('');

  // Rating
  const ratingHtml = ratingBlock(r.rating);
  const aggregateRatingJson = r.rating
    ? JSON.stringify({ '@type':'AggregateRating', ratingValue: r.rating, reviewCount: 25, bestRating: 5, worstRating: 1 })
    : 'null';

  // Languages
  const langs = (r.languages || ['TR','EN']).join(' · ');

  // OG image
  const ogImagePath = `/assets/og/tur/${r.id}.jpg`;
  const ogImageFull = existsSync(join(root, ogImagePath.replace(/^\//, '')))
    ? `https://kalkaninfo.com${ogImagePath}?v=2026-06-04`
    : `https://kalkaninfo.com${heroImage}`;
  const heroImageFull = heroImage.startsWith('http') ? heroImage : `https://kalkaninfo.com${heroImage}`;

  // Maps query
  const mapsQuery = encodeURIComponent((r.meetingPoint || 'Kalkan Yat Limanı') + ' Kalkan');

  // Price extraction (numeric)
  const priceM = (r.price || '').match(/[\d.,]+/);
  const priceNum = priceM ? priceM[0].replace(/[^\d]/g, '') : '850';

  // Telefon (concierge)
  const phone = concierge;
  const phoneRaw = phone.replace(/[^\d+]/g, '');

  // META i18n — title isim tabanli (TR SEO korunur), aciklama cevrilir (summaryI18n).
  const metaTitle = `${r.name} — ${r.category} | Kalkan Info`;
  const descI18n = r.summaryI18n || {};
  const META_I18N = {};
  for (const l of ['tr', 'en', 'de', 'ru', 'fr']){
    META_I18N[l] = { title: metaTitle, desc: (l === 'tr') ? (r.summary || '') : (descI18n[l] || r.summary || '') };
  }

  const repl = {
    NAME: r.name,
    NAME_URL: encodeURIComponent(r.name),
    SLUG: r.id,
    CATEGORY: r.category,
    SUMMARY: r.summary || c.tagline || '',
    TAGLINE: c.tagline || r.summary || '',
    TAGLINE_I18N_ATTRS: i18nAttrs(r.taglineI18n),
    ABOUT_TITLE_I18N_ATTRS: i18nAttrs(r.aboutTitleI18n),
    ABOUT_P1_I18N_ATTRS: i18nAttrs(r.aboutP1I18n),
    ABOUT_P2_I18N_ATTRS: i18nAttrs(r.aboutP2I18n),
    META_I18N_JSON: JSON.stringify(META_I18N),
    PHONE: phone,
    PHONE_RAW: phoneRaw,
    WA_RAW: conciergeRaw,
    ABOUT_TITLE: c.aboutTitle || r.name,
    ABOUT_P1: c.aboutP1 || r.summary || '',
    ABOUT_P2: c.aboutP2 || '',
    ABOUT_IMAGE: aboutImage,
    HERO_IMAGE: heroImage,
    HERO_IMAGE_FULL: heroImageFull,
    HERO_TAGS: heroTags,
    OG_IMAGE_FULL: ogImageFull,
    MAPS_QUERY: mapsQuery,
    DURATION: r.duration || '—',
    MEETING_POINT: r.meetingPoint || 'Kalkan Yat Limanı',
    CAPACITY: r.capacity || '—',
    LANGUAGES: langs,
    PROGRAM_ROWS: programRows,
    INCLUDES_LIST: includesList,
    EXCLUDES_LIST: excludesList,
    REMIND_CARDS: remindCards,
    FAQ_ITEMS: faqItems,
    PRICE: r.price || '—',
    PRICE_NUM: priceNum,
    PRICE_NOTE: r.priceNote || '',
    RATING_HTML: ratingHtml,
    AGGREGATE_RATING_JSON: aggregateRatingJson,
    GALLERY_ITEMS: galleryItems,
    I18N_JSON: JSON.stringify(I18N_BASE),
    THEME_BG: t.bg,
    THEME_BG_2: t.bg2,
    THEME_ACCENT: t.accent,
    THEME_ACCENT_2: t.accent2,
    THEME_TEXT: t.text,
    THEME_MUTED: t.muted,
    FONT_DISPLAY: t.font
  };

  let html = template;
  for (const [k, v] of Object.entries(repl)) {
    html = html.replaceAll(`{{${k}}}`, String(v));
  }

  const outDir = join(root, 'tur', r.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  built.push({ slug: r.id, name: r.name, category: r.category, url: `https://kalkaninfo.com/tur/${r.id}/`, local: `http://localhost:3000/tur/${r.id}/` });
  console.log(`  + ${r.name} [${r.category}] -> tur/${r.id}/`);
}

// Sitemap'e ekle
if (built.length) {
  const sitemapPath = join(root, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0,10);
  for (const b of built) {
    const url = `https://kalkaninfo.com/tur/${b.slug}/`;
    if (!sitemap.includes(url)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
    }
  }
  // turlar.html landing
  const landing = 'https://kalkaninfo.com/turlar.html';
  if (!sitemap.includes(landing)) {
    const entry = `  <url>\n    <loc>${landing}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
  }
  await writeFile(sitemapPath, sitemap);
  console.log(`Sitemap'e ${built.length} URL eklendi (+ turlar.html).`);
}

console.log('\n--- ADRESLER ---');
built.forEach(b => console.log(`  ${b.name} [${b.category}]\n    Local : ${b.local}\n    Canli : ${b.url}\n`));
