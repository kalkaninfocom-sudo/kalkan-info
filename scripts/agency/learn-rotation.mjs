#!/usr/bin/env node
/**
 * scripts/agency/learn-rotation.mjs — Round-robin ÖĞRENME rotasyonu
 * ----------------------------------------------------------------
 * reading-list.json'daki tüm agentId'leri, knowledge/<id>.json updatedAt'ine göre
 * EN ESKİ önce sıralar (hiç öğrenmemiş = en eski) ve sıradaki 1-2 agent için
 * agent-learn.mjs'i SENKRON çalıştırır. Round-robin → zamanla herkes öğrenir.
 *
 * Kota güvenliği: her tetikte SADECE 1-2 agent öğrenir (NVIDIA 40 RPM + Edge 40/10dk
 * throttle patlamaz). scheduler.json bunu birkaç saatte bir çağırır.
 *
 * Non-fatal: her hata yutulur, exit 0.
 *
 * Kullanım:
 *   node scripts/agency/learn-rotation.mjs           # en eski 2 agent öğrensin
 *   node scripts/agency/learn-rotation.mjs 1         # bu tur sadece 1 agent
 *   node scripts/agency/learn-rotation.mjs --dry     # kim öğrenirdi göster
 */
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const READING_LIST = join(ROOT, 'data', 'agency', 'reading-list.json');
const KNOWLEDGE_DIR = join(ROOT, 'data', 'agency', 'knowledge');
const LEARN_SCRIPT = join(__dirname, 'agent-learn.mjs');

// .env.local yükle (agent-learn spawn edilen çocukta da lazım; process.env miras alınır)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const DRY = process.argv.includes('--dry');
const countArg = process.argv.find(a => /^\d+$/.test(a));
const BATCH = countArg ? Math.max(1, Math.min(2, Number(countArg))) : 2; // kota güvenliği: en fazla 2

/** Bir agent'ın son öğrenme zamanı (ms). Hiç öğrenmemişse 0 → en eski. */
async function lastLearned(agentId) {
  const f = join(KNOWLEDGE_DIR, `${agentId}.json`);
  try {
    const kb = JSON.parse(await readFile(f, 'utf8'));
    if (kb.updatedAt) return Date.parse(kb.updatedAt) || 0;
  } catch {}
  // updatedAt yoksa dosya mtime'ına düş, o da yoksa 0
  try { return (await stat(f)).mtimeMs; } catch { return 0; }
}

async function main() {
  let list;
  try { list = JSON.parse(await readFile(READING_LIST, 'utf8')); }
  catch (e) { console.log(`[learn-rotation] reading-list okunamadı: ${e.message}`); process.exit(0); }

  const agentIds = Object.keys(list.agents || {});
  if (!agentIds.length) { console.log('[learn-rotation] agent yok'); process.exit(0); }

  // EN ESKİ önce sırala
  const withTs = await Promise.all(agentIds.map(async id => ({ id, ts: await lastLearned(id) })));
  withTs.sort((a, b) => a.ts - b.ts);
  const picks = withTs.slice(0, BATCH);

  console.log(`[learn-rotation] ${agentIds.length} agent · sıradaki ${picks.length}: ${picks.map(p => p.id).join(', ')}`);

  if (DRY) {
    for (const p of picks) console.log(`  [dry] öğrenirdi → ${p.id} (son: ${p.ts ? new Date(p.ts).toISOString() : 'hiç'})`);
    process.exit(0);
  }

  for (const p of picks) {
    try {
      const r = spawnSync(process.execPath, [LEARN_SCRIPT, p.id], { cwd: ROOT, stdio: 'inherit', env: process.env });
      if (r.error) console.log(`[learn-rotation] ${p.id} spawn hata: ${r.error.message}`);
    } catch (e) {
      console.log(`[learn-rotation] ${p.id} hata: ${e.message}`);
    }
  }
  process.exit(0);
}

main().catch(e => { console.log(`[learn-rotation] beklenmeyen: ${e.message}`); process.exit(0); });
