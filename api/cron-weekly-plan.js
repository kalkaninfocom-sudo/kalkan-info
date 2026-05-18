// api/cron-weekly-plan.js
// Vercel cron Pazartesi 06:00 UTC (= 09:00 TR) çağırır.
// Deploy hook'u POST eder → yeni build → scripts/weekly-content-planner.mjs
// build sırasında değil ama spawned process. Daha temiz: doğrudan ESM import.

export default async function handler(req, res) {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const expected = process.env.IG_CRON_SECRET || process.env.CRON_SECRET;
  if (expected && auth !== expected && req.query.secret !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    // ESM dynamic import — script main() çalıştırır
    const mod = await import('../scripts/weekly-content-planner.mjs');
    return res.status(200).json({
      ok: true,
      triggered_at: new Date().toISOString(),
      note: 'Planner çalıştı — Telegram onay mesajları için bota bak.'
    });
  } catch (err) {
    console.error('[cron-weekly-plan]', err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
