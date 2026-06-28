// api/cron-rebuild.js
// Vercel cron her gün 03:00 UTC = 06:00 Europe/Istanbul'da çağırır.
// 2 iş yapar (Hobby plan function slot tasarrufu için birleşik):
//   1. expire_old_jobs() RPC — süresi dolan ilanları status='closed' yap
//   2. Vercel Deploy Hook'u POST et → yeni build başlat → scripts/fetch-eczane.mjs
//      ve scripts/news-aggregator.mjs taze veri çeker, deploy edilir.
//
// Setup:
//   1. Vercel Dashboard → Settings → Git → Deploy Hooks → Create Hook
//      → Name: "Daily refresh", Branch: main
//   2. URL'i kopyala
//   3. Env Variables → VERCEL_DEPLOY_HOOK_URL = <url>

import { createClient } from '@supabase/supabase-js';

for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

async function expireJobs() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, skipped: 'env_missing' };
  }
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    const { data, error } = await supabase.rpc('expire_old_jobs');
    if (error) throw error;
    return { ok: true, expired_count: typeof data === 'number' ? data : 0 };
  } catch (err) {
    console.error('[cron-rebuild] expire_old_jobs failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export default async function handler(req, res) {
  // Auth: Vercel cron Authorization: Bearer <CRON_SECRET> ile çağırır
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const secret = req.query.secret;
  const expected = process.env.IG_CRON_SECRET || process.env.CRON_SECRET;

  if (expected && auth !== expected && secret !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  // Günlük durum raporu dalı: /api/cron-rebuild?job=daily-status
  // (Yeni api/ fonksiyonu eklenemez — 12/12 dolu; yeni Vercel cron da eklenemez — Hobby 2-cron sınırı.
  //  Bu yüzden mevcut fonksiyona dal eklendi. Serverless'ta git yok → yalnızca yol haritası bölümü.
  //  git'li tam rapor için PC: node scripts/daily-status-report.mjs — bkz. docs/GUNLUK_RAPOR.md)
  if (req.query.job === 'daily-status') {
    try {
      const { buildReport } = await import('../scripts/daily-status-report.mjs');
      const report = buildReport({ includeGit: false });
      const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!chat || !token) {
        return res.status(200).json({ ok: false, job: 'daily-status', skipped: 'telegram_env_missing' });
      }
      const { sendMessage } = await import('../lib/telegram.js');
      await sendMessage(chat, report, { parse_mode: 'HTML' });
      return res.status(200).json({ ok: true, job: 'daily-status', sent_at: new Date().toISOString() });
    } catch (err) {
      console.error('[cron-rebuild] daily-status failed:', err.message);
      return res.status(500).json({ ok: false, job: 'daily-status', error: String(err.message || err) });
    }
  }

  // 1. Süresi dolan ilanları kapat
  const expireResult = await expireJobs();

  // 2. Deploy hook tetikle
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return res.status(200).json({
      ok: false,
      expire: expireResult,
      deploy: { skipped: 'VERCEL_DEPLOY_HOOK_URL env tanımlı değil' },
    });
  }

  try {
    const r = await fetch(hookUrl, { method: 'POST' });
    const body = await r.text();
    return res.status(200).json({
      ok: r.ok,
      expire: expireResult,
      deploy: {
        status: r.status,
        triggered_at: new Date().toISOString(),
        body_preview: body.slice(0, 200),
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      expire: expireResult,
      deploy: { error: String(err.message || err) },
    });
  }
}
