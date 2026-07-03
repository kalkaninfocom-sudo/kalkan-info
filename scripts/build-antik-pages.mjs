/**
 * build-antik-pages.mjs
 *
 * Generates one static HTML page per priority antik kent under /antik-kentler/<slug>.html.
 * Each page is self-contained (vanilla HTML + Tailwind CDN + dist/tw.css), matches the
 * site design system (sea-* / sun-* tokens, Montserrat/Inter fonts) and includes:
 *  - Per-page <title>, <meta description>, og:image (assets/og/antik-<slug>.png)
 *  - JSON-LD TouristAttraction + BreadcrumbList
 *  - 5-language data-* attributes (TR base + EN/DE/RU/FR — translate-i18n.mjs will fill DE/RU/FR)
 *  - Genişletilmiş tarih + ziyaret rehberi (özgün Türkçe, JSON.summary + history + tips kaynak)
 *  - "Nasıl gidilir" pratik bilgi, açık saatler, giriş ücreti
 *  - Yakın restoran / plaj internal link
 *  - Concierge CTA
 *  - Breadcrumb back to /antik-kentler.html
 *
 * Run: node scripts/build-antik-pages.mjs
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'data/antik-kentler.json');
const OUT_DIR = resolve(ROOT, 'antik-kentler');

export const PRIORITY = [
  'patara', 'xanthos', 'letoon', 'tlos', 'pinara',
  'simena', 'antiphellos', 'myra', 'andriake', 'aperlae'
];

// Lokalize edilmiş "il/ilçe" bilgileri — JSON'da yoktu, manuel
const LOCALITY = {
  patara:       { city: 'Patara, Kalkan',           region: 'Antalya' },
  xanthos:      { city: 'Kınık, Kaş',                region: 'Antalya' },
  letoon:       { city: 'Kumluova, Seydikemer',     region: 'Muğla'   },
  tlos:         { city: 'Yakaköy, Seydikemer',      region: 'Muğla'   },
  pinara:       { city: 'Minare, Fethiye',           region: 'Muğla'   },
  simena:       { city: 'Üçağız, Demre',             region: 'Antalya' },
  antiphellos:  { city: 'Kaş merkez',                region: 'Antalya' },
  myra:         { city: 'Demre',                     region: 'Antalya' },
  andriake:     { city: 'Çayağzı, Demre',            region: 'Antalya' },
  aperlae:      { city: 'Sıçak Yarımadası, Kaş',     region: 'Antalya' }
};

// Özgün, ChatGPT-jenerik olmayan ek tarih anlatımı (her kent için 200-300 kelime)
export const EXTENDED = {
  patara: `Patara'da yürüdüğünüz tozlu Decumanus, M.S. 100'lerde Roma'nın en geniş anayollarından biriydi — 12 metre genişliğindeki cadde, tahıl yüklü iki at arabasının yan yana geçebileceği kadar genişti. Bouleuterion'un yarım yuvarlak basamaklarına oturunca, M.Ö. 168'de Likya Birliği temsilcilerinin "her büyük şehir 3 oy, küçük şehir 1 oy" sistemini burada tartıştığını düşünün — bu, dünyanın bilinen ilk oransal temsil sistemiydi. Türk arkeologların 1988'den beri devam eden kazılarında ortaya çıkan Hadrian Granarium'unun duvarları, Mısır'dan Roma'ya giden tahılın 6-8 ay burada bekletildiğini gösteriyor. Aziz Nikolas'ın doğduğu eve dair somut iz yok ama M.S. 270'lerde piskopos olduğu kilise temelleri görülebiliyor. Antik kentten 1.5 km batıda ise Türkiye'nin en uzun kumsalı (18 km) başlar — caretta caretta deniz kaplumbağalarının yumurtladığı bu plaja antik kent biletiyle aynı gün girebilirsiniz, ekstra ücret yok.`,

  xanthos: `Xanthos'ta hissedilen ağırlık, sadece taşlardan değil — tarihin iki kez kendini yok eden bir halkın anısından geliyor. M.Ö. 540'ta Pers komutanı Harpagos kenti kuşattığında, Xanthoslular kadınlarını, çocuklarını ve hazinelerini akropoldeki bir binaya koyup ateşe verdi, sonra son neferleri düşmana saldırdı. M.Ö. 42'de Brutus geldiğinde aynı sahne tekrarlandı — Plutarkhos bu olayı "tarihin en hazin sahnesi" olarak yazdı. Bugün gördüğünüz Harpya Anıtı (M.Ö. 480) ve Likya Sütunlu Anıtı'nın orijinalleri 1842'de İngiliz arkeolog Charles Fellows tarafından 80 sandık halinde British Museum'a taşındı; tepede gördükleriniz replika. Ancak Roma tiyatrosunun 2.200 kişilik basamakları orijinal — Eşen vadisine bakan basamaklara oturup gün batımını izlemek, Likya hikayesini en doğru hissetme yolu. Sabah erken saatlerde gidin: tepe gölgesiz, öğle sıcağı yorucu.`,

  letoon: `Letoon'un büyüsü, suyun altında saklı kalmasıdır. Eşen vadisinin yeraltı su tabakası bahar aylarında yükselince, Apollon Tapınağı'nın mozaikli zemini ve Leto Tapınağı'nın İonik sütun temelleri sığ bir gölün altına gömülür — kalıntılar suyun içinde titrer, kurbağalar antik sunakların üstünde şarkı söyler. Bu, mitolojiye uygun bir tablo: tanrıça Leto'nun (Apollo ve Artemis'in annesi) Zeus'tan kaçarken Likya'ya sığındığı, bir çobanın su pınarından içmesine engel olunca çobanları kurbağaya dönüştürdüğü efsanesi tam burada anlatılır. Yaz aylarında (Temmuz-Eylül) su çekilir, mozaikler ve üç tapınağın temelleri net görünür. Letoon, Xanthos'a 8 km uzaklıkta — aynı bilet, aynı gün, iki kent gezilir. Roma stoası (sütunlu galeri) ve küçük tiyatrosu da görülmeye değer; Xanthos kalabalığından bunalanlar için sessiz bir alternatif.`,

  tlos: `Tlos, 4 medeniyetin üst üste oturduğu nadir bir yerdir: Hititler (M.Ö. 2000, "Dalawa"), Likyalılar (M.Ö. 800), Romalılar (M.Ö. 100) ve son olarak 19. yüzyıl Türk derebeyi Kanlı Ali Ağa kalesini Likya akropolünün üzerine inşa etti. Bellerophon'un kayalık mezarına ulaşmak için 15 dakikalık dik tırmanış gerekiyor, ama tepedeki ödül muhteşem — kayanın yüzünde, kahramanın Pegasus üzerinde Khimaira canavarına saldırdığı kabartma hâlâ seçilir durumda. Roma tiyatrosunun basamaklarına oturduğunuzda karşınızda Akdağlar uzanır; Likya tiyatrolarının çoğu denize bakarken Tlos dağ panoraması sunar — Anadolu'nun Toskanası gibi. Saklıkent kanyonu Tlos'a sadece 10 km — sabah tarih, öğleden sonra serin su, akşam Yakaköy'de gözleme. Likya birliğinde 3 oy hakkına sahip 6 büyük kentten biriydi; bugün hâlâ az ziyaret edilen, otantik bir keşif.`,

  pinara: `Pinara'nın petekli kayalık duvarı, dünyada eşi olmayan bir manzaradır: 60 metre yükseklikteki düz kaya yüzeyine 700'den fazla küçük dikdörtgen oyuk açılmış — her biri yaklaşık 1 metre derinliğinde, bir yetişkinin sığabileceği boyutta. Arkeologlar bu oyukların kült mezarları mı, sembolik anıtlar mı yoksa kemik kaplarının saklandığı yerler mi olduğu konusunda hâlâ tartışıyor. Pinara, Xanthos'tan göçenler tarafından M.Ö. 5. yüzyılda kuruldu — adı "yuvarlak" anlamına gelen Likyaca "pinale"den geliyor. Likya birliğinde 3 oy hakkına sahip büyük kentlerden biriydi ama bugün en az ziyaret edilen yer — bu Pinara'nın asıl güzelliği. Kraliyet Mezarı'nın 4 yüzünde Likya yaşamına dair kabartmalar var: tiyatro, av sahnesi, kentin surları. Akropole tırmanmak 30 dakika sürer, son 5 dakika dik. Yanınızda 1.5 lt su + atıştırmalık alın, köyde büfe yok. Bahar aylarında dağ kelebekleri ve yaban arıları çok — açık renk giymeyin.`,

  simena: `Simena'ya gitmenin tek yolu denizden — bu, antik kentin asıl çekiciliğidir. Üçağız limanından kalkan yarım saatlik tekneyle Kekova Adası'nın kuzeyindeki batık şehrin yanından geçerken, sığ suyun altında sütun parçaları, basamaklar ve Likya lahitlerinin üst yarıları görünür — M.S. 2. yüzyıldaki büyük depremde kentin yarısı denize gömüldü. Karaya çıktığınızda 350 kişilik dünya'nın en küçük antik tiyatrosu (Likya birliği oyunlarında değil, kentin günlük sosyal toplantıları için) sizi karşılar. Tepeye çıkan keçi yolu Ortaçağ Türk kalesine götürür — 350 metre yükseklikteki burçtan Kekova'nın tüm panoraması ayaklarınızın altında uzanır. Camdan tekneyle batık şehir turu öğle saatlerinde en iyi: güneş 12:00-14:00 arası dikey olduğunda su altı görünürlüğü en yüksek. Yüzme ve dalış yasaktır — buradaki her taş Sit alanı koruması altında. Kalkan'dan tam günlük tekne turu sabah 09:30 kalkar, akşam 17:30 döner; öğle yemeği teknede dahil.`,

  antiphellos: `Antiphellos, Kaş'ın eski adıdır ve antik kentin geri kalanı bugünkü Kaş'ın altında, sokakların arasına dağılmış halde. Uzun Çarşı'da bir Likya kral lahdi tam bir kafenin önünde duruyor — masa toplayıp altında öğle yemeği yiyorsunuz. Bu, Kaş'ı Türkiye'nin en şiirsel kasabalarından biri yapan ayrıntıdır: turizm ve antik tarih iç içe geçmiş. Antik tiyatro Kaş merkezinin batı tepesinde, 4.000 kişilik basamakları Meis Adası ve gün batımına bakar — yaz akşamları yerel halkın piknik yaptığı, müzisyenlerin akşam müziği çaldığı doğal bir tribün. Giriş tamamen ücretsiz, açık alan 7/24. Antiphellos, dağda yer alan Phellos'un (3 km kuzey) liman kasabasıydı; Roma döneminde liman aktivitesi arttı, ana yerleşim sahile indi. 1957 depreminde Kaş büyük hasar gördü ama tiyatro ayakta kaldı. Likya Lahdi (Uzun Çarşı), Doric Tomb ve Kaş Müzesi'ni birlikte gezmek 1-2 saat. Akşam yemeği için Café Merhaba veya Bahçe Restaurant — ikisi de antik kalıntılara bakar.`,

  myra: `Myra'nın 12.000 kişilik Roma tiyatrosu, Likya'nın en büyüğüdür ve sahne binasının arkasında, kayanın içine oyulmuş muhteşem ev tipi mezarlar yükselir — Likya mimarisinin başyapıtı. Bu mezarlar (M.Ö. 4. yy) ahşap Likya evlerinin taş replikalarıdır: çatı kirişleri, kapı menteşeleri, hatta pencere parmaklıkları kayaya kabartılmış. Aziz Nikolas (M.S. 270-343), gerçek kişiliğiyle bu kentin piskoposuydu — yoksul kızların çeyizleri için pencerelerinden altın kese atması, Noel Baba efsanesinin kaynağıdır. Demre merkezindeki Aziz Nikolas Kilisesi (4. yüzyıl bazilika, sonradan Bizans onarımlı) ayrı bir ziyarettir, ayrı giriş ücreti gerekir. Tiyatro yan koridorlarında akustik testi yapın — alçak sesli bir fısıltı sahnenin diğer ucundan duyulur. Sabah erken (08:30) gidin, kayalık mezarlar doğu güneşiyle altın rengine boyanır. Demre'nin sera-tarımı ünlü; ziyaret dönüşü taze portakal + zeytin için pazara uğrayın. Myra UNESCO geçici listesinde — 2030'larda kalıcı listeye geçmesi bekleniyor.`,

  andriake: `Andriake, Aziz Pavlus'un Elçilerin İşleri 27:5-6'da geçen Myra durağıdır — Filistin'den Roma'ya götürülen tutuklu apostol, M.S. 60'ta burada İskenderiye gemisine bindi. Bu detay, Andriake'yi Hristiyan hac rotasının önemli noktalarından biri yapar. Roma İmparatoru Hadrian'ın M.S. 119'da yaptırdığı Granarium (tahıl ambarı) Akdeniz'in en iyi korunmuş Roma deposudur — 8 odalı, dev kemerleriyle ayakta. Mısır'dan Roma'ya gönderilen tahıl burada 6 ay bekletilir, sonra büyük tahıl gemilerine yüklenir, İtalya'ya gönderilirdi. 2014'te ambarın içine kurulan Likya Uygarlıkları Müzesi, bölgenin en kapsamlı koleksiyonunu sergiliyor — Likya yazıtları, bronz kandiller, Aziz Nikolas dönemine ait litürjik objeler. Likya'da nadir bulunan bir Yahudi sinagogu kalıntısı da burada — M.S. 4. yüzyıl, denizci tüccarların kullandığı. Plaja yakın olması Andriake'nin avantajı: müze sonrası 500 m yürüyerek Çayağzı plajına geçer, antik denizin değdiği aynı kuma değersiniz. Kekova bot turları da bu limandan kalkar — yarım günlük tur + müze + plaj kombinasyonu ideal.`,

  aperlae: `Aperlae'ye karayolu yok — sadece denizden veya zorlu yürüyüşle. Bu, ziyaretçi sayısını yılda 200-300 kişiye düşürür; tam keşif duygusu yaşamak isteyenlerin yeri. Sıçak koyunun berrak suları (görünürlük 15-20 m) altında sütun parçaları, kent surları ve devrik Likya lahitleri yatar — snorkel ile yüzerken bir antik liman caddesinin üstünden geçebilirsiniz. Aperlae, Likya'da "tetrapolis" adı verilen 4 kent birliğinin merkeziydi — Apollonia, İsinda ve Simena ile birlikte tek bir sikkecik birimi kullanıyorlardı; arkeolojik bulgularda "tetrapolis" yazılı Roma dönemi sikkeleri çıkmıştır. M.S. 2. yüzyıl depremi kıyıyı 2-3 metre alçalttı, kentin yarısı denize gömüldü. Bizans döneminde küçük bir piskoposluk merkezi olarak yaşadı, 7. yüzyıl Arap akınlarıyla nihai olarak terk edildi. Üçağız'dan tekne kiralayın (yarım gün 2500-3000 ₺, max 4 kişi) — kaptanı snorkel rotasını biliyor. Likya Yolu üzerinden Sıçak Koy yürüyüşü 1.5 saat sürer, son 30 dk dik iniş; sıcakta yapılmaz, sabah 7'de başlayın. Yüzerken antik duvarlara dokunmayın, hatta paletle değmeyin — Sit alanı koruması altındadır.`
};

// EN/DE/RU/FR çeviriler için: data-en, data-de, data-ru, data-fr — translate-i18n.mjs sonra doldurur
// Manuel olarak temel meta etiketlerini EN ile veriyoruz, diğer 3'ünü EN'den otomatik doldurulacak şekilde işaretliyoruz.
export const EN_OVERVIEW = {
  patara: "UNESCO World Heritage Site. Capital of the Lycian League, birthplace of Apollo and St. Nicholas. The world's first known democratic assembly building.",
  xanthos: "UNESCO World Heritage Site. Co-capital of Lycia with Letoon. Famous for the harrowing self-immolation tale and the Harpy Tomb.",
  letoon: "UNESCO World Heritage Site (with Xanthos). Lycia's federal religious centre dedicated to Leto, Apollo and Artemis.",
  tlos: "One of Lycia's oldest cities. Recorded by Hittites as 'Dalawa'. Mythical home of Bellerophon and Pegasus.",
  pinara: "One of Lycia's six great cities. Famed for its unique honeycomb cliff tombs — 700+ small chambers carved into rock.",
  simena: "Ancient Lycian harbour beneath the Crusader castle. Half-sunken by a 2nd-century earthquake — Kekova's sunken city.",
  antiphellos: "Ancient Kaş — the harbour of Phellos. Free 4,000-seat Roman theatre with sea views over Meis Island.",
  myra: "Lycia's largest Roman theatre (12,000 seats) plus the most spectacular Lycian rock-cut house tombs. Home of St. Nicholas.",
  andriake: "Myra's harbour — home to the Mediterranean's best-preserved Roman granary and the Museum of Lycian Civilisations.",
  aperlae: "Sunken Lycian harbour on Sıçak Bay. Reachable only by boat or hike — underwater columns and walls visible through clear water."
};

function escapeHtml(s = '') {
  return String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
}

function escapeAttr(s = '') {
  return String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
}

// ── i18n içerik çevirileri (translate-antik.mjs üretir) ──────────────────────
// data/antik-kentler-i18n.json: { <slug>: { en:{summary,history,extended,highlights[],tips,transport}, de, ru, fr } }
const I18N_PATH = resolve(ROOT, 'data/antik-kentler-i18n.json');
const I18N = existsSync(I18N_PATH) ? JSON.parse(readFileSync(I18N_PATH, 'utf8')) : {};

// Bir içerik alanı için data-en/de/ru/fr attribute dizisi üret (js/i18n.js okur, fallback lang→en→tr).
function langAttrs(slug, field, langs = ['en', 'de', 'ru', 'fr']) {
  const rec = I18N[slug];
  if (!rec) return '';
  return langs
    .map(l => (rec[l] && rec[l][field]) ? `data-${l}="${escapeAttr(rec[l][field])}"` : '')
    .filter(Boolean)
    .join(' ');
}

// highlights[] için: verilen index'in çevirisinden data-* attribute'ları (li text span'ine).
function highlightAttrs(slug, idx, langs = ['en', 'de', 'ru', 'fr']) {
  const rec = I18N[slug];
  if (!rec) return '';
  return langs
    .map(l => (rec[l] && Array.isArray(rec[l].highlights) && rec[l].highlights[idx])
      ? `data-${l}="${escapeAttr(rec[l].highlights[idx])}"` : '')
    .filter(Boolean)
    .join(' ');
}

function buildJsonLd(item, slug) {
  const loc = LOCALITY[slug] || { city: 'Antalya', region: 'Antalya' };
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: item.name,
    description: item.summary,
    image: `https://kalkaninfo.com${item.image}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: item.lat,
      longitude: item.lng
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: loc.city,
      addressRegion: loc.region,
      addressCountry: 'TR'
    },
    isAccessibleForFree: /Ücretsiz/i.test(item.entryFee || ''),
    openingHours: item.hours || 'Mo-Su 08:00-19:00',
    touristType: 'Tarih ve Kültür Turizmi',
    url: `https://kalkaninfo.com/antik-kentler/${slug}.html`
  };
}

function buildBreadcrumb(item, slug) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Anasayfa', item: 'https://kalkaninfo.com/' },
      { '@type': 'ListItem', position: 2, name: 'Antik Kentler', item: 'https://kalkaninfo.com/antik-kentler.html' },
      { '@type': 'ListItem', position: 3, name: item.name, item: `https://kalkaninfo.com/antik-kentler/${slug}.html` }
    ]
  };
}

function pageHtml(item, slug) {
  const loc = LOCALITY[slug] || { city: 'Antalya', region: 'Antalya' };
  const enOverview = EN_OVERVIEW[slug] || item.summary;
  const extended = EXTENDED[slug] || item.history;
  // Özet/içerik DE/RU/FR: langAttrs() I18N sidecar'dan okur (js/i18n.js fallback: lang→en→tr).
  const highlights = (item.highlights || []).map((h, idx) => `<li class="flex gap-2 items-start"><span class="text-sun-500 mt-1.5">◆</span><span ${highlightAttrs(slug, idx)}>${escapeHtml(h)}</span></li>`).join('\n          ');
  const tags = (item.tags || []).map(t => `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sun-400/12 text-sun-700 border border-sun-400/30">${escapeHtml(t)}</span>`).join(' ');

  const metaDesc = `${item.name} — ${item.summary}`.slice(0, 158);
  const title = `${item.name} — ${item.category} | Kalkan Info`;
  const ogImage = `https://kalkaninfo.com/assets/og/antik-${slug}.png`;
  const canonical = `https://kalkaninfo.com/antik-kentler/${slug}.html`;

  const jsonLd = JSON.stringify(buildJsonLd(item, slug));
  const breadcrumb = JSON.stringify(buildBreadcrumb(item, slug));

  return `<!doctype html>
<html lang="tr" style="scroll-behavior:smooth;">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" href="../dist/tw.css">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(metaDesc)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="tr" href="${canonical}">
<link rel="alternate" hreflang="en" href="${canonical}?lang=en">
<link rel="alternate" hreflang="de" href="${canonical}?lang=de">
<link rel="alternate" hreflang="ru" href="${canonical}?lang=ru">
<link rel="alternate" hreflang="fr" href="${canonical}?lang=fr">
<link rel="alternate" hreflang="x-default" href="${canonical}">
<meta name="keywords" content="${escapeAttr(item.name)}, ${escapeAttr((item.tags||[]).join(', '))}, Likya, antik kent, Kalkan">

<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="#0a2e4c">
<link rel="icon" type="image/svg+xml" href="../icons/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="../icons/favicon-32.png">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">

<!-- OG -->
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(metaDesc)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="tr_TR">
<meta property="og:locale:alternate" content="en_US">
<meta property="og:locale:alternate" content="de_DE">
<meta property="og:locale:alternate" content="ru_RU">
<meta property="og:locale:alternate" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<style>
html,body{font-family:'Inter',system-ui,sans-serif;color:#0a2e4c;background:#dce6ef;}
h1,h2,h3,h4,.font-display{font-family:'Montserrat',system-ui,sans-serif;letter-spacing:-0.02em;}
.underline-grow{position:relative;}
.underline-grow::after{content:'';position:absolute;left:0;right:0;bottom:-6px;height:3px;background:#e89812;transform:scaleX(0);transform-origin:left;transition:transform .25s ease;}
.underline-grow:hover::after{transform:scaleX(1);}
.nav-active{color:#f4b53d!important;}
.nav-active::after{transform:scaleX(1)!important;}
.hero-overlay{background:radial-gradient(ellipse 80% 60% at 60% 40%,rgba(26,94,147,0.45) 0%,transparent 70%),linear-gradient(180deg,rgba(7,33,54,0.55) 0%,rgba(7,33,54,0.30) 40%,rgba(7,33,54,0.92) 100%);}
.fact-card{background:white;border:1px solid #e3edf6;border-radius:14px;padding:18px;box-shadow:0 4px 14px -8px rgba(13,58,95,0.18);}
</style>

<script src="../js/auth-pill.js" defer></script>
<script src="../js/site-drawer.js?v=20260516b" defer></script>
<script src="../js/supabase-window.js"></script>
<script src="../js/i18n.js?v=20260518c" defer></script>
<script src="../js/cookie-banner.js" defer></script>
<script src="../js/header-search.js" defer></script>
<script src="../js/bottom-nav.js?v=20260516b" defer></script>
<script src="../js/analytics.js" defer></script>
<script src="../js/concierge-modal.js?v=20260517b" defer></script>

<script type="application/ld+json">${breadcrumb}</script>
<script type="application/ld+json">${jsonLd}</script>
</head>
<body class="bg-[#dce6ef]">

<!-- HERO -->
<header class="relative overflow-hidden" style="background:#072136;min-height:560px;">
  <div class="absolute inset-0 z-0">
    <img loading="eager" decoding="async" src="..${item.image}" class="w-full h-full object-cover" style="filter:saturate(1.2) contrast(1.05);" alt="${escapeAttr(item.name)}" data-en-alt="${escapeAttr(item.name)}">
    <div class="absolute inset-0 hero-overlay"></div>
  </div>
  <div class="relative z-10 max-w-7xl mx-auto px-4 pt-6 pb-3 flex items-center justify-between text-white">
    <a href="../antik-kentler.html" class="w-9 h-9 grid place-items-center rounded-md bg-white/10 backdrop-blur hover:bg-white/20 transition" aria-label="Geri" data-en-aria="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
    </a>
    <a href="../index.html" class="font-display font-extrabold text-base md:text-lg tracking-tight flex items-center gap-2">
      <span class="text-sun-500">◆</span> KALKAN INFO
    </a>
    <div class="w-9 h-9"></div>
  </div>
  <div class="relative z-10 max-w-7xl mx-auto px-4 pt-10 md:pt-16 pb-14 md:pb-18 text-white">
    <nav class="text-[11px] tracking-widest opacity-80 uppercase mb-3" aria-label="Breadcrumb">
      <a href="../index.html" class="hover:text-sun-400" data-en="Home">Anasayfa</a>
      <span class="mx-1.5 opacity-50">/</span>
      <a href="../antik-kentler.html" class="hover:text-sun-400" data-en="Ancient Cities">Antik Kentler</a>
      <span class="mx-1.5 opacity-50">/</span>
      <span class="text-sun-400">${escapeHtml(item.name)}</span>
    </nav>
    <div class="inline-flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase bg-white/10 border border-white/20 text-sun-400 px-3 py-1.5 rounded-full font-semibold" style="backdrop-filter:blur(4px);">
      <span class="w-1.5 h-1.5 rounded-full bg-sun-400"></span> <span data-en="${escapeAttr(item.category)}">${escapeHtml(item.category)}</span>
    </div>
    <h1 class="font-display text-4xl md:text-6xl font-extrabold mt-4 max-w-3xl leading-[1.05]" style="letter-spacing:-0.03em;text-shadow:0 2px 32px rgba(7,33,54,0.6);" data-en="${escapeAttr(item.name)}">${escapeHtml(item.name)}</h1>
    <p class="mt-4 text-white/85 max-w-2xl text-base md:text-lg leading-relaxed" data-en="${escapeAttr(enOverview)}" ${langAttrs(slug, 'summary', ['de', 'ru', 'fr'])}>${escapeHtml(item.summary)}</p>
    <div class="mt-5 flex flex-wrap gap-2">${tags}</div>
  </div>
</header>

<!-- STICKY NAV -->
<nav class="text-white sticky top-0 z-40" style="background:linear-gradient(180deg,#0c3858 0%,#0a2e4c 100%);box-shadow:0 4px 24px -4px rgba(7,33,54,0.55);">
  <div class="max-w-7xl mx-auto px-4 hidden md:flex items-center gap-0 text-[12px] uppercase tracking-[0.1em] font-display font-semibold">
    <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="../haberler.html" data-en="News">Haberler</a>
    <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="../villalar.html" data-en="Villas">Villalar</a>
    <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="../restoranlar.html" data-en="Restaurants">Restoran &amp; Bar</a>
    <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="../plajlar.html" data-en="Beaches">Plajlar</a>
    <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="../turlar.html" data-en="Tours">Turlar</a>
    <a class="px-4 py-3 hover:bg-sea-700 underline-grow nav-active" href="../antik-kentler.html" data-en="Ancient Cities">Antik Kentler</a>
    <a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="../hizmetler.html" data-en="Services">Hizmetler</a>
    <span class="ml-auto"></span>
    <a class="px-4 py-3 text-sun-400 hover:bg-sea-700" href="#" data-concierge-trigger>Concierge</a>
  </div>
</nav>

<!-- QUICK FACTS -->
<section class="max-w-7xl mx-auto px-4 -mt-8 md:-mt-12 relative z-10">
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
    <div class="fact-card">
      <div class="text-[10px] uppercase tracking-widest text-sea-700/60 font-bold" data-en="Distance from Kalkan">Kalkan'dan</div>
      <div class="font-display font-extrabold text-sea-800 text-lg md:text-xl mt-1">${escapeHtml(item.distance || '—')}</div>
      <div class="text-xs text-sea-700/70 mt-0.5" data-en="${escapeAttr(item.drive || '')}">${escapeHtml(item.drive || '')}</div>
    </div>
    <div class="fact-card">
      <div class="text-[10px] uppercase tracking-widest text-sea-700/60 font-bold" data-en="Entry Fee">Giriş Ücreti</div>
      <div class="font-display font-extrabold text-sea-800 text-lg md:text-xl mt-1" data-en="${escapeAttr(item.entryFee || 'Free')}">${escapeHtml(item.entryFee || 'Ücretsiz')}</div>
      <div class="text-xs text-sea-700/70 mt-0.5" data-en="2026 prices">2026 fiyatı</div>
    </div>
    <div class="fact-card">
      <div class="text-[10px] uppercase tracking-widest text-sea-700/60 font-bold" data-en="Hours">Açık Saatler</div>
      <div class="font-display font-extrabold text-sea-800 text-base md:text-lg mt-1">${escapeHtml(item.hours || '7/24')}</div>
    </div>
    <div class="fact-card">
      <div class="text-[10px] uppercase tracking-widest text-sea-700/60 font-bold" data-en="Visit Duration">Ziyaret Süresi</div>
      <div class="font-display font-extrabold text-sea-800 text-lg md:text-xl mt-1">${escapeHtml(item.duration || '1-2 saat')}</div>
    </div>
  </div>
</section>

<!-- HISTORY + TIPS -->
<section class="max-w-7xl mx-auto px-4 py-14">
  <div class="grid md:grid-cols-3 gap-10">
    <article class="md:col-span-2">
      <div class="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-sun-500 font-bold mb-2">
        <span class="w-1.5 h-1.5 rounded-full bg-sun-500"></span> <span data-en="History &amp; Visit Guide">Tarih &amp; Ziyaret Rehberi</span>
      </div>
      <h2 class="font-display text-2xl md:text-4xl font-extrabold text-sea-800 leading-tight" data-en="What you'll see at ${escapeAttr(item.name)}">${escapeHtml(item.name)}'nde ne göreceksiniz?</h2>
      <p class="text-sea-700 mt-5 text-base md:text-lg leading-relaxed" ${langAttrs(slug, 'history')}>${escapeHtml(item.history || '')}</p>
      <p class="text-sea-700 mt-4 text-base leading-relaxed" ${langAttrs(slug, 'extended')}>${escapeHtml(extended)}</p>

      <h3 class="font-display text-xl font-extrabold text-sea-800 mt-10 mb-4" data-en="Highlights">Görülmesi Gerekenler</h3>
      <ul class="space-y-2.5 text-sea-700 text-[15px]">
          ${highlights}
      </ul>

      <div class="mt-10 bg-sun-50 border-l-4 border-sun-500 rounded-r-xl p-5">
        <div class="text-[11px] uppercase tracking-widest text-sun-700 font-bold mb-2" data-en="Local tip">Yerel Tavsiye</div>
        <p class="text-sea-800 text-[15px] leading-relaxed" ${langAttrs(slug, 'tips')}>${escapeHtml(item.tips || '')}</p>
      </div>
    </article>

    <!-- SIDEBAR -->
    <aside class="space-y-5">
      <div class="bg-white border border-sea-100 rounded-2xl p-5 shadow-sm">
        <div class="text-[11px] uppercase tracking-widest text-sun-500 font-bold mb-2" data-en="How to get there">Nasıl Gidilir</div>
        <h3 class="font-display font-extrabold text-sea-800 text-lg mb-3">Kalkan → ${escapeHtml(item.name)}</h3>
        <p class="text-sea-700 text-sm leading-relaxed" ${langAttrs(slug, 'transport')}>${escapeHtml(item.transport || '')}</p>
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div class="bg-sea-50 rounded-lg p-2.5">
            <div class="text-[10px] uppercase tracking-wider text-sea-700/60 font-bold" data-en="By car">Araçla</div>
            <div class="font-bold text-sea-800 mt-0.5">${escapeHtml(item.drive || '—')}</div>
          </div>
          <div class="bg-sea-50 rounded-lg p-2.5">
            <div class="text-[10px] uppercase tracking-wider text-sea-700/60 font-bold" data-en="Distance">Mesafe</div>
            <div class="font-bold text-sea-800 mt-0.5">${escapeHtml(item.distance || '—')}</div>
          </div>
        </div>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}" target="_blank" rel="noopener" class="mt-4 block text-center bg-sea-800 hover:bg-sea-900 text-white font-display font-bold text-sm uppercase tracking-wider rounded-lg py-3 transition" data-en="Open in Google Maps">Google Maps'te Aç</a>
      </div>

      <div class="bg-gradient-to-br from-sea-800 to-sea-900 text-white rounded-2xl p-5">
        <div class="text-[11px] uppercase tracking-widest text-sun-400 font-bold mb-2" data-en="AI Concierge">AI Concierge</div>
        <h3 class="font-display font-extrabold text-white text-lg mb-2" data-en="Plan this with Concierge">Bu Antik Kenti Concierge'le Planla</h3>
        <p class="text-white/75 text-sm leading-relaxed mb-4" data-en="Get a personalised day plan: best time, route from your villa, lunch + beach combo, photographer tips.">Kişiye özel günlük plan: en iyi saat, villanızdan rota, öğle yemeği + plaj kombinasyonu, fotoğraf önerileri.</p>
        <a href="#" data-concierge-trigger class="block text-center bg-sun-500 hover:bg-sun-400 text-sea-900 font-display font-extrabold text-sm uppercase tracking-wider rounded-lg py-3 transition" data-en="Start Planning">Planlamaya Başla</a>
      </div>

      <div class="bg-white border border-sea-100 rounded-2xl p-5 shadow-sm">
        <div class="text-[11px] uppercase tracking-widest text-sun-500 font-bold mb-2" data-en="Nearby">Yakınlarda</div>
        <h3 class="font-display font-extrabold text-sea-800 text-lg mb-3" data-en="Combine your visit">Ziyaretinizi Birleştirin</h3>
        <div class="space-y-2.5 text-sm">
          <a href="../restoranlar.html" class="flex items-center gap-3 group">
            <span class="w-9 h-9 rounded-lg bg-sun-100 grid place-items-center text-sun-700">🍽️</span>
            <span class="text-sea-800 group-hover:text-sun-600 transition" data-en="Restaurants in the region">Bölgedeki Restoranlar</span>
          </a>
          <a href="../plajlar.html" class="flex items-center gap-3 group">
            <span class="w-9 h-9 rounded-lg bg-sea-100 grid place-items-center text-sea-700">🏖️</span>
            <span class="text-sea-800 group-hover:text-sun-600 transition" data-en="Nearby beaches">Yakın Plajlar</span>
          </a>
          <a href="../turlar.html" class="flex items-center gap-3 group">
            <span class="w-9 h-9 rounded-lg bg-coral-100 grid place-items-center text-coral-600">🚐</span>
            <span class="text-sea-800 group-hover:text-sun-600 transition" data-en="Guided tours">Rehberli Turlar</span>
          </a>
          <a href="../antik-kentler.html" class="flex items-center gap-3 group">
            <span class="w-9 h-9 rounded-lg bg-sea-100 grid place-items-center text-sea-700">🏛️</span>
            <span class="text-sea-800 group-hover:text-sun-600 transition" data-en="Other ancient cities">Diğer Antik Kentler</span>
          </a>
        </div>
      </div>
    </aside>
  </div>
</section>

<!-- CTA strip -->
<section class="bg-gradient-to-r from-sea-900 via-sea-800 to-sea-900 text-white py-12 border-y border-white/10">
  <div class="max-w-5xl mx-auto px-4 text-center">
    <div class="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-sun-400 font-bold mb-3">
      <span class="w-1.5 h-1.5 rounded-full bg-sun-400"></span> <span data-en="Plan Your Day">Gününüzü Planlayın</span>
    </div>
    <h2 class="font-display text-2xl md:text-4xl font-extrabold leading-tight" data-en="Ready to visit ${escapeAttr(item.name)}?">${escapeHtml(item.name)}'i ziyaret etmeye hazır mısınız?</h2>
    <p class="text-white/75 mt-3 max-w-2xl mx-auto" data-en="Kalkan Info Concierge builds a free day plan: route, timing, lunch and a beach stop, customised to your villa.">Kalkan Info Concierge size ücretsiz günlük plan hazırlar: rota, zamanlama, öğle yemeği ve bir plaj durağı — villanıza özel.</p>
    <a href="#" data-concierge-trigger class="inline-block mt-6 bg-sun-500 hover:bg-sun-400 text-sea-900 font-display font-extrabold text-sm md:text-base uppercase tracking-wider rounded-lg px-7 py-3.5 transition" data-en="Get a Free Plan">Ücretsiz Plan Al</a>
  </div>
</section>

<!-- FOOTER -->
<footer class="bg-gradient-to-b from-sea-800 to-sea-900 text-white">
  <div class="max-w-7xl mx-auto px-4 pt-14 pb-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
    <div class="col-span-2">
      <a href="../index.html" class="font-display font-extrabold text-2xl tracking-tight flex items-center gap-2">
        <span class="text-sun-500">◆</span> KALKAN <span class="text-sun-500">INFO</span>
      </a>
      <p class="text-white/70 mt-3 max-w-sm" data-en="Quiet but powerful — local knowledge, curated recommendations, professional service.">Sessiz ama güçlü — yerel bilgi, seçili tavsiyeler, kurumsal hizmet.</p>
    </div>
    <div>
      <div class="text-xs uppercase tracking-widest text-sun-400 font-bold mb-3" data-en="Explore">Keşfet</div>
      <ul class="space-y-2 text-white/80">
        <li><a class="hover:text-sun-400" href="../plajlar.html" data-en="Beaches">Plajlar</a></li>
        <li><a class="hover:text-sun-400" href="../restoranlar.html" data-en="Restaurants">Restoran &amp; Bar</a></li>
        <li><a class="hover:text-sun-400" href="../turlar.html" data-en="Tours">Turlar</a></li>
        <li><a class="hover:text-sun-400" href="../antik-kentler.html" data-en="Ancient Cities">Antik Kentler</a></li>
      </ul>
    </div>
    <div>
      <div class="text-xs uppercase tracking-widest text-sun-400 font-bold mb-3" data-en="Support">Destek</div>
      <ul class="space-y-2 text-white/80">
        <li><a class="hover:text-sun-400" href="../hizmetler.html" data-en="Services">Hizmetler</a></li>
        <li><a class="hover:text-sun-400" href="../haberler.html" data-en="News">Haberler</a></li>
        <li><a class="hover:text-sun-400" href="#" data-concierge-trigger>Concierge</a></li>
      </ul>
    </div>
  </div>
  <div class="border-t border-white/10 max-w-7xl mx-auto px-4 py-5 text-xs text-white/60">
    <div data-en="© 2026 Kalkan Info — All rights reserved.">© 2026 Kalkan Info — Tüm hakları saklıdır.</div>
  </div>
</footer>

<script src="../js/render.js?v=20260517a"></script>
<script src="../js/pwa.js?v=20260516c" defer></script>
</body>
</html>
`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const raw = await readFile(DATA, 'utf8');
  const data = JSON.parse(raw);
  const byId = new Map(data.items.map(it => [it.id, it]));

  const built = [];
  for (const slug of PRIORITY) {
    const item = byId.get(slug);
    if (!item) {
      console.warn(`Skipping missing slug: ${slug}`);
      continue;
    }
    const html = pageHtml(item, slug);
    const out = join(OUT_DIR, `${slug}.html`);
    await writeFile(out, html, 'utf8');
    built.push(out);
    console.log(`✓ ${out}`);
  }
  console.log(`\nDone — ${built.length} pages written to ${OUT_DIR}`);
}

// Sadece doğrudan çalıştırıldığında build et — import edildiğinde (translate-antik.mjs) değil.
if (process.argv[1] && process.argv[1].endsWith('build-antik-pages.mjs')) {
  main().catch(err => { console.error(err); process.exit(1); });
}
