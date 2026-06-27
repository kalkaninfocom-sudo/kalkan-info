#!/usr/bin/env node
/**
 * Plaj mini-site uretici (15 plaj).
 * Kullanim: node scripts/build-plaj-pages.mjs [slug1 slug2 ...]
 *   - Slug verilmezse data/plajlar.json'daki TUM plajlar uretilir.
 *
 * Pool fallback YOK. Her plaj sadece kendi fotograflarini gosterir.
 * Galeri kaynagi sirayla:
 *   (a) /assets/img/plaj/<slug>-{1..8}.jpg (fetch-plaj-photos.mjs ile indirilen)
 *   (b) plajlar.json'daki gercek gallery + image
 *   (c) yetersizse kart sayisi azalir
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const REVIEWS_DIR = join(root, 'data', 'plaj-reviews');

const args = process.argv.slice(2);

const data = JSON.parse(await readFile(join(root, 'data', 'plajlar.json'), 'utf8'));
const template = await readFile(join(root, 'plaj', '_template', 'index.html'), 'utf8');
const targets = args.length ? args : (data.items || []).map(it => it.id);

// Kategoriye gore tema secimi
function theme(category){
  const n = (category || '').toLowerCase();
  // Halk plaji -> turkuaz + sand
  if (n.includes('halk')) {
    return { bg:'#06141a', bg2:'#0a1f28', accent:'#4eb1b3', accent2:'#3a8e91', text:'#e8f0f2', muted:'#8aa5ad', font:'Cormorant+Garamond' };
  }
  // Beach club -> gold + sea blue (lux)
  if (n.includes('beach club')) {
    return { bg:'#0a0e16', bg2:'#141a26', accent:'#d4af37', accent2:'#b8932a', text:'#ecdfc8', muted:'#998b6e', font:'Playfair+Display' };
  }
  // Beach club koyu -> ayni lux palette
  if (n.includes('club')) {
    return { bg:'#0a0e16', bg2:'#141a26', accent:'#d4af37', accent2:'#b8932a', text:'#ecdfc8', muted:'#998b6e', font:'Playfair+Display' };
  }
  // Gizli koy -> green + earth tones (dogal)
  if (n.includes('gizli') || n.includes('koy')) {
    return { bg:'#0d1a14', bg2:'#13241c', accent:'#7eb89a', accent2:'#5e9779', text:'#e3ebe5', muted:'#8aa094', font:'Cormorant+Garamond' };
  }
  // Tekne plaji -> navy + silver (denizci)
  if (n.includes('tekne')) {
    return { bg:'#051528', bg2:'#0a223c', accent:'#c5d4e8', accent2:'#9fb4cd', text:'#e6edf5', muted:'#8a9ab0', font:'Cinzel' };
  }
  // Dogal SIT -> green + earth (Patara)
  if (n.includes('dogal') || n.includes('doğal') || n.includes('sit')) {
    return { bg:'#0d1a14', bg2:'#13241c', accent:'#c4a67d', accent2:'#a08760', text:'#ede4d2', muted:'#a89a82', font:'Cormorant+Garamond' };
  }
  // Default turkuaz halk plaji
  return { bg:'#06141a', bg2:'#0a1f28', accent:'#4eb1b3', accent2:'#3a8e91', text:'#e8f0f2', muted:'#8aa5ad', font:'Cormorant+Garamond' };
}

// Plaj basina ozel "hakkinda" tohumlari + tagline
const CUSTOM = {
  'kaputas': {
    tagline: '187 Basamaklı Turkuaz Cennet.',
    aboutTitle: 'Kalkan ile Kaş Arasında Bir Mücevher.',
    aboutP1: 'Kaputaş Plajı, D400 yolunun altındaki kanyondan denize açılan dünyaca ünlü bir turkuaz koy. 187 basamaklı taş merdiven, sizi beyaz çakıllı sahile ve kristal berraklığındaki suya indirir.',
    aboutP2: 'Türkiye\'nin Instagram\'da en çok paylaşılan plajlarından biri — fotoğrafçılar için sabah ışığı, yüzücüler için cam gibi temiz su. Mavi Bayraklı bu koy, Akdeniz\'in en saf yüzünü temsil eder.'
  },
  'patara': {
    tagline: '18 km Altın Kum + Antik Kent.',
    aboutTitle: 'Türkiye\'nin En Uzun Kumsalı.',
    aboutP1: 'Patara Plajı, 18 kilometrelik kesintisiz altın kum şeridiyle Türkiye\'nin en uzun kumsalıdır. UNESCO Patara Antik Kenti ile aynı SİT alanında yer alır — Likyalıların 2000 yıllık başkenti hâlâ ayakta.',
    aboutP2: 'Caretta caretta yuvalama bölgesi olduğu için 20:00\'den sonra kumsala giriş yasaktır. Yumuşak ince kumu, sığ ve berrak suyu, antik kent dokunuşu ile aile, çift ve solo gezginler için ideal.'
  },
  'incirli': {
    tagline: 'Yat Limanının Kalbinde Şehir Plajı.',
    aboutTitle: 'Kalkan Merkezinde Plaj.',
    aboutP1: 'İncirli Plajı, Kalkan iskelesine bitişik küçük şehir plajıdır. Yürüme mesafesinde 20+ restoran, kafe ve bar — günü plajda geçirip akşam doğrudan yemeğe geçebilirsiniz.',
    aboutP2: 'Yat manzaralı bu plaj, akşam yemekleri öncesi rahat bir mola için ideal. Beach club hizmetleri, modern olanaklar ve şehir konforu burada bir araya gelir.'
  },
  'kalamar': {
    tagline: 'Kayalık Koyun Şezlong Konforu.',
    aboutTitle: 'Kalamar Koyunun Lüks Yüzü.',
    aboutP1: 'Kalamar Plajı, Kalkan\'ın hemen batısında uzanan kayalık koy. Gün batımı manzarasıyla ünlü beach club\'ları, iskeleli platformları ve berrak Akdeniz suyu burada birleşir.',
    aboutP2: 'Şezlong + minimum harcama modeliyle çalışan beach club\'lar, gün boyu Akdeniz keyfini lüks bir biçimde yaşamanıza olanak tanır. Akşam saatlerinde gün batımı menüleri öne çıkar.'
  },
  'akcagerme': {
    tagline: 'Sessiz, Otantik, Daha Az Kalabalık.',
    aboutTitle: 'Patara Yolundaki Gizli Koy.',
    aboutP1: 'Akçagerme Plajı, Patara yolu üzerinde turistik akıştan biraz uzakta kalmış küçük bir koydur. Daha az kalabalık, daha sakin atmosfer arayanlar için bölgenin saklı cevheri.',
    aboutP2: 'Doğal şemsiyeler, küçük büfe ve berrak su — gün boyu kano kiralayıp koyu keşfedebilir, sabah erken saatlerde plajda neredeyse tek başınıza kalabilirsiniz.'
  },
  'indigo-beach': {
    tagline: 'Limanın Hemen Ötesinde Beach Club.',
    aboutTitle: 'İskele Üstünde Restoran, Altında Deniz.',
    aboutP1: 'Indigo Beach Club, Kalkan limanının hemen ötesinde, iskele üstünde restoran ve bar ile platform tarzı bir beach club. Stil, konfor ve liman manzarası burada bir araya gelir.',
    aboutP2: 'Alt katta yüzme platformları, üst katta restoran ve bar — günü Akdeniz\'in mavisinde geçirin, akşam aynı yerde yemeğe oturun. Rezervasyon önerilir.'
  },
  'yali-beach': {
    tagline: 'Kalkan Körfezinde Lüks Platform.',
    aboutTitle: 'Cam Berraklığında Suya Bakan Lüks.',
    aboutP1: 'Yali Beach Club, Kalkan Körfezi\'nin sağ tarafına yerleşmiş, kesintisiz Akdeniz manzaralı lüks bir beach club. Cam berraklığındaki suya bakan platformlar, sezon boyunca aranan adreslerden.',
    aboutP2: 'Şezlong + şemsiye günlüğü makul bütçeyle Akdeniz lüksünü deneyimleyin. Restoran, bar ve modern olanaklar tam donanımlı; rezervasyon hafta sonu için önerilir.'
  },
  'lures-beach': {
    tagline: 'Otel Beach Club — F&B Paket Modeli.',
    aboutTitle: 'Sessiz, Lüks, F&B Odaklı.',
    aboutP1: 'Lures Hotel Beach Club, Lures Hotel\'in otele bağlı beach club\'ıdır. Şezlong, şemsiye ve havlu ücretsiz; günlük yiyecek-içecek harcaması ile çalışan farklı bir model sunar.',
    aboutP2: 'Sessiz, lüks ve servis odaklı bir gün için ideal. Otel mutfağının kalitesi, beach club rahatlığı ile birleşir — gün boyu menüden seçim yaparak harcamanızı yönetin.'
  },
  'kucuk-cakil': {
    tagline: 'Kaş Merkezinde Minik Çakıl Plaj.',
    aboutTitle: 'Kaş Şehir İçi Plajı.',
    aboutP1: 'Küçük Çakıl Plajı, Kaş merkezindeki minik çakıl plajdır. Ücretsiz, halk plajı niteliğinde — yürüme mesafesinde restoran ve kafelerle Kaş\'ın merkez yaşamına dahildir.',
    aboutP2: 'Berrak suyu, dalış için uygun yapısı ve şehre yakın konumu ile gün boyu rahat bir tatil sunar. Sabah erken veya akşamüstü saatleri ideal.'
  },
  'buyuk-cakil': {
    tagline: 'Kaş\'ın Mavi Bayraklı Halk Plajı.',
    aboutTitle: 'Çakıl, Derin Mavi, Mavi Bayrak.',
    aboutP1: 'Büyük Çakıl Plajı, Kaş\'ın en bilinen halk plajıdır. Mavi Bayraklı, derin maviye dökülen çakıl sahil — şezlong ve gölgelik kiralanabilir, plaja giriş serbesttir.',
    aboutP2: 'Snorkel için elverişli derin su, yakındaki kafeler ve modern olanaklarla ailelerden solo gezginlere herkesi memnun eder. Çakıl plaj olduğu için terlik şart.'
  },
  'hidayet-koyu': {
    tagline: 'Çukurbağ Yarımadasında Blanca Beach.',
    aboutTitle: 'Yarımadanın Sakin Yüzü.',
    aboutP1: 'Hidayet Koyu, Kaş Çukurbağ Yarımadası\'nda yer alır. Tek işletme — Blanca Beach — koyu yönetir. Giriş ücretsiz, şezlong + şemsiye ücretli; alternatif olarak kişi başı paket de var.',
    aboutP2: 'Yarımada manzaralı bu koy, Kaş merkezine 2.5 km mesafede. Berrak suyu, sessiz atmosferi ve restoran-bar konforu ile günü dingin geçirmek için ideal.'
  },
  'limanagzi': {
    tagline: 'Tekneyle 10 Dakika — Yarımada Koyu.',
    aboutTitle: 'Tekneye Atla, Karşı Koya Geç.',
    aboutP1: 'Limanağzı Plajı, Kaş karşısındaki yarımadada yer alan koy. 4 işletme paralel çalışır — Bilal\'in Yeri ve Nuri\'s Beach en popüler. Kaş limanından tekneyle 10 dakikada ulaşılır.',
    aboutP2: 'Cam berraklığında su, yarımada manzarası ve günboyu restoran servisi. Karadan da Kaş yürüyüş rotasıyla erişilebilir — sportif tatilciler için ek bir keşif fırsatı.'
  },
  'kalamar-beach-club': {
    tagline: 'Kalamar Koyunda İskeleli Beach Club.',
    aboutTitle: 'Akdeniz Manzaralı Platform.',
    aboutP1: 'Kalamar Beach Club, Kalamar Koyu\'nda iskeleli ücretli beach club\'tır. Akdeniz manzaralı platform üzerinde restoran ve bar, alt katta yüzme alanları.',
    aboutP2: 'Sezlong/şemsiye ücretli veya minimum harcama uygulanır. Hafta sonu rezervasyon önerilir — Kalkan\'ın batısındaki en aranan günlük tatil noktalarından biri.'
  },
  'kulube-beach': {
    tagline: 'Kalamar Tarafında Sessiz Beach Club.',
    aboutTitle: 'Sakin Koy, İskele, Restoran.',
    aboutP1: 'Kulube Beach, Kalkan Kalamar tarafında ücretli bir beach club\'tır. Sessiz koy, iskele ve restoran servisi — kalabalıktan kaçmak isteyenler için ideal.',
    aboutP2: 'Şezlong/şemsiye veya minimum harcama modeliyle çalışır. Rezervasyon önerilir; sezon boyunca düzenli müzik ve organizasyonlar gerçekleşir.'
  },
  'tas-ocak': {
    tagline: 'Ahşap Basamaklı Gizli Koy.',
    aboutTitle: 'Kayalıklardan Denize İniş.',
    aboutP1: 'Taş Ocak Plajı, kayalıkların arasında ahşap basamaklarla denize inilen gizli koy. Turkuaz berrak suda snorkel ve dalış için ideal bir nokta.',
    aboutP2: 'Doğal bir plaj — büfe, şezlong yok. Yanınızda su, atıştırmalık ve plaj ayakkabısı getirin. Kayalık zemin, deneyimli yüzücüler için ekstra heyecan sunar.'
  }
};

// SSS sablonlari (plaj basina, dile gore)
function buildFAQs(r, c) {
  const free = !r.paid;
  const facilityList = (r.facilities || []).join(', ');
  return [
    {
      q: 'Plaja giriş ücretli mi?',
      a: free
        ? `${r.name} ücretsiz halk plajıdır. Şezlong, şemsiye veya yiyecek-içecek hizmetleri ücretli olabilir.`
        : `${r.name} ücretli bir alandır. Şezlong, şemsiye veya minimum harcama uygulaması olabilir — güncel fiyatlar için işletme ile iletişime geçin.`
    },
    {
      q: 'En iyi gitme zamanı ne?',
      a: `${r.best || 'Mayıs–Ekim'} arası ideal. Sabah erken (09:00 öncesi) veya akşamüstü (17:00 sonrası) saatler kalabalığı azaltır ve fotoğraf için ışık çok güzeldir.`
    },
    {
      q: 'Plajda hangi olanaklar var?',
      a: facilityList ? `Mevcut olanaklar: ${facilityList}. Detaylar mevsime ve işletmeye göre değişebilir.` : 'Doğal bir plaj olduğu için temel olanaklar sınırlıdır. Yanınızda su, gölgelik ve atıştırmalık getirmenizi öneririz.'
    },
    {
      q: 'Çocuklarla gidilebilir mi?',
      a: (r.tags || []).some(t => (t || '').toLowerCase().includes('aile'))
        ? `${r.name} aile dostu bir plajdır. Sığ su ve uygun olanaklar ile çocuklarla rahatça vakit geçirilebilir.`
        : `Plajın yapısı ve derinliği değişiklik gösterebilir. Küçük çocuklarla giderken dikkatli olun; can yeleği önerilir.`
    },
    {
      q: 'Otopark var mı?',
      a: (r.facilities || []).some(f => (f || '').toLowerCase().includes('otopark'))
        ? 'Plajda veya yakınında otopark mevcuttur. Sezonun yoğun günlerinde erken gitmenizi öneririz.'
        : 'Otopark sınırlı veya doğal alanda yol kenarıdır. Yoğun günlerde alternatif ulaşım (yürüyüş, taksi, tekne) değerlendirilmelidir.'
    }
  ];
}

// HTML escape
const esc = (s) => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Yildizlar (Google rating)
function starsHtml(rating) {
  if (!rating) return '';
  const v = Math.max(0, Math.min(5, Number(rating)));
  const full = Math.floor(v);
  const half = (v - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const star = (fill) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.4" style="display:inline-block;vertical-align:middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  return star('currentColor').repeat(full) + (half ? star('url(#half)') : '') + star('none').repeat(empty);
}

// Hero altinda rating gosterim HTML
function ratingHtml(rating) {
  if (!rating) return '';
  const v = Number(rating).toFixed(1);
  const star = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  return `<div class="mb-6 inline-flex items-center gap-2" style="color:var(--theme-accent);">${star} <span class="font-bold text-lg">${v}</span> <span class="text-sm opacity-75">/ 5.0 Google</span></div>`;
}

// Olanak/highlight ikonlari
function infoIcon(name) {
  const n = (name || '').toLowerCase();
  const svg = (path) => `<svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${path}</svg>`;
  if (n.includes('wc') || n.includes('toilet') || n.includes('tuvalet')) return svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="9" r="2"/><circle cx="16" cy="9" r="2"/><path d="M8 14v6M16 14v6"/>');
  if (n.includes('duş') || n.includes('dus') || n.includes('shower')) return svg('<path d="M12 2v6M8 8h8"/><path d="M6 12h12l-2 10H8z"/>');
  if (n.includes('büfe') || n.includes('bufe') || n.includes('kafe')) return svg('<rect x="3" y="9" width="18" height="10" rx="2"/><path d="M7 9V5a5 5 0 0 1 10 0v4"/>');
  if (n.includes('restoran') || n.includes('restaurant')) return svg('<path d="M6 2v8a2 2 0 0 0 2 2v8M10 2v8a2 2 0 0 1-2 2"/><path d="M18 2c-1 0-3 2-3 6s2 4 3 4v10"/>');
  if (n.includes('bar')) return svg('<path d="M5 3h14l-7 9v8h3M5 3l7 9"/>');
  if (n.includes('otopark') || n.includes('parking')) return svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>');
  if (n.includes('şezlong') || n.includes('sezlong') || n.includes('sun')) return svg('<path d="M2 18h20M5 18l3-8h8l3 8M9 14h6"/>');
  if (n.includes('şemsi') || n.includes('semsi') || n.includes('umbrella')) return svg('<path d="M12 2v20"/><path d="M3 12c0-5 4-9 9-9s9 4 9 9c-3-2-6-2-9 0-3-2-6-2-9 0z"/>');
  if (n.includes('iskele') || n.includes('pier')) return svg('<path d="M3 14h18M7 14v8M17 14v8M12 3v11M9 6l3-3 3 3"/>');
  if (n.includes('beach club') || n.includes('club')) return svg('<circle cx="12" cy="8" r="4"/><path d="M3 21l3-7M21 21l-3-7M9 21l1-5h4l1 5"/>');
  if (n.includes('snorkel') || n.includes('dalış') || n.includes('dalis')) return svg('<circle cx="10" cy="9" r="4"/><path d="M14 9h6v3M3 17c4-2 6 2 10 0s6 2 8 0"/>');
  if (n.includes('kano') || n.includes('kayak')) return svg('<path d="M2 16c4-2 8-2 10-2s6 0 10 2"/><path d="M5 14V8M19 14V8"/>');
  if (n.includes('mavi bayrak')) return svg('<path d="M5 21V3l8 4-8 4"/><path d="M5 11l14 2v-8z"/>');
  if (n.includes('turkuaz') || n.includes('berrak') || n.includes('mavi')) return svg('<path d="M2 12c2 0 4-2 6-2s4 2 6 2 4-2 6-2 2 2 2 2M2 18c2 0 4-2 6-2s4 2 6 2 4-2 6-2 2 2 2 2"/>');
  if (n.includes('kum') || n.includes('sand')) return svg('<circle cx="6" cy="8" r="1"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="8" r="1"/><circle cx="18" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="14" cy="18" r="1"/><path d="M2 21h20"/>');
  if (n.includes('çakıl') || n.includes('cakil')) return svg('<circle cx="6" cy="10" r="2"/><circle cx="12" cy="14" r="2.5"/><circle cx="18" cy="10" r="2"/><path d="M2 21h20"/>');
  if (n.includes('fotoğraf') || n.includes('fotograf') || n.includes('photo')) return svg('<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M9 3h6l1 3"/>');
  if (n.includes('manzara') || n.includes('view') || n.includes('antik')) return svg('<path d="M2 20l5-8 4 5 3-4 8 7H2z"/><circle cx="7" cy="7" r="2"/>');
  if (n.includes('aile') || n.includes('family') || n.includes('cocuk')) return svg('<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 21c0-3 2-6 6-6s6 3 6 6"/><path d="M15 21c0-2 1-4 4-4s2 2 2 4"/>');
  if (n.includes('caretta') || n.includes('kaplumbaga')) return svg('<circle cx="12" cy="12" r="6"/><path d="M6 12c-2 0-3-1-3-3M18 12c2 0 3-1 3-3M9 18l-2 3M15 18l2 3"/>');
  if (n.includes('yat') || n.includes('liman')) return svg('<path d="M12 2v20"/><path d="M3 14c2 4 6 6 9 6s7-2 9-6"/><path d="M6 10l6-6 6 6"/>');
  if (n.includes('sessiz') || n.includes('quiet')) return svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>');
  if (n.includes('lüks') || n.includes('luks') || n.includes('lux')) return svg('<path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4-6.5 4 2-7L2 9h7z"/>');
  if (n.includes('gün batım') || n.includes('gun batim') || n.includes('sunset')) return svg('<circle cx="12" cy="14" r="4"/><path d="M2 18h20M12 6v2M5 9l1 1M19 9l-1 1"/>');
  // default check
  return svg('<path d="M4 12l5 5L20 7"/>');
}

// AggregateRating JSON-LD — rating VE reviewCount ikisi de gerekli, yoksa null.
// Bos "{}" veya reviewCount'suz AggregateRating Rich Results'ta invalid.
function aggregateRatingJson(cache, r) {
  const place = cache?.place || {};
  const rating = place.rating ?? r?.rating ?? null;
  const reviewCount = place.reviews ?? r?.reviewCount ?? null;
  if (!rating || !reviewCount) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: Number(rating),
    reviewCount: Number(reviewCount),
    bestRating: 5,
    worstRating: 1
  };
}

function reviewArrayJson(cache) {
  const reviews = cache?.reviews || [];
  if (!reviews.length) return [];
  return reviews.slice(0, 5).map(rv => {
    const obj = {
      '@type': 'Review',
      author: { '@type': 'Person', name: rv.user || 'Anonim' },
      reviewRating: { '@type': 'Rating', ratingValue: rv.rating || 5, bestRating: 5 }
    };
    if (rv.date && /\d{4}/.test(rv.date)) obj.datePublished = rv.date;
    if (rv.snippet) obj.reviewBody = rv.snippet.slice(0, 500);
    return obj;
  });
}

function amenityFeatureJson(items) {
  return (items || []).map(a => ({
    '@type': 'LocationFeatureSpecification',
    name: a,
    value: true
  }));
}

async function loadReviewCache(slug) {
  const path = join(REVIEWS_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

function buildReviewsSection(r, cache) {
  const place = cache?.place || {};
  const reviews = cache?.reviews || [];
  const rating = place.rating ?? r.rating ?? null;
  const reviewCount = place.reviews ?? null;
  const mapsHref = place.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${esc(place.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + (r.region || 'Kalkan'))}`;

  if (!reviews.length) {
    return `
<section id="reviews" class="py-24 md:py-32 px-6">
  <div class="max-w-5xl mx-auto text-center">
    <div class="section-label justify-center mb-6" data-i="reviews_label">Ziyaretçi Yorumları</div>
    <h2 class="font-display text-4xl md:text-5xl font-extrabold mb-6" data-i="reviews_title">Google'da Bizi Anlatanlar</h2>
    <p class="text-base max-w-xl mx-auto mb-10" style="color:var(--theme-muted);" data-i="reviews_empty">Yorumlar yakında eklenecek.</p>
    <a href="${esc(mapsHref)}" target="_blank" rel="noopener" class="btn-ghost" data-i="reviews_all">Tüm Yorumları Gör (Google)</a>
  </div>
</section>`;
  }

  const ratingBlock = rating ? `
    <div class="flex flex-col items-center mb-12">
      <div class="font-display text-7xl font-extrabold leading-none" style="color:var(--theme-accent);">${Number(rating).toFixed(1)}</div>
      <div class="flex gap-1 mt-3" style="color:var(--theme-accent);">${starsHtml(rating)}</div>
      ${reviewCount ? `<div class="text-sm mt-3" style="color:var(--theme-muted);">${esc(reviewCount)} Google yorum</div>` : ''}
    </div>` : '';

  const cards = reviews.slice(0, 6).map(rv => {
    const initial = (rv.user || '?').trim().charAt(0).toUpperCase();
    const snippet = (rv.snippet || '').slice(0, 320);
    return `
      <article class="border p-6 flex flex-col h-full" style="border-color:rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
        <div class="flex items-center gap-3 mb-4">
          ${rv.avatar
            ? `<img src="${esc(rv.avatar)}" alt="${esc(rv.user)}" class="w-10 h-10 rounded-full object-cover" loading="lazy">`
            : `<div class="w-10 h-10 rounded-full grid place-items-center font-bold" style="background:var(--theme-accent);color:var(--theme-bg);">${esc(initial)}</div>`}
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm truncate">${esc(rv.user)}${rv.local_guide ? ` <span class="text-[10px] uppercase tracking-wider ml-1" style="color:var(--theme-accent);">Local Guide</span>` : ''}</div>
            <div class="text-xs" style="color:var(--theme-muted);">${esc(rv.date || '')}</div>
          </div>
        </div>
        ${rv.rating ? `<div class="flex gap-0.5 mb-3" style="color:var(--theme-accent);">${starsHtml(rv.rating)}</div>` : ''}
        <p class="text-sm leading-relaxed" style="color:var(--theme-text);">${esc(snippet)}${(rv.snippet || '').length > 320 ? '…' : ''}</p>
      </article>`;
  }).join('');

  return `
<section id="reviews" class="py-24 md:py-32 px-6">
  <div class="max-w-7xl mx-auto">
    <div class="text-center mb-16">
      <div class="section-label justify-center mb-6" data-i="reviews_label">Ziyaretçi Yorumları</div>
      <h2 class="font-display text-4xl md:text-5xl font-extrabold mb-6" data-i="reviews_title">Google'da Bizi Anlatanlar</h2>
      <p class="max-w-2xl mx-auto text-base" style="color:var(--theme-muted);" data-i="reviews_sub">Aşağıdaki yorumlar Google Maps'ten alınmıştır.</p>
    </div>
    ${ratingBlock}
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
    <div class="text-center mt-12">
      <a href="${esc(mapsHref)}" target="_blank" rel="noopener" class="btn-primary" data-i="reviews_all">Tüm Yorumları Gör (Google)</a>
    </div>
  </div>
</section>`;
}

// 5-dil i18n
const I18N_BASE = {
  tr: { about:'Hakkında', highlights:'Öne Çıkanlar', facilities:'Olanaklar', travel:'Gidiş', gallery:'Galeri', reviews:'Yorumlar', faq:'SSS', cta_directions:'Yol Tarifi', cta_gallery:'Fotoğraflar', cta_route:'Google Maps\'te Yol Tarifi', about_label:'Hakkında', highlights_label:'Öne Çıkanlar', highlights_title:'Bu Plajı Özel Yapan', highlights_sub:'Ziyaretçilerin en çok beğendiği özellikler.', facilities_label:'Olanaklar', facilities_title:'Plajda Bulunanlar', facilities_sub:'Ziyaretiniz sırasında yararlanabileceğiniz hizmet ve olanaklar.', travel_label:'Gidiş Bilgileri', travel_title:'Nasıl Gidilir?', travel_sub:'Konum, mesafe ve ulaşım bilgileri.', travel_distance:'Mesafe', travel_drive:'Süre', travel_best:'En İyi Zaman', tip_label:'Ziyaret İpuçları', gallery_label:'Galeri', map_label:'Konum', map_title:'Plajın Yeri', reviews_label:'Ziyaretçi Yorumları', reviews_title:'Google\'da Bizi Anlatanlar', reviews_sub:'Aşağıdaki yorumlar Google Maps\'ten alınmıştır.', reviews_all:'Tüm Yorumları Gör (Google)', reviews_empty:'Yorumlar yakında eklenecek.', faq_label:'SSS', faq_title:'Sık Sorulan Sorular', all_beaches:'Tüm Plajlar →' },
  en: { about:'About', highlights:'Highlights', facilities:'Facilities', travel:'Getting There', gallery:'Gallery', reviews:'Reviews', faq:'FAQ', cta_directions:'Directions', cta_gallery:'Photos', cta_route:'Get Directions on Google Maps', about_label:'About', highlights_label:'Highlights', highlights_title:'What Makes This Beach Special', highlights_sub:'Features most loved by visitors.', facilities_label:'Facilities', facilities_title:'Available On-Site', facilities_sub:'Services and amenities you can use during your visit.', travel_label:'Getting There', travel_title:'How to Reach', travel_sub:'Location, distance and transport info.', travel_distance:'Distance', travel_drive:'Duration', travel_best:'Best Time', tip_label:'Visitor Tips', gallery_label:'Gallery', map_label:'Location', map_title:'Where the Beach Is', reviews_label:'Visitor Reviews', reviews_title:'What People Say on Google', reviews_sub:'The reviews below are sourced from Google Maps.', reviews_all:'See All Reviews (Google)', reviews_empty:'Reviews coming soon.', faq_label:'FAQ', faq_title:'Frequently Asked Questions', all_beaches:'All Beaches →' },
  de: { about:'Über', highlights:'Highlights', facilities:'Einrichtungen', travel:'Anfahrt', gallery:'Galerie', reviews:'Bewertungen', faq:'FAQ', cta_directions:'Wegbeschreibung', cta_gallery:'Fotos', cta_route:'Wegbeschreibung auf Google Maps', about_label:'Über', highlights_label:'Highlights', highlights_title:'Was diesen Strand besonders macht', highlights_sub:'Die von Besuchern am meisten geschätzten Merkmale.', facilities_label:'Einrichtungen', facilities_title:'Vor Ort verfügbar', facilities_sub:'Dienste und Einrichtungen für Ihren Besuch.', travel_label:'Anfahrt', travel_title:'Wie man hinkommt', travel_sub:'Lage, Entfernung und Transportinformationen.', travel_distance:'Entfernung', travel_drive:'Dauer', travel_best:'Beste Zeit', tip_label:'Besuchstipps', gallery_label:'Galerie', map_label:'Lage', map_title:'Wo der Strand liegt', reviews_label:'Besucherbewertungen', reviews_title:'Was Gäste auf Google sagen', reviews_sub:'Die Bewertungen stammen von Google Maps.', reviews_all:'Alle Bewertungen (Google)', reviews_empty:'Bewertungen folgen in Kürze.', faq_label:'FAQ', faq_title:'Häufig gestellte Fragen', all_beaches:'Alle Strände →' },
  ru: { about:'О пляже', highlights:'Особенности', facilities:'Удобства', travel:'Как добраться', gallery:'Галерея', reviews:'Отзывы', faq:'FAQ', cta_directions:'Маршрут', cta_gallery:'Фото', cta_route:'Открыть в Google Картах', about_label:'О пляже', highlights_label:'Особенности', highlights_title:'Что делает этот пляж особенным', highlights_sub:'Самые любимые посетителями особенности.', facilities_label:'Удобства', facilities_title:'Что есть на месте', facilities_sub:'Услуги и удобства для вашего визита.', travel_label:'Как добраться', travel_title:'Как доехать', travel_sub:'Расположение, расстояние и транспорт.', travel_distance:'Расстояние', travel_drive:'Время', travel_best:'Лучшее время', tip_label:'Советы посетителям', gallery_label:'Галерея', map_label:'Расположение', map_title:'Где находится пляж', reviews_label:'Отзывы посетителей', reviews_title:'Что говорят в Google', reviews_sub:'Отзывы ниже — из Google Карт.', reviews_all:'Все отзывы (Google)', reviews_empty:'Отзывы появятся скоро.', faq_label:'FAQ', faq_title:'Часто задаваемые вопросы', all_beaches:'Все пляжи →' },
  fr: { about:'À propos', highlights:'Points Forts', facilities:'Équipements', travel:'Accès', gallery:'Galerie', reviews:'Avis', faq:'FAQ', cta_directions:'Itinéraire', cta_gallery:'Photos', cta_route:'Itinéraire sur Google Maps', about_label:'À propos', highlights_label:'Points Forts', highlights_title:'Ce qui rend cette plage spéciale', highlights_sub:'Les caractéristiques les plus appréciées par les visiteurs.', facilities_label:'Équipements', facilities_title:'Disponible sur place', facilities_sub:'Services et installations pour votre visite.', travel_label:'Accès', travel_title:'Comment s\'y rendre', travel_sub:'Emplacement, distance et transport.', travel_distance:'Distance', travel_drive:'Durée', travel_best:'Meilleure période', tip_label:'Conseils aux visiteurs', gallery_label:'Galerie', map_label:'Emplacement', map_title:'Où se trouve la plage', reviews_label:'Avis des visiteurs', reviews_title:'Ce que disent les visiteurs sur Google', reviews_sub:'Les avis ci-dessous proviennent de Google Maps.', reviews_all:'Voir tous les avis (Google)', reviews_empty:'Avis bientôt disponibles.', faq_label:'FAQ', faq_title:'Questions fréquentes', all_beaches:'Toutes les plages →' }
};

let built = [];

for (const slug of targets) {
  const r = (data.items || []).find(x => x.id === slug);
  if (!r) { console.warn(`Atlandi: ${slug} plajlar.json'da yok`); continue; }
  const c = CUSTOM[slug] || {};
  const t = theme(r.category);

  // Galeri: SADECE bu plajin kendi fotograflari. Pool fallback YOK.
  // (a) /assets/img/plaj/<slug>-{1..8}.jpg (fetch-plaj-photos.mjs)
  // (b) plajlar.json'daki gercek gallery + image
  const fetchedGallery = [];
  for (let i = 1; i <= 8; i++) {
    const rel = `/assets/img/plaj/${r.id}-${i}.jpg`;
    if (existsSync(join(root, rel.replace(/^\//, '')))) fetchedGallery.push(rel);
  }
  const jsonGallery = (r.gallery || []).filter(Boolean)
    .filter(g => g.startsWith('/') ? existsSync(join(root, g.replace(/^\//, ''))) : true);

  const seenG = new Set();
  const ownGallery = [];
  for (const src of [...fetchedGallery, ...jsonGallery]) {
    if (!seenG.has(src)) { seenG.add(src); ownGallery.push(src); }
    if (ownGallery.length >= 8) break;
  }

  // Hero: fetch indirdigi varsa onu kullan
  const fetchedHeroRel = `/assets/img/plaj/${r.id}-hero.jpg`;
  const fetchedHeroExists = existsSync(join(root, fetchedHeroRel.replace(/^\//, '')));
  const baseImg = fetchedHeroExists ? fetchedHeroRel : (r.image || ownGallery[0] || '');

  const galleryItems = ownGallery.map((src, i) => `
    <a href="${esc(src)}" target="_blank" class="gallery-item aspect-square block">
      <img src="${esc(src)}" alt="${esc(r.name)} ${i+1}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.background='var(--theme-bg-2)';this.style.opacity='0.3';">
    </a>`).join('');

  const aboutImage = ownGallery[1] || ownGallery[0] || baseImg;

  // Highlights tiles
  const highlightTiles = (r.highlights || []).map(h => `
    <div class="info-tile">
      ${infoIcon(h)}
      <div>
        <div class="text-sm font-semibold leading-tight">${esc(h)}</div>
      </div>
    </div>`).join('');

  // Facility tiles
  const facilityTiles = (r.facilities || []).map(f => `
    <div class="info-tile">
      ${infoIcon(f)}
      <div class="text-sm font-semibold">${esc(f)}</div>
    </div>`).join('');

  // Tag pills (from json)
  const tagPills = (r.tags || []).map(tag => `<span class="highlight-pill">${esc(tag)}</span>`).join('');

  // SameAs
  const sameAs = [];
  if (r.instagram) sameAs.push(r.instagram);
  sameAs.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + (r.region || 'Kalkan'))}`);

  // Hero / OG
  const heroImage = baseImg;
  const heroImageFull = baseImg ? `https://kalkaninfo.com${baseImg}` : 'https://kalkaninfo.com/assets/og-default.png';

  const ogImagePath = `/assets/og/plaj/${r.id}.jpg`;
  const ogImageFull = existsSync(join(root, ogImagePath.replace(/^\//, '')))
    ? `https://kalkaninfo.com${ogImagePath}?v=2026-06-04`
    : heroImageFull;

  // Maps query
  const mapsQuery = encodeURIComponent(`${r.name} ${r.region || 'Kalkan'} Antalya`);

  // Geo — sadece gercek GPS varsa uretilir. Kaputas/Patara gibi uzak plajlara
  // sahte Kalkan-merkez koordinati basmak yanlis konum verir; gercek yoksa cikar.
  const reviewCache = await loadReviewCache(r.id);
  const gpsRaw = reviewCache?.place?.gps;
  const geoLat = gpsRaw?.latitude ?? (r.coordinates && (r.coordinates.latitude ?? r.coordinates.lat)) ?? null;
  const geoLng = gpsRaw?.longitude ?? (r.coordinates && (r.coordinates.longitude ?? r.coordinates.lng)) ?? null;
  const geoBlock = (geoLat != null && geoLng != null)
    ? `"geo":{"@type":"GeoCoordinates","latitude":${Number(geoLat)},"longitude":${Number(geoLng)}},\n  `
    : '';

  // Reviews section
  const reviewsSectionHtml = buildReviewsSection(r, reviewCache);

  // FAQs
  const faqs = buildFAQs(r, c);
  const faqItems = faqs.map(f => `
    <div class="faq-item">
      <div class="faq-q">${esc(f.q)}</div>
      <div class="faq-a">${esc(f.a)}</div>
    </div>`).join('');
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  });

  // Location line
  const locationLine = `${r.distance || ''}${r.drive ? ' · ' + r.drive : ''}`.trim() || `${r.region || 'Kalkan'}, Antalya`;

  // Template doldur
  const repl = {
    NAME: r.name,
    NAME_URL: encodeURIComponent(r.name),
    SLUG: r.id,
    CATEGORY: r.category || 'Plaj',
    REGION: r.region || 'Kalkan',
    SUMMARY: r.summary || c.tagline || '',
    TAGLINE: c.tagline || r.summary || '',
    DISTANCE: r.distance || '—',
    DRIVE: r.drive || '—',
    BEST_SEASON: r.best || 'Mayıs–Ekim',
    TIPS: r.tips || 'Sabah erken veya akşamüstü saatlerde gitmenizi öneririz.',
    LOCATION_LINE: locationLine,
    IS_FREE: r.paid ? 'false' : 'true',
    ABOUT_TITLE: c.aboutTitle || r.name,
    ABOUT_P1: c.aboutP1 || r.summary || '',
    ABOUT_P2: c.aboutP2 || '',
    ABOUT_IMAGE: aboutImage,
    HERO_IMAGE: heroImage,
    HERO_IMAGE_FULL: heroImageFull,
    OG_IMAGE_FULL: ogImageFull,
    MAPS_QUERY: mapsQuery,
    GEO_BLOCK: geoBlock,
    HIGHLIGHT_TILES: highlightTiles || `<div class="info-tile col-span-full text-sm" style="color:var(--theme-muted);">Bilgi yakında eklenecek.</div>`,
    FACILITY_TILES: facilityTiles || `<div class="info-tile col-span-full text-sm" style="color:var(--theme-muted);">Doğal plaj, sınırlı olanak.</div>`,
    TAG_PILLS: tagPills,
    GALLERY_ITEMS: galleryItems || `<div class="text-center col-span-full py-12" style="color:var(--theme-muted);">Fotoğraflar yakında eklenecek.</div>`,
    REVIEWS_SECTION: reviewsSectionHtml,
    FAQ_ITEMS: faqItems,
    FAQ_JSON_LD: faqJsonLd,
    RATING_HTML: ratingHtml(reviewCache?.place?.rating ?? r.rating),
    AMENITY_FEATURE_JSON: JSON.stringify(amenityFeatureJson([...(r.facilities || []), ...(r.highlights || [])])),
    AGGREGATE_RATING_BLOCK: (() => { const a = aggregateRatingJson(reviewCache, r); return a ? `"aggregateRating":${JSON.stringify(a)},\n  ` : ''; })(),
    REVIEW_ARRAY_JSON: JSON.stringify(reviewArrayJson(reviewCache)),
    SAME_AS_JSON: JSON.stringify(sameAs),
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

  const outDir = join(root, 'plaj', r.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  built.push({ slug: r.id, name: r.name, url: `https://kalkaninfo.com/plaj/${r.id}/`, local: `http://localhost:3000/plaj/${r.id}/` });
  console.log(`  + ${r.name}  ->  plaj/${r.id}/`);
}

// Sitemap'e ekle
if (built.length) {
  const sitemapPath = join(root, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0,10);
  for (const b of built) {
    const url = `https://kalkaninfo.com/plaj/${b.slug}/`;
    if (!sitemap.includes(url)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
    }
  }
  await writeFile(sitemapPath, sitemap);
  console.log(`Sitemap'e ${built.length} URL eklendi.`);
}

console.log('\n--- ADRESLER ---');
built.forEach(b => console.log(`  ${b.name}\n    Local : ${b.local}\n    Canli : ${b.url}\n`));
