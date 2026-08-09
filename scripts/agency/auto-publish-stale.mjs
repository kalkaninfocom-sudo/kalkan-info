#!/usr/bin/env node
/**
 * scripts/agency/auto-publish-stale.mjs
 * OTOMATİK YAYIN — onay gelmezse (Berkay kararı: 6 saat + sadece BrandGuard PASS).
 *
 * Akış:
 *   1. social_posts'ta status=pending_approval, published_at=null, scheduled_at > 6 saat önce olanları bul.
 *   2. Her biri için BrandGuard denetimi (cheap-llm, guard system prompt) → PASS/SOFT/BLOCK.
 *   3. PASS → status=approved (scheduled_at=now). SOFT/BLOCK → beklemede bırak (elle onay ister).
 *   4. Telegram'a özet bildir (neyin otomatik onaylandığı / neyin marka denetimine takıldığı).
 *
 * ⚠️ YALNIZCA ONAYLAR — YAYINLAMAZ. Fiili IG/FB yayınını TEK yayıncı olan
 *    publish-approved.mjs (publish-approved.yml, saat :20) yapar (published_at=is.null guard'ıyla).
 *    Böylece aynı postu iki farklı kod yolu yayınlayamaz (çift-post riski kapandı).
 *
 * Zamanlama: .github/workflows/auto-publish.yml (saatlik :00, Vercel cron dolu olduğu için GitHub Actions).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, (cheap-llm anahtarları),
 *      TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (bildirim).
 *
 * Kullanım: node scripts/agency/auto-publish-stale.mjs [--dry-run] [--hours=6]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheapJSON } from '../../lib/cheap-llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

try {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;

const DRY = process.argv.includes('--dry-run');
const HOURS = Number((process.argv.find((a) => a.startsWith('--hours=')) || '').split('=')[1]) || 6;

const supa = (path, opts = {}) => fetch(`${SUPA_URL}/rest/v1${path}`, {
  ...opts, headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
});

// BrandGuard system prompt — agents.json'dan (tek kaynak; yoksa gömülü fallback)
function guardSystem() {
  try {
    const a = JSON.parse(readFileSync(join(ROOT, 'data', 'agency', 'agents.json'), 'utf8'));
    if (a.agents?.guard?.system) return a.agents.guard.system;
  } catch {}
  return 'Sen BrandGuard’sın — Kalkan Info marka kapı bekçisi. Marka sesi: meraklı & sıcak, dürüst tavsiye (övgü/satış reddedilir), bilgiçlik yok. Verilen caption’ı ton/marka/risk boyutunda değerlendir. SADECE JSON: {"verdict":"PASS|SOFT|BLOCK","score":0-1,"notes":"..."}';
}

async function brandCheck(caption, sys) {
  if (!caption || !caption.trim()) return { verdict: 'SOFT', notes: 'caption boş' };
  try {
    const { data } = await cheapJSON(`Bu sosyal medya caption’ını değerlendir:\n\n${caption.slice(0, 1200)}`, { system: sys, maxTokens: 300 });
    const v = String(data.verdict || '').toUpperCase();
    return { verdict: ['PASS', 'SOFT', 'BLOCK'].includes(v) ? v : 'SOFT', notes: data.notes || '' };
  } catch (e) {
    return { verdict: 'SOFT', notes: 'denetim hatası: ' + e.message }; // hata → güvenli tarafta beklet
  }
}

async function tg(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
    });
  } catch {}
}

async function main() {
  console.log(`⏰ Otomatik yayın taraması — ${HOURS}h+ bekleyen, BrandGuard PASS${DRY ? ' [DRY]' : ''}`);
  if (!SUPA_URL || !SUPA_KEY) { console.error('Supabase env yok — çıkılıyor.'); process.exit(1); }

  const cutoff = new Date(Date.now() - HOURS * 3600 * 1000).toISOString();
  const res = await supa(`/social_posts?status=eq.pending_approval&published_at=is.null&scheduled_at=lte.${encodeURIComponent(cutoff)}&order=scheduled_at.asc&select=id,content_pack_id,caption,content_type,scheduled_at&limit=25`);
  if (!res.ok) { console.error('sorgu fail:', res.status, await res.text()); process.exit(1); }
  const stale = await res.json();
  console.log(`   ${stale.length} bekleyen içerik ${HOURS}h+ (cutoff ${cutoff})`);
  if (!stale.length) { console.log('Otomatik yayınlanacak bayat içerik yok.'); return; }

  const sys = guardSystem();
  const approved = [], held = [];
  for (const p of stale) {
    const g = await brandCheck(p.caption, sys);
    console.log(`   • ${p.content_pack_id} → ${g.verdict}${g.notes ? ' ('+String(g.notes).slice(0,60)+')' : ''}`);
    if (g.verdict === 'PASS') {
      if (!DRY) {
        const up = await supa(`/social_posts?id=eq.${p.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'approved', scheduled_at: new Date().toISOString() }) });
        if (!up.ok) { console.error('   ✗ approve fail:', up.status); held.push({ ...p, g }); continue; }
      }
      approved.push({ ...p, g });
    } else held.push({ ...p, g });
  }

  // NOT: Burada YAYIN tetiklenmez. Onaylananları tek yayıncı publish-approved.mjs
  // (publish-approved.yml, :20) published_at=is.null guard'ıyla yayınlar → çift-post yok.
  const lines = [`🤖 Otomatik onay (onay ${HOURS}h gelmedi)`,
    `✅ PASS → onaylandı (yayın :20 turunda gidecek): ${approved.length}`,
    ...approved.slice(0, 8).map((p) => `   • ${p.content_pack_id}`),
    held.length ? `⏸ marka denetimi (SOFT/BLOCK) → beklemede: ${held.length}` : '',
    ...held.slice(0, 6).map((p) => `   • ${p.content_pack_id} (${p.g.verdict})`)].filter(Boolean);
  console.log('\n' + lines.join('\n'));
  if (!DRY) await tg(lines.join('\n'));
  console.log(`\n✅ Bitti. ${approved.length} otomatik onaylandı, ${held.length} beklemede.`);
}
main().catch((e) => { console.error('[auto-publish] fatal:', e); process.exit(1); });
