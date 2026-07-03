#!/usr/bin/env node
/**
 * scripts/agency/scheduler.mjs — Ajans 7/24 SABİT SAATLİ ZAMANLAYICI
 * ------------------------------------------------------------------
 * data/agency/schedule.json'u okur, ŞU ANA (TR saati) denk gelen görevleri çalıştırır.
 * GitHub Actions ile her 10 dakikada bir 7/24 tetiklenir — Vercel cron/api limitine dokunmaz.
 *
 *   type=agent  → agency Edge Function'a /enqueue (NVIDIA ile GERÇEKTEN çalışır)
 *   type=script → yerel/CI node script çalıştır
 *   type=approval → (script gibi) Telegram onay kapısı
 *
 * Kullanım:
 *   node scripts/agency/scheduler.mjs tick                 # şu anki slota denk gelenleri çalıştır
 *   node scripts/agency/scheduler.mjs tick --now 08:00     # saat override (test)
 *   node scripts/agency/scheduler.mjs tick --dow Fri       # gün override (test)
 *   node scripts/agency/scheduler.mjs tick --dry           # ne çalışırdı göster, çalıştırma
 *   node scripts/agency/scheduler.mjs tick --force         # runlog'u yok say (tekrar çalıştır)
 *   node scripts/agency/scheduler.mjs list                 # tüm takvimi yazdır
 *
 * Dürüstlük: hata olursa loglanır + iş 'error' döner, sessiz geçmez.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SCHEDULE = join(ROOT, 'data', 'agency', 'schedule.json');
const RUNLOG = join(ROOT, 'data', 'agency', 'schedule-runlog.json'); // gitignore (CI'da geçici)

// .env.local yükle (yerel çalıştırma)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const EDGE = process.env.AGENCY_EDGE || 'https://dgichfealzdpfhdgryym.supabase.co/functions/v1/agency';
const KEY  = process.env.AGENCY_KEY  || 'sb_publishable_26HXaUgGqxZUOuxbcPhiDQ_s3MvKVpr';

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const has = (name) => process.argv.includes(name);
const DRY = has('--dry'), FORCE = has('--force');

/** TR (Europe/Istanbul) şu anki {hhmm:'HH:MM', minutes, dow:'Mon', date:'YYYY-MM-DD'} */
function trNow() {
  const nowOverride = arg('--now');   // "HH:MM"
  const dowOverride = arg('--dow');
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const hhmm = nowOverride || `${parts.hour}:${parts.minute}`;
  const [h, m] = hhmm.split(':').map(Number);
  return {
    hhmm, minutes: h * 60 + m,
    dow: dowOverride || parts.weekday,        // 'Mon','Tue',...
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

async function loadRunlog() {
  try { return JSON.parse(await readFile(RUNLOG, 'utf8')); } catch { return {}; }
}
async function saveRunlog(log) { try { await writeFile(RUNLOG, JSON.stringify(log, null, 2)); } catch {} }

async function runAgentTask(t) {
  const res = await fetch(`${EDGE}/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ agent: t.agent, task: t.task }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.ok === false && d.status !== 'error') throw new Error(`enqueue ${res.status} ${JSON.stringify(d).slice(0, 140)}`);
  return `jobId=${d.jobId} status=${d.status}${d.error ? ' err=' + d.error : ''}`;
}

function runScriptTask(t) {
  // SENKRON çalıştır + tamamlanmasını BEKLE. Eski hali detached+unref idi → CI job
  // bitince (saveRunlog sonrası process exit) detached child ÖLDÜRÜLÜYORDU, script hiç
  // bitmiyordu. Artık çıkış kodunu bekliyoruz ki CI runner script bitene kadar ayakta kalsın.
  return new Promise((resolve) => {
    const scriptPath = join(ROOT, t.script);
    if (!existsSync(scriptPath)) return resolve(`⚠ script yok: ${t.script}`);
    const child = spawn(process.execPath, [scriptPath], { cwd: ROOT, stdio: 'inherit' });
    child.on('error', (e) => resolve(`script spawn hata: ${e.message}`));
    child.on('exit', (code) => resolve(code === 0 ? `script tamamlandı (0): ${t.script}` : `script çıkış ${code}: ${t.script}`));
  });
}

async function tick() {
  const sched = JSON.parse(await readFile(SCHEDULE, 'utf8'));
  const now = trNow();
  const slotStart = Math.floor(now.minutes / 10) * 10; // 10dk'lık slot
  const log = await loadRunlog();
  const todays = log[now.date] || (log[now.date] = {});

  console.log(`[scheduler] TR ${now.hhmm} (${now.dow}) · slot ${Math.floor(slotStart/60)}:${String(slotStart%60).padStart(2,'0')} · ${sched.tasks.length} görev tarandı`);

  const due = sched.tasks.filter(t => {
    if (t.dow && t.dow !== now.dow) return false;
    const tm = toMin(t.time);
    if (!(tm >= slotStart && tm < slotStart + 10)) return false;   // bu slota düşüyor mu
    if (!FORCE && todays[t.id]) return false;                       // bugün zaten çalıştı mı
    return true;
  });

  if (!due.length) { console.log('[scheduler] bu slotta iş yok.'); return; }

  for (const t of due) {
    const tag = `${t.time} ${t.id} (${t.type}${t.agent ? '/' + t.agent : ''})`;
    if (DRY) { console.log(`  [dry] çalışırdı → ${tag}`); continue; }
    try {
      let out;
      if (t.type === 'agent') out = await runAgentTask(t);
      else out = await runScriptTask(t); // script + approval
      todays[t.id] = { at: new Date().toISOString(), out };
      console.log(`  ✅ ${tag} → ${out}`);
    } catch (e) {
      todays[t.id] = { at: new Date().toISOString(), error: String(e.message) };
      console.error(`  ❌ ${tag} → ${e.message}`);
    }
  }
  if (!DRY) await saveRunlog(log);
}

function list() {
  const sched = JSON.parse(readFileSync(SCHEDULE, 'utf8'));
  console.log(`Ajans takvimi (${sched.timezone}):\n`);
  for (const t of sched.tasks.sort((a, b) => (a.dow || '') + toMin(a.time) - ((b.dow || '') + toMin(b.time)))) {
    console.log(`  ${t.dow ? t.dow + ' ' : ''}${t.time}  ${t.type.padEnd(8)} ${t.agent || t.script || ''}`);
  }
}

const cmd = process.argv[2];
if (cmd === 'tick') await tick();
else if (cmd === 'list') list();
else { console.error('Kullanım: scheduler.mjs tick [--now HH:MM] [--dow Mon] [--dry] [--force] | list'); process.exit(1); }
