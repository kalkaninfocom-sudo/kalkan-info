/**
 * api/whatsapp.js — Vercel Serverless Function
 * Meta WhatsApp Business Cloud API webhook
 *
 * GET  /api/whatsapp → verify challenge
 * POST /api/whatsapp → inbound message → audit_log (Supabase)
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const STUB_MODE =
  !process.env.META_VERIFY_TOKEN ||
  !process.env.META_APP_SECRET ||
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function verifySignature(rawBody, signature) {
  if (!signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function getAllowlist() {
  const raw = process.env.WHATSAPP_ALLOWLIST || '';
  return raw.split(',').map(p => p.trim()).filter(Boolean);
}

export default async function handler(req, res) {
  // GET — webhook verification
  if (req.method === 'GET') {
    if (STUB_MODE) {
      console.log('[whatsapp] STUB: GET verify, env vars eksik');
      return res.status(200).send(req.query['hub.challenge'] || 'stub');
    }

    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  // POST — inbound message
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  if (STUB_MODE) {
    console.log('[whatsapp] STUB: POST received, env vars eksik — body:', JSON.stringify(req.body));
    return res.status(200).end();
  }

  // Signature doğrulama
  const rawBody = JSON.stringify(req.body);
  const sig     = req.headers['x-hub-signature-256'];
  if (!verifySignature(rawBody, sig)) {
    console.warn('[whatsapp] Signature doğrulama başarısız');
    return res.status(403).end();
  }

  const body = req.body;

  if (body?.object !== 'whatsapp_business_account') {
    return res.status(400).end();
  }

  const allowlist = getAllowlist();

  try {
    const supabase = getSupabase();

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          const sender     = msg.from || '';
          const normalised = sender.startsWith('+') ? sender : '+' + sender;

          if (allowlist.length > 0 && !allowlist.includes(normalised)) {
            console.log('[whatsapp] Allowlist dışı gönderici, atlanıyor:', normalised);
            continue;
          }

          await supabase.from('audit_log').insert({
            event_type: 'whatsapp_message_received',
            payload: {
              message_id:   msg.id,
              sender:       normalised,
              type:         msg.type,
              text:         msg.text?.body || null,
              timestamp:    msg.timestamp,
              entry_id:     entry.id,
            },
          });
        }
      }
    }

    return res.status(200).end();
  } catch (err) {
    console.error('[whatsapp] Hata:', err.message);
    return res.status(500).end();
  }
}
