/**
 * lib/llm-router.mjs — Göreve göre model YÖNLENDİRME (G4)
 * -------------------------------------------------------
 * cheap-llm.mjs FAILOVER yapar (ucuzdan başla, patlarsa yukarı tırman). Bu iyi ama KRİTİK
 * işlerde yanlış: manşet / fact-check / kalite-eleştirmeni ucuz 8B modelle başlamamalı —
 * "ucuz içeriği ucuz model onaylamasın" ilkesi. Bu router göreve göre DOĞRU sağlayıcı sırasını
 * verir; cheap-llm'in üstünde ince bir katman (onu değiştirmez, sadece order seçer).
 *
 * Öncelik: env override (LLM_ROUTE_<GÖREV>) > görev profili > cheap varsayılan.
 *   ör. LLM_ROUTE_CRITIC=groq,cerebras  → critic için CI'da ucuz zorla (mevcut CRITIC_LLM_ORDER gibi)
 */

// Ucuz-öncelikli (angarya): özet, çeviri, sınıflandırma, caption, taslak.
const CHEAP = ['ollama', 'groq', 'cerebras', 'nvidia', 'gemini', 'claude'];
// Kalite-öncelikli (güçlü hakem/yazar önce): eleştirmen, fact-check, manşet.
const STRONG = ['claude', 'gemini', 'routellm', 'groq', 'cerebras', 'nvidia'];
// Akıllı-yönlendirme önce (zoru güçlüye, kolayı ucuza): manşet gibi değişken zorluk.
const SMART = ['claude', 'routellm', 'gemini', 'groq', 'cerebras', 'nvidia'];

export const TASK_PROFILES = {
  // angarya → ucuz
  summary: CHEAP, translate: CHEAP, classify: CHEAP, caption: CHEAP, draft: CHEAP, cheap: CHEAP,
  // kritik → güçlü
  critic: STRONG, judge: STRONG, factcheck: STRONG, verify: STRONG,
  // değişken zorluk → akıllı
  headline: SMART, editorial: SMART,
};

/**
 * Görev için sağlayıcı sırası (dizi). env `LLM_ROUTE_<GÖREV>` her zaman kazanır.
 * @param {string} task  profil anahtarı (bilinmeyen → cheap)
 * @returns {string[]}
 */
export function routeOrder(task = 'cheap') {
  const key = String(task || 'cheap').toLowerCase();
  const envRaw = process.env[`LLM_ROUTE_${key.toUpperCase()}`];
  if (envRaw) return envRaw.split(',').map(s => s.trim()).filter(Boolean);
  return TASK_PROFILES[key] || CHEAP;
}

/**
 * Göreve uygun sırayla cheap-llm çağır. cheap-llm'i dinamik import eder (döngü/ROOT sorunları yok).
 * @param {string|Array} prompt
 * @param {{task?:string, system?, json?, maxTokens?, temperature?, timeoutMs?}} opts
 * @returns {Promise<{text, provider, model}>}
 */
export async function routedLLM(prompt, { task = 'cheap', ...rest } = {}) {
  const { cheapLLM } = await import('./cheap-llm.mjs');
  return cheapLLM(prompt, { ...rest, order: routeOrder(task) });
}

export default { TASK_PROFILES, routeOrder, routedLLM };
