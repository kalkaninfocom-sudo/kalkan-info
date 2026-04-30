/* SEO Inject — her sayfaya özel meta + Open Graph + Twitter Card + canonical + JSON-LD */
import { readFile, writeFile } from 'fs/promises';

const SITE_URL = 'https://kalkaninfo.com'; // production domain — değiştirilebilir
const SITE_NAME = 'Kalkan Info';
const DEFAULT_IMG = `${SITE_URL}/icons/icon-512.png`;

const PAGES = {
  'index.html': {
    title: 'Kalkan Info — Yerel Bilgi, Seçili Tavsiyeler, Kurumsal Hizmet',
    description: 'Kalkan, Kaş ve Patara için yerel hizmet rehberi. Plajlar, villalar, restoranlar, turlar, transfer, nöbetçi eczane ve daha fazlası tek adreste.',
    keywords: 'Kalkan, Kaş, Patara, tatil, villa, restoran, plaj, tekne turu, antalya, nöbetçi eczane, transfer, yerel rehber',
    image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80',
    type: 'website'
  },
  'plajlar.html': {
    title: 'Kalkan Plajları — Kaputaş, Patara, Kalamar | Kalkan Info',
    description: 'Kalkan, Kaş ve Patara\'nın en güzel 10 plajı. Mavi bayraklı Kaputaş, dünya mirası Patara, Kalamar koyu, gizli plajlar — fotoğraflar, mesafe, ipuçları.',
    keywords: 'Kalkan plajları, Kaputaş, Patara plajı, Kalamar, İncirli, Akçagerme, Mavi Bayrak, Antalya plajları',
    image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80',
    type: 'article'
  },
  'villalar.html': {
    title: 'Kalkan Kiralık Villalar — Havuzlu, Deniz Manzaralı | Kalkan Info',
    description: 'Kalkan\'da seçili kiralık villalar. 2+1\'den 6+1\'e havuzlu, deniz manzaralı, butik konumlu villalar — fiyat, kapasite, özellik karşılaştırması.',
    keywords: 'Kalkan kiralık villa, havuzlu villa, deniz manzaralı villa, Kalamar villa, Kaş villa, lüks villa kiralama',
    image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    type: 'website'
  },
  'turlar.html': {
    title: 'Kalkan Turları — Tekne, Safari, At, Kano | Kalkan Info',
    description: 'Kalkan\'da günlük tekne turu, jeep safari, at biniciliği, Xanthos kano turu. Kekova batık şehri, Patara at turu, Saklıkent jeep — fiyat ve rezervasyon.',
    keywords: 'Kalkan tekne turu, Kekova turu, jeep safari, Saklıkent, Patara at turu, Xanthos kano, Kalkan günübirlik tur',
    image: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=1200&q=80',
    type: 'website'
  },
  'restoranlar.html': {
    title: 'Kalkan Restoranları — En İyi 25 | Kalkan Info',
    description: 'Kalkan\'ın en iyi 25 restoranı. Fine dining, balık, Türk ev yemeği, dünya mutfağı, kahvaltı ve kafe — konum, telefon, mutfak ve fiyat aralığı.',
    keywords: 'Kalkan restoranları, en iyi restoran Kalkan, Aubergine, Korsan Kalamar, Kalkan balık restoranı, Türk mutfağı Kalkan',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    type: 'website'
  },
  'hizmetler.html': {
    title: 'Kalkan Hizmetler — Nöbetçi Eczane, Taksi, Acil | Kalkan Info',
    description: 'Kalkan\'da bugün nöbetçi eczane, acil numaralar, taksi durakları, transfer, market, kuru temizleme, tesisat, catering, çocuk bakımı — tüm yerel servisler.',
    keywords: 'Kalkan nöbetçi eczane, Kalkan taksi, Kalkan acil numaralar, Kaş Devlet Hastanesi, transfer, catering, Kalkan hizmetler',
    image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80',
    type: 'website'
  },
  'haberler.html': {
    title: 'Kalkan Haberleri — Etkinlik, Sezon, Duyuru | Kalkan Info',
    description: 'Kalkan, Kaş ve Patara\'dan güncel haberler. Sezon açılışı, etkinlikler, yeni restoran açılışları, Mavi Bayrak duyuruları, hava uyarıları.',
    keywords: 'Kalkan haberleri, Patara haberleri, Kalkan etkinlik, sezon açılışı, Mavi Bayrak, Kalkan duyuru',
    image: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=1200&q=80',
    type: 'article'
  }
};

