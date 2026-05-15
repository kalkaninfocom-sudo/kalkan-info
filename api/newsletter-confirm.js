/**
 * api/newsletter-confirm.js — Vercel Serverless Function
 * GET /api/newsletter-confirm?token=...
 *
 * Çift opt-in onay endpoint'i. Token doğrulayıp confirmed_at set eder,
 * sonra kullanıcıyı bilgilendirme sayfasına yönlendirir.
 */

import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const SITE_URL = 'https://kalkaninfo.com';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const token = String(req.query?.token || '').trim();
  const TOKEN_RE = /^[a-f0-9]{40,80}$/i;
  if (!token || !TOKEN_RE.test(token)) {
    return redirectStatus(res, 'invalid');
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[newsletter-confirm] env eksik');
    return redirectStatus(res, 'error');
  }

  const supa = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supa
    .from('newsletter_subscribers')
    .select('id, confirmed_at, locale')
    .eq('confirm_token', token)
    .maybeSingle();

  if (error || !data) return redirectStatus(res, 'invalid');
  if (data.confirmed_at) return redirectStatus(res, 'already', data.locale);

  const { error: upErr } = await supa
    .from('newsletter_subscribers')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('id', data.id);

  if (upErr) {
    console.error('[newsletter-confirm] update failed', upErr);
    return redirectStatus(res, 'error');
  }

  return redirectStatus(res, 'ok', data.locale);
}

function redirectStatus(res, status, locale) {
  const lc = locale || 'tr';
  res.statusCode = 302;
  res.setHeader('Location', `${SITE_URL}/?newsletter=${status}&lc=${lc}`);
  return res.end();
}
