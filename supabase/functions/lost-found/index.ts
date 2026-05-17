/**
 * supabase/functions/lost-found/index.ts
 * Kalkan Info — Kayıp & Bulunan Edge Function (Deno)
 *
 * GET  /functions/v1/lost-found/list?type=kayip|bulundu   — son 50 aktif ilan
 * POST /functions/v1/lost-found/create                    — yeni ilan (rate limit: 3/saat + 10/gün/IP, honeypot, captcha)
 * POST /functions/v1/lost-found/delete                    — {id, delete_code} ile status='removed'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://kalkaninfo.com',
  'https://www.kalkaninfo.com',
  'http://localhost:3000',
  'http://localhost:3010',
];

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ---- helpers ----------------------------------------------------------------

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

function json(payload: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function supa() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

// ---- anti-spam helpers ------------------------------------------------------

/** Honeypot + math captcha guard for create endpoint */
async function ipHash(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return sha256Hex(ip);
}

/**
 * Math captcha verifier.
 * q format: "3+5", "12-7", "4*3" — only digits and +, -, * operators.
 * a: the user's numeric answer as string.
 */
function verifyMathCaptcha(q: string, a: string): boolean {
  if (!q || !a) return false;
  try {
    // safe: only digits, spaces, and +, -, * allowed
    if (!/^[\d+\-*\s]+$/.test(q)) return false;
    // deno-lint-ignore no-new-func
    const expected = new Function(`"use strict"; return (${q})`)();
    return Number(a) === Number(expected);
  } catch { return false; }
}

// ---- PII masking helpers ---------------------------------------------------

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 6) return '***';
  return phone.slice(0, 3) + '*'.repeat(phone.length - 5) + phone.slice(-2);
}

function maskName(name: string | null): string | null {
  if (!name) return null;
  return name.split(' ').map((w: string) => w[0] + '*'.repeat(Math.max(0, w.length - 1))).join(' ');
}

// ---- route handlers ---------------------------------------------------------

