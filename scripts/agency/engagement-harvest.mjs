#!/usr/bin/env node
/**
 * scripts/agency/engagement-harvest.mjs — 2. BEYİN: ENGAGEMENT DUYUSU (Katman 2)
 * ---------------------------------------------------------------------------
 * Beyni "kör"lükten çıkarır: yayınladığı postun GERÇEK sonucunu ölçer ve
 * hafızaya yazar. Döngünün "ölç" adımı. Stratejist (Katman 3) bunu okur.
 *
 * AKIŞ:
 *   1) Supabase social_posts'tan yayınlanan (published_at != null, ig_media_id var)
 *      son LOOKBACK_DAYS içindeki postları çek.
 *   2) Her media_id için IG Graph'tan ölçüm al:
 *        - media node: like_count, comments_count, media_type, media_product_type, timestamp
 *        - /insights?metric=reach,saved,shares,total_interactions (izin varsa; yoksa atla)
 *   3) Postun bildiği meta (content_pack_id, caption, yayın saati, local_assets) ile
 *      birlikte hafızaya 'outcome' olarak yaz + data/agency/engagement.json snapshot.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IG_LONG_LIVED_TOKEN(||IG_TOKEN)
 * Kullanım: node scripts/agency/engagement-harvest.mjs [--days=14] [--dry-run]
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, query } from '../../lib/brain-memory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// .env.local yükle (yerel; pm2/CI'da env dolu olabilir)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const IG_TOKEN = process.env.IG_LONG_LIVED_TOKEN || process.env.IG_TOKEN;
const GRAPH = 'https://graph.facebook.com/v21.0';

const DRY = process.argv.includes('--dry-run');
const DAYS = Number((process.argv.find(a => a.startsWith('--days=')) || '').split('=')[1]) || 14;

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts,
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  signal: AbortSignal.timeout(25000),
});

/** IG media node — her zaman erişilebilir temel sayaçlar. */
async function fetchMedia(mediaId) {
  const fields = 'id,media_type,media_product_type,like_count,comments_count,timestamp,permalink';
  const url = `${GRAPH}/${mediaId}?fields=${encodeURIComponent(fields)}&access_token=${IG_TOKEN}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`media ${mediaId}: ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

/** IG insights — izin/tür bağımlı; başarısızsa null (kör değil, sadece daha az veri). */
async function fetchInsights(mediaId) {
  const url = `${GRAPH}/${mediaId}/insights?metric=reach,saved,shares,total_interactions&access_token=${IG_TOKEN}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const j = await res.json();
    const out = {};
    for (const d of j.data || []) out[d.name] = d.values?.[0]?.value ?? null;
    return out;
  } catch { return null; }
}

async function main() {
  if (!SUPA_URL || !SUPA_KEY) { console.error('❌ Supabase env eksik'); process.exit(1); }
  if (!IG_TOKEN) { console.error('❌ IG token eksik (IG_LONG_LIVED_TOKEN)'); process.exit(1); }

  const floor = new Date(Date.now() - DAYS * 864e5).toISOString();
  const q = `/social_posts?published_at=not.is.null&ig_media_id=not.is.null` +
    `&published_at=gte.${encodeURIComponent(floor)}&order=published_at.desc&limit=50`;
  const res = await supa(q);
  if (!res.ok) { console.error('❌ social_posts fetch fail', res.status, await res.text()); process.exit(1); }
  const posts = await res.json();
  console.log(`[engagement] ${posts.length} yayınlanmış post (son ${DAYS} gün)`);

  // Zaten ölçtüklerimizi hatırla — her media için en taze ölçümü tut (idempotent değil, ama snapshot temiz).
  const measured = [];
  let ok = 0, skip = 0;
  for (const post of posts) {
    const mid = post.ig_media_id;
    try {
      const media = await fetchMedia(mid);
      const ins = await fetchInsights(mid);
      const publishedHour = new Date(post.published_at).getUTCHours();
      const outcome = {
        ref_media_id: mid,
        content_pack_id: post.content_pack_id || null,
        caption: (post.caption || post.content || '').slice(0, 280),
        published_at: post.published_at,
        published_hour_utc: publishedHour,
        media_product_type: media.media_product_type || media.media_type || null,
        permalink: media.permalink || null,
        likes: media.like_count ?? null,
        comments: media.comments_count ?? null,
        reach: ins?.reach ?? null,
        saved: ins?.saved ?? null,
        shares: ins?.shares ?? null,
        total_interactions: ins?.total_interactions ?? null,
        // beynin bildiği köken sinyalleri (varsa) — stratejist korelasyon için kullanır
        lang: post.lang || post.language || null,
        column: post.column || post.content_column || null,
      };
      measured.push(outcome);
      if (!DRY) await record('outcome', outcome, ['engagement', outcome.media_product_type || 'post']);
      ok++;
      console.log(`  ✓ ${mid} reach=${outcome.reach ?? '—'} saved=${outcome.saved ?? '—'} likes=${outcome.likes ?? '—'}`);
    } catch (e) {
      skip++;
      console.log(`  ⚠ ${mid} atlandı: ${e.message?.slice(0, 100)}`);
    }
  }

  // Snapshot (en son ölçüm durumu — insan/rapor için tek bakış)
  if (!DRY) {
    try {
      mkdirSync(join(ROOT, 'data', 'agency'), { recursive: true });
      writeFileSync(join(ROOT, 'data', 'agency', 'engagement.json'),
        JSON.stringify({ measured_at: new Date().toISOString(), days: DAYS, count: measured.length, posts: measured }, null, 2));
    } catch (e) { console.warn('snapshot yazılamadı:', e.message); }
  }

  console.log(`[engagement] bitti: ${ok} ölçüldü, ${skip} atlandı${DRY ? ' (dry-run — hafızaya yazılmadı)' : ''}`);
  console.log(`[engagement] hafıza outcome toplam: ${query({ kind: 'outcome' }).length}`);
}

main().catch(e => { console.error('[engagement] ölümcül:', e.message); process.exit(1); });
