// scripts/scrapers/kasbel.mjs
// Kaş Belediyesi (resmi) haber + duyuru scraper.
// Kalkan, Kaş ilçesine bağlı bir belde olduğundan bu kaynak EN yüksek yerel-alaka taşır:
// meclis kararları, festival/etkinlik duyuruları, altyapı, sahil/deniz uyarıları.
//
// Sayfalar (RSS yok, HTML scrape):
//   - https://www.kas.bel.tr/AnaSayfa/Haberler   (kart: <img class="card-img-top" alt=BAŞLIK> + /haber/ linki)
//   - https://www.kas.bel.tr/AnaSayfa/Duyurular  (<a href="/duyuru/">BAŞLIK</a> + <i class="fa fa-calendar"> TARİH)
//
// Çıktı: news-aggregator.parseRss ile AYNI item şeması
//   { _source, _sourceHome, title, link, pubDate, summary, content, image, _matchText }

const TR_MONTHS = {
  ocak: 1, 'şubat': 2, subat: 2, mart: 3, nisan: 4, 'mayıs': 5, mayis: 5,
  haziran: 6, temmuz: 7, 'ağustos': 8, agustos: 8, 'eylül': 9, eylul: 9,
  ekim: 10, 'kasım': 11, kasim: 11, 'aralık': 12, aralik: 12,
};

function decode(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

// "19 Haziran 2026" → "2026-06-19" (tanınmazsa '' → aggregator bugüne düşer)
function trDate(s) {
  if (!s) return '';
  const m = decode(s).toLowerCase().match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/i);
  if (!m) return '';
  const mo = TR_MONTHS[m[2]];
  if (!mo) return '';
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}

// HTML attribute'lerindeki entity'leri çöz (URL için — boşluk sıkıştırma YOK).
// kas.bel.tr href'leri ü/ş gibi harfleri &#252; olarak kodlar; çözülmezse URL 400 döner.
function decodeUrl(u) {
  if (!u) return '';
  return u
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function absUrl(home, u) {
  const clean = decodeUrl(u);
  if (!clean) return '';
  return clean.startsWith('http') ? clean : home + clean;
}

// Tek fonksiyon iki sayfa tipini de işler (bir sayfa yalnız kendi kalıbıyla eşleşir).
export function parseKasBel(html, source) {
  const home = source.sourceHome || 'https://www.kas.bel.tr';
  const items = [];
  const seen = new Set();

  const push = (title, link, image, pubDate) => {
    const t = decode(title);
    if (!t || t.length < 8) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      _source: source.name,
      _sourceHome: home,
      title: t,
      link: absUrl(home, link),
      pubDate,
      summary: t,
      content: t,
      image: /^https?:/.test(image || '') || (image || '').startsWith('/') ? absUrl(home, image) : '',
      _matchText: `${t} kaş belediye`,
    });
  };

  // 1) Haber kartları — img alt tam başlığı verir (anchor metni "..." ile kesik)
  const RX_HABER = /<img\s+class="card-img-top"\s+src="([^"]+)"\s+alt="([^"]+)">[\s\S]{0,600}?<a\s+href="(\/haber\/[^"]+)"/gi;
  let m;
  while ((m = RX_HABER.exec(html)) !== null) {
    push(m[2], m[3], m[1], '');
    if (items.length >= 25) break;
  }

  // 2) Duyurular — <a href="/duyuru/">BAŞLIK</a> ... <i class="fa fa-calendar"></i> TARİH
  const RX_DUYURU = /<a[^>]*href="(\/duyuru\/[^"]+)"[^>]*>([^<]+)<\/a>\s*<\/p>\s*<p[^>]*>\s*<i\s+class="fa fa-calendar"><\/i>&nbsp;([^<]+)</gi;
  while ((m = RX_DUYURU.exec(html)) !== null) {
    push(m[2], m[1], '/assets/images/duyuru-img.png', trDate(m[3]));
    if (items.length >= 50) break;
  }

  return items;
}