/** GET /list?type=kayip|bulundu */
async function handleList(url: URL, _req: Request, cors: Record<string, string>) {
  const type = url.searchParams.get('type');
  const db   = supa();

  let query = db
    .from('lost_found_items')
    .select('id, type, title, description, location, phone, contact_name, photo_url, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);

  if (type === 'kayip' || type === 'bulundu') {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) return json({ error: 'db_error', detail: error.message }, 500, cors);

  // PII maskeleme: lost_found tablosu anonim (user_id yok, delete_code ile silme).
  // Her listeleme çağrısında phone + contact_name maskelenir.
  const items = (data ?? []).map((item: Record<string, unknown>) => ({
    id:           item.id,
    type:         item.type,
    title:        item.title,
    description:  item.description,
    location:     item.location,
    photo_url:    item.photo_url,
    created_at:   item.created_at,
    phone:        maskPhone(item.phone as string | null),
    contact_name: maskName(item.contact_name as string | null),
    contact_hint: 'İlan sahibine ulaşmak için iletişim formunu kullanın.',
  }));

  return json({ ok: true, items }, 200, cors);
}

/** POST /create — body: { type, title, description?, location?, phone?, contact_name?, photo_url?, captcha_q, captcha_a } */
async function handleCreate(req: Request, cors: Record<string, string>) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400, cors); }

  // --- Honeypot: bots fill decoy fields, humans leave them empty ---
  if (body.website || body.homepage) {
    console.log('honeypot triggered', { ip_hash: await ipHash(req) });
    return json({ ok: true, items: [] }, 200, cors); // silent reject
  }

  // --- Math captcha ---
  if (!verifyMathCaptcha(String(body.captcha_q ?? ''), String(body.captcha_a ?? ''))) {
    return json({ error: 'captcha_failed' }, 400, cors);
  }

  const type        = body.type as string;
  const title       = String(body.title ?? '').trim().slice(0, 200);
  const description = body.description ? String(body.description).trim().slice(0, 1000) : null;
  const location    = body.location    ? String(body.location).trim().slice(0, 200)     : null;
  const phone       = body.phone       ? String(body.phone).trim().slice(0, 40)         : null;
  const contactName = body.contact_name ? String(body.contact_name).trim().slice(0, 120) : null;
  const photoUrl    = body.photo_url   ? String(body.photo_url).trim().slice(0, 2048)   : null;

  if (type !== 'kayip' && type !== 'bulundu') {
    return json({ error: 'invalid_type', detail: 'type must be kayip or bulundu' }, 400, cors);
  }
  if (!title) return json({ error: 'title_required' }, 400, cors);

  // --- IP rate limit: 3/saat + 10/gün ---
  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ipHashVal = await sha256Hex(ip);
  const sinceHour = new Date(Date.now() - 60 * 60_000).toISOString();
  const sinceDay  = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const db = supa();

  const { count: recentHour } = await db
    .from('lost_found_items')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHashVal)
    .gte('created_at', sinceHour);

  if ((recentHour ?? 0) >= 3) return json({ error: 'rate_limited' }, 429, cors);

  const { count: recentDay } = await db
    .from('lost_found_items')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHashVal)
    .gte('created_at', sinceDay);

  if ((recentDay ?? 0) >= 10) return json({ error: 'rate_limited' }, 429, cors);

  const ipHash = ipHashVal; // alias for insert below

  const { data: inserted, error } = await db
    .from('lost_found_items')
    .insert({
      type,
      title,
      description,
      location,
      phone,
      contact_name: contactName,
      photo_url:    photoUrl,
      ip_hash:      ipHash,
    })
    .select('id, delete_code, created_at')
    .single();

  if (error) return json({ error: 'db_insert_failed', detail: error.message }, 500, cors);

  return json({
    ok:          true,
    id:          inserted.id,
    delete_code: inserted.delete_code,
    created_at:  inserted.created_at,
    message:     'İlanınız yayınlandı. delete_code değerini saklayın — silmek için tek yol budur.',
  }, 201, cors);
}

/** POST /delete — body: { id, delete_code } */
async function handleDelete(req: Request, cors: Record<string, string>) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400, cors); }

  const id         = String(body.id          ?? '').trim();
  const deleteCode = String(body.delete_code ?? '').trim().toLowerCase();

  if (!id || !deleteCode) return json({ error: 'id_and_delete_code_required' }, 400, cors);

  const db = supa();

  // Kaydı çek (service_role — delete_code'a erişebilir)
  const { data: item, error: fetchErr } = await db
    .from('lost_found_items')
    .select('id, status, delete_code')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) return json({ error: 'db_error', detail: fetchErr.message }, 500, cors);
  if (!item)    return json({ error: 'not_found' }, 404, cors);
  if (item.status === 'removed') return json({ ok: true, status: 'already_removed' }, 200, cors);
  if (item.delete_code !== deleteCode) return json({ error: 'invalid_delete_code' }, 403, cors);

  const { error: updateErr } = await db
    .from('lost_found_items')
    .update({ status: 'removed' })
    .eq('id', id);

  if (updateErr) return json({ error: 'db_update_failed', detail: updateErr.message }, 500, cors);

  return json({ ok: true, status: 'removed' }, 200, cors);
}

// ---- main -------------------------------------------------------------------

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors   = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url      = new URL(req.url);
  // path: /functions/v1/lost-found/<action> → split last segment
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const action   = segments[segments.length - 1]; // 'list' | 'create' | 'delete'

  if (req.method === 'GET'  && action === 'list')   return handleList(url, req, cors);
  if (req.method === 'POST' && action === 'create') return handleCreate(req, cors);
  if (req.method === 'POST' && action === 'delete') return handleDelete(req, cors);

  return json({ error: 'not_found' }, 404, cors);
});
