// api/cron-rebuild.js
// Vercel cron her gün 03:00 UTC = 06:00 Europe/Istanbul'da çağırır.
// Vercel Deploy Hook'u POST eder → yeni build başlar → scripts/fetch-eczane.mjs
// ve scripts/news-aggregator.mjs taze veri çeker, deploy edilir.
//
// Setup:
//   1. Vercel Dashboard → Settings → Git → Deploy Hooks → Create Hook
//      → Name: "Daily refresh", Branch: main
//   2. URL'i kopyala
//   3. Env Variables → VERCEL_DEPLOY_HOOK_URL = <url>

export default async function handler(req, res) {
  // Auth: Vercel cron Authorization: Bearer <CRON_SECRET> ile çağırır
  // (Vercel Pro plan otomatik header). Hobby plan'da query secret fallback.
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const secret = req.query.secret;
  const expected = process.env.IG_CRON_SECRET || process.env.CRON_SECRET;

  if (expected && auth !== expected && secret !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return res.status(500).json({
      ok: false,
      error: 'VERCEL_DEPLOY_HOOK_URL env tanımlı değil',
      hint: 'Vercel Settings → Git → Deploy Hooks → Create Hook'
    });
  }

  try {
    const r = await fetch(hookUrl, { method: 'POST' });
    const body = await r.text();
    return res.status(200).json({
      ok: r.ok,
      status: r.status,
      triggered_at: new Date().toISOString(),
      body_preview: body.slice(0, 200),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