function buildSeoBlock(page, key) {
  const url = `${SITE_URL}/${key}`;
  const img = page.image || DEFAULT_IMG;

  // JSON-LD schemas (page-specific)
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "url": SITE_URL,
    "logo": `${SITE_URL}/icons/icon-512.png`,
    "sameAs": ["https://instagram.com/kalkaninfo", "https://facebook.com/kalkaninfo"]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": SITE_URL,
    "inLanguage": "tr-TR",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE_URL}/index.html?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  const breadcrumb = key === 'index.html' ? null : {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Anasayfa", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": page.title.split('—')[0].trim(), "item": url }
    ]
  };

  const localBiz = key === 'index.html' ? {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "name": SITE_NAME,
    "url": SITE_URL,
    "image": img,
    "description": page.description,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Atatürk Cad.",
      "addressLocality": "Kalkan",
      "addressRegion": "Antalya",
      "postalCode": "07580",
      "addressCountry": "TR"
    },
    "geo": { "@type": "GeoCoordinates", "latitude": 36.2655, "longitude": 29.4138 },
    "areaServed": ["Kalkan","Kaş","Patara","Antalya"]
  } : null;

  const schemas = [orgSchema, websiteSchema, breadcrumb, localBiz].filter(Boolean);
  const jsonLd = schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n');

  return `<!-- SEO -->
<meta name="description" content="${page.description}">
<meta name="keywords" content="${page.keywords}">
<meta name="author" content="${SITE_NAME}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="googlebot" content="index, follow">
<link rel="canonical" href="${url}">

<!-- Open Graph -->
<meta property="og:type" content="${page.type}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${page.title}">
<meta name="twitter:description" content="${page.description}">
<meta name="twitter:image" content="${img}">

<!-- Geo -->
<meta name="geo.region" content="TR-07">
<meta name="geo.placename" content="Kalkan, Antalya">
<meta name="geo.position" content="36.2655;29.4138">
<meta name="ICBM" content="36.2655, 29.4138">

<!-- Structured data -->
${jsonLd}
<!-- /SEO -->
`;
}

const SEO_START = '<!-- SEO -->';
const SEO_END = '<!-- /SEO -->';

for (const [key, page] of Object.entries(PAGES)) {
  try {
    let html = await readFile(key, 'utf-8');
    const seoBlock = buildSeoBlock(page, key);

    // Eski SEO bloğu varsa kaldır
    const startIdx = html.indexOf(SEO_START);
    const endIdx = html.indexOf(SEO_END);
    if (startIdx !== -1 && endIdx !== -1) {
      html = html.slice(0, startIdx) + html.slice(endIdx + SEO_END.length).replace(/^\n/, '');
    }

    // Title'ı güncelle
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`);

    // Eski meta description'u kaldır (yeni SEO bloğu içinde olacak)
    html = html.replace(/<meta\s+name="description"[^>]*>\n?/gi, '');
    html = html.replace(/<meta\s+name="keywords"[^>]*>\n?/gi, '');

    // SEO bloğunu </head>'den önce ekle
    html = html.replace('</head>', seoBlock + '</head>');

    await writeFile(key, html, 'utf-8');
    console.log(`✓ ${key} — SEO meta + JSON-LD eklendi`);
  } catch (e) {
    console.warn(`✗ ${key} — ${e.message}`);
  }
}

console.log('\nSEO injection tamamlandı.');
