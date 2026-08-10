// lib/site-edit-intent.mjs
// Telegram serbest metnini "site düzenleme niyeti" olarak sınıflandırır + yapılandırılmış aksiyon çıkarır.
// Sadece AÇIK düzenleme komutlarında tetiklenir (ekle/değiştir/sil). Değilse null → normal ajan sohbeti.
import { cheapJSON } from './cheap-llm.mjs';

const HAVUZ_CATS = 'catering|havuz|temizlik|bahce|transfer-havalimani'; // hizmet-saglayicilari kategorileri

const SYSTEM =
  'Sen Kalkan Info site yönetim asistanısın. Kullanıcının mesajının siteye bir DÜZENLEME komutu olup olmadığını belirle. ' +
  'SADECE geçerli JSON dön. Uydurma yapma — sadece mesajda AÇIKÇA verilen alanları doldur, olmayanı boş bırak.\n' +
  'Aksiyon tipleri:\n' +
  '- addEvent: etkinlik/konser/program ekle. alanlar: title, date (YYYY-MM-DD), time (HH:MM|""), venueName, area, type\n' +
  `- addProvider: hizmet sağlayıcı ekle. alanlar: category (${HAVUZ_CATS} içinden), name, phone, type, summary\n` +
  'Mesaj bir düzenleme DEĞİLSE (soru, sohbet, bilgi isteği): {"isEdit":false}\n' +
  'Düzenlemeyse: {"isEdit":true, "action":{"type":"addEvent|addProvider", ...alanlar}}\n' +
  'Tarihi bugüne göre çöz (ör. "yarın"). Bugün gerekiyorsa kullanıcı vermeli — yoksa date boş bırak.';

const EDIT_HINT = /\b(ekle|eklermisin|ekler misin|güncelle|değiştir|degistir|sil|kaldır|kaldir|düzelt|duzelt|fiyat|telefon|numar|etkinlik ekle|konser|sağlayıcı|saglayici|usta ekle|add|update|change|remove)\b/i;

/**
 * @returns {Promise<null | {type, ...fields}>}  aksiyon veya null (düzenleme değil)
 */
export async function detectSiteEdit(text, { today } = {}) {
  if (!text || text.length < 6) return null;
  if (!EDIT_HINT.test(text)) return null;              // ucuz ön-eleme: düzenleme sinyali yoksa hiç LLM'e gitme
  try {
    const { data } = await cheapJSON(
      `Bugün: ${today || new Date().toISOString().slice(0, 10)}\nMesaj: ${text.slice(0, 500)}`,
      { system: SYSTEM, order: ['groq', 'cerebras', 'nvidia'], temperature: 0.1, maxTokens: 240 }
    );
    if (!data || !data.isEdit || !data.action || !data.action.type) return null;
    return data.action;
  } catch { return null; }
}
