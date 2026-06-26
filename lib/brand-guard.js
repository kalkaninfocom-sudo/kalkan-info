// lib/brand-guard.js
// Yayın öncesi son denetim. Heuristic + Haiku nüans değerlendirme.
// Çıktı: { pass, score, flags[], reasoning }

import { ask } from './anthropic.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const HARD_BLOCK = [
  /inanmayacaksın/i, /şok!/i, /asla pişman olmayacaks/i,
  /takip et takip ederim/i, /#followforfollow/i, /#like4like/i,
  /\bgaranti\b.*\bbooking\b/i,
];

const SENSITIVE = [
  /afet|sel|deprem|yangın|kaza|ölü|cenaze/i,
  /siyas|parti lideri|seçim|cumhurbaşkan|bakan/i,
];

const PII_LIKE = [
  /\+?\d{2,3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2,4}/, // phone-like
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,           // email
  /\bTC[\s:]?\d{11}\b/i,                              // TCKN
];

const SYSTEM = `Sen Kalkan Info marka koruma agent'ısın. Sadece bu işe odaklan, başka şey yapma.

Görev: verilen caption'ı 3 boyutta değerlendir.
1) Ton — marka uygun (warm, bilgilendirici, abartısız) mı? 0-1
2) Marka çizgi — Kalkan Info değerleri (turizm, doğa, yerel, otantik) yansıtıyor mu? 0-1
3) Risk — gizli risk var mı? (yanlış iddia, yasal sorun, kültürel hata) 0-1 (1=temiz)

Çıktı SADECE JSON:
{
  "tone_score": 0.0-1.0,
  "brand_score": 0.0-1.0,
  "risk_score": 0.0-1.0,
  "overall": 0.0-1.0,
  "flags": ["string","..."],
  "suggestion": "tek cümle iyileştirme önerisi (varsa)"
}`;

function heuristicCheck(text) {
  const flags = [];
  const lc = String(text || '');
  for (const r of HARD_BLOCK) if (r.test(lc)) flags.push(`hard:${r.source.slice(0, 30)}`);
  for (const r of SENSITIVE) if (r.test(lc)) flags.push(`sensitive:${r.source.slice(0, 30)}`);
  for (const r of PII_LIKE) if (r.test(lc)) flags.push('pii_detected');
  const exclam = (lc.match(/!/g) || []).length;
  if (exclam > 5) flags.push('too_many_exclamations');
  if (lc.length > 2200) flags.push('over_length_ig');
  return flags;
}

async function logCheck(input, result) {
  if (!SUPA_URL || !SUPA_KEY) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/brand_guard_log`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_brief: String(input).slice(0, 500),
        pass: result.pass,
        overall: result.score,
        flags: result.flags,
        meta: { tone: result.tone, brand: result.brand, risk: result.risk, cost: result.cost },
      }),
    });
  } catch { /* swallow */ }
}

export async function guard({ caption, hashtags = [], pillar }) {
  const text = `${caption}\n\n${hashtags.join(' ')}`;
  const heuristicFlags = heuristicCheck(text);

  const hardBlocked = heuristicFlags.some(f => f.startsWith('hard:') || f === 'pii_detected');
  if (hardBlocked) {
    const result = { pass: false, score: 0.0, flags: heuristicFlags, reasoning: 'Hard block (heuristic)', cost: 0 };
    await logCheck(text, result);
    return result;
  }

  let llm = { tone_score: 0.7, brand_score: 0.7, risk_score: 0.9, overall: 0.75, flags: [], suggestion: null };
  let cost = 0;
  try {
    const { parsed, cost: c } = await ask({
      model: 'haiku',
      system: SYSTEM,
      user: `Pillar: ${pillar || 'unknown'}\n\nCaption:\n"""\n${caption}\n"""\n\nHashtags: ${hashtags.join(' ') || '(yok)'}`,
      max_tokens: 400,
      json: true,
    });
    cost = c;
    if (parsed && !parsed._parse_error) llm = { ...llm, ...parsed };
  } catch (e) {
    llm.flags.push(`llm_error:${String(e.message || e).slice(0, 80)}`);
  }

  const overall = Number(llm.overall ?? Math.min(llm.tone_score, llm.brand_score, llm.risk_score));
  const allFlags = [...heuristicFlags, ...(llm.flags || [])];
  const sensitive = heuristicFlags.some(f => f.startsWith('sensitive:'));
  const pass = overall >= 0.70 && !sensitive;

  const result = {
    pass,
    score: overall,
    tone: llm.tone_score,
    brand: llm.brand_score,
    risk: llm.risk_score,
    flags: allFlags,
    reasoning: llm.suggestion || (pass ? 'Onaylandı' : 'Düşük skor veya hassas içerik'),
    cost,
  };
  await logCheck(text, result);
  return result;
}
