/**
 * cheap-llm.mjs — Ucuz/ücretsiz LLM yönlendirici (token tasarrufu)
 *
 * Amaç: Basit "angarya" işleri (etkinlik çıkarımı, caption, haber özeti, çeviri,
 * sınıflandırma, taslak üretimi) ÜCRETSİZ/ucuz modellere yönlendir; Claude'u
 * sadece kalite gerektiğinde ya da fallback olarak kullan. Böylece Claude token
 * maliyeti minimuma iner.
 *
 * Sağlayıcılar (öncelik sırası env CHEAP_LLM_ORDER ile değişir, varsayılan aşağıda):
 *   - ollama  : yerel, %100 ücretsiz (model çekilmiş olmalı: `ollama pull llama3.1`)
 *   - nvidia  : NVIDIA NIM ücretsiz tier (~40 RPM, OpenAI-uyumlu). Kart gerekmez.
 *               build.nvidia.com → API key (nvapi-...). env: NVIDIA_API_KEY
 *               ⚠️ Ücretsiz tier dev/test/araştırma içindir; canlı son-kullanıcı
 *               servisi (production) NVIDIA AI Enterprise ister. Angarya/batch için ideal.
 *   - gemini  : Google Gemini ücretsiz tier (cömert kota). env: GOOGLE_GEMINI_API_KEY
 *   - claude  : fallback (kaliteli). env: ANTHROPIC_API_KEY
 *
 * Hiçbir Vercel fonksiyonu GEREKMEZ — bunlar dış HTTP endpoint'leridir, script'ten
 * doğrudan çağrılır. (api/ 12/12 limiti bunları etkilemez.)
 *
 * Kullanım:
 *   import { cheapLLM } from '../lib/cheap-llm.mjs';
 *   const txt = await cheapLLM('Şu metinden etkinlik çıkar: ...', { system:'...', json:true });
 */

const ENV = (k) => process.env[k];

const PROVIDERS = {
  ollama: {
    available: () => true, // yerel; çağrı anında doğrulanır
    url: 'http://localhost:11434/v1/chat/completions',
    headers: () => ({ 'Content-Type': 'application/json' }),
    model: () => ENV('OLLAMA_MODEL') || 'llama3.1',
    openai: true,
  },
  nvidia: {
    available: () => !!ENV('NVIDIA_API_KEY'),
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    headers: () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${ENV('NVIDIA_API_KEY')}` }),
    model: () => ENV('NVIDIA_MODEL') || 'meta/llama-3.3-70b-instruct',
    openai: true,
  },
  // Cerebras — ücretsiz, KART YOK, çok hızlı. Hesap model seti değişebilir (/v1/models ile doğrula).
  // 2026-07: erişilebilir modeller gemma-4-31b, gpt-oss-120b, zai-glm-4.7.
  // NOT: gpt-oss-120b + zai-glm-4.7 reasoning; json_object modunda content BOŞ döner → gemma-4-31b
  //      hem text hem JSON'da güvenilir (test edildi). Eski 'llama-3.3-70b' bu hesapta YOK (404).
  cerebras: {
    available: () => !!ENV('CEREBRAS_API_KEY'),
    url: 'https://api.cerebras.ai/v1/chat/completions',
    headers: () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${ENV('CEREBRAS_API_KEY')}` }),
    model: () => ENV('CEREBRAS_MODEL') || 'gemma-4-31b',
    openai: true,
  },
  // Groq — ücretsiz, KART YOK, hızlı LPU (Llama 3.3 70B).
  groq: {
    available: () => !!ENV('GROQ_API_KEY'),
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${ENV('GROQ_API_KEY')}` }),
    model: () => ENV('GROQ_MODEL') || 'llama-3.3-70b-versatile',
    openai: true,
  },
  // Abacus.AI RouteLLM — AKILLI YÖNLENDİRME: kolay istek→ucuz model, zor istek→güçlü model (GPT/Claude/Gemini).
  // OpenAI-uyumlu tek endpoint. Kalite tavanını açar (ücretsiz zayıf modellerin ötesi). Maliyet: Abacus kredisi.
  // env: ROUTELLM_API_KEY (veya ABACUS_API_KEY). model 'route-llm' = otomatik en iyi model seçimi.
  routellm: {
    available: () => !!(ENV('ROUTELLM_API_KEY') || ENV('ABACUS_API_KEY')),
    url: 'https://routellm.abacus.ai/v1/chat/completions',
    headers: () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${ENV('ROUTELLM_API_KEY') || ENV('ABACUS_API_KEY')}` }),
    model: () => ENV('ROUTELLM_MODEL') || 'route-llm',
    openai: true,
  },
  gemini: {
    available: () => !!ENV('GOOGLE_GEMINI_API_KEY'),
    custom: 'gemini',
    model: () => ENV('GEMINI_MODEL') || 'gemini-2.0-flash',
  },
  claude: {
    available: () => !!ENV('ANTHROPIC_API_KEY'),
    custom: 'claude',
    model: () => ENV('CLAUDE_CHEAP_MODEL') || 'claude-haiku-4-5',
  },
};

