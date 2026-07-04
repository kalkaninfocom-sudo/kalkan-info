// api/telegram-webhook.js
// Telegram bot inline-button callback handler — onay flow.
//
// Setup tamamlandı:
//   ✅ TELEGRAM_BOT_TOKEN (Vercel env)
//   ✅ TELEGRAM_WEBHOOK_SECRET (Vercel env)
//   ✅ TELEGRAM_ADMIN_CHAT_ID (Vercel env)
//   ✅ Webhook URL: https://www.kalkaninfo.com/api/telegram-webhook

import { answerCallbackQuery, editMessageText, escapeMd, sendMessage } from '../lib/telegram.js';
import { publishCarousel, publishSingleImage, publishReels } from '../lib/instagram-publish.js';
import { publishFacebookReel, publishFacebookPhoto } from '../lib/facebook-publish.js';
import { fetchAgentStatus, summarizeByAgent } from '../lib/agent-logger.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(path, opts = {}) {
  return fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

async function updateStatus(postId, patch) {
  if (!SUPA_URL || !SUPA_KEY) return null;
  const res = await supa(`/social_posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error('[telegram-webhook] supabase patch fail', res.status, await res.text());
    return null;
  }
  const [updated] = await res.json();
  return updated;
}

async function publishNow(post) {
  const IG_USER_ID = process.env.IG_BUSINESS_ID;
  const IG_TOKEN = process.env.IG_LONG_LIVED_TOKEN;
  if (!IG_USER_ID || !IG_TOKEN) {
    console.warn('[publishNow] IG env eksik');
    return;
  }
  // local_assets göreli yol ('/newspaper/...') tutabilir — IG/FB image_url'i FETCH eder,
  // göreli yolu çözemez → Graph API 9004 "Only photo or video". Mutlak public URL'e normalize et.
  // Non-www doğrulanmış 200 (www 308 redirect → Meta fetch'i bozabilir), o yüzden non-www.
  const SITE = (process.env.SITE_BASE || 'https://kalkaninfo.com').replace(/\/$/, '');
  const assets = (post.local_assets || []).map(a =>
    /^https?:\/\//i.test(a) ? a : `${SITE}/${String(a).replace(/^\//, '')}`);
  if (!assets.length) {
    console.warn('[publishNow] local_assets yok, atlandı');
    await updateStatus(post.id, { status: 'failed', engagement_metrics: { error: 'no_assets' } });
    return;
  }
  const captionFull = (post.caption || '') +
    (Array.isArray(post.hashtags) && post.hashtags.length ? '\n\n' + post.hashtags.join(' ') : '');
  const caption = captionFull.slice(0, 2200);

  try {
    let mediaId;
    if (post.content_type === 'reels' || post.content_type === 'video') {
      // Reel: assets[0] = video URL (Supabase storage). publishReels container→poll→publish.
      mediaId = await publishReels(IG_USER_ID, IG_TOKEN, assets[0], caption);
    } else if (assets.length >= 2) {
      mediaId = await publishCarousel(IG_USER_ID, IG_TOKEN, assets, caption);
    } else {
      mediaId = await publishSingleImage(IG_USER_ID, IG_TOKEN, assets[0], caption);
    }

    // Facebook paralel yayın (aynı system-user token). Hata IG yayınını BOZMAZ (FB bonus).
    let fbResult = 'atlandı (env yok)';
    const FB_ID = process.env.FB_PAGE_ID, FB_TOKEN = process.env.FB_PAGE_TOKEN;
    if (FB_ID && FB_TOKEN) {
      try {
        if (post.content_type === 'reels' || post.content_type === 'video') {
          await publishFacebookReel(FB_ID, FB_TOKEN, assets[0], caption);
          fbResult = 'reel ✓';
        } else {
          await publishFacebookPhoto(FB_ID, FB_TOKEN, assets[0], caption);
          fbResult = 'foto ✓';
        }
      } catch (fe) {
        console.error('[publishNow] FB fail', fe);
        fbResult = 'hata: ' + String(fe.message || fe).slice(0, 80);
      }
    }

    await updateStatus(post.id, {
      status: 'published',
      published_at: new Date().toISOString(),
      ig_media_id: mediaId,
    });
    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID,
        `✅ *Yayınlandı*\n\n${escapeMd(post.content_pack_id)}\nIG Media ID: \`${escapeMd(String(mediaId))}\`\nFB: ${escapeMd(fbResult)}`);
    }
  } catch (e) {
    console.error('[publishNow] fail', e);
    await updateStatus(post.id, {
      status: 'failed',
      engagement_metrics: { error: String(e.message || e) },
    });
    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID,
        `❌ *Yayın Başarısız*\n\n${escapeMd(post.content_pack_id)}\n\n_${escapeMd(String(e.message || e).slice(0, 250))}_`);
    }
  }
}

