/**
 * lib/reklam-uyum.mjs — Ticari Reklam Yönetmeliği (yür. 1 Ağustos 2026) içerik uyum kütüphanesi
 * ------------------------------------------------------------------------------------------
 * Politika: docs/ICERIK_UYUM_REKLAM_YONETMELIGI.md
 * Tek doğruluk kaynağı: AI şeffaflık ibaresi + yönetmelik ihlal tarayıcısı + hedefli reklam notu.
 * Üreticiler ve kritik kapıları bunu kullanır (elle kural kopyalama YOK).
 *
 *   import { withAiDisclosure, scanReklamUyum, hedefliReklamNotu, AI_IBARESI_TR } from '../../lib/reklam-uyum.mjs';
 */

// ── Madde 1: Yapay zeka kullanımı açıkça belirtilmeli ───────────────────────────
export const AI_IBARESI_TR = '🤖 Bu içerik yapay zeka yardımıyla üretilmiştir.';
export const AI_IBARESI_EN = '🤖 This content was created with the help of AI.';
export const AI_HASHTAGS = ['#yapayzeka'];

const HAS_AI_MENTION = /yapay\s*zek[âa]|#yapayzeka|\byapayzeka\b|\bA\.?I\.?\b|üretken zeka/i;

/**
 * AI ile üretilmiş içeriğin caption'ına şeffaflık ibaresini + #yapayzeka ekler (yoksa).
 * @param {string} caption
 * @param {{hashtags?:string[], lang?:'tr'|'en', isAI?:boolean}} opts
 * @returns {{caption:string, hashtags:string[]}}
 */
export function withAiDisclosure(caption, { hashtags = [], lang = 'tr', isAI = true } = {}) {
  if (!isAI) return { caption: caption || '', hashtags: [...(hashtags || [])] };
  const line = lang === 'en' ? AI_IBARESI_EN : AI_IBARESI_TR;
  let cap = String(caption || '');
  if (!HAS_AI_MENTION.test(cap)) cap = cap.replace(/\s+$/, '') + '\n\n' + line;
  const tags = [...new Set([...(hashtags || []), ...AI_HASHTAGS])];
  return { caption: cap, hashtags: tags };
}

/**
 * Madde 3: Kişisel-veriyle hedeflenen ÜCRETLİ reklam için şeffaflık notu
 * ("bu reklamı neden görüyorsun + tercihini nasıl değiştirirsin").
 */
export function hedefliReklamNotu({ criteria = ['konum', 'ilgi alanları'], lang = 'tr' } = {}) {
  const c = criteria.join(', ');
  return lang === 'en'
    ? `ℹ️ You’re seeing this ad based on: ${c}. You can change these preferences in your ad settings.`
    : `ℹ️ Bu reklamı şu kriterlerle görüyorsunuz: ${c}. Tercihlerinizi reklam ayarlarınızdan değiştirebilirsiniz.`;
}

/**
 * Deterministik yönetmelik ihlal tarayıcısı (LLM'den bağımsız güvenlik ağı).
 * hard = yayını bloklayan (madde 2/6), soft = uyarı/etiket gerektiren (madde 5/6).
 * @param {string} text
 * @returns {{hard:string[], soft:string[], ok:boolean}}
 */
export function scanReklamUyum(text) {
  const t = String(text || '');
  const low = t.toLocaleLowerCase('tr');
  const hard = [];
  const soft = [];

  // Madde 2 & 6: Yapay zekanın/anlatıcının birinci ağızdan sahte kişisel deneyim/tavsiye izlenimi.
  if (/(bizzat|kendim|geçen\s+(gün|hafta)|dün|ben)\s+(gittim|yedim|denedim|kaldım|tattım|içtim|deneyimledim)/i.test(t) ||
      /(gittim|yedim|denedim|kaldım|tattım|deneyimledim)[^.!?]{0,50}(tavsiye ederim|bayıldım|harikaydı|çok beğendim)/i.test(t)) {
    hard.push('Madde 2/6: birinci ağızdan kişisel deneyim/tavsiye iddiası — yapay zeka gerçek deneyim izlenimi VEREMEZ (sahte endorsement yasak).');
  }

  // Madde 6: uydurulmuş "yorum — müşteri/misafir" kalıbı.
  if (/["“][^"”]{12,}["”]\s*[-–—]\s*(bir\s+)?(müşteri|misafir|ziyaretçi|turist|gezgin)/i.test(t)) {
    soft.push('Madde 6: "alıntı — müşteri" kalıbı tespit edildi; yorumun GERÇEK ve doğrulanmış olduğundan emin ol (AI uydurması yorum yasak).');
  }

  // Madde 5: kanıtsız çevresel iddia (greenwashing).
  if (/(100\s*%?\s*doğal|tamamen doğal|sıfır atık|karbon nötr|çevre dostu|eko[-\s]?dostu|sürdürülebilir|organik sertifikal)/i.test(low)) {
    soft.push('Madde 5: çevresel iddia — belgelenemiyorsa kaldır (greenwashing riski).');
  }

  // Madde 5: kanıtsız mutlak üstünlük.
  if (/(türkiye'?nin|dünyanın|bölgenin)\s+(en\b|bir\s*numara|1\s*numara)|kesinlikle en iyi|rakipsiz|tartışmasız\s+(en\s+)?/i.test(low)) {
    soft.push('Madde 5: kanıtsız mutlak/üstünlük iddiası; somut kaynak yoksa yumuşat.');
  }

  // Madde 5: indirim/fırsat — gerçek eski fiyat + koşul.
  if (/%\s?\d{1,3}\s*indirim|yar[ıi]\s*fiyat|fiyat\s*düştü|kaç[ıi]rma(y[ıi]n)?\s*f[ıi]rsat/i.test(low)) {
    soft.push('Madde 5: indirim/fırsat iddiası — gerçek önceki fiyat esas alınmalı, süre/koşul açık olmalı.');
  }

  // Madde 5: etiketlenmemiş işbirliği/sponsorluk.
  if (/(i[şs]\s*birli[ğg]i|sponsor|hediye edildi|bize g[öo]nderildi| [üu]cretsiz sa[ğg]land)/i.test(low) &&
      !/#reklam|#i[şs]birli[ğg]i|#sponsor|\breklam\b/i.test(low)) {
    soft.push('Madde 5: işbirliği/sponsor içerik #reklam veya #işbirliği etiketi taşımalı.');
  }

  return { hard, soft, ok: hard.length === 0 };
}

export default { withAiDisclosure, hedefliReklamNotu, scanReklamUyum, AI_IBARESI_TR, AI_IBARESI_EN, AI_HASHTAGS };
