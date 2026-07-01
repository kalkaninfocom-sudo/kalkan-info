// api/cron-weekly-plan.js
// Multi-mode cron endpoint — Vercel Hobby 12-function limit nedeniyle hep aynı endpoint, mode router.
//
// Modes:
//   weekly  (default, Pzt 06:00 UTC = 09:00 TR) → scripts/weekly-content-planner.mjs
//   trend   (her gün 02:00 + 14:00 UTC = 05:00 + 17:00 TR) → lib/trend-scout.js scoutTrends
//   director(her gün 03:00 UTC = 06:00 TR) → lib/content-director.js decideToday + brand-guard
//
// Çağrı: /api/cron-weekly-plan?mode=trend  veya  ?mode=director

import { runAgent } from '../lib/agent-logger.js';

export default async function handler(req, res) {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const expected = process.env.IG_CRON_SECRET || process.env.CRON_SECRET;
  if (expected && auth !== expected && req.query.secret !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const mode = (req.query.mode || 'weekly').toLowerCase();

  try {
    if (mode === 'trend') {
      const { scoutTrends } = await import('../lib/trend-scout.js');
      const out = await runAgent('trend-scout', { trigger: 'cron' }, async () => {
        const r = await scoutTrends();
        return { ...r, outputBrief: `${r.items?.length || 0} trend, ${r.inserted || 0} insert` };
      });
      return res.status(200).json({ ok: true, mode, ...out });
    }

    if (mode === 'growth') {
      const { generateWeeklyPlan } = await import('../lib/growth-strategist.js');
      const out = await runAgent('growth-strategist', { trigger: 'cron' }, async () => {
        const r = await generateWeeklyPlan();
        return { ...r, outputBrief: `${r.plan?.top_3_actions?.length || 0} aksiyon, ${r.plan?.warnings?.length || 0} uyarı`, cost: r.cost };
      });
      return res.status(200).json({ ok: true, mode, ...out });
    }

    if (mode === 'director') {
      const { decideToday } = await import('../lib/content-director.js');
      const { guard } = await import('../lib/brand-guard.js');

      const decision = await runAgent('content-director', { trigger: 'cron' }, async () => {
        const r = await decideToday();
        return { ...r, outputBrief: `${r.candidates?.length || 0} aday, top conf ${r.candidates?.[0]?.confidence ?? 0}`, cost: r.cost };
      });

      const guarded = [];
      for (const c of (decision.candidates || []).slice(0, 3)) {
        const g = await runAgent('brand-guard', { trigger: 'auto', input: c.caption_draft?.slice(0, 80) }, async () => {
          const r = await guard({ caption: c.caption_draft, hashtags: c.hashtags, pillar: c.pillar });
          return { ...r, outputBrief: `pass=${r.pass} score=${r.score.toFixed(2)}`, cost: r.cost };
        });
        guarded.push({ rank: c.rank, pillar: c.pillar, confidence: c.confidence, guard: g });
      }

      return res.status(200).json({ ok: true, mode, decision: { date: decision.date, count: decision.candidates?.length }, guarded });
    }

    if (mode === 'ads') {
      const { runAdsOptimizer } = await import('../lib/ads-optimizer.js');
      const out = await runAgent('ads-optimizer', { trigger: 'cron' }, async () => {
        const r = await runAdsOptimizer({ window: '7d' });
        return { ...r, outputBrief: r.summary };
      });
      return res.status(200).json({ ok: true, mode, ...out });
    }

    if (mode === 'analyst') {
      const { runSocialAnalyst } = await import('../lib/social-analyst.js');
      const out = await runAgent('social-analyst', { trigger: 'cron' }, async () => {
        const r = await runSocialAnalyst({ window: '7d' });
        return { ...r, outputBrief: r.summary };
      });
      return res.status(200).json({ ok: true, mode, ...out });
    }

    if (mode === 'publish') {
      // Gap A fix: "Önerilen Saatte" onaylanan (approved + scheduled_at<=now) post'ları
      // yayınla. Vercel cron 2/2 dolu olduğu için ayrı cron yerine bu router'a dal +
      // dış tetikleyici (cron-job.org). social-publish-queue.js mantığını çağırır.
      const pub = (await import('./social-publish-queue.js')).default;
      // İç auth: publish-queue kendi secret'ını query'den bekler.
      const shimReq = { query: { secret: expected }, headers: {} };
      let payload = null;
      const shimRes = {
        status() { return this; },
        json(o) { payload = o; return this; },
      };
      await pub(shimReq, shimRes);
      return res.status(200).json({ ok: true, mode: 'publish', ...payload });
    }

    if (mode === 'remind') {
      // Workflow 4 (takip/tırmandırma) + Gap C (seed→onay köprüsü).
      await import('../scripts/approval-reminder.mjs');
      return res.status(200).json({
        ok: true, mode: 'remind', triggered_at: new Date().toISOString(),
        note: 'approval-reminder çalıştı — hatırlatma/eskalasyon için bota bak.',
      });
    }

    // default: weekly
    await import('../scripts/weekly-content-planner.mjs');
    return res.status(200).json({
      ok: true,
      mode: 'weekly',
      triggered_at: new Date().toISOString(),
      note: 'Planner çalıştı — Telegram onay mesajları için bota bak.'
    });
  } catch (err) {
    console.error('[cron-weekly-plan]', mode, err);
    return res.status(500).json({ ok: false, mode, error: String(err.message || err) });
  }
}
