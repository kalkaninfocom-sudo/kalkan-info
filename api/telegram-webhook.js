// api/telegram-webhook.js
// Telegram bot inline-button callback handler — onay flow.
//
// Setup tamamlandı:
//   ✅ TELEGRAM_BOT_TOKEN (Vercel env)
//   ✅ TELEGRAM_WEBHOOK_SECRET (Vercel env)
//   ✅ TELEGRAM_ADMIN_CHAT_ID (Vercel env)
//   ✅ Webhook URL: https://www.kalkaninfo.com/api/telegram-webhook

import { answerCallbackQuery, editMessageText, escapeMd, sendMessage, getFileUrl, sendPhotoBuffer } from '../lib/telegram.js';
import { shopImage, pickRecipe } from '../lib/image-shop.js';
import { publishCarousel, publishSingleImage, publishReels } from '../lib/instagram-publish.js';
import { publishFacebookReel, publishFacebookPhoto } from '../lib/facebook-publish.js';
import { fanoutExtraPlatforms, fanoutSummary } from '../lib/social-fanout.js';
import { fetchAgentStatus, summarizeByAgent } from '../lib/agent-logger.js';
import { cheapLLM } from '../lib/cheap-llm.mjs';

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

// ── AJAN YÖNLENDİRME (Telegram'dan ajanlarla konuş) ──
// Berkay: "yazdığım hangi alanla ilgiliyse o ajan çalışsın." Düz metin → alan sınıflandır → ajan çalış → yanıt.
const AGENCY_EDGE = process.env.AGENCY_EDGE || 'https://dgichfealzdpfhdgryym.supabase.co/functions/v1/agency';
const AGENCY_KEY = process.env.AGENCY_KEY || 'sb_publishable_26HXaUgGqxZUOuxbcPhiDQ_s3MvKVpr';

// Alan → ajan anahtar kelime haritası (en çok eşleşen kazanır; yoksa director).
const AGENT_KEYWORDS = {
  muhabir: ['haber', 'manşet', 'gazete haber', 'muhabir', 'gündem', 'gelişme'],
  'magazin-editoru': ['magazin', 'gece hayatı', 'kültür', 'lezzet', 'gece kulüb'],
  'reels-uretici': ['reels', 'reel', 'video', 'tiktok video'],
  writer: ['caption', 'post yaz', 'sosyal metin', 'instagram yazı', 'gönderi metni', 'hashtag'],
  trend: ['trend', 'gündemde ne', 'popüler'],
  growth: ['büyüme', 'seo', 'trafik', 'kaldıraç', 'organik'],
  ads: ['reklam bütçe', 'ads', 'roas', 'meta reklam'],
  analyst: ['analitik', 'metrik', 'istatistik', 'performans raporu'],
  'tatil-planner': ['tatil', 'rota', 'gezi planı', 'kaç gün', 'program öner'],
  'gezgin-rehber': ['antik', 'likya', 'patara', 'xanthos', 'letoon', 'tlos', 'kekova', 'tarihi', 'rehber'],
  'menu-chef': ['menü', 'yemek listesi', 'restoran menü'],
  'provider-matcher': ['villa', 'otel', 'tekne', 'transfer', 'sağlayıcı', 'konaklama'],
  'dil-cevirmen': ['çeviri', 'çevir', 'translate', 'ingilizce', 'almanca', 'rusça'],
  'hava-plan': ['hava', 'yağmur', 'fırtına', 'meteoroloji'],
  'kvkk-guardian': ['kvkk', 'gdpr', 'gizlilik', 'hukuk', 'yasal'],
  'ilan-uzmani': ['iş ilanı', 'eleman', 'iş var', 'personel'],
  'bulten-editoru': ['bülten', 'haftalık özet'],
  'news-verifier': ['doğrula', 'haber doğru mu', 'teyit'],
  guard: ['marka denetim', 'ton kontrol', 'risk denetim'],
  'audit-agent': ['site denetim', 'eksik bul', 'audit', 'kırık link'],
  'deploy-agent': ['deploy', 'build', 'dağıtım'],
  reception: ['whatsapp', 'müşteri mesaj', 'rezervasyon talep'],
  director: ['ne paylaşalım', 'içerik kararı', 'fikir öner', 'bugün ne'],
};
const KNOWN_AGENTS = new Set([...Object.keys(AGENT_KEYWORDS),
  'foto-editoru', 'gazete-sosyal', 'yayin-yonetmeni', 'reklam-uyum', 'gazete-reel-en']);

