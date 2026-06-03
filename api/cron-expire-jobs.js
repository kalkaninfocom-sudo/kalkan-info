/**
 * api/cron-expire-jobs.js — Daily cron
 *
 * vercel.json crons: { "path": "/api/cron-expire-jobs", "schedule": "0 3 * * *" }
 *
 * expire_old_jobs() Postgres fonksiyonunu çağırır.
 * status='active' AND expires_at < now() olanları status='closed' yapar.
 *
 * Vercel cron Authorization: Bearer ${CRON_SECRET} ile gelir.
 */

import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

export default async function handler(req, res) {
  // Cron secret doğrulama (opsiyonel ama tavsiye edilir)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[cron-expire-jobs] STUB: Supabase env eksik');
    return res.status(200).json({ stub: true });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    const { data, error } = await supabase.rpc('expire_old_jobs');
    if (error) throw error;

    const expired = typeof data === 'number' ? data : 0;
    console.log(`[cron-expire-jobs] ${expired} jobs expired`);

    return res.status(200).json({
      ok: true,
      expired_count: expired,
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron-expire-jobs] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
