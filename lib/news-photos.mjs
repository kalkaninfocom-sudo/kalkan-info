/**
 * lib/news-photos.mjs — Haber/gazete için GERÇEK Kalkan foto grounding
 *
 * SORUN: Haber görselleri generic Unsplash stok fotosuydu (kategoriye göre HEP aynı URL),
 * başlıkla alakasız; ayrıca haber fotosu boşsa RESTORAN fotosuna düşürülüyordu (foto-başlık
 * uyumsuzluğu). Berkay: "kullanılan fotoğraflar haber başlığı ile alakalı olmuyor".
 *
 * ÇÖZÜM: assets/img altındaki KENDİ gerçek Kalkan fotolarımızdan (Kaputaş, Patara, plajlar,
 * Kalkan panoraması, marina...) yer-farkında + kategori-temelli + story-hash rotasyonlu seçim.
 *   - Metinde geçen yer adı varsa (Patara/Kaputaş/plaj adı) O yerin gerçek fotosu.
 *   - Yoksa kategori havuzundan, story id hash'iyle deterministik (aynı haber → aynı foto,
 *     farklı haber → farklı foto). Böylece hem alakalı hem her gün aynı değil.
 *
 * Tek kaynak: news-aggregator.mjs, gazete-editorial.mjs, sources.mjs hepsi buradan çeker.
 */

const BASE = 'https://kalkaninfo.com/assets/img';
const P = (f) => `${BASE}/${f}`;

// ── Yer-farkında eşleşme (regex → gerçek foto). En spesifik önce. ──
const PLACE_PHOTOS = [
  [/\bpatara\b/i,                 P('patara-wm.jpg')],
  [/\bkaputaş\b|\bkaputas\b/i,    P('kaputas-wm.jpg')],
  [/\bbüyük ?çakıl\b|\bbuyuk ?cakil\b/i, P('buyuk-cakil-real.jpg')],
  [/\bküçük ?çakıl\b|\bkucuk ?cakil\b/i, P('kucuk-cakil-real.jpg')],
  [/\bincirli\b/i,                P('incirli-real.jpg')],
  [/\byalı\b|\byali beach\b/i,    P('yali-beach-real.jpg')],
  [/\blikya\b/i,                  P('likya-beach-real.jpg')],
  [/\bindigo\b/i,                 P('indigo-beach-real.jpg')],
  [/\bliman ?ağzı\b|\blimanagzi\b/i, P('limanagzi-real.jpg')],
  [/\bkalamar\b/i,                P('kalamar-real.jpg')],
  [/\bhidayet\b/i,                P('hidayet-koyu-real.jpg')],
  [/\bakçagerme\b|\bakcagerme\b/i, P('akcagerme-real.jpg')],
];

// ── Kategori havuzları (hepsi GERÇEK Kalkan fotoları) ──
const CATEGORY_POOLS = {
  Plaj:     ['kaputas-wm.jpg', 'buyuk-cakil-real.jpg', 'kucuk-cakil-real.jpg', 'incirli-real.jpg', 'yali-beach-real.jpg', 'likya-beach-real.jpg', 'indigo-beach-real.jpg', 'limanagzi-real.jpg'].map(P),
  Kültür:   ['patara-wm.jpg', 'panorama-kalkan.jpg'].map(P),
  Turizm:   ['panorama-kalkan.jpg', 'seaport-kalkan.jpg', 'villa-seascape.webp', 'kalamar-beach-club-real.jpg'].map(P),
  Hava:     ['kaputas-wm.jpg', 'panorama-kalkan.jpg', 'seaport-kalkan.jpg'].map(P),
  Etkinlik: ['seaport-kalkan.jpg', 'panorama-kalkan.jpg'].map(P),
  Belediye: ['panorama-kalkan.jpg', 'seaport-kalkan.jpg'].map(P),
  Gündem:   ['panorama-kalkan.jpg', 'seaport-kalkan.jpg'].map(P),
  Restoran: ['kalamar-beach-club-real.jpg', 'panorama-kalkan.jpg'].map(P),
  İşletme:  ['kalamar-beach-club-real.jpg', 'panorama-kalkan.jpg', 'seaport-kalkan.jpg'].map(P),
  Asayiş:   ['panorama-kalkan.jpg', 'seaport-kalkan.jpg'].map(P),
};
const DEFAULT_POOL = ['panorama-kalkan.jpg', 'seaport-kalkan.jpg', 'kaputas-wm.jpg'].map(P);

// Basit deterministik string hash (aynı story → aynı foto; farklı story → farklı).
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

/**
 * Generic/stok foto mu? (grounded gerçek fotoya değiştirilmeli)
 * unsplash / boş / placehold / vektör grafik / logo / banner / varsayılan site grafiği → true.
 * Dosya adı veya URL yolunda bu kalıplar geçen görseller haberin gerçek fotosu değil,
 * kaynağın site grafiğidir (vektor, logo, placeholder, default, banner, avatar, duyuru-img vb.)
 */
export function isGenericStock(url) {
  if (!url) return true;
  if (/images\.unsplash\.com|source\.unsplash|placehold\.co|placeholder/i.test(url)) return true;
  // Kaynak sitenin vektör/logo/banner/varsayılan grafiklerini reddet (dosya adı / URL segmenti).
  // Örn: antalya-vektor.jpg, duyuru-img.png, logo.png, default-haber.jpg, banner-xxx.jpg
  const path = url.split('?')[0]; // query string'i çıkar
  return /[\/\-_](vektor|vector|logo|placeholder|default|banner|avatar|duyuru[-_]img|generic|icon|sprite|thumbnail[-_]default)/i.test(path)
    || /vektor\.jpg|vector\.jpg|vektor\.png|vector\.png/i.test(path);
}

/**
 * Bir haber öğesi için GERÇEK Kalkan fotosu seç.
 * @param {object} item  { id?, title?, category?, matchText?, summary? }
 * @returns {string} absolute foto URL'i
 */
export function pickNewsPhoto(item = {}) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.matchText || ''}`;
  // 1) Yer-farkında: metinde spesifik yer geçiyorsa o yerin gerçek fotosu.
  for (const [rx, url] of PLACE_PHOTOS) if (rx.test(text)) return url;
  // 2) Kategori havuzu + story-hash rotasyonu (aynı haber sabit, farklı haber farklı).
  const pool = CATEGORY_POOLS[item.category] || DEFAULT_POOL;
  const key = String(item.id || item.title || text || 'x');
  return pool[hashStr(key) % pool.length];
}

/**
 * Mevcut foto varsa ve grounded ise onu koru; değilse gerçek Kalkan fotosuna düş.
 */
export function groundPhoto(currentUrl, item = {}) {
  return (currentUrl && !isGenericStock(currentUrl)) ? currentUrl : pickNewsPhoto(item);
}