function routeToAgent(text) {
  const t = (text || '').toLowerCase();
  let best = 'director', bestScore = 0;
  for (const [agent, kws] of Object.entries(AGENT_KEYWORDS)) {
    let s = 0;
    for (const kw of kws) if (t.includes(kw)) s += kw.length; // uzun eşleşme daha güçlü
    if (s > bestScore) { bestScore = s; best = agent; }
  }
  return best;
}

// Ajan config + hafızasını deploy edilmiş statik JSON'dan çek (Vercel bundle'a bağımlı değil).
let AGENTS_CFG = null;
async function getAgentsCfg() {
  if (AGENTS_CFG) return AGENTS_CFG;
  try {
    const r = await fetch('https://kalkaninfo.com/data/agency/agents.json', { signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    AGENTS_CFG = d.agents || {};
  } catch { AGENTS_CFG = {}; }
  return AGENTS_CFG;
}
async function getAgentKnowledge(id) {
  try {
    const r = await fetch(`https://kalkaninfo.com/data/agency/knowledge/${id}.json`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return '';
    const d = await r.json();
    const lessons = (d.lessons || []).slice(-3).map(l => l.summary).filter(Boolean);
    return lessons.length ? `\n\nÖĞRENDİKLERİN (kendi alanında son okumaların — bunu uygula):\n- ${lessons.join('\n- ')}` : '';
  } catch { return ''; }
}
// Ajanı DOĞRUDAN cheap-llm ile çalıştır (hızlı, çok-sağlayıcı). Yavaş NVIDIA Edge Function'a bağımlı DEĞİL.
async function runAgentChat(agentId, task) {
  try {
    const agents = await getAgentsCfg();
    const a = agents[agentId];
    if (!a) return { error: `bilinmeyen ajan: ${agentId}` };
    const know = await getAgentKnowledge(agentId);
    const res = await cheapLLM(String(task).slice(0, 2000), {
      system: (a.system || '') + know,
      maxTokens: 700, temperature: 0.5,
      order: ['groq', 'cerebras', 'gemini', 'claude'], // ollama/nvidia hariç (Vercel'de yok/yavaş)
      timeoutMs: 20000,
    });
    return { result: res.text, provider: res.provider, name: a.name };
  } catch (e) { return { error: String(e.message || e) }; }
}

async function publishNow(post) {
  // Env adı toleransı: prod'da hangi ad set edilmişse çalışsın.
  const IG_USER_ID = process.env.IG_BUSINESS_ID || process.env.IG_ACCOUNT_ID || process.env.IG_USER_ID;
  const IG_TOKEN = process.env.IG_LONG_LIVED_TOKEN || process.env.IG_TOKEN;
  if (!IG_USER_ID || !IG_TOKEN) {
    // Sessizce dönme — durumu 'failed' işaretle + Telegram'a net bildir (yoksa post sonsuza dek 'approved' çürür).
    console.error('[publishNow] IG env eksik (IG_BUSINESS_ID/IG_LONG_LIVED_TOKEN)');
    await updateStatus(post.id, { status: 'failed', engagement_metrics: { error: 'IG env eksik (prod: IG_BUSINESS_ID + IG_LONG_LIVED_TOKEN set edilmeli)' } });
    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID,
        `❌ *Yayın yapılamadı* — IG env eksik\n\n${escapeMd(String(post.content_pack_id || post.id))}\n\n_Vercel prod'da IG\\_BUSINESS\\_ID ve IG\\_LONG\\_LIVED\\_TOKEN set edilmeli._`);
    }
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

    // IG başarılı — durumu HEMEN kaydet (ek platform gecikmesi/timeout bunu kaybetmesin).
    await updateStatus(post.id, {
      status: 'published',
      published_at: new Date().toISOString(),
      ig_media_id: mediaId,
    });

    // Ek platformlar (Threads/Bluesky/YouTube/TikTok) — graceful, IG/FB'yi bozmaz. Bonus dağıtım.
    let extraSummary = '';
    try {
      const isVid = post.content_type === 'reels' || post.content_type === 'video';
      const extra = await fanoutExtraPlatforms({ caption, mediaUrl: assets[0], isVideo: isVid });
      extraSummary = fanoutSummary(extra);
    } catch (fe) { console.error('[publishNow] fanout fail', fe); }

    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID,
        `✅ *Yayınlandı*\n\n${escapeMd(post.content_pack_id)}\nIG Media ID: \`${escapeMd(String(mediaId))}\`\nFB: ${escapeMd(fbResult)}` +
        (extraSummary ? `\n\n_Ek platformlar:_\n${escapeMd(extraSummary)}` : ''));
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

// ── PHOTO-SHOP: telefon fotosu → yayına-hazır görsel (nano-banana) ──
// PC gerekmez (Vercel). Reçete caption'dan: enhance/removebg/relight/menu/social (vars: menu).
async function handleShopPhoto(chatId, msg) {
  const recipe = pickRecipe(msg.caption || '');
  await sendMessage(chatId, `📸 Fotoğrafı aldım — _${escapeMd(recipe)}_ ile işliyorum\\.\\.\\. (birkaç sn)`);
  try {
    const photo = msg.photo[msg.photo.length - 1]; // en yüksek çözünürlük
    const url = await getFileUrl(photo.file_id);
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const inBuf = Buffer.from(await resp.arrayBuffer());
    const { outBuffer, provenance } = await shopImage({ buffer: inBuf, recipe });
    await sendPhotoBuffer(chatId, outBuffer, `✅ Hazır (${recipe}) · ajansAI`);
    // provenance → Supabase audit (varsa); yoksa sessiz
    if (SUPA_URL && SUPA_KEY) {
      await supa('/image_audit', { method: 'POST', body: JSON.stringify({
        chat_id: String(chatId), recipe, input_sha: provenance.inputSha,
        output_sha: provenance.outputSha, engine: provenance.engine, ts: provenance.ts,
      }) }).catch(() => {});
    }
  } catch (e) {
    const is429 = e.status === 429 || /quota|billing|429/i.test(String(e.message));
    if (is429) {
      await sendMessage(chatId, '⚠️ Görsel motoru için *billing* açılmalı \\(Gemini free\\-tier kota=0\\)\\. Açılınca foto\\-shop anında çalışır\\.');
    } else {
      await sendMessage(chatId, `⚠️ İşlenemedi: ${escapeMd(String(e.message || e).slice(0, 200))}`);
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

      // ── Foto geldi → Photo-Shop (nano-banana) ──
      if (Array.isArray(msg.photo) && msg.photo.length) {
        await handleShopPhoto(chatId, msg);
        return res.status(200).json({ ok: true });
      }

      if (text === '/start' || text === '/id') {
        await sendMessage(chatId,
          `Merhaba Berkay\\! ✅\n\nChat ID: \`${chatId}\`\n\nBu ID Vercel env \`TELEGRAM_ADMIN_CHAT_ID\` olarak eklendi\\. Onay flow aktif\\.\n\nKomutlar:\n/plan — bu haftaki planı göster\n/pending — onay bekleyenleri listele\n/agents — agent organizma durumu\n\n📸 *Foto\\-Shop:* bir fotoğraf yolla → yayına\\-hazır hale getireyim\\. Caption ile reçete: _enhance · removebg · relight · menu · social_`);
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
      } else if (text === '/ajanlar' || text === '/help') {
        await sendMessage(chatId,
          '🤖 *Ajanlarla konuş*\n\nDüz yaz — mesajın hangi alanla ilgiliyse o ajan çalışır ve yanıtlar\\.\n' +
          'Belirli ajanı zorla: `@muhabir <mesaj>` veya `/ajan muhabir <mesaj>`\n\n' +
          'Örn: _"kaputaş için reels fikri"_ → reels ajanı\\. _"patara tarihi"_ → rehber ajanı\\.');
      } else if (text.startsWith('@') || text.startsWith('/ajan ') || (text && !text.startsWith('/'))) {
        // ── Serbest metin → ilgili ajana yönlendir, çalıştır, yanıtla (PC gerekmez, serverless)
        let agentId = null, task = text;
        const mAt = text.match(/^@([a-z][a-z-]+)\s+([\s\S]+)/i);
        const mCmd = text.match(/^\/ajan\s+([a-z][a-z-]+)\s+([\s\S]+)/i);
        if (mAt) { agentId = mAt[1].toLowerCase(); task = mAt[2].trim(); }
        else if (mCmd) { agentId = mCmd[1].toLowerCase(); task = mCmd[2].trim(); }
        else { agentId = routeToAgent(text); }
        if (!KNOWN_AGENTS.has(agentId)) agentId = 'director';
        await sendMessage(chatId, `🧠 _${escapeMd(agentId)}_ çalışıyor\\.\\.\\.`);
        const out = await runAgentChat(agentId, task);
        if (out.result) {
          await sendMessage(chatId, `🤖 *${escapeMd(agentId)}*\n\n${escapeMd(String(out.result).slice(0, 3500))}`);
        } else {
          await sendMessage(chatId, `❌ _${escapeMd(agentId)}_ yanıt veremedi: ${escapeMd(String(out.error || 'bilinmeyen hata').slice(0, 200))}`);
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
