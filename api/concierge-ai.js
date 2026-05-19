/**
 * api/concierge-ai.js — Vercel Serverless Function
 * POST /api/concierge-ai
 *
 * AI Claude Haiku fallback for Kalkan Info concierge.
 * Insan concierge (Berkay) meşgul/uykudayken kullanıcılarla sohbet eder.
 *
 * Body:  { message: string, lang?: 'tr'|'en'|'de'|'ru'|'fr', context?: string, history?: Array<{role,content}> }
 * Auth:  yok (public). Rate limit: 10/min, 30/hr per IP (in-memory).
 *
 * Model: claude-haiku-4-5-20251001  (cost ~$0.80 / $4 per 1M)
 * Streaming: text/event-stream (SSE).
 * Prompt caching: system prompt + data context (~3K tokens cached).
 *
 * KVKK: kullanıcı mesajı loglanmaz. Sadece olay sayacı + IP mask.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Trim env vars (defensive, mirrors pattern in api/whatsapp.js)
for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_OUTPUT_TOKENS = 600;
const MAX_USER_MSG_LEN = 1500;
const MAX_HISTORY_TURNS = 6; // 3 user + 3 assistant
const SUPPORTED_LANGS = new Set(['tr', 'en', 'de', 'ru', 'fr']);

// -----------------------------------------------------------------
// Rate limiter (in-memory). Vercel cold start ile reset olur — kabul edilebilir.
// Production'da KV/Redis tercih edilir.
// -----------------------------------------------------------------
const RATE_LIMITS = {
  perMinute: 10,
  perHour: 30,
};
const ipState = new Map(); // ip -> { minute: {ts, count}, hour: {ts, count} }

function checkRate(ip) {
  const now = Date.now();
  const rec = ipState.get(ip) || { minute: { ts: now, count: 0 }, hour: { ts: now, count: 0 } };

  if (now - rec.minute.ts > 60_000) {
    rec.minute = { ts: now, count: 0 };
  }
  if (now - rec.hour.ts > 3_600_000) {
    rec.hour = { ts: now, count: 0 };
  }
  rec.minute.count += 1;
  rec.hour.count += 1;
  ipState.set(ip, rec);

  if (rec.minute.count > RATE_LIMITS.perMinute) {
    return { ok: false, retryAfter: 60, reason: 'minute' };
  }
  if (rec.hour.count > RATE_LIMITS.perHour) {
    return { ok: false, retryAfter: 3600, reason: 'hour' };
  }
  return { ok: true };
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']).trim();
  return req.socket?.remoteAddress || 'unknown';
}

// -----------------------------------------------------------------
// System prompt + DATA bundle (lazy-loaded, cached for the lifetime of the
// serverless instance). Anthropic prompt caching also applied (cache_control).
// -----------------------------------------------------------------
let CACHED_BUNDLE = null;

async function loadSystemBundle() {
  if (CACHED_BUNDLE) return CACHED_BUNDLE;

  const root = process.cwd();
  const safeRead = async (relPath) => {
    try {
      return await readFile(join(root, relPath), 'utf8');
    } catch (err) {
      console.warn(`[concierge-ai] could not read ${relPath}:`, err.message);
      return null;
    }
  };

  // 1) Base system prompt (markdown)
  const basePrompt = await safeRead('data/ai-system-prompt.md') ||
    'You are a friendly Kalkan/Kaş/Patara travel concierge. Reply in user language. Never quote prices. Redirect bookings to wa.me/905306650794.';

  // 2) JSON data — trimmed to essentials for token budget.
  const dataFiles = [
    'data/restoranlar.json',
    'data/plajlar.json',
    'data/villalar.json',
    'data/antik-kentler.json',
    'data/turlar.json',
    'data/hizmetler.json',
    'data/aktiviteler.json',
  ];

  const dataChunks = [];
  for (const path of dataFiles) {
    const raw = await safeRead(path);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      // Keep only the fields the assistant actually needs.
      const slim = items.slice(0, 30).map(it => ({
        id: it.id,
        name: it.name,
        category: it.category,
        region: it.region,
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 5) : undefined,
        summary: it.summary || it.shortDescription || it.description?.slice(0, 200),
      }));
      const label = path.replace('data/', '').replace('.json', '');
      dataChunks.push(`### ${label}\n` + JSON.stringify(slim));
    } catch (err) {
      console.warn(`[concierge-ai] parse failed for ${path}:`, err.message);
    }
  }

  const dataBlock = dataChunks.length
    ? `\n\n---\n\n## DATA — Kalkan/Kaş/Patara mekanlar (özet)\n\n${dataChunks.join('\n\n')}\n\n--- DATA SONU ---`
    : '';

  CACHED_BUNDLE = `${basePrompt}${dataBlock}`;
  return CACHED_BUNDLE;
}

// -----------------------------------------------------------------
// Input validation
// -----------------------------------------------------------------
function sanitize(input, maxLen = MAX_USER_MSG_LEN) {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').slice(0, maxLen).trim();
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const cleaned = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY_TURNS)
    .map(m => ({ role: m.role, content: sanitize(m.content) }))
    .filter(m => m.content.length > 0);

  // Anthropic requires alternating user/assistant with leading 'user'.
  // Drop leading assistant message if present.
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  return cleaned;
}

// -----------------------------------------------------------------
// Handler
// -----------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[concierge-ai] ANTHROPIC_API_KEY missing');
    return res.status(503).json({ error: 'AI service unavailable' });
  }

  // Rate limit
  const ip = getClientIp(req);
  const rate = checkRate(ip);
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'rate_limited', reason: rate.reason });
  }

  // Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const message = sanitize(body.message);
  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  const langRaw = typeof body.lang === 'string' ? body.lang.toLowerCase() : 'tr';
  const lang = SUPPORTED_LANGS.has(langRaw) ? langRaw : 'tr';
  const context = sanitize(body.context, 80);
  const history = normalizeHistory(body.history);

  let systemBundle;
  try {
    systemBundle = await loadSystemBundle();
  } catch (err) {
    console.error('[concierge-ai] system bundle load failed:', err.message);
    return res.status(500).json({ error: 'system prompt unavailable' });
  }

  // Per-turn lang/context hint goes in a non-cached system block.
  const turnHint = `## Bu mesaj için ipuçları\n- Kullanıcının tercih dili: **${lang}**\n- Sayfa bağlamı: ${context || 'genel'}\n- Cevabını kullanıcının mesaj diline göre ver (eğer farklıysa).`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages = [
    ...history,
    { role: 'user', content: message },
  ];

  // Streaming SSE response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stream = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      system: [
        // Cached block — heavy, stable.
        {
          type: 'text',
          text: systemBundle,
          cache_control: { type: 'ephemeral' },
        },
        // Per-turn lightweight hint (not cached).
        {
          type: 'text',
          text: turnHint,
        },
      ],
      messages,
    });

    let outputText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreateTokens = 0;

    for await (const evt of stream) {
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        const chunk = evt.delta.text || '';
        outputText += chunk;
        send('delta', { text: chunk });
      } else if (evt.type === 'message_start' && evt.message?.usage) {
        inputTokens = evt.message.usage.input_tokens || 0;
        cacheReadTokens = evt.message.usage.cache_read_input_tokens || 0;
        cacheCreateTokens = evt.message.usage.cache_creation_input_tokens || 0;
      } else if (evt.type === 'message_delta' && evt.usage) {
        outputTokens = evt.usage.output_tokens || outputTokens;
      }
    }

    send('done', {
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cache_read: cacheReadTokens,
        cache_create: cacheCreateTokens,
      },
    });
    res.end();

    // KVKK-safe log — content is NOT stored.
    console.log('[concierge-ai] ok', {
      ip_mask: ip.slice(0, 3) + '***',
      lang,
      context: context || 'genel',
      input_len: message.length,
      output_len: outputText.length,
      tokens: { in: inputTokens, out: outputTokens, cache_r: cacheReadTokens },
    });
  } catch (err) {
    console.error('[concierge-ai] stream error:', err?.message || err);
    try {
      send('error', { message: 'AI cevap veremedi, lütfen tekrar dene veya Berkay\'a yaz: wa.me/905306650794' });
      res.end();
    } catch {
      // already ended
    }
  }
}
