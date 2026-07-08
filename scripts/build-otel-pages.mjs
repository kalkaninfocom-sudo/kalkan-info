#!/usr/bin/env node
/**
 * Otel mini-site uretici (15 otel).
 * Kullanim: node scripts/build-otel-pages.mjs [slug1 slug2 ...]
 *   - Slug verilmezse data/oteller.json'daki TUM oteller uretilir.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const REVIEWS_DIR = join(root, 'data', 'otel-reviews');

const args = process.argv.slice(2);

const data = JSON.parse(await readFile(join(root, 'data', 'oteller.json'), 'utf8'));
const template = await readFile(join(root, 'otel', '_template', 'index.html'), 'utf8');
const targets = args.length ? args : (data.items || []).map(it => it.id);

// Tum otellerin galeri ve hero gorsellerinden + restoran havuzundan pool
// (restoran havuzu da Akdeniz / Kalkan estetigine uyar — fallback olarak kullanir)
const allRealImages = new Set();
for (const it of (data.items || [])) {
  if (it.image) allRealImages.add(it.image);
  for (const g of (it.gallery || [])) if (g) allRealImages.add(g);
}
// Restoran havuzundan da gorseller ekle (Akdeniz cevre dokusu icin uyumlu)
try {
  const restData = JSON.parse(await readFile(join(root, 'data', 'restoranlar.json'), 'utf8'));
  for (const it of (restData.items || [])) {
    if (it.image) allRealImages.add(it.image);
    for (const g of (it.gallery || [])) if (g) allRealImages.add(g);
  }
} catch(e) { /* yoksa atla */ }

