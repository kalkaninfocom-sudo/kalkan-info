/**
 * lib/news-score.mjs — Kalkan-yerel haber skorlaması (TEK DOĞRULUK KAYNAĞI)
 * ---------------------------------------------------------------------------
 * Önceden bu mantık İKİ yerde kopyaydı ve zaten sürüklenmişti:
 *   - newspaper/generator/sources.mjs  → newsScore (srcPenalty -5, tags+featured, 'kutso' dahil)
 *   - scripts/agency/gazete-editorial.mjs → score (srcPenalty -4, tags/featured yok, 'kutso' YOK)
 * Yer adı listesini tek yerde tutmak asıl kazanç: yeni bir mahalle/mevki eklenince
 * iki dosyada ayrı ayrı güncelleme derdi biter (drift → yanlış manşet riski).
 *
 * Politika (Berkay): tatilci gazetesi → Kalkan/Kaş/Patara ekseni güçlü, salt-Antalya bastırılır.
 * Davranış her iki çağrı yerinde de opts ile BİRE BİR korunur (bilinçli tek fark: editorial artık
 * 'kutso'yu da çekirdek sayar — Kaş Ticaret Odası yereldir, bu bir düzeltmedir).
 */

// ÇEKİRDEK yer adları (Kalkan/Kaş/Patara ekseni). 'antalya' KASITLI yok — il-geneli haber
// çekirdek yer geçmiyorsa ön sayfayı basmasın.
export const CORE_RX = [
  /\bkalkan\b/i, /\bkaş\b/i, /\bpatara\b/i, /\bkaputaş\b/i, /\bletoon\b/i,
  /\bksanthos\b/i, /\bxanthos\b/i, /\blik[iy]a\b/i, /\bsaklıkent\b/i,
  /\bislamlar\b/i, /\bbezirgan\b/i, /\bçukurbağ\b/i, /\bkalamar\b/i, /\bkutso\b/i, /\bdemre\b/i,
];

// Tatilci kategori ağırlıkları.
export const TOURIST_CATS = { Turizm: 2, Plaj: 2, Etkinlik: 2, Kültür: 2, Belediye: 0, Gündem: 0, Hava: 1, Asayiş: -3 };
export const CATS = TOURIST_CATS; // alias (geriye dönük isim)

/**
 * Kalkan-yerel haber skoru.
 * @param {object} it  haber item { title, summary, tags?, source, category, featured? }
 * @param {object} opts
 *   useTags       {boolean=true}  başlık/özet yanında tags'ı da metne kat (sources davranışı)
 *   featuredBonus {boolean=true}  it.featured ise +1 (sources davranışı)
 *   srcPenalty    {number=-5}     yerel/bölgesel olmayan kaynak cezası (sources -5, editorial -4)
 */
export function newsScore(it, { useTags = true, featuredBonus = true, srcPenalty = -5 } = {}) {
  const txt = `${it.title || ''} ${it.summary || ''}${useTags ? ' ' + ((it.tags || []).join(' ')) : ''}`;
  let s = 0;
  const hasCore = CORE_RX.some(rx => rx.test(txt));
  if (hasCore) s += 3;                        // Kalkan/Kaş/Patara ekseni → güçlü
  else if (/\bantalya\b/i.test(txt)) s -= 4;  // yalnız Antalya (çekirdek yok) → tatilci gazetesine girmesin
  if (/\bkalkan\b/i.test(txt)) s += 2;        // Kalkan'ın kendisi ekstra
  // Kaynak güveni: yerel > bölgesel > ulusal
  const src = it.source || '';
  if (/kalkan/i.test(src)) s += 3;
  else if (/körfez|antalya/i.test(src)) s += 1;
  else s += srcPenalty;                       // Anadolu Ajansı vb. ulusal/dünya
  s += TOURIST_CATS[it.category] ?? 0;
  if (featuredBonus && it.featured) s += 1;
  return s;
}

export default { CORE_RX, TOURIST_CATS, CATS, newsScore };
