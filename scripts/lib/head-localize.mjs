/**
 * scripts/lib/head-localize.mjs — build-zamanı <head> yerelleştirme yardımcıları
 * ------------------------------------------------------------------------------
 * Statik dil sayfaları (/en/ /de/ /ru/ /fr/) için: title/description/OG/canonical/
 * hreflang/og:locale/<html lang> alanlarını hedef dile göre yeniden yazar.
 *
 * Kaynak dil TR; hedefler en/de/ru/fr. hreflang HER ZAMAN 5 gerçek URL + x-default.
 * kalkaninfo.com yapısı: TR kökte (/restoranlar.html), diller alt klasörde
 * (/en/restoranlar.html). x-default = TR.
 */

export const SITE = 'https://kalkaninfo.com';
export const ALL_LANGS = ['tr', 'en', 'de', 'ru', 'fr'];
export const OG_LOCALE = { tr: 'tr_TR', en: 'en_GB', de: 'de_DE', ru: 'ru_RU', fr: 'fr_FR' };

/**
 * Bir kaynak sayfa yolundan (repo köküne göre, ör. "restoranlar.html" veya
 * "restoran/kaptan-restaurant/index.html") verilen dil için mutlak URL üretir.
 * TR → kökte; diğer diller → /{lang}/ prefix.
 */
export function urlFor(relPath, lang) {
  let clean = String(relPath).replace(/\\/g, '/').replace(/^\.?\//, '');
  clean = clean.replace(/index\.html$/, '').replace(/\.html$/, ''); // temiz URL (Vercel cleanUrls)
  return lang === 'tr' ? `${SITE}/${clean}` : `${SITE}/${lang}/${clean}`;
}

/** 5-dil hreflang <link> seti + x-default (TR). */
export function hreflangBlock(relPath) {
  const links = ALL_LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(relPath, l)}">`
  );
  links.push(`<link rel="alternate" hreflang="x-default" href="${urlFor(relPath, 'tr')}">`);
  return links.join('\n');
}

/**
 * cheerio $ üzerinde <head>'i hedef dile göre yerelleştirir.
 * @param {import('cheerio').CheerioAPI} $
 * @param {object} o
 * @param {string} o.lang            hedef dil (en/de/ru/fr)
 * @param {string} o.relPath         repo köküne göre kaynak yol
 * @param {string} [o.title]         çevrilmiş title (verilmezse mevcut korunur)
 * @param {string} [o.description]   çevrilmiş meta description
 * @param {string} [o.keywords]      çevrilmiş keywords
 */
export function localizeHead($, { lang, relPath, title, description, keywords }) {
  // <html lang>
  $('html').attr('lang', lang);

  // <title>
  if (title) $('title').first().text(title);

  // meta description / keywords
  if (description) $('meta[name="description"]').attr('content', description);
  if (keywords) $('meta[name="keywords"]').attr('content', keywords);

  // OG / Twitter başlık & açıklama
  if (title) {
    $('meta[property="og:title"]').attr('content', title);
    $('meta[name="twitter:title"]').attr('content', title);
  }
  if (description) {
    $('meta[property="og:description"]').attr('content', description);
    $('meta[name="twitter:description"]').attr('content', description);
  }

  // canonical → bu dilin URL'i
  const canonical = urlFor(relPath, lang);
  if ($('link[rel="canonical"]').length) $('link[rel="canonical"]').attr('href', canonical);
  else $('head').append(`\n<link rel="canonical" href="${canonical}">`);
  $('meta[property="og:url"]').attr('content', canonical);

  // og:locale + alternate'ler
  $('meta[property="og:locale"]').attr('content', OG_LOCALE[lang] || 'tr_TR');
  $('meta[property="og:locale:alternate"]').remove();
  ALL_LANGS.filter((l) => l !== lang).forEach((l) => {
    $('meta[property="og:locale"]').last().after(
      `\n<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`
    );
  });

  // hreflang bloğu — mevcut tüm alternate'leri sil, temiz 5+xdefault yaz
  $('link[rel="alternate"][hreflang]').remove();
  const canonicalEl = $('link[rel="canonical"]').first();
  if (canonicalEl.length) canonicalEl.after('\n' + hreflangBlock(relPath));
  else $('head').append('\n' + hreflangBlock(relPath));
}
