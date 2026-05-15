/**
 * supabase/functions/newsletter-subscribe/index.ts
 * Kalkan Info — Newsletter abonelik Edge Function (Deno)
 *
 * POST /functions/v1/newsletter-subscribe
 * Body: { email, source_page?, locale? ('tr'|'en'|'de'|'ru'), gdpr_consent: true }
 *
 * Flow:
 *   1. Email format + GDPR onay doğrula
 *   2. IP bazlı rate limit (5 / 10 dk) — rate_limits tablosu üzerinden
 *   3. INSERT veya re-issue confirm_token
 *   4. Resend ile confirm linkli mail gönder
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://kalkaninfo.com',
  'https://www.kalkaninfo.com',
  'http://localhost:3000',
  'http://localhost:3010',
];

const SITE_URL = 'https://kalkaninfo.com';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Kalkan Info <noreply@kalkaninfo.com>';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SUBJECTS: Record<string, string> = {
  tr: "Kalkan Info — E-posta adresinizi doğrulayın",
  en: "Kalkan Info — Confirm your email",
  de: "Kalkan Info — E-Mail bestätigen",
  ru: "Kalkan Info — Подтвердите ваш email",
};

const BODIES: Record<string, (link: string) => string> = {
  tr: (link) => `Merhaba,

Kalkan Info bültenine abone olmak için bu adresi kullandınız. Aşağıdaki bağlantıya tıklayarak aboneliğinizi onaylayın:

${link}

Bu isteği yapmadıysanız bu e-postayı yok sayın.

— Kalkan Info`,
  en: (link) => `Hello,\n\nClick to confirm your subscription:\n${link}\n\nIf this wasn't you, ignore this email.\n— Kalkan Info`,
  de: (link) => `Hallo,\n\nKlicken Sie auf den Bestätigungslink:\n${link}\n\nFalls nicht von Ihnen, ignorieren.\n— Kalkan Info`,
  ru: (link) => `Здравствуйте,\n\nПодтвердите подписку:\n${link}\n\nЕсли это были не вы, проигнорируйте.\n— Kalkan Info`,
};

async function sendConfirmEmail(email: string, token: string, locale: string) {
  if (!RESEND_API_KEY) {
    console.warn('[newsletter] RESEND_API_KEY missing, skipping send (token=' + token.slice(0, 6) + '…)');
    return { skipped: true };
  }
  const lang = SUBJECTS[locale] ? locale : 'tr';
  const link = `${SITE_URL}/api/newsletter-confirm?token=${encodeURIComponent(token)}`;
  const subject = SUBJECTS[lang];
  const text = BODIES[lang](link);
  const html = text.replace(/\n/g, '<br>').replace(link, `<a href="${link}" style="color:#e89812;font-weight:700;">${link}</a>`);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: email, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[newsletter] Resend failed', res.status, body);
    return { sent: false, error: body };
  }
  return { sent: true };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400, cors); }

  const email = String(body?.email || '').trim().toLowerCase();
  const sourcePage = String(body?.source_page || '').slice(0, 256) || null;
  const locale = ['tr', 'en', 'de', 'ru'].includes(body?.locale) ? body.locale : 'tr';
  const gdpr = body?.gdpr_consent === true;

  if (!email || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400, cors);
  if (!gdpr) return json({ error: 'gdpr_consent_required' }, 400, cors);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent')?.slice(0, 256) || null;
  const ipHash = await sha256Hex(ip);

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ---- IP rate limit: 5 newsletter / 10 dk
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count: recent } = await supa
    .from('newsletter_subscribers')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if ((recent || 0) >= 5) return json({ error: 'rate_limited' }, 429, cors);

  // ---- Upsert by email_lower; mevcut kayıt varsa token'ı yeniden üret
  const { data: existing } = await supa
    .from('newsletter_subscribers')
    .select('id, confirmed_at, confirm_token')
    .eq('email_lower', email)
    .maybeSingle();

  let confirmToken: string;
  if (existing?.confirmed_at) {
    return json({ ok: true, status: 'already_confirmed' }, 200, cors);
  }

  if (existing) {
    const { data: updated, error } = await supa
      .from('newsletter_subscribers')
      .update({ source_page: sourcePage, locale, ip_hash: ipHash, user_agent: ua })
      .eq('id', existing.id)
      .select('confirm_token')
      .single();
    if (error) return json({ error: 'db_update_failed', detail: error.message }, 500, cors);
    confirmToken = updated.confirm_token;
  } else {
    const { data: inserted, error } = await supa
      .from('newsletter_subscribers')
      .insert({ email, source_page: sourcePage, locale, ip_hash: ipHash, user_agent: ua })
      .select('confirm_token')
      .single();
    if (error) return json({ error: 'db_insert_failed', detail: error.message }, 500, cors);
    confirmToken = inserted.confirm_token;
  }

  const sendResult = await sendConfirmEmail(email, confirmToken, locale);

  return json({ ok: true, status: 'pending_confirm', send: sendResult }, 200, cors);
});

function json(payload: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
