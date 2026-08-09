/**
 * supabase/functions/set-contributor-role/index.ts
 * Kalkan Info — Gazete Topluluk Editörü: katkıcı rol yönetimi (Deno Edge Function)
 *
 * Admin bir kullanıcıyı gazete katkıcısı yapar veya engeller. app_metadata.role
 * değişikliği SADECE service_role ile yapılabilir (client'tan yapılamaz) → bu Edge Fn şart.
 *
 * POST /functions/v1/set-contributor-role   body: { user_id, action: 'approve' | 'block' }
 *   - approve → app_metadata.role='contributor' + gazete_contributors.status='approved'
 *   - block   → app_metadata.role kaldırılır      + gazete_contributors.status='blocked'
 *
 * Güvenlik: çağıranın Authorization Bearer JWT'si service_role ile doğrulanır;
 * app_metadata.role='admin' değilse 403. (UI guard'a GÜVENİLMEZ — gerçek kapı burası.)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://kalkaninfo.com',
  'https://www.kalkaninfo.com',
  'http://localhost:3000',
  'http://localhost:3010',
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age': '86400',
  };
}

function json(payload: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function supa() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

/**
 * Çağıranın JWT'sini service_role ile doğrula → admin mi?
 * @returns admin kullanıcı objesi veya null
 */
async function verifyAdmin(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = supa();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  // SADECE app_metadata (user_metadata kullanıcı tarafından değiştirilebilir).
  const role = (data.user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (role !== 'admin') return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

  // 1) Admin doğrula (gerçek koruma — UI guard yeterli değil)
  const admin = await verifyAdmin(req);
  if (!admin) return json({ error: 'forbidden', detail: 'Yalnızca admin kullanıcı çağırabilir.' }, 403, cors);

  // 2) Girdi
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400, cors); }

  const userId = String(body.user_id ?? '').trim();
  const action = String(body.action ?? '').trim();

  if (!userId) return json({ error: 'user_id_required' }, 400, cors);
  if (action !== 'approve' && action !== 'block') {
    return json({ error: 'invalid_action', detail: "action 'approve' veya 'block' olmalı" }, 400, cors);
  }

  const db = supa();

  // 3) Hedef kullanıcı var mı? (mevcut app_metadata'yı koru, sadece role'ü değiştir)
  const { data: target, error: getErr } = await db.auth.admin.getUserById(userId);
  if (getErr || !target?.user) {
    return json({ error: 'user_not_found', detail: getErr?.message }, 404, cors);
  }
  const existingMeta = (target.user.app_metadata as Record<string, unknown>) || {};

  const nowIso = new Date().toISOString();

  if (action === 'approve') {
    // app_metadata.role='contributor' (diğer app_metadata alanlarını koru)
    const { error: updErr } = await db.auth.admin.updateUserById(userId, {
      app_metadata: { ...existingMeta, role: 'contributor' },
    });
    if (updErr) return json({ error: 'role_update_failed', detail: updErr.message }, 500, cors);

    // gazete_contributors profil satırını güncelle (yoksa oluştur — upsert)
    const { error: rowErr } = await db.from('gazete_contributors').upsert({
      user_id: userId,
      email: target.user.email ?? null,
      status: 'approved',
      approved_by: admin.id,
      approved_at: nowIso,
    }, { onConflict: 'user_id' });
    if (rowErr) return json({ error: 'profile_update_failed', detail: rowErr.message }, 500, cors);

    return json({ ok: true, user_id: userId, status: 'approved', role: 'contributor' }, 200, cors);
  }

  // action === 'block' → role kaldır + status='blocked'
  const { role: _drop, ...metaWithoutRole } = existingMeta as { role?: unknown };
  const { error: updErr } = await db.auth.admin.updateUserById(userId, {
    app_metadata: metaWithoutRole,
  });
  if (updErr) return json({ error: 'role_update_failed', detail: updErr.message }, 500, cors);

  const { error: rowErr } = await db.from('gazete_contributors').upsert({
    user_id: userId,
    email: target.user.email ?? null,
    status: 'blocked',
    approved_by: admin.id,
    approved_at: nowIso,
  }, { onConflict: 'user_id' });
  if (rowErr) return json({ error: 'profile_update_failed', detail: rowErr.message }, 500, cors);

  return json({ ok: true, user_id: userId, status: 'blocked', role: null }, 200, cors);
});
