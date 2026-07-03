/**
 * restoran-content.mjs — Restoran detay sayfasi icin PAYLASILAN icerik tohumlari.
 *
 * CUSTOM ve theme() hem build-restoran-pages.mjs (sayfa uretimi) hem de
 * translate-detail-i18n.mjs (cheap-llm cevirisi) tarafindan kullanilir.
 * Tek kaynak: burasi. build script'i bunu import eder (yan etkisi yoktur).
 */

// Kategoriye gore tema secimi
export function theme(category) {
  const map = {
    'Fine Dining':       { bg:'#0d0610', bg2:'#1a0a14', accent:'#d4af37', accent2:'#b8932a', text:'#e8e2d4', muted:'#9b8f78', font:'Playfair+Display' },
    'Deniz Ürünleri':    { bg:'#061826', bg2:'#0a2236', accent:'#4eb1b3', accent2:'#3a8e91', text:'#e1ecf2', muted:'#7f9aae', font:'Cormorant+Garamond' },
    'Cafe & Bar':        { bg:'#1a120a', bg2:'#241710', accent:'#e8a55a', accent2:'#c8853e', text:'#f0e5d6', muted:'#a89882', font:'Cormorant+Garamond' },
    'Türk Mutfağı':      { bg:'#1a0e0a', bg2:'#241410', accent:'#d97757', accent2:'#b85a3d', text:'#f0e2d4', muted:'#a89682', font:'Cormorant+Garamond' },
    'Dünya Mutfağı':     { bg:'#0f0f10', bg2:'#1a1a1c', accent:'#c9b87f', accent2:'#a89860', text:'#e8e3d8', muted:'#9a948a', font:'Cormorant+Garamond' },
    'Pub & Lounge':      { bg:'#0a0d10', bg2:'#13181c', accent:'#e8c46c', accent2:'#c9a44e', text:'#e6e4dc', muted:'#94918a', font:'Playfair+Display' },
    'Gece Kulübü':       { bg:'#0a0410', bg2:'#15082a', accent:'#c47ae0', accent2:'#9a5cb8', text:'#ecdcf0', muted:'#9c8aa8', font:'Playfair+Display' }
  };
  return map[category] || map['Dünya Mutfağı'];
}

// Hakkimda ve menu icerik tohumlari (per-restoran ozel metin).
export const CUSTOM = {
  'aubergine': {
    tagline: 'Akdeniz fine dining — taze malzeme, hassas detay.',
    aboutTitle: 'Detay ve Sadelik.',
    aboutP1: 'Aubergine, Kalkan\'ın kalbinde, denize bakan terasıyla Akdeniz mutfağının ince yorumunu sunar. Mevsimsel ürünler, kısa menü, dikkatle seçilmiş şarap kart.',
    aboutP2: 'Her tabak, mutfak şefimiz ve yerel üretici arasındaki diyaloğun ürünüdür. Aubergine\'de yemek, bir akşamın merkezi olmak için tasarlandı.',
    menuTitle: 'Mevsimlik Menü',
    menuSub: 'Menümüz her hafta yerel pazara göre yenilenir. Aşağıda mevcut sezonun seçili tabakları.',
    menu: {
      'Başlangıç': ['Karides ve avokado tartare', 'Roka, çam fıstığı, parmesan', 'Mevsim çorbası'],
      'Ana Yemek': ['Akdeniz levrek fileto', 'Kuzu pirzola, taze kekik', 'Bahçe sebzeli risotto'],
      'Tatlı': ['Sıcak çikolata fondan', 'Limon parfait', 'Mevsim meyveleri']
    },
    hours: 'Her gün 18:00 — 23:30'
  },
  'korsan-kalamar': {
    tagline: 'Kalkan klasiği — taze balık, liman manzarası.',
    aboutTitle: 'Limanın Yanı Başında.',
    aboutP1: 'Korsan Kalamar, Kalamar Koyu\'nda hizmet veriyor. Gün taze balık, ev yapımı mezeler ve sıcak misafirperverlik — Kalkan\'ın eski havasını koruyan az sayıdaki yerden biri.',
    aboutP2: 'Mevsimine göre balıkçımızın kıyıya getirdiği taze ürünleri masada görüyorsunuz. Klasik tarifler, taze otlar, sade sunum.',
    menuTitle: 'Günlük Taze Balık',
    menuSub: 'Menümüz her gün limana göre değişir. Aşağıdakiler değişmez klasiklerimiz.',
    menu: {
      'Mezeler': ['Topik', 'Haydari', 'Patlıcan ezme', 'Lakerda', 'Roka salatası'],
      'Ana Yemek': ['Izgara çipura', 'Levrek buğulama', 'Kalamar ızgara', 'Karides güveç', 'Lüfer mevsim'],
      'Sonrası': ['Lokum tabağı', 'Karpuz & beyaz peynir', 'Türk kahvesi']
    },
    hours: 'Her gün 12:00 — 24:00'
  },
  'omar-s-kokobus-kokorec-kofte-tavuk-ekmek': {
    tagline: 'Kalkan\'ın gece klasiği — kokoreç, köfte, tavuk ekmek. Izgara 03:30\'a kadar sıcak.',
    aboutTitle: 'Izgaranın Başında Ömer Usta.',
    aboutP1: 'Omar\'s Kokobüs — nam-ı diğer Köfteci Ömer Usta — Kalkan\'da sokak lezzetinin adresi. Migros\'un yanındaki tezgahtan yükselen ızgara kokusu akşam saatlerinde sokağı sarar: bol malzemeli kokoreç, közde köfte, çıtır tavuk.',
    aboutP2: 'Çeyrek, yarım, üç çeyrek — ekmeğin boyunu siz seçin, arasını usta doldursun. Plaj dönüşü hızlı bir kaçamaktan gece 03:30 acıkmalarına kadar tezgah hep açık, ekmek hep taze.'
  },
  'harbor-lights': {
    tagline: 'Sabahtan geceye — sanatkâr kahve, brunch, kokteyl.',
    aboutTitle: 'Limanın Işığı.',
    aboutP1: 'Harbor Lights, Kalkan iskelesinde artisan cafe & cocktail bar. Sabah erken brunch ile başlar, gün boyu kahve ritüeli, akşam el yapımı kokteyl ile devam eder.',
    aboutP2: 'Liman kıyısındaki konumumuz, kahve içerken Kalkan teknelerini izlemenizi sağlar. İçeride ev yapımı pastalar, dışarıda Lykia rüzgârı.',
    menuTitle: 'Gün Boyu Menü',
    menuSub: 'Üç ana saatte üç farklı menü: kahvaltı, öğle, akşam.',
    menu: {
      'Kahvaltı': ['Avokado toast', 'Eggs Benedict', 'Türk kahvaltı tabağı', 'Açai bowl'],
      'Kahve & İçecek': ['Filter kahve (origin)', 'Cortado', 'Soğuk demleme', 'Matcha latte'],
      'Akşam': ['Sezar salata', 'Trüf mantar tabağı', 'El yapımı kokteyl seti', 'Mezze tabağı']
    },
    hours: 'Her gün 08:00 — 24:00'
  }
};
