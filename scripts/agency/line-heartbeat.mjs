#!/usr/bin/env node
/**
 * scripts/agency/line-heartbeat.mjs — TÜM ÜRETİM HATLARI NÖBETİ (Katman 2)
 * ------------------------------------------------------------------------
 * Haber ajansının "prova/nöbetçi" desenini TÜM hatlara uygular: data/agency/production-lines.json
 * registry'sindeki her hattı prova eder (gazete=derin, veri hatları=tazelik, reel/bülten=Supabase).
 * Kritik bir hat bayatsa → Telegram alarm. Control Tower bunu import edip tek ekranda gösterir.
 *
 * ajansAI = tüm haber odalarının genel yayın yönetmeni: hangi hat üretti, hangisi durdu — tek yerde.
 *
 * Kullanım: node scripts/agency/line-heartbeat.mjs [--verbose]  (Telegram env varsa kritikte alarm)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnvLocal, freshnessCheck, supabasePackCheck, sendTelegram, pingHealthcheck, proofIcon } from '../../lib/line-proof.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
loadEnvLocal(ROOT);
const DATE = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

function readRegistry() {
  try { return JSON.parse(readFileSync(join(ROOT, 'data', 'agency', 'production-lines.json'), 'utf8')); }
  catch { return { lines: [] }; }
}

/** Bir hattı prova et → {key,title,cadence,ok,critical,detail}. */
async function proofLine(line) {
  const base = { key: line.key, title: line.title, cadence: line.cadence, critical: !!line.critical };
  // Derin prova: gazete kendi checkTodayIssue'sunu kullanır (sayı+5dil+baskı provası).
  if (line.proof === 'gazete-heartbeat') {
    try {
      const { checkTodayIssue } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'gazete-heartbeat.mjs')).href);
      const checks = checkTodayIssue(DATE);
      const crit = checks.filter((c) => !c.ok && c.critical);
      return { ...base, ok: crit.length === 0, detail: crit.length ? `${crit.length} kritik eksik: ${crit.map((c) => c.name).join(', ')}` : 'sayı + 5 dil + baskı provası ✓' };
    } catch (e) { return { ...base, ok: false, critical: false, detail: `prova hatası: ${String(e.message).slice(0, 50)}` }; }
  }
  // Tazelik: committed veri dosyası
  if (line.signal?.file) {
    const c = freshnessCheck({ root: ROOT, name: line.title, file: line.signal.file, fields: line.signal.fields, maxAgeDays: line.signal.maxAgeDays, critical: !!line.critical });
    return { ...base, ok: c.ok, critical: c.critical, detail: c.detail };
  }
  // Efemeral çıktı: Supabase social_posts (anahtar yoksa graceful)
  if (line.signal?.supabasePack) {
    const c = await supabasePackCheck({ name: line.title, packPrefix: line.signal.supabasePack, maxAgeDays: line.signal.maxAgeDays, critical: !!line.critical });
    return { ...base, ok: c.ok, critical: c.critical, detail: c.detail };
  }
  return { ...base, ok: true, critical: false, detail: 'sinyal tanımsız (izlenmiyor)' };
}

/** Tüm hatları prova et → [{...}]. Control Tower + main() bunu kullanır. */
export async function runLineProofs() {
  const reg = readRegistry();
  return Promise.all((reg.lines || []).map(proofLine));
}

async function main() {
  const results = await runLineProofs();
  const lines = results.map((r) => `${proofIcon(r)} ${r.title} (${r.cadence}): ${r.detail}`);
  console.log('── ÜRETİM HATLARI NÖBETİ ──\n' + lines.join('\n'));
  const problems = results.filter((r) => !r.ok && r.critical);
  if (problems.length) {
    await sendTelegram(`🚨 ÜRETİM HATTI ALARMI — ${problems.length} kritik hat durdu\n\n` + lines.join('\n'));
    await pingHealthcheck(process.env.LINES_HEALTHCHECK_URL, false);
    console.log(`✗ ${problems.length} kritik hat sorunlu`);
    process.exit(1);
  }
  await pingHealthcheck(process.env.LINES_HEALTHCHECK_URL, true);
  console.log('✓ tüm kritik hatlar taze');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('[line-heartbeat]', e.message); process.exit(1); });
}