function order() {
  const raw = ENV('CHEAP_LLM_ORDER');
  if (raw) return raw.split(',').map(s => s.trim()).filter(Boolean);
  return ['ollama', 'groq', 'cerebras', 'nvidia', 'gemini', 'claude'];
}

async function callOpenAICompat(p, messages, opts) {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: p.headers(),
    body: JSON.stringify({
      model: p.model(),
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 700,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  // reasoning modellerinde (ör. gpt-oss-120b) content boş olabilir → reasoning_content'e düş
  return d.choices?.[0]?.message?.content || d.choices?.[0]?.message?.reasoning_content || '';
}

async function callGemini(p, messages, opts) {
  const sys = messages.find(m => m.role === 'system')?.content;
  const contents = messages.filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${p.model()}:generateContent?key=${ENV('GOOGLE_GEMINI_API_KEY')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
      generationConfig: { temperature: opts.temperature ?? 0.4, maxOutputTokens: opts.maxTokens ?? 700,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '';
}

async function callClaude(p, messages, opts) {
  const sys = messages.find(m => m.role === 'system')?.content;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ENV('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: p.model(), max_tokens: opts.maxTokens ?? 700,
      ...(sys ? { system: sys } : {}),
      messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  return d.content?.map(b => b.text).join('') ?? '';
}

/**
 * Angarya işi ucuz/ücretsiz modele yönlendir. İlk çalışan sağlayıcıyı kullanır.
 * @param {string|Array} prompt  Düz metin ya da [{role,content}] mesaj dizisi
 * @param {object} opts { system, json, maxTokens, temperature, only, verbose }
 * @returns {Promise<{text, provider, model}>}
 */
export async function cheapLLM(prompt, opts = {}) {
  const messages = typeof prompt === 'string'
    ? [...(opts.system ? [{ role: 'system', content: opts.system }] : []), { role: 'user', content: prompt }]
    : prompt;

  // opts.only: tek sağlayıcı zorla · opts.order: per-call sıra (ör. kaliteli caption → ollama'yı atla)
  const seq = opts.only ? [opts.only] : (Array.isArray(opts.order) && opts.order.length ? opts.order : order());
  const errors = [];
  for (const name of seq) {
    const p = PROVIDERS[name];
    if (!p || !p.available()) { errors.push(`${name}: yok/keysiz`); continue; }
    try {
      let text;
      if (p.openai) text = await callOpenAICompat(p, messages, opts);
      else if (p.custom === 'gemini') text = await callGemini(p, messages, opts);
      else if (p.custom === 'claude') text = await callClaude(p, messages, opts);
      if (text && text.trim()) {
        if (opts.verbose) console.error(`[cheap-llm] ✓ ${name} (${p.model()})`);
        return { text: text.trim(), provider: name, model: p.model() };
      }
      errors.push(`${name}: boş yanıt`);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
      if (opts.verbose) console.error(`[cheap-llm] ✗ ${name}: ${e.message}`);
    }
  }
  throw new Error(`Tüm sağlayıcılar başarısız → ${errors.join(' | ')}`);
}

/** JSON döndüren angarya işleri için kısayol (parse + tek retry). */
export async function cheapJSON(prompt, opts = {}) {
  const { text, provider, model } = await cheapLLM(prompt, { ...opts, json: true });
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return { data: JSON.parse(m ? m[0] : text), provider, model };
  } catch {
    throw new Error(`cheapJSON parse hatası (${provider}): ${text.slice(0, 120)}`);
  }
}

export function availableProviders() {
  return Object.entries(PROVIDERS).filter(([, p]) => p.available()).map(([k]) => k);
}

// CLI smoke test: node lib/cheap-llm.mjs "merhaba de"
if (process.argv[1]?.endsWith('cheap-llm.mjs')) {
  const q = process.argv[2] || 'Tek kelimeyle: Kalkan nerede?';
  console.error('Mevcut sağlayıcılar:', availableProviders().join(', ') || '(hiçbiri — key yok)');
  try {
    const r = await cheapLLM(q, { verbose: true, maxTokens: 50 });
    console.log(`\n[${r.provider}/${r.model}] ${r.text}`);
  } catch (e) { console.error('HATA:', e.message); }
}
