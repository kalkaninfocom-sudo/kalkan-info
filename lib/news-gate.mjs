/**
 * lib/news-gate.mjs — Paylaşılan haber kapısı (IG + FB ortak)
 *
 * ig-news-harvest.mjs ve fb-pages-harvest.mjs tarafından import edilir.
 * Tek LLM çağrısında 5 karar verir:
 *   is_news, usable, scope, category, placement
 * + kendi sözcüklerimizle başlık + özet + güven skoru.
 *
 * Kullanım:
 *   import { runGate } from '../lib/news-gate.mjs';
 *   const result = await runGate(cheapLLM, { sourceName, username, category, headline, source });
 *   // result: null (başarısız) | { is_news, usable, scope, category, placement, confidence,
 *   //                             our_headline, our_summary, news_value, _provider }
 */

// placement kategorisi → hangi site bölümü
// haberler   : data/haberler.json (Gündem/Kültür/Uyarı)
// etkinlik   : data/etkinlik-takvimi.json (Etkinlik)
// restoran   : haberler.json + tag "İşletme" (restoranlar sayfası da okur)
// magazine   : haberler.json + magazine:true flag (gazete arka sayfa)
// ig-card    : sadece IG kartı üretilir, site'e yazılmaz
const GATE_SCHEMA = JSON.stringify({
  is_news: 'true|false',
  usable: 'true|false',
  scope: 'kalkan|kas|bolge|alakasiz',
  news_value: '0.0-1.0',
  confidence: '0.0-1.0 (bu karardan ne kadar eminsin)',
  category: 'Gündem|Etkinlik|İşletme|Kültür|Uyarı',
  placement: 'haberler|etkinlik|restoran|magazine|ig-card',
  our_headline: 'kendi sözcüklerimizle kısa haber başlığı (max 90 karakter)',
  our_summary: '2-3 cümle olgusal özet, kendi sözcüklerimizle, uydurma yok',
});

const PLACEMENT_RULES = `
placement kuralı (category ile uyumlu olmalı):
  Etkinlik           → "etkinlik"
  İşletme (restoran/kafe/bar/otel açılış/kapanış/değişim) → "restoran"
  Kültür + insan ilgisi yüksek → "magazine"
  Gündem + acil/uyarı          → "haberler"
  Uyarı (hava/deniz/güvenlik)  → "haberler"
  Düşük haber değeri ama görsel ilgi çekici → "ig-card"
`.trim();

/**
 * @param {Function} cheapLLM  lib/cheap-llm.mjs'den import edilmiş cheapLLM fonksiyonu
 * @param {object} item
 *   item.sourceName  — hesap/sayfa adı (görünen ad)
 *   item.username    — @kullanıcıadı veya page slug
 *   item.category    — kaynak kategorisi (Restoran, Otel, Belediye vs.)
 *   item.headline    — sinyal metni (caption özeti veya başlık)
 *   item.source      — 'ig' | 'fb'  (kaynak platform)
 * @param {object} opts
 *   opts.order       — LLM sağlayıcı sırası (dizi)
 *   opts.minValue    — minimum news_value (varsayılan 0.55)
 * @returns {object|null}
 */
export async function runGate(cheapLLM, item, opts = {}) {
  const platform = item.source === 'fb' ? 'Facebook sayfasından' : 'Instagram hesabından';
  const prompt =
    `Aşağıda bir Kalkan/Kaş bölgesi ${platform} alınan içerik sinyali var. Kalkan İnfo Haber Merkezi editörü olarak KARAR ver:\n\n` +
    `1) is_news — GERÇEK haber mi?\n` +
    `   HABER = açılış/kapanış, etkinlik/konser/festival, önemli duyuru, olay/kaza, sezon/hava/deniz uyarısı, rekor, yeni hizmet, belediye kararı.\n` +
    `   HABER DEĞİL = indirim/kampanya/"happy hour"/rezervasyon çağrısı/genel reklam/rutin paylaşım/estetik manzara fotoğrafı.\n\n` +
    `2) usable — kalkaninfo.com'da yayınlamaya UYGUN mu?\n` +
    `   UYGUN = turizm, yerel yaşam, etkinlik, işletme, gastronomi, ulaşım, kültür/tarih, hava/deniz uyarısı, belediye duyurusu.\n` +
    `   UYGUN DEĞİL = siyasi kavga, kişisel çekişme, doğrulanamayan iddia, rahatsız edici içerik, bölgeyle alakasız ulusal haber, saf reklam.\n\n` +
    `3) scope — "kalkan" | "kas" | "bolge" | "alakasiz"\n\n` +
    `4) category — "Gündem" | "Etkinlik" | "İşletme" | "Kültür" | "Uyarı"\n\n` +
    `5) placement — hangi site bölümüne gider:\n${PLACEMENT_RULES}\n\n` +
    `6) confidence — bu kararlardan ne kadar eminsin (0.0-1.0). Sinyal belirsiz/eksikse düşük yaz.\n\n` +
    `Haber VE uygun ise: olguyu KENDİ SÖZCÜKLERİMİZLE yeniden yaz (kopyalama, uydurma yok).\n\n` +
    `Hesap: ${item.sourceName} (@${item.username})\n` +
    `Kaynak kategori: ${item.category}\n` +
    `Sinyal: "${item.headline}"\n\n` +
    `SADECE şu JSON (başka açıklama ekleme): ${GATE_SCHEMA}`;

  try {
    const res = await cheapLLM(prompt, {
      system: 'Sen Kalkan Info Haber Merkezi baş editörüsün. Titiz, olgusal, reklamı haberden ayıran bir muhabirsin. Türkçe yaz.',
      json: true,
      maxTokens: 380,
      temperature: 0.2,
      order: opts.order || ['groq', 'cerebras', 'nvidia', 'gemini', 'claude'],
      timeoutMs: 45000,
    });
    let t = String(res.text || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    const j = JSON.parse(t);
    j._provider = res.provider;
    return j;
  } catch {
    return null;
  }
}

/**
 * placement alanından hedef dosya bilgisini döner.
 * basket-publish.mjs bu tabloyu okur.
 */
export const PLACEMENT_TARGETS = {
  haberler: { file: 'data/haberler.json', type: 'array-prepend' },
  etkinlik: { file: 'data/etkinlik-takvimi.json', type: 'etkinlik-append' },
  restoran: { file: 'data/haberler.json', type: 'array-prepend', extraTag: 'İşletme' },
  magazine: { file: 'data/haberler.json', type: 'array-prepend', magazineFlag: true },
  'ig-card': { file: null, type: 'ig-only' },
};
