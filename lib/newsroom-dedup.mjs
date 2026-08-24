/**
 * lib/newsroom-dedup.mjs — Kaynaklar-arası NEAR-DUP haber çökertme (G3)
 * ---------------------------------------------------------------------
 * Sorun: news-aggregator birebir normalize BAŞLIK ile dedup yapıyor. Aynı hikaye farklı
 * başlıkla 3 kaynaktan gelince ("villa turizmi zirvede" / "villa turizmi temmuzda zirve" /
 * "kalkan'da villa talebi patladı") üçü de hayatta kalıp gazeteye tekrar olarak sızıyor.
 * Token-set Jaccard benzerliği ile aynı hikayeyi TEK'e indiririz (sıralı listede en üstteki
 * = en yüksek alaka tutulur). gazete-editorial.mjs'deki near-dup mantığının merkezî sürümü.
 */

const STOP = new Set(['ve', 'ile', 'da', 'de', 'ta', 'te', 'bir', 'bu', 'icin', 'için', 'olan', 'oldu', 'yeni', 'son', 'en', 'the', 'a', 'of', 'in', 'on']);

/** Başlığı anlamlı token kümesine indir (küçük harf, noktalama at, stop-word/2-harf ele). */
export function tokenSet(title) {
  return new Set(String(title || '').toLocaleLowerCase('tr')
    .replace(/[^a-zçğıöşü0-9\s]/gi, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w)));
}

/** İki token kümesi arası Jaccard benzerliği (0..1). */
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Near-duplicate haberleri çökert. Girdi SIRALI ise (en alakalı önce) ilk gören tutulur.
 * @param {Array} items  haber objeleri (title alanı okunur; headline de kabul)
 * @param {{threshold?:number, scoreFn?:(it)=>number, titleKey?:string}} opts
 *   threshold  {0.5}   bu benzerlik ve üstü → aynı hikaye
 *   scoreFn    verilirse önce buna göre azalan sıralanır (yüksek skorlu tutulur)
 *   titleKey   {'title'} başlık alan adı
 * @returns {Array} tekilleştirilmiş liste (girdi sırası korunur)
 */
export function dedupeNews(items, { threshold = 0.5, scoreFn = null, titleKey = 'title' } = {}) {
  const list = Array.isArray(items) ? items : [];
  const ordered = scoreFn
    ? list.map((it, i) => ({ it, i, s: scoreFn(it) })).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.it)
    : list;
  const kept = [];
  const sigs = [];
  for (const it of ordered) {
    const sig = tokenSet(it[titleKey] ?? it.title ?? it.headline ?? '');
    if (sig.size && sigs.some(s => jaccard(sig, s) >= threshold)) continue; // aynı hikaye — atla
    kept.push(it); sigs.push(sig);
  }
  return kept;
}

export default { tokenSet, jaccard, dedupeNews };