const POOL = Array.from(allRealImages).filter(src => {
  if (!src.startsWith('/assets/img/')) return false;
  return existsSync(join(root, src.replace(/^\//, '')));
});
console.log(`Pool: ${POOL.length} gercek webp/jpg gorsel.`);

// Kategoriye gore tema secimi
function theme(category){
  const map = {
    'Boutique':         { bg:'#1a0e08', bg2:'#241710', accent:'#d4af37', accent2:'#b8932a', text:'#f0e2d4', muted:'#a89682', font:'Playfair+Display' },
    'Lüks':             { bg:'#0d0610', bg2:'#1a0a14', accent:'#d4af37', accent2:'#b8932a', text:'#e8e2d4', muted:'#9b8f78', font:'Playfair+Display' },
    'Butik Pansiyon':   { bg:'#1a120a', bg2:'#241710', accent:'#e8a55a', accent2:'#c8853e', text:'#f0e5d6', muted:'#a89882', font:'Cormorant+Garamond' },
    'Beach Hotel':      { bg:'#061826', bg2:'#0a2236', accent:'#4eb1b3', accent2:'#3a8e91', text:'#e1ecf2', muted:'#7f9aae', font:'Cormorant+Garamond' },
    'Resort':           { bg:'#0a1018', bg2:'#13181c', accent:'#7eb8a0', accent2:'#5f9882', text:'#e8efe8', muted:'#94a094', font:'Cormorant+Garamond' }
  };
  return map[category] || map['Boutique'];
}

// Otel basina ozel "hakkimizda" tohumlari + parlak ozellikler
const CUSTOM = {
  'white-house-kalkan': {
    tagline: 'Eski Kalkan dokunuşu, modern konfor.',
    aboutTitle: 'Beyaz Duvarlar, Lacivert Deniz.',
    aboutP1: 'White House Hotel, Eski Kalkan\'ın kıvrımlı taş sokaklarında, beyaza boyalı geleneksel evlerin arasında konumlanır. Akdeniz mimarisinin sıcaklığını modern butik konforuyla birleştiriyoruz.',
    aboutP2: 'Çatı terasımızdan Akdeniz\'in tüm tonlarını izleyin; her sabah yerel ürünlerden hazırlanan kahvaltı eşliğinde günü açın.',
    highlights: ['Eski Kalkan Konum','Çatı Terası','Aile İşletmesi']
  },
  'sea-house-kalkan': {
    tagline: 'İskelenin kalbinde butik konaklama.',
    aboutTitle: 'İskelenin Tam Üstünde.',
    aboutP1: 'Pier House Kalkan, iskele sokağında — odalarınızın çoğundan tekneleri ve günbatımını doğrudan izleyebilirsiniz. Sıcak, kişisel bir butik adres.',
    aboutP2: 'Sabah deniz esintisi, kahvaltıda taze meyve, akşam liman yürüyüşü — Kalkan\'ı yaşamak için bundan iyisi yok.',
    highlights: ['İskele Kalbinde','Deniz Manzarası','Butik Atmosfer']
  },
  'likya-residence-kalkan': {
    tagline: 'Beş yıldız lüks — sessiz, özel, panoramik.',
    aboutTitle: 'Likya Kıyısının Premium Yüzü.',
    aboutP1: 'Kalkan Likya Bay Hotel, beş yıldızlı bir butik lüks adres. Geniş süitler, panoramik koy manzarası ve premium spa hizmeti — sessiz ve seçkin bir tatil için tasarlandı.',
    aboutP2: 'Her detay incelikle seçildi: yerel sanat, organik amenities, kişisel concierge. Lykia kıyısının en lüks adreslerinden birisiniz.',
    highlights: ['5 Yıldız','Spa & Wellness','Panoramik Manzara']
  },
  'hotel-pirat-kalkan': {
    tagline: 'Kalkan limanında klasik bir adres.',
    aboutTitle: 'Yatların Yanı Başında.',
    aboutP1: 'Hotel Pirat, Kalkan iskelesinde uzun yıllardır hizmet veriyor. Konum mükemmel — yatlar, restoranlar ve tüm liman yaşamı kapıda.',
    aboutP2: 'Sade konfor ve iyi fiyat — ailelerden gezginlere kadar geniş bir kitleye uygun, klasik bir Kalkan deneyimi.',
    highlights: ['Liman Manzarası','Klasik Adres','Aile Dostu']
  },
  'kalkan-regency': {
    tagline: 'Şehir merkezi lüksü, panoramik teras.',
    aboutTitle: 'Şehrin Yüksek Tarafı.',
    aboutP1: 'Kalkan Regency Hotel, şehir merkezinin nabzında yer alan beş yıldızlı butik lüks otel. Modern süitler, panoramik teras restoran ve titiz spa hizmeti — yüksek standartta tatil için.',
    aboutP2: 'Çatı katındaki sonsuzluk havuzundan Kalkan körfezini tüm renkleriyle izleyin. Akşamları teras barda kokteyl, sabahları premium kahvaltı.',
    highlights: ['5 Yıldız','Çatı Katı Spa','Panoramik Teras']
  },
  'olea-nova-kalkan': {
    tagline: 'Modern dizayn, Akdeniz dokunuşu.',
    aboutTitle: 'Tasarım, Doğa, Lüks.',
    aboutP1: 'Olea Nova Hotel, çağdaş mimarinin Akdeniz dokusuyla buluştuğu bir tasarım adresi. Özel havuzlu süitler, geniş cam yüzeyler ve sade ama lüks bir iç dekor.',
    aboutP2: 'Mutfağımız sezonluk yerel ürünlerle çalışıyor; spa kompleksimiz tam donanımlı. Hem konforlu hem de görsel olarak tatmin edici bir tatil arıyorsanız doğru adres.',
    highlights: ['Dizayn Otel','Özel Havuzlu Odalar','Akdeniz Mutfağı']
  },
  'patara-prince-resort': {
    tagline: 'İkonik koy resort — kendi sahili, geniş havuz.',
    aboutTitle: 'Kendi Koyunuz.',
    aboutP1: 'Patara Prince, Kalkan\'ın en eski ve en ikonik kıyı resort\'larından biri. Kendi sahil iskelesi, geniş yüzme havuzu ve taş yapılı süitleri ile özel bir koya yerleşmiş bir köy gibi hissettiriyor.',
    aboutP2: 'Sabah denize girip kahvaltıya geçin, gün boyu havuz başında dinlenin, akşam teras restoranımızda Lykia kıyısının batan güneşini izleyin. Çocuklu ailelerden balayı çiftlerine kadar herkese uygun.',
    highlights: ['Özel Sahil İskelesi','Geniş Havuz','Resort Konfor']
  },
  'villa-linda-kalkan': {
    tagline: 'Aile sıcaklığı, bahçeli kahvaltı.',
    aboutTitle: 'Evden Uzakta Bir Ev.',
    aboutP1: 'Villa Linda, Eski Kalkan\'ın taş sokaklarında aile işletmesi sıcak bir butik pansiyon. Otel servisinin formalitesi yerine, samimi bir misafirperverlik bulacaksınız.',
    aboutP2: 'Bahçede kahvaltı, akşamleyin terasta sohbet, sabaha karşı serin bir esinti — Kalkan\'ın eski havasını seven misafirler için.',
    highlights: ['Aile İşletmesi','Bahçe Kahvaltı','Samimi Atmosfer']
  },
  'asfiya-sea-view': {
    tagline: 'Tepede panoramik manzara, sakin atmosfer.',
    aboutTitle: 'Yüksekten Bakış.',
    aboutP1: 'Asfiya Sea View Hotel, Kalkan\'ın yukarısında konumlanmış butik bir otel. Tüm odalardan panoramik koy manzarası, havuzdan kesintisiz deniz görüntüsü.',
    aboutP2: 'Şehrin gürültüsünden uzak ama yine de merkeze yakın — sakin bir tatil için ideal denge.',
    highlights: ['Panoramik Manzara','Tepede Konum','Sakin Atmosfer']
  },
  'hera-hotel-kalkan': {
    tagline: 'Şehir kalbinde havuzlu butik konfor.',
    aboutTitle: 'Klasik Kalkan Sıcaklığı.',
    aboutP1: 'Hera Hotel Kalkan, şehir merkezine yakın konumu ve havuzlu bahçesiyle butik konaklamanın sıcak yorumunu sunar. Plajlara ve restoranlara yürüme mesafesi.',
    aboutP2: 'Klasik Akdeniz dekoru, samimi servis ve uygun fiyat — yıllardır sadık misafir kitlesini koruyan bir adres.',
    highlights: ['Havuzlu Bahçe','Merkez Konum','Samimi Servis']
  },
  'hadrian-hotel-kalkan': {
    tagline: 'Doğa ile iç içe sakin butik otel.',
    aboutTitle: 'Doğanın Kucağında.',
    aboutP1: 'Hadrian Hotel Kalkan, sakin bir bölgede konumlanmış, havuzlu ve teraslı bir butik otel. Şehirden uzaklaşıp doğanın içinde dinlenmek isteyenler için ideal.',
    aboutP2: 'Sade ama özenli iç dekor, ferah balkonlar, sabah terasta kahvaltı — Kalkan\'ın sessiz yüzünü deneyimleyin.',
    highlights: ['Sakin Bölge','Havuzlu Teras','Doğa İçinde']
  },
  'asfiya-retreat-spa': {
    tagline: 'Yetişkin spa retreat — özel havuz, Asya wellness.',
    aboutTitle: 'Sessizlik, Spa, Lüks.',
    aboutP1: 'Asfiya Retreat & Spa, yalnızca yetişkinlere açık 5 yıldızlı bir spa retreat. Özel havuzlu süitler, Asya esinli wellness merkezi ve panoramik manzara — Kalkan\'da gerçek bir kaçamak.',
    aboutP2: 'Sabah özel havuzunuzda yüzün, öğleden sonra spa terapisine geçin, akşam fine dining restoranımızda günü kapatın. Premium hizmet, sessizlik garantili.',
    highlights: ['Yetişkinlere Özel','Asya Spa','Özel Havuzlu Süitler']
  },
  'mahal-hotel-kalkan': {
    tagline: 'Kalkan\'ın ikonik beş yıldızlı butik lüks adresi.',
    aboutTitle: 'Yarımadanın Ucunda Lüks.',
    aboutP1: 'Hotel Villa Mahal, Çukurbağ Yarımadası\'nın ucunda konumlanmış, Kalkan\'ın en bilinen ve fotoğrafı en çok çekilen butik lüks otellerinden biridir. Sonsuzluk havuzu doğrudan koya bakar; özel deniz iskelesi ise misafirleri Akdeniz\'in temiz suyuna açar.',
    aboutP2: 'Her oda denize bakar — modern Akdeniz dokusu, taş duvarlar, geniş camlar. Mahal sadece konaklama değil, bir manzara deneyimi sunuyor.',
    highlights: ['5 Yıldız','Sonsuzluk Havuzu','Özel Deniz İskelesi']
  },
  'kalkan-han-hotel': {
    tagline: 'Geleneksel han, taş duvarlı avlu.',
    aboutTitle: 'Han Mimarisinde Modern Konfor.',
    aboutP1: 'Kalkan Han Hotel, Eski Kalkan\'ın taş sokaklarında geleneksel han mimarisini modern konforla birleştiren bir butik adres. Avlu, taş duvarlar, sade ama samimi odalar.',
    aboutP2: 'Sabah avluda kahvaltı, akşam serin taş duvarların gölgesinde kitap okuma — Kalkan\'ın tarihi dokusunu en otantik yaşama biçimi.',
    highlights: ['Geleneksel Han','Taş Avlu','Tarihi Doku']
  },
  'doruk-hotel-kalkan': {
    tagline: 'Modern butik konfor, deniz manzaralı teras.',
    aboutTitle: 'Modern Kalkan Konaklaması.',
    aboutP1: 'Kalkan Dream Hotel, modern butik konsepti benimsemiş bir konaklama adresi. Havuz, deniz manzaralı teras restoran ve düzenli plaj transferi ile rahat bir kıyı tatili sunuyor.',
    aboutP2: 'Şehir merkezine yakın ama sakin bir bölgede — modern dokular, ferah balkonlar, profesyonel servis. Çiftler ve aileler için ideal.',
    highlights: ['Modern Konsept','Plaj Transferi','Havuzlu Teras']
  },
  'kalkan-turk-evi-otel': {
    tagline: 'Tarihi Taş Ev Konaklama — Eski Kalkan\'ın Kalbinde.',
    aboutTitle: 'Geleneksel Türk Evi Sıcaklığı.',
    aboutP1: 'Kalkan Türk Evi Otel, Eski Kalkan\'ın kıvrımlı taş sokaklarında, geleneksel Türk evi mimarisini koruyarak hizmet veren samimi bir butik pansiyondur. Taş duvarlar, ahşap detaylar ve sıcak Akdeniz dokusu birleşiyor.',
    aboutP2: 'Sabah bahçede ev yapımı kahvaltı, akşam çatı terasında günbatımı — Kalkan\'ın otantik dokusunu en samimi biçimde yaşayın. Aile işletmesi sıcaklığı her detayda hissediliyor.',
    highlights: ['Tarihi Taş Ev','Eski Kalkan','Aile İşletmesi']
  }
};

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

// Resmi yildiz reytingi HTML (hero altinda gosterilir)
function officialStarsHtml(starRating) {
  if (!starRating) return '';
  const n = Math.max(1, Math.min(5, Number(starRating)));
  const star = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  return `<div class="star-row mb-6 justify-center" style="display:inline-flex;color:#d4af37;">${star.repeat(n)}</div>`;
}

// Olanak ikonlari (anahtar -> SVG)
function amenityIcon(name) {
  const n = (name || '').toLowerCase();
  const svg = (path) => `<svg class="amenity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${path}</svg>`;
  if (n.includes('havuz') || n.includes('pool')) return svg('<path d="M2 18c4-2 6 2 10 0s6 2 10 0"/><path d="M2 14c4-2 6 2 10 0s6 2 10 0"/><path d="M6 4v10M18 4v10"/>');
  if (n.includes('spa') || n.includes('wellness')) return svg('<path d="M12 2v6M12 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M8 8c0-2 2-4 4-4s4 2 4 4"/>');
  if (n.includes('restoran') || n.includes('restaurant')) return svg('<path d="M6 2v8a2 2 0 0 0 2 2v8M10 2v8a2 2 0 0 1-2 2"/><path d="M18 2c-1 0-3 2-3 6s2 4 3 4v10"/>');
  if (n.includes('bar')) return svg('<path d="M5 3h14l-7 9v8h3M5 3l7 9"/>');
  if (n.includes('wifi') || n.includes('internet')) return svg('<path d="M5 13a10 10 0 0 1 14 0"/><path d="M8 16a6 6 0 0 1 8 0"/><circle cx="12" cy="19" r="1"/>');
  if (n.includes('klima') || n.includes('air')) return svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.07 4.93l-2.12 2.12M7.05 16.95 4.93 19.07M19.07 19.07l-2.12-2.12M7.05 7.05 4.93 4.93"/>');
  if (n.includes('aile') || n.includes('family') || n.includes('cocuk')) return svg('<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 21c0-3 2-6 6-6s6 3 6 6"/><path d="M15 21c0-2 1-4 4-4s2 2 2 4"/>');
  if (n.includes('hayvan') || n.includes('pet')) return svg('<circle cx="5" cy="9" r="2"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="19" cy="9" r="2"/><path d="M12 12c-3 0-6 2-6 5 0 2 2 4 6 4s6-2 6-4c0-3-3-5-6-5z"/>');
  if (n.includes('teras')) return svg('<path d="M3 9l9-6 9 6"/><path d="M5 9v11M19 9v11"/><path d="M9 14h6M9 18h6"/>');
  if (n.includes('bahce') || n.includes('garden') || n.includes('avlu')) return svg('<path d="M12 22V8"/><path d="M5 8c0-4 3-6 7-6s7 2 7 6c0 4-7 6-7 6s-7-2-7-6z"/>');
  if (n.includes('manzara') || n.includes('view') || n.includes('deniz') || n.includes('sea')) return svg('<path d="M2 18c4-2 6 2 10 0s6 2 10 0"/><circle cx="6" cy="8" r="2"/><path d="M14 4l4 4-4 4"/>');
  if (n.includes('plaj') || n.includes('beach') || n.includes('sahil') || n.includes('transfer')) return svg('<circle cx="12" cy="8" r="3"/><path d="M5 22c0-4 3-7 7-7s7 3 7 7"/>');
  if (n.includes('kahvalti') || n.includes('breakfast')) return svg('<rect x="3" y="8" width="14" height="10" rx="2"/><path d="M17 12h2a2 2 0 0 1 0 4h-2"/><path d="M7 3v3M11 3v3"/>');
  if (n.includes('fitness') || n.includes('gym')) return svg('<path d="M6 4v16M18 4v16M2 8h4M2 16h4M18 8h4M18 16h4M6 12h12"/>');
  if (n.includes('concierge')) return svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/><path d="M9 8h6"/>');
  if (n.includes('tenis') || n.includes('tennis')) return svg('<circle cx="12" cy="12" r="10"/><path d="M2 12c4 0 8-2 10-10M22 12c-4 0-8-2-10 10"/>');
  if (n.includes('yetiskin') || n.includes('adult')) return svg('<circle cx="12" cy="7" r="3"/><path d="M5 22c0-4 3-7 7-7s7 3 7 7"/><path d="M16 11l4 4M20 11l-4 4"/>');
  if (n.includes('otopark') || n.includes('parking')) return svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>');
  if (n.includes('limana') || n.includes('liman') || n.includes('iskele')) return svg('<path d="M12 2v20"/><circle cx="12" cy="6" r="3"/><path d="M5 14c0 4 3 6 7 6s7-2 7-6"/><path d="M3 14h18"/>');
  // default: check
  return svg('<path d="M4 12l5 5L20 7"/>');
}

// AggregateRating JSON-LD — gecerli rating+reviewCount yoksa null (alan cikarilir).
// Bos "{}" Rich Results'ta invalid markup uyarisi verir.
function aggregateRatingJson(cache, r) {
  const place = cache?.place || {};
  const ratingValue = place.rating ?? r?.rating ?? null;
  const reviewCount = place.reviews ?? r?.reviewCount ?? null;
  if (!ratingValue || !reviewCount) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: Math.min(Number(ratingValue), 5), // schema geçerliliği: bestRating=5'i asla aşma
    reviewCount: Number(reviewCount),
    bestRating: 5,
    worstRating: 1
  };
}

// Review array JSON-LD (max 5)
function reviewArrayJson(cache) {
  const reviews = cache?.reviews || [];
  if (!reviews.length) return [];
  return reviews.slice(0, 5).map(rv => {
    const obj = {
      '@type': 'Review',
      author: { '@type': 'Person', name: rv.user || 'Anonim' },
      reviewRating: { '@type': 'Rating', ratingValue: Math.min(rv.rating || 5, 5), bestRating: 5 }
    };
    if (rv.date && /\d{4}/.test(rv.date)) obj.datePublished = rv.date;
    if (rv.snippet) obj.reviewBody = rv.snippet.slice(0, 500);
    return obj;
  });
}

// AmenityFeature JSON-LD
function amenityFeatureJson(amenities) {
  return (amenities || []).map(a => ({
    '@type': 'LocationFeatureSpecification',
    name: a,
    value: true
  }));
}

// Cache'den otel review verisini oku
async function loadReviewCache(slug) {
  const path = join(REVIEWS_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

// Yorumlar bolumu HTML
function buildReviewsSection(r, cache) {
  const place = cache?.place || {};
  const reviews = cache?.reviews || [];
  const rating = place.rating ?? r.rating ?? null;
  const reviewCount = place.reviews ?? r.reviewCount ?? null;
  const mapsHref = place.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${esc(place.place_id)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' Kalkan')}`;

  if (!reviews.length) {
    return `
<section id="reviews" class="py-24 md:py-32 px-6">
  <div class="max-w-5xl mx-auto text-center">
    <div class="section-label justify-center mb-6" data-i="reviews_label">Misafir Yorumları</div>
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
      <div class="section-label justify-center mb-6" data-i="reviews_label">Misafir Yorumları</div>
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

// Sosyal medya
function socialLinks(r){
  const icons = [];
  if (r.instagram) icons.push(`<a href="${esc(r.instagram)}" target="_blank" rel="noopener" aria-label="Instagram" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>`);
  if (r.website) icons.push(`<a href="${esc(r.website)}" target="_blank" rel="noopener" aria-label="Website" style="color:var(--theme-accent);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3 4 7 4 10s-1 7-4 10c-3-3-4-7-4-10s1-7 4-10z"/></svg></a>`);
  icons.push(`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+' Kalkan')}" target="_blank" rel="noopener" aria-label="Google Yorumları" style="color:var(--theme-accent);" title="Google'da yorumları gör"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></a>`);
  return icons.join('');
}

// 5-dil i18n
const I18N_BASE = {
  tr: { about:'Hakkımızda', amenities:'Olanaklar', rooms:'Odalar', gallery:'Galeri', reserve:'Detaylar', contact:'İletişim', reviews:'Yorumlar', cta_reserve:'Detaylar & İletişim', cta_rooms:'Odaları Gör', cta_reserve_send:'Talebi Gönder', about_label:'Hakkımızda', amenities_label:'Olanaklar', amenities_title:'Otelin Sunduğu', amenities_sub:'Konaklamanız boyunca yararlanabileceğiniz olanak ve hizmetler.', rooms_label:'Odalar', rooms_title:'Oda Tipleri', rooms_sub:'Konfor seviyenize uygun oda seçenekleri.', rooms_cta:'Müsaitlik Sor', rooms_sleeps:'kişi', gallery_label:'Galeri', gallery_title:'Otelden Kareler', reserve_label:'Detaylar & İletişim', reserve_title:'Detaylar & İletişim', reserve_sub:'Oda müsaitliği ve fiyat bilgisi için doğrudan otelyle iletişime geçin. Rezervasyon ve ödeme otel ile yapılır.', contact_label:'İletişim', contact_title:'Bize Ulaşın', contact_addr:'Adres', contact_phone:'Telefon', contact_checkin:'Check-in / Check-out', contact_social:'Sosyal Medya', reviews_label:'Misafir Yorumları', reviews_title:'Google\'da Bizi Anlatanlar', reviews_sub:'Aşağıdaki yorumlar Google Maps\'ten alınmıştır.', reviews_all:'Tüm Yorumları Gör (Google)', reviews_empty:'Yorumlar yakında eklenecek.' },
  en: { about:'About', amenities:'Amenities', rooms:'Rooms', gallery:'Gallery', reserve:'Details', contact:'Contact', reviews:'Reviews', cta_reserve:'Details & Contact', cta_rooms:'View Rooms', cta_reserve_send:'Send Request', about_label:'About Us', amenities_label:'Amenities', amenities_title:'What We Offer', amenities_sub:'Facilities and services available during your stay.', rooms_label:'Rooms', rooms_title:'Room Types', rooms_sub:'Room options to match your comfort level.', rooms_cta:'Ask Availability', rooms_sleeps:'guests', gallery_label:'Gallery', gallery_title:'Hotel Moments', reserve_label:'Details & Contact', reserve_title:'Details & Contact', reserve_sub:'Contact the hotel directly for availability and pricing. Bookings and payments are made directly with the hotel.', contact_label:'Contact', contact_title:'Get In Touch', contact_addr:'Address', contact_phone:'Phone', contact_checkin:'Check-in / Check-out', contact_social:'Social Media', reviews_label:'Guest Reviews', reviews_title:'What People Say on Google', reviews_sub:'The reviews below are sourced from Google Maps.', reviews_all:'See All Reviews (Google)', reviews_empty:'Reviews coming soon.' },
  de: { about:'Über uns', amenities:'Ausstattung', rooms:'Zimmer', gallery:'Galerie', reserve:'Details', contact:'Kontakt', reviews:'Bewertungen', cta_reserve:'Details & Kontakt', cta_rooms:'Zimmer ansehen', cta_reserve_send:'Anfrage senden', about_label:'Über uns', amenities_label:'Ausstattung', amenities_title:'Was wir bieten', amenities_sub:'Einrichtungen und Dienstleistungen während Ihres Aufenthalts.', rooms_label:'Zimmer', rooms_title:'Zimmertypen', rooms_sub:'Zimmeroptionen für jeden Komfortwunsch.', rooms_cta:'Verfügbarkeit anfragen', rooms_sleeps:'Personen', gallery_label:'Galerie', gallery_title:'Momente im Hotel', reserve_label:'Details & Kontakt', reserve_title:'Details & Kontakt', reserve_sub:'Kontaktieren Sie das Hotel direkt für Verfügbarkeit und Preise. Buchungen und Zahlungen erfolgen direkt mit dem Hotel.', contact_label:'Kontakt', contact_title:'Kontaktiere uns', contact_addr:'Adresse', contact_phone:'Telefon', contact_checkin:'Check-in / Check-out', contact_social:'Soziale Medien', reviews_label:'Gästebewertungen', reviews_title:'Was Gäste auf Google sagen', reviews_sub:'Die Bewertungen stammen von Google Maps.', reviews_all:'Alle Bewertungen (Google)', reviews_empty:'Bewertungen folgen in Kürze.' },
  ru: { about:'О нас', amenities:'Удобства', rooms:'Номера', gallery:'Галерея', reserve:'Детали', contact:'Контакты', reviews:'Отзывы', cta_reserve:'Детали и контакт', cta_rooms:'Посмотреть номера', cta_reserve_send:'Отправить запрос', about_label:'О нас', amenities_label:'Удобства', amenities_title:'Что мы предлагаем', amenities_sub:'Удобства и услуги во время вашего проживания.', rooms_label:'Номера', rooms_title:'Типы номеров', rooms_sub:'Варианты номеров под ваш уровень комфорта.', rooms_cta:'Узнать наличие', rooms_sleeps:'чел.', gallery_label:'Галерея', gallery_title:'Моменты отеля', reserve_label:'Детали и контакт', reserve_title:'Детали и контакт', reserve_sub:'Свяжитесь напрямую с отелем для уточнения наличия мест и цен. Бронирование и оплата производятся напрямую с отелем.', contact_label:'Контакты', contact_title:'Свяжитесь с нами', contact_addr:'Адрес', contact_phone:'Телефон', contact_checkin:'Заезд / Выезд', contact_social:'Социальные сети', reviews_label:'Отзывы гостей', reviews_title:'Что говорят в Google', reviews_sub:'Отзывы ниже — из Google Карт.', reviews_all:'Все отзывы (Google)', reviews_empty:'Отзывы появятся скоро.' },
  fr: { about:'À propos', amenities:'Équipements', rooms:'Chambres', gallery:'Galerie', reserve:'Détails', contact:'Contact', reviews:'Avis', cta_reserve:'Détails et contact', cta_rooms:'Voir les chambres', cta_reserve_send:'Envoyer la demande', about_label:'À propos', amenities_label:'Équipements', amenities_title:'Ce que nous offrons', amenities_sub:'Installations et services pendant votre séjour.', rooms_label:'Chambres', rooms_title:'Types de chambres', rooms_sub:'Options selon votre niveau de confort.', rooms_cta:'Demander disponibilité', rooms_sleeps:'pers.', gallery_label:'Galerie', gallery_title:'Moments de l\'hôtel', reserve_label:'Détails et contact', reserve_title:'Détails et contact', reserve_sub:'Contactez directement l\'hôtel pour la disponibilité et les tarifs. Les réservations et paiements se font directement avec l\'hôtel.', contact_label:'Contact', contact_title:'Contactez-nous', contact_addr:'Adresse', contact_phone:'Téléphone', contact_checkin:'Arrivée / Départ', contact_social:'Réseaux sociaux', reviews_label:'Avis des clients', reviews_title:'Ce que disent les clients sur Google', reviews_sub:'Les avis ci-dessous proviennent de Google Maps.', reviews_all:'Voir tous les avis (Google)', reviews_empty:'Avis bientôt disponibles.' }
};

const RELATED_I18N = {
  tr: { related_label:'Keşfet', related_title:"Kalkan'da Benzer Oteller", related_sub:'Konaklamak için keşfedebileceğiniz diğer Kalkan otelleri.', related_all:'Tüm Kalkan Otelleri →' },
  en: { related_label:'Discover', related_title:'Similar Hotels in Kalkan', related_sub:'Other Kalkan hotels worth considering for your stay.', related_all:'All Kalkan Hotels →' },
  de: { related_label:'Entdecken', related_title:'Ähnliche Hotels in Kalkan', related_sub:'Weitere Hotels in Kalkan für Ihren Aufenthalt.', related_all:'Alle Hotels in Kalkan →' },
  ru: { related_label:'Откройте', related_title:'Похожие отели в Калкане', related_sub:'Другие отели Калкана для вашего отдыха.', related_all:'Все отели Калкана →' },
  fr: { related_label:'Découvrir', related_title:'Hôtels similaires à Kalkan', related_sub:'D\'autres hôtels de Kalkan pour votre séjour.', related_all:'Tous les hôtels de Kalkan →' }
};
for (const l of Object.keys(I18N_BASE)) Object.assign(I18N_BASE[l], RELATED_I18N[l]);

function relatedSection(current, allItems) {
  const sameCat = allItems.filter(x => x.id !== current.id && x.category === current.category);
  const others = allItems.filter(x => x.id !== current.id && x.category !== current.category);
  const picks = [...sameCat, ...others].slice(0, 6);
  if (!picks.length) return '';
  const cards = picks.map(x => {
    const href = `/otel/${x.id}`;
    const sub = esc(x.category || x.location || '');
    return `
      <a href="${href}" class="related-card block p-5 transition" style="border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
        <div class="text-[10px] tracking-[0.2em] uppercase font-bold mb-2" style="color:var(--theme-accent);">${esc(x.category || 'Otel')}</div>
        <div class="font-display text-xl font-bold mb-1" style="color:var(--theme-text);">${esc(x.name)}</div>
        <div class="text-sm" style="color:var(--theme-muted);">${sub}</div>
      </a>`;
  }).join('');
  return `
<section class="py-24 md:py-32 px-6" style="background:var(--theme-bg-2);">
  <div class="max-w-7xl mx-auto">
    <div class="section-label mb-6" data-i="related_label">Keşfet</div>
    <h2 class="font-display text-4xl md:text-5xl font-extrabold mb-4" data-i="related_title">Kalkan'da Benzer Oteller</h2>
    <p class="mb-12 text-base max-w-2xl" style="color:var(--theme-muted);" data-i="related_sub">Konaklamak için keşfedebileceğiniz diğer Kalkan otelleri.</p>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">${cards}</div>
    <div class="mt-12">
      <a href="/oteller" class="btn-ghost" data-i="related_all">Tüm Kalkan Otelleri →</a>
    </div>
  </div>
</section>`;
}

let built = [];

for (const slug of targets) {
  const r = (data.items || []).find(x => x.id === slug);
  if (!r) { console.warn(`Atlandi: ${slug} oteller.json'da yok`); continue; }
  const c = CUSTOM[slug] || {};
  const t = theme(r.category);

  // Galeri: gerçek galeri + havuzdan deterministik fallback (8 toplam)
  const baseImg = r.image;
  const realGallery = (r.gallery || []).filter(Boolean);
  const used = new Set(realGallery);
  const need = Math.max(0, 8 - realGallery.length);
  const seed = r.id.split('').reduce((a,c)=>a*31+c.charCodeAt(0),7) & 0x7fffffff;
  const candidates = POOL.filter(p => !used.has(p));
  const picks = [];
  for (let i = 0; i < need && candidates.length; i++) {
    const idx = (seed + i * 37) % candidates.length;
    picks.push(candidates.splice(idx, 1)[0]);
  }
  const gallerySources = [...realGallery, ...picks].slice(0, 8);
  const galleryItems = gallerySources.map((src, i) => `
    <a href="${esc(src)}" target="_blank" class="gallery-item aspect-square block">
      <img src="${esc(src)}" alt="${esc(r.name)} ${i+1}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.background='var(--theme-bg-2)';this.style.opacity='0.3';">
    </a>`).join('');
  const aboutImage = realGallery[1] || realGallery[0] || baseImg;

  // Olanak kartlari
  const amenityTiles = (r.amenities || []).map(a => `
    <div class="amenity-tile">
      ${amenityIcon(a)}
      <div class="text-sm font-semibold">${esc(a)}</div>
    </div>`).join('');

  // Oda kartlari
  const roomCards = (r.roomTypes || []).map(rm => `
    <div class="room-card">
      <div class="text-[10px] tracking-[0.2em] uppercase font-bold mb-3" style="color:var(--theme-accent);">${esc(rm.name)}</div>
      <div class="font-display text-xl font-bold mb-3" style="color:var(--theme-text);">${esc(rm.sleeps)} kişiye kadar</div>
      <p class="text-sm leading-relaxed" style="color:var(--theme-muted);">${esc(rm.description || '')}</p>
    </div>`).join('');

  // Highlight pills (3 ozellik)
  const highlightPills = (c.highlights || []).map(h => `
    <span class="inline-flex items-center px-3 py-1.5 text-xs tracking-wider uppercase font-semibold border" style="border-color:var(--theme-accent);color:var(--theme-accent);">${esc(h)}</span>
  `).join('');

  // SameAs JSON
  const sameAs = [];
  if (r.instagram) sameAs.push(r.instagram);
  if (r.website && r.website !== r.instagram) sameAs.push(r.website);
  sameAs.push(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+' Kalkan')}`);

  // Telefon + concierge logic
  const concierge = '+90 530 665 07 94';
  const conciergeRaw = '905306650794';
  const hotelPhone = r.phone || null;
  const phone = hotelPhone || concierge;
  const phoneRaw = phone.replace(/[^\d+]/g, '');
  // WhatsApp her zaman concierge'e (booking talep yonlendirmesi icin)
  const waRaw = conciergeRaw;

  // Otelin kendi telefonu varsa "Direkt Otel" CTA ekle
  const directHotelCta = hotelPhone
    ? `<a href="tel:${phoneRaw}" class="btn-ghost">Direkt Otel</a>`
    : '';
  const conciergeLine = hotelPhone
    ? `<div class="text-xs mt-2" style="color:var(--theme-muted);">Concierge (Kalkan Info): <a href="tel:${conciergeRaw}" class="hover:underline" style="color:var(--theme-accent);">${concierge}</a></div>`
    : `<div class="text-xs mt-2" style="color:var(--theme-muted);">Kalkan Info concierge servisi üzerinden rezervasyon.</div>`;

  // Hero
  const heroImage = baseImg;
  const heroImageFull = `https://kalkaninfo.com${baseImg}`;

  // OG
  const ogImagePath = `/assets/og/otel/${r.id}.jpg`;
  const ogImageFull = existsSync(join(root, ogImagePath.replace(/^\//, '')))
    ? `https://kalkaninfo.com${ogImagePath}?v=2026-06-04`
    : heroImageFull;

  // Maps query
  const mapsQuery = encodeURIComponent((r.location || r.name + ' Kalkan'));

  // Geo
  const geoLat = (r.geo && r.geo.lat) || 36.2655;
  const geoLng = (r.geo && r.geo.lng) || 29.4138;

  // Yorumlar
  const reviewCache = await loadReviewCache(r.id);
  const reviewsSectionHtml = buildReviewsSection(r, reviewCache);

  // Oda WhatsApp text
  const roomWaText = encodeURIComponent(`Merhaba, ${r.name} oda müsaitlik durumu hakkında bilgi almak istiyorum.`);

  // Template doldur
  const repl = {
    NAME: r.name,
    NAME_URL: encodeURIComponent(r.name),
    SLUG: r.id,
    CATEGORY: r.category,
    PRICE_RANGE: r.priceRange || '$$$',
    SUMMARY: r.summary || c.tagline || '',
    TAGLINE: c.tagline || r.summary || '',
    LOCATION: r.location || 'Kalkan, Antalya',
    PHONE: phone,
    PHONE_RAW: phoneRaw,
    WA_RAW: waRaw,
    ABOUT_TITLE: c.aboutTitle || r.name,
    ABOUT_P1: c.aboutP1 || r.summary || '',
    ABOUT_P2: c.aboutP2 || '',
    ABOUT_IMAGE: aboutImage,
    HERO_IMAGE: heroImage,
    HERO_IMAGE_FULL: heroImageFull,
    OG_IMAGE_FULL: ogImageFull,
    MAPS_QUERY: mapsQuery,
    GEO_LAT: geoLat,
    GEO_LNG: geoLng,
    AMENITY_TILES: amenityTiles,
    ROOM_CARDS: roomCards,
    ROOM_WA_TEXT: roomWaText,
    HIGHLIGHT_PILLS: highlightPills,
    GALLERY_TITLE: 'Otelden Kareler',
    GALLERY_ITEMS: galleryItems,
    SOCIAL_LINKS: socialLinks(r),
    REVIEWS_SECTION: reviewsSectionHtml,
    RELATED_SECTION: relatedSection(r, data.items || []),
    DIRECT_HOTEL_CTA: directHotelCta,
    CONCIERGE_LINE: conciergeLine,
    CHECKIN_TIMES: 'Giriş 14:00 · Çıkış 12:00',
    STAR_RATING_HTML: officialStarsHtml(r.starRating),
    STAR_RATING_JSON: r.starRating ? JSON.stringify({ '@type':'Rating', ratingValue: r.starRating, bestRating: 5 }) : 'null',
    AMENITY_FEATURE_JSON: JSON.stringify(amenityFeatureJson(r.amenities)),
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

  const outDir = join(root, 'otel', r.id);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  built.push({ slug: r.id, name: r.name, url: `https://kalkaninfo.com/otel/${r.id}/`, local: `http://localhost:3000/otel/${r.id}/` });
  console.log(`  + ${r.name}  ->  otel/${r.id}/`);
}

// Sitemap'e ekle
if (built.length) {
  const sitemapPath = join(root, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');
  const today = new Date().toISOString().slice(0,10);
  for (const b of built) {
    const url = `https://kalkaninfo.com/otel/${b.slug}`;
    if (!sitemap.includes(url)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
    }
  }
  // oteller.html landing
  const landing = 'https://kalkaninfo.com/oteller.html';
  if (!sitemap.includes(landing)) {
    const entry = `  <url>\n    <loc>${landing}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    sitemap = sitemap.replace('</urlset>', entry + '</urlset>');
  }
  await writeFile(sitemapPath, sitemap);
  console.log(`Sitemap'e ${built.length} URL eklendi (+ oteller.html).`);
}

console.log('\n--- ADRESLER ---');
built.forEach(b => console.log(`  ${b.name}\n    Local : ${b.local}\n    Canli : ${b.url}\n`));
