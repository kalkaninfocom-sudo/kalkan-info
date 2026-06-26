/**
 * api/whatsapp.js — Vercel Serverless Function
 * Meta WhatsApp Business Cloud API webhook + Claude auto-reply
 *
 * GET  /api/whatsapp → verify challenge
 * POST /api/whatsapp → inbound message → Claude → Graph API send
 *
 * Env vars (Vercel):
 *   META_VERIFY_TOKEN          — webhook verification (Meta Console'da aynısı)
 *   META_APP_SECRET            — signature doğrulama
 *   META_PHONE_NUMBER_ID       — Graph API mesaj gönderme
 *   META_ACCESS_TOKEN          — System User permanent token
 *   ANTHROPIC_API_KEY          — Claude Haiku assistant
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   WHATSAPP_ALLOWLIST         — opsiyonel, virgülle ayrılmış +90...
 *   AGENT_WHATSAPP_RECEPTION_MODEL — default: claude-haiku-4-5-20251001
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

const CHAT_DISABLED =
  !process.env.ANTHROPIC_API_KEY ||
  !process.env.META_PHONE_NUMBER_ID ||
  !process.env.META_ACCESS_TOKEN;

const MODEL = process.env.AGENT_WHATSAPP_RECEPTION_MODEL || 'claude-haiku-4-5-20251001';
const HISTORY_LIMIT = 12;
const MAX_USER_MSG = 1500;

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

function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone + (process.env.META_APP_SECRET || '')).digest('hex').slice(0, 32);
}

function maskPhone(phone) {
  return phone.length >= 6 ? phone.slice(0, 4) + '****' + phone.slice(-2) : '****';
}

// ---------------------------------------------------------------------------
// Claude system prompt — Berkay'ın yerine konuşan Kalkan Info asistanı
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Sen Kalkan Info'nun resmi dijital asistanısın. Berkay (kurucu) WhatsApp'a hemen bakamadığında onun yerine kibar, profesyonel ve KISA cevap veriyorsun.

KİMLİK:
- Adın "Kalkan Info Asistanı"
- Berkay'ın kişisel asistanı gibi davran ama bot olduğunu gizleme — sorulursa "Ben Berkay'ın WhatsApp asistanıyım, kendisi en kısa sürede sana dönecek" de.
- Kalkaninfo.com Kalkan/Kaş/Patara bölgesi turizm portalı.

KAPSAM:
- Villa kiralama (3+1 → 6+1, ₺9.500–₺32.000/gece, kalkaninfo.com/villalar)
- Restoran rezervasyonu (27 restoran, kalkaninfo.com/restoranlar)
- Tekne turları, jeep safari, antik kent rehberi
- Tatil planı (kalkaninfo.com/tatil-planla — AI plan üretici, 1 dakikada gün gün program)
- Transfer (havalimanı, Dalaman 1.5 saat, Antalya 3 saat)
- Hizmet sağlayıcı (temizlik, masaj, market, organizasyon)
- 5 dil: Türkçe, İngilizce, Rusça, Almanca, Arapça

KURALLAR:
1. Kullanıcı hangi dilde yazdıysa o dilde cevap ver.
2. Cevaplar KISA — 1-3 cümle. Uzun açıklama yapma.
3. Net fiyat/tarih bilgisi yoksa "Berkay'a iletip dönüş yapacağım" de, uydurma.
4. İlgili sayfa varsa link ver: kalkaninfo.com/restoranlar gibi.
5. Para/ödeme/kapora konuşması direkt: "Bu konuyu Berkay'la görüşeceksin, müsait olunca seni arayacak."
6. Konu kapsam dışıysa kibarca: "Bu konuda yardımcı olamam, Berkay döndüğünde sorabilirsin."
7. Emoji kullanma. Aşırı resmi de olma — samimi ama profesyonel.
8. Asla kişisel veri (kart, TC, şifre) isteme.

ÖRNEK STİL:
"Merhaba! Ağustos ayında 6 kişilik bir villa için Kalamar bölgesinde Villa Yakamoz veya Villa Mira önerebilirim. Müsaitlik için kalkaninfo.com/villalar'a bakabilirsin ya da net tarihi yazarsan Berkay döndüğünde teklif hazırlar."`;

// ---------------------------------------------------------------------------
// Anthropic chat call
// ---------------------------------------------------------------------------
async function callClaude(history, userMessage) {
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const textBlock = (json.content || []).find(b => b.type === 'text');
  const text = textBlock?.text?.trim() || '';
  if (!text) throw new Error('Claude empty response');

  return {
    text,
    tokensIn:  json.usage?.input_tokens  ?? 0,
    tokensOut: json.usage?.output_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Graph API — outbound text message
// ---------------------------------------------------------------------------
async function sendWhatsAppText(toPhone, text) {
  const url = `https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
      'content-type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhone.replace(/^\+/, ''),
      type: 'text',
      text: { body: text.slice(0, 4000), preview_url: true },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API send ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.messages?.[0]?.id || null;
}

// ---------------------------------------------------------------------------
// Conversation history
// ---------------------------------------------------------------------------
async function loadHistory(supabase, phoneHash) {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('role, content, created_at')
    .eq('phone_hash', phoneHash)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.warn('[whatsapp] history load failed:', error.message);
    return [];
  }
  return (data || []).reverse();
}

async function saveTurn(supabase, row) {
  const { error } = await supabase.from('whatsapp_conversations').insert(row);
  if (error) console.warn('[whatsapp] save failed:', error.message);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  // GET — webhook verification
  if (req.method === 'GET') {
    if (STUB_MODE) {
      console.warn('[whatsapp] STUB: env vars eksik, servis devre dışı');
      return res.status(503).json({ error: 'Service unavailable' });
    }

    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  if (STUB_MODE) {
    console.log('[whatsapp] STUB: POST received, env vars eksik');
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
  if (body?.object !== 'whatsapp_business_account') return res.status(400).end();

  // Meta 200 OK'i 20 saniye içinde bekliyor — uzun işleri ack'tan sonra yap.
  // Vercel serverless'ta arka plan task pattern: response gönderip await et.
  res.status(200).end();

  try {
    const supabase = getSupabase();
    const allowlist = getAllowlist();

    const entries = body.entry || [];
    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          await processMessage(supabase, allowlist, msg);
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp] handler error:', err.message);
  }
}

async function processMessage(supabase, allowlist, msg) {
  const sender = msg.from || '';
  if (!sender) return;
  const normalised = sender.startsWith('+') ? sender : '+' + sender;

  if (allowlist.length > 0 && !allowlist.includes(normalised)) {
    console.log('[whatsapp] Allowlist dışı, atlanıyor:', maskPhone(normalised));
    return;
  }

  // Sadece text mesajları işle (image/voice/location v2'de)
  if (msg.type !== 'text') {
    console.log('[whatsapp] Non-text mesaj, atlanıyor:', msg.type);
    return;
  }

  const userText = (msg.text?.body || '').slice(0, MAX_USER_MSG).trim();
  if (!userText) return;

  const phoneHash = hashPhone(normalised);
  const phoneMask = maskPhone(normalised);

  // Kullanıcı mesajını kaydet
  await saveTurn(supabase, {
    phone_hash: phoneHash,
    phone_mask: phoneMask,
    wa_message_id: msg.id,
    role: 'user',
    content: userText,
  });

  if (CHAT_DISABLED) {
    console.warn('[whatsapp] Chat disabled (ANTHROPIC_API_KEY or META_*_TOKEN eksik)');
    return;
  }

  // ── FOUNDER MODE: Berkay'sa sekretere yönlendir
  try {
    const { isBerkay, buildBriefing, askSecretary } = await import('../lib/secretary.js');
    if (isBerkay(normalised)) {
      const briefing = await buildBriefing();
      const { reply, cost, usage } = await askSecretary({ userMessage: userText, briefing });
      const waId = await sendWhatsAppText(normalised, reply);
      await saveTurn(supabase, {
        phone_hash: phoneHash,
        phone_mask: phoneMask,
        wa_message_id: waId,
        role: 'assistant',
        content: reply,
        model: 'claude-sonnet-4-6-secretary',
        tokens_in: usage?.input_tokens ?? 0,
        tokens_out: usage?.output_tokens ?? 0,
      });
      console.log('[whatsapp] Secretary reply', { cost: cost.toFixed(4), usage });
      return;
    }
  } catch (e) {
    console.warn('[whatsapp] Secretary fail, fallback to public assistant:', e.message);
  }

  try {
    const history = await loadHistory(supabase, phoneHash);
    // En son kaydedilen user mesajını history'den çıkar (Claude'a ayrı veriyoruz)
    const trimmed = history.slice(0, -1);

    const { text, tokensIn, tokensOut } = await callClaude(trimmed, userText);
    const waId = await sendWhatsAppText(normalised, text);

    await saveTurn(supabase, {
      phone_hash: phoneHash,
      phone_mask: phoneMask,
      wa_message_id: waId,
      role: 'assistant',
      content: text,
      model: MODEL,
      tokens_in:  tokensIn,
      tokens_out: tokensOut,
    });

    console.log('[whatsapp] Reply sent', { phone: phoneMask, tokensIn, tokensOut });
  } catch (err) {
    console.error('[whatsapp] Reply failed:', err.message);
  }
}
