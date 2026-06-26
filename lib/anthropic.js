// lib/anthropic.js
// Minimal Anthropic API client (no SDK dep). All agents share this.

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export const MODELS = {
  opus:   'claude-opus-4-7',
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
};

const PRICE_PER_MTOK = {
  'claude-opus-4-7':           { in: 15.00, out: 75.00 },
  'claude-sonnet-4-6':         { in: 3.00,  out: 15.00 },
  'claude-haiku-4-5-20251001': { in: 0.80,  out: 4.00 },
};

export async function ask({ model = 'haiku', system, user, max_tokens = 1024, json = false }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');

  const modelId = MODELS[model] || model;
  const body = {
    model: modelId,
    max_tokens,
    system: system || undefined,
    messages: [{ role: 'user', content: user }],
  };

  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = data.content?.[0]?.text || '';
  const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
  const price = PRICE_PER_MTOK[modelId] || { in: 0, out: 0 };
  const cost = (usage.input_tokens * price.in + usage.output_tokens * price.out) / 1_000_000;

  let parsed = text;
  if (json) {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : text);
    } catch {
      parsed = { _raw: text, _parse_error: true };
    }
  }

  return { text, parsed, cost, usage, model: modelId };
}