export default async function handler(req, res) {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    return res.status(401).json({ ok: false, error: 'invalid secret' });
  }

  const update = req.body || {};

  try {
    // ── Message: /start, /id, /plan
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').trim();

      if (text === '/start' || text === '/id') {
        await sendMessage(chatId,
          `Merhaba Berkay\\! ✅\n\nChat ID: \`${chatId}\`\n\nBu ID Vercel env \`TELEGRAM_ADMIN_CHAT_ID\` olarak eklendi\\. Onay flow aktif\\.\n\nKomutlar:\n/plan — bu haftaki planı göster\n/pending — onay bekleyenleri listele\n/agents — agent organizma durumu`);
      } else if (text === '/agents') {
        try {
          const rows = await fetchAgentStatus(200);
          const summary = summarizeByAgent(rows);
          if (!summary.length) {
            await sendMessage(chatId, '🤖 *Agent Organizma*\n\n_Henüz çalışma logu yok\\. Migration uygulandı mı?_');
          } else {
            const totalCost = summary.reduce((s, a) => s + a.cost, 0);
            const totalRuns = summary.reduce((s, a) => s + a.runs, 0);
            const totalFails = summary.reduce((s, a) => s + a.failures, 0);
            const dot = (s) => s === 'success' ? '🟢' : s === 'failed' ? '🔴' : s === 'running' ? '🟡' : '⚪';
            const ago = (iso) => {
              const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
              if (m < 1) return 'şimdi';
              if (m < 60) return `${m}dk önce`;
              if (m < 1440) return `${Math.floor(m/60)}sa önce`;
              return `${Math.floor(m/1440)}g önce`;
            };
            const lines = summary.slice(0, 20).map(a =>
              `${dot(a.last_status)} \`${escapeMd(a.agent.padEnd(20))}\` ${escapeMd(ago(a.last_at))} · ${a.runs}× · $${a.cost.toFixed(2)}`
            );
            const body = [
              `🤖 *Agent Organizma* — son 200 run`,
              ``,
              `Toplam: ${totalRuns} çalışma · ${totalFails} hata · $${totalCost.toFixed(2)}`,
              ``,
              ...lines,
            ].join('\n');
            await sendMessage(chatId, body);
          }
        } catch (e) {
          await sendMessage(chatId, `❌ Hata: ${escapeMd(String(e.message || e))}`);
        }
      } else if (text === '/plan' || text === '/pending') {
        if (SUPA_URL && SUPA_KEY) {
          const r = await supa('/social_posts?status=eq.pending_approval&order=scheduled_at.asc&select=id,content_pack_id,scheduled_at&limit=10');
          const list = r.ok ? await r.json() : [];
          const body = list.length
            ? list.map(p => `• ${escapeMd(p.content_pack_id)} → ${escapeMd(new Date(p.scheduled_at).toLocaleString('tr-TR'))}`).join('\n')
            : '_Onay bekleyen post yok\\._';
          await sendMessage(chatId, `📋 *Bekleyen Post'lar*\n\n${body}`);
        } else {
          await sendMessage(chatId, '_Supabase yapılandırılmadı\\._');
        }
      }
      return res.status(200).json({ ok: true });
    }

    // ── Callback query: 4-button approval
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      const [verb, postId, action] = data.split(':');
      if (verb !== 'pub') {
        await answerCallbackQuery(cb.id, { text: 'Bilinmeyen komut' });
        return res.status(200).json({ ok: true });
      }

      // Test post handling (postId === 'test-patara' etc)
      const isTest = postId && postId.startsWith('test-');
      let post = null;

      if (!isTest) {
        // Real DB update
        const now = new Date();
        let patch = {};
        if (action === 'now') {
          patch = { status: 'approved', scheduled_at: now.toISOString() };
        } else if (action === 'scheduled') {
          patch = { status: 'approved' };
        } else if (action === 'edit') {
          patch = { status: 'draft' };
        } else if (action === 'reject') {
          patch = { status: 'rejected', reject_reason: 'admin_telegram_reject' };
        }
        post = await updateStatus(postId, patch);

        // "Yayınla Şimdi" — Hobby plan cron günde 1 olduğu için
        // beklemeden anında IG'ye gönder
        if (action === 'now' && post) {
          // Async — webhook 200 dönsün, publish arka planda
          publishNow(post).catch(e => console.error('[publishNow]', e));
        }
      }

      const toastMap = {
        now:       '✅ Yayın kuyruğa alındı (1dk içinde)',
        scheduled: '⏰ Önerilen saate planlandı',
        edit:      '✏️ Taslağa alındı — admin panelden düzenle',
        reject:    '❌ Reddedildi',
      };
      const statusLabel = {
        now: 'APPROVED — Yayında 1dk içinde',
        scheduled: 'APPROVED — Planlandı',
        edit: 'DRAFT — Düzenle',
        reject: 'REJECTED',
      };

      await answerCallbackQuery(cb.id, { text: toastMap[action] || 'Aksiyon alındı' });

      if (chatId && messageId) {
        const orig = cb.message?.text || '';
        const sched = post?.scheduled_at
          ? new Date(post.scheduled_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
          : new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
        await editMessageText(chatId, messageId,
          `${escapeMd(orig)}\n\n━━━━━━━━━━\n*Durum:* ${escapeMd(statusLabel[action] || 'UPDATED')}\n*Zaman:* ${escapeMd(sched)}`,
          { reply_markup: { inline_keyboard: [] } });
      }

      return res.status(200).json({ ok: true, action, postId, status: post?.status || 'test' });
    }

    return res.status(200).json({ ok: true, handled: false });
  } catch (err) {
    console.error('[telegram-webhook]', err);
    return res.status(200).json({ ok: false, error: String(err.message || err) });
  }
}
