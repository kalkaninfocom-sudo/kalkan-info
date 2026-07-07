#!/usr/bin/env node
/**
 * scripts/agency/publish-approved.mjs
 * ONAYLI POST'LARI YAYINLA — self-contained (korumalı endpoint'e curl YOK).
 *
 * NEDEN: api/social-publish-queue.js doğru mantığı içerir ama (1) hiçbir cron'a bağlı değildi,
 * (2) IG_CRON_SECRET ile korunuyor ve prod'daki secret değeri dış çağrılarla eşleşmiyor (401) →
 * auto-publish dahil "endpoint'i curl'le" deseni kırık. Bu script Supabase + IG/FB'yi DOĞRUDAN
 * kullanır (GitHub Actions secret'larıyla), secret-eşleştirme kırılganlığını ortadan kaldırır.
 *
 * Akış: status=approved + scheduled_at<=now + son STALE_HOURS içinde + published_at=null →
 *   IG'ye (carousel/single/reels) + FB'ye yayınla → published/failed işaretle → Telegram bildir.
 *
 * Env (GitHub Actions secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   IG_BUSINESS_ID(||IG_ACCOUNT_ID||IG_USER_ID), IG_LONG_LIVED_TOKEN(||IG_TOKEN),
 *   FB_PAGE_ID, FB_PAGE_TOKEN (ops), TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (ops bildirim).
 *
 * Kullanım: node scripts/agency/publish-approved.mjs [--dry-run] [--stale-hours=12]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishCarousel, publishSingleImage, publishReels } from '../../lib/instagram-publish.js';
import { publishFacebookReel, publishFacebookPhoto } from '../../lib/facebook-publish.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel; CI'da env zaten dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const IG_USER_ID = process.env.IG_BUSINESS_ID || process.env.IG_ACCOUNT_ID || process.env.IG_USER_ID;
const IG_TOKEN = process.env.IG_LONG_LIVED_TOKEN || process.env.IG_TOKEN;
const FB_ID = process.env.FB_PAGE_ID, FB_TOKEN = process.env.FB_PAGE_TOKEN;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN, TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
// non-www: canonical + Vercel primary (www 308 redirect → Meta image-fetch'i bozar).
const SITE_BASE = (process.env.SITE_BASE || 'https://kalkaninfo.com').replace(/\/$/, '').replace('://www.', '://');

const DRY = process.argv.includes('--dry-run');
const STALE_HOURS = Number((process.argv.find(a => a.startsWith('--stale-hours=')) || '').split('=')[1]) ||
  Number(process.env.PUBLISH_STALE_HOURS || 12);

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts, headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

async function notify(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (e) { console.warn('telegram notify fail:', e.message); }
}

function buildCaption(post) {
  const caption = post.caption || post.content || '';
  const tags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : (post.hashtags || '');
  const full = tags ? `${caption}\n\n${tags}` : caption;
  return full.length <= 2200 ? full : full.slice(0, 2197) + '...';
}
function resolveImageUrls(localAssets) {
  if (!Array.isArray(localAssets)) return [];
  return localAssets.filter(p => typeof p === 'string' && p.trim())
    .map(p => (p.startsWith('http') ? p : `${SITE_BASE}${p.startsWith('/') ? p : '/' + p}`));
}

async function main() {
  if (!SUPA_URL || !SUPA_KEY) { console.error('❌ Supabase env eksik'); process.exit(1); }
  if (!IG_USER_ID || !IG_TOKEN) {
    console.error('❌ IG env eksik (IG_BUSINESS_ID + IG_LONG_LIVED_TOKEN)');
    await notify('❌ <b>Yayın atlandı</b> — GitHub Actions IG env eksik (IG_BUSINESS_ID + IG_LONG_LIVED_TOKEN secret gerekli).');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const floor = new Date(Date.now() - STALE_HOURS * 3600_000).toISOString();
  const q = `/social_posts?status=eq.approved&scheduled_at=lte.${encodeURIComponent(now)}` +
    `&scheduled_at=gte.${encodeURIComponent(floor)}&published_at=is.null&order=scheduled_at.asc&limit=5`;
  const res = await supa(q);
  if (!res.ok) { console.error('❌ Supabase fetch fail', res.status, await res.text()); process.exit(1); }
  const posts = await res.json();

  console.log(`[publish-approved] ${posts.length} onaylı post (son ${STALE_HOURS}s içinde planlı)`);
  if (DRY) { posts.forEach(p => console.log('  [dry]', p.content_pack_id, '·', (p.local_assets || []).length, 'asset')); return; }

  let published = 0, failed = 0;
  for (const post of posts) {
    const label = post.content_pack_id || post.id;
    try {
      const imageUrls = resolveImageUrls(post.local_assets);
      const caption = buildCaption(post);
      if (!imageUrls.length) throw new Error('local_assets boş — en az 1 görsel gerekli');

      let result;
      if (post.content_type === 'reels' || post.content_type === 'video') result = await publishReels(IG_USER_ID, IG_TOKEN, imageUrls[0], caption);
      else if (imageUrls.length >= 2) result = await publishCarousel(IG_USER_ID, IG_TOKEN, imageUrls, caption);
      else result = await publishSingleImage(IG_USER_ID, IG_TOKEN, imageUrls[0], caption);

      // Facebook paralel (hata IG'yi bozmaz)
      let fbResult = 'atlandı';
      if (FB_ID && FB_TOKEN) {
        try {
          if (post.content_type === 'reels' || post.content_type === 'video') { await publishFacebookReel(FB_ID, FB_TOKEN, imageUrls[0], caption); fbResult = 'reel ✓'; }
          else { await publishFacebookPhoto(FB_ID, FB_TOKEN, imageUrls[0], caption); fbResult = 'foto ✓'; }
        } catch (fe) { console.error('FB fail', fe.message); fbResult = 'hata'; }
      }

      await supa(`/social_posts?id=eq.${post.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'published', published_at: new Date().toISOString(), ig_media_id: result.mediaId }),
      });
      published++;
      console.log(`  ✅ ${label} → IG ${result.mediaId} · FB ${fbResult}`);
      await notify(`✅ Yayınlandı: <b>${label}</b>\nTür: ${result.type} · IG: ${result.mediaId} · FB: ${fbResult}`);
    } catch (err) {
      failed++;
      await supa(`/social_posts?id=eq.${post.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'failed', engagement_metrics: { error: String(err.message || err) } }),
      });
      console.error(`  ❌ ${label} → ${err.message}`);
      await notify(`❌ Yayın başarısız: <b>${label}</b>\n${String(err.message || err).slice(0, 200)}`);
    }
  }
  console.log(`[publish-approved] bitti: ${published} yayınlandı, ${failed} başarısız`);
}

main().catch(e => { console.error('[publish-approved]', e); process.exit(1); });
