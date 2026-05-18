// api/cron-refresh-ig-token.js
// Vercel cron: her ayın 1'i 04:00 UTC → IG_LONG_LIVED_TOKEN'i fb_exchange_token
// ile yeniler (henüz expire olmadıysa). 60 gün → tekrar 60 gün.
// Token expire OLDU ise Telegram'a uyarı atar.

export default async function handler(req, res) {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const expected = process.env.IG_CRON_SECRET;
  if (expected && auth !== expected && req.query.secret !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;
  const CURRENT = process.env.IG_LONG_LIVED_TOKEN;
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;

  async function notify(text) {
    if (!TG_TOKEN || !TG_CHAT) return;
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' })
    }).catch(() => {});
  }

  if (!APP_ID || !APP_SECRET || !CURRENT) {
    await notify('⚠️ IG token refresh: env eksik (META_APP_ID/META_APP_SECRET/IG_LONG_LIVED_TOKEN)');
    return res.status(500).json({ ok: false, error: 'env missing' });
  }

  try {
    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${encodeURIComponent(APP_SECRET)}&fb_exchange_token=${CURRENT}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok || !data.access_token) {
      await notify(`❌ *IG token refresh fail*\n\n${data.error?.message || JSON.stringify(data).slice(0, 300)}\n\nManuel adım: Graph API Explorer\'dan yeni short-lived token al ve scripts/refresh-ig-token.mjs --short=... çalıştır.`);
      return res.status(500).json({ ok: false, error: data });
    }

    // Vercel env update — VERCEL_TOKEN gerekirse env'de olmalı; yoksa skip + bildir
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    if (VERCEL_TOKEN) {
      const PROJ = 'prj_BH2LwGySrcm0VTNmOqam14bGLdGN';
      const TEAM = 'team_KQRZpbniYV5I2ZFb1BwcMdxJ';
      // Find existing env id
      const list = await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env?teamId=${TEAM}`, {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }
      }).then(r => r.json());
      const existing = (list.envs || []).find(e => e.key === 'IG_LONG_LIVED_TOKEN' && e.target.includes('production'));
      if (existing) {
        await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env/${existing.id}?teamId=${TEAM}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: data.access_token })
        });
      }
    }

    const days = Math.round(data.expires_in / 86400);
    await notify(`✅ *IG token refresh OK*\n\n${days} gün geçerli\n\n${VERCEL_TOKEN ? 'Vercel env güncellendi' : 'Token alındı ama VERCEL_TOKEN yok — env\'i manuel güncelle'}`);
    return res.status(200).json({ ok: true, days, vercel_updated: !!VERCEL_TOKEN });
  } catch (e) {
    await notify(`❌ IG token cron exception: ${String(e.message || e).slice(0, 200)}`);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
