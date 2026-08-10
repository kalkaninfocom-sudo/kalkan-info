#!/usr/bin/env node
/**
 * scripts/agency/always-on.mjs — SÜREKLİ AJANS MOTORU (Abacus SuperComputer 7/24)
 * -------------------------------------------------------------------------------------------------
 * GitHub Actions "günde 1" yerine SUREKLİ çalışır: periyodik hasat + 28 karakter brifingi,
 * yeni sepet içeriği düşünce ANLIK Telegram bildirimi. Yayın hâlâ İNSAN ONAYLI (basket-publish).
 *
 * Mimari: bu tek kaynak repo'yu kullanır (karakterler, sepetler, kapı). RouteLLM ile güçlü model.
 *   1) Hasat (varsayılan 30 dk): ig-venue-watch + fb-page-harvest + ig-news-harvest → sepetler.
 *      Yeni 'pending' içerik çıkarsa → Telegram'a "N yeni içerik, onay bekliyor" bildirimi.
 *   2) Brifing (varsayılan 12 saat): 28 karakter ajanı → content-ideas (gazete/reels tüketir).
 *   Döngü hata-güvenli: her görev try/catch, motor asla çökmez.
 *
 * Kullanım:
 *   node scripts/agency/always-on.mjs           # sürekli çalış (SuperComputer'da böyle)
 *   node scripts/agency/always-on.mjs --once     # tek tur (test)
 * Ayarlar (env): HARVEST_INTERVAL_MIN=30 · BRIEFING_INTERVAL_HR=12 · TICK_MIN=5
 *   Gerekli env: ROUTELLM_API_KEY, IG_BUSINESS_ID, IG_LONG_LIVED_TOKEN, FB_PAGE_ID, FB_PAGE_TOKEN,
 *                GROQ_API_KEY (fallback), TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSiteEditQueue } from './site-edit-worker.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ONCE = process.argv.includes('--once');

// ── TEK-INSTANCE KİLİDİ — çift çalışmayı engeller (tekrar eden mesajların kök nedeni) ──
const LOCK = join(tmpdir(), 'kalkan-always-on.lock');
function acquireLock() {
  try {
    if (existsSync(LOCK)) {
      const pid = Number(readFileSync(LOCK, 'utf8').trim());
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch { alive = false; }  // 0 = sinyal yok, sadece varlık kontrolü
      if (alive && pid !== process.pid) {
        console.error(`[always-on] ZATEN ÇALIŞIYOR (pid ${pid}) — bu instance çıkıyor (çift çalışma engellendi).`);
        process.exit(0);
      }
    }
    writeFileSync(LOCK, String(process.pid));
    const release = () => { try { unlinkSync(LOCK); } catch {} };
    process.on('exit', release); process.on('SIGINT', () => { release(); process.exit(0); });
    process.on('SIGTERM', () => { release(); process.exit(0); });
  } catch (e) { console.warn('[always-on] kilit uyarısı:', e.message); }
}

// .env.local yükle (SuperComputer'da env zaten dolu olabilir; ikisi de çalışır)
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) for (const l of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const HARVEST_MS = (Number(process.env.HARVEST_INTERVAL_MIN) || 30) * 60_000;
const BRIEFING_MS = (Number(process.env.BRIEFING_INTERVAL_HR) || 12) * 3_600_000;
const TICK_MS = (Number(process.env.TICK_MIN) || 5) * 60_000;
process.env.CHEAP_LLM_ORDER = process.env.CHEAP_LLM_ORDER || 'routellm,groq,cerebras,nvidia,gemini,claude';

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const log = (...a) => console.log(`[${now()}]`, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function readJson(rel, fb) { try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return fb; } }

// Sepetlerdeki toplam 'pending' (seçime hazır) sayısı
function pendingCount() {
  let n = 0;
  for (const sc of ['kalkan', 'kas', 'bolge']) {
    const b = readJson(`data/agency/sepet/${sc}.json`, { items: [] });
    n += (b.items || []).filter(i => (i.status || 'pending') === 'pending').length;
  }
  return n;
}

async function tg(text) {
  const t = process.env.TELEGRAM_BOT_TOKEN, c = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!t || !c) return;
  try {
    await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: c, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) { log('⚠ telegram:', e.message); }
}

function run(script, args = []) {
  execFileSync('node', [join(ROOT, script), ...args], { stdio: 'inherit', env: process.env, timeout: 15 * 60_000 });
}

async function doHarvest() {
  const before = pendingCount();
  log('▶ HASAT başlıyor (IG + FB → kapı → sepet)...');
  try { run('scripts/agency/ig-news-harvest.mjs', ['--watch']); }
  catch (e) { log('⚠ hasat hata (devam):', e.message?.slice(0, 120)); }
  const after = pendingCount();
  const fresh = after - before;
  log(`✔ hasat bitti. sepet pending: ${before} → ${after}`);
  if (fresh > 0) await tg(`🗞️ Kalkan İnfo Haber Merkezi: ${fresh} yeni içerik sepete düştü (toplam ${after} onay bekliyor).\nSeç → yayınla: basket-publish --list`);
}

async function doBriefing() {
  log('▶ BRİFİNG başlıyor (28 karakter ajanı, RouteLLM)...');
  try { run('scripts/agency/morning-briefing.mjs'); log('✔ brifing bitti.'); }
  catch (e) { log('⚠ brifing hata (devam):', e.message?.slice(0, 120)); }
}

async function doSiteEdits() {
  try { const n = await runSiteEditQueue(); if (n) log(`✔ ${n} site-düzenleme işlendi.`); }
  catch (e) { log('⚠ site-edit hata (devam):', e.message?.slice(0, 120)); }
}

async function main() {
  if (!ONCE) acquireLock();  // tek-instance garanti (çift çalışma = tekrar eden mesaj)
  log('═══ AJANS MOTORU AÇILDI (always-on) ═══');
  log(`hasat/${HARVEST_MS / 60000}dk · brifing/${BRIEFING_MS / 3600000}sa · tick/${TICK_MS / 60000}dk · model-order: ${process.env.CHEAP_LLM_ORDER}`);
  await tg('🟢 Kalkan İnfo ajans motoru AÇILDI (7/24 always-on).');

  if (ONCE) { await doHarvest(); await doSiteEdits(); await doBriefing(); log('--once: tek tur bitti.'); return; }

  let lastHarvest = 0, lastBriefing = 0;
  for (;;) {
    const t = Date.now();
    await doSiteEdits();  // her tick: Telegram'dan gelen site düzenlemelerini işle (hızlı yanıt)
    if (t - lastHarvest >= HARVEST_MS) { lastHarvest = t; await doHarvest(); }
    if (t - lastBriefing >= BRIEFING_MS) { lastBriefing = t; await doBriefing(); }
    await sleep(TICK_MS);
  }
}

main().catch(e => { console.error('[always-on] ölümcül:', e); process.exit(1); });
