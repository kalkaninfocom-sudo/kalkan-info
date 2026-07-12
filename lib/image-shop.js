// lib/image-shop.mjs
// ajansAI Photo-Shop motoru (bellekte, Vercel-uyumlu — disk YOK).
// Gemini (nano-banana) ile telefon fotosunu yayına-hazır hale getirir.
// telegram-webhook.js foto dalı bunu kullanır.

import { createHash } from 'node:crypto';

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'; // nano-banana
const API = k => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${k}`;

export const RECIPES = {
  enhance:  'Enhance this photo for a restaurant menu/social post: improve lighting and color balance, increase sharpness and appetizing warmth, keep it photorealistic and true to the original. Do not add or remove objects.',
  removebg: 'Remove the background cleanly and replace it with a soft neutral studio background suitable for a product shot. Keep the subject crisp with natural edges.',
  relight:  'Relight this photo with warm golden-hour lighting. Fix underexposure and harsh shadows, make it inviting. Keep it photorealistic and faithful to the real scene.',
  menu:     'Turn this phone photo into a clean, appetizing menu-ready dish photo: better lighting, subtle background blur, vivid but realistic colors, remove clutter. No fake ingredients.',
  social:   'Make this photo pop for Instagram: punchy but natural colors, balanced exposure, slight cinematic contrast. Keep it authentic, no heavy filters.',
};

export function pickRecipe(caption) {
  const t = (caption || '').toLowerCase();
  for (const k of Object.keys(RECIPES)) if (t.includes(k)) return k;
  if (/arka ?plan|background|kes/.test(t)) return 'removebg';
  if (/ışık|isik|aydınlat|light/.test(t)) return 'relight';
  if (/menü|menu|yemek/.test(t)) return 'menu';
  return 'menu'; // varsayılan
}

/**
 * shopImage — görsel buffer'ı düzenler, yeni buffer + provenance döndürür. Diske YAZMAZ.
 * @returns {Promise<{outBuffer:Buffer, mimeType:string, provenance:object}>}
 */
export async function shopImage({ buffer, mimeType = 'image/jpeg', recipe, prompt, apiKey }) {
  const key = apiKey || process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY yok (Vercel env).');
  const finalPrompt = prompt || RECIPES[recipe] || RECIPES.menu;
  const inHash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);

  const body = {
    contents: [{ parts: [
      { text: finalPrompt },
      { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
    ] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const res = await fetch(API(key), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(28000),
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  const b64 = imgPart && (imgPart.inlineData?.data || imgPart.inline_data?.data);
  if (!b64) throw new Error('Yanıtta görsel yok.');

  const outBuffer = Buffer.from(b64, 'base64');
  const outHash = createHash('sha256').update(outBuffer).digest('hex').slice(0, 16);
  const provenance = {
    engine: MODEL, recipe: recipe || null,
    inputSha: inHash, outputSha: outHash,
    bytesIn: buffer.length, bytesOut: outBuffer.length,
    ts: new Date().toISOString(),
  };
  return { outBuffer, mimeType: 'image/png', provenance };
}
