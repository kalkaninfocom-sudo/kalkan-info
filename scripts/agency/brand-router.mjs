#!/usr/bin/env node
/**
 * scripts/agency/brand-router.mjs — Marka HATTI yönlendirici
 *
 * Her içerik parçasını doğru yayın hattına (Kalkan Info / Haber / Magazin / TV) atar ve o hattın
 * KENDİ kuyruğuna yazar → hatlar karışmaz. Hat: item.line > kategori eşleşmesi > tip > varsayılan.
 *
 * API:  resolveLine(item) · routeToLine(item) · loadLines() · lineQueue(id) · counts()
 * CLI:  node scripts/agency/brand-router.mjs --status         # hat başına kuyruk sayıları
 *       node scripts/agency/brand-router.mjs --config         # hat tanımları
 *       node scripts/agency/brand-router.mjs --route-baskets  # mevcut sepet öğelerini hatlara dağıt (demo/migrasyon)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CFG = join(ROOT, 'data', 'agency', 'brand-lines.json');

const norm = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]+/g, ' ').trim();

// Hassas/trajedi/kişisel-veri içerik kalıpları — bunlar OTOMATİK kart/yayın ÜRETMEZ; insan onayı ('hold') şart.
const SENSITIVE_RE = /(boğ[uü]l|ölüm|öldü|hayat[ıi]n[ıi] kaybet|cenaze|vefat|intihar|kaza|yaralan|gözalt|tutukla|cinayet|taciz|istismar|yang[ıi]n|sel felaket|deprem)/i;
/** İçerik hassas mı? item.sensitive bayrağı VEYA başlık/gövdede trajedi/PII kalıbı. */
export function isSensitive(item) {
  if (item && (item.sensitive === true || item.status === 'hold')) return true;
  const text = [item?.title, item?.hook, item?.body, item?.summary, item?.content].filter(Boolean).join(' ');
  return SENSITIVE_RE.test(text);
}

let _cfg = null;
export function loadLines() {
  if (_cfg) return _cfg;
  _cfg = JSON.parse(readFileSync(CFG, 'utf8'));
  return _cfg;
}

function catSet(line) {
  return new Set((line.categories || []).map(norm));
}

/** Bir içerik öğesinin ait olduğu hattı çöz. */
export function resolveLine(item) {
  const { lines } = loadLines();
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  const def = lines.find((l) => l.default) || lines[0];

  // 1) Açık hat.
  if (item.line && byId[item.line]) return byId[item.line];

  // 2) Kategori/placement/scope/tags eşleşmesi (varsayılan-olmayan hatlar önce, config sırasıyla).
  const fields = [item.category, item.placement, item.scope, ...(Array.isArray(item.tags) ? item.tags : [])]
    .filter(Boolean).map(norm);
  for (const line of lines) {
    if (line.default) continue;
    const cats = catSet(line);
    if (fields.some((f) => cats.has(f))) return line;
  }

  // 3) Tip eşleşmesi (yalnız tek hatta özgü tipler için, ör. video → tv).
  const t = norm(item.type);
  if (t) {
    const owners = lines.filter((l) => !l.default && (l.types || []).map(norm).includes(t));
    if (owners.length === 1) return owners[0];
  }

  // 4) Varsayılan.
  return def;
}

function queuePath(line) {
  return join(ROOT, line.queue || `data/agency/lines/${line.id}.json`);
}
function readQueue(line) {
  const p = queuePath(line);
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { line: line.id, updated: null, items: [] }; }
}
function writeQueue(line, q) {
  const p = queuePath(line);
  mkdirSync(dirname(p), { recursive: true });
  q.updated = new Date().toISOString();
  writeFileSync(p, JSON.stringify(q, null, 2), 'utf8');
}

/** Öğeyi ait olduğu hattın kuyruğuna yaz (id ile tekilleştirir). Hattın id'sini döndürür. */
export function routeToLine(item) {
  const line = resolveLine(item);
  const q = readQueue(line);
  const idx = (q.items || []).findIndex((x) => x.id && item.id && x.id === item.id);
  const enriched = { ...item, line: line.id, routedAt: new Date().toISOString() };
  if (idx >= 0) q.items[idx] = enriched; else (q.items = q.items || []).push(enriched);
  writeQueue(line, q);
  return line.id;
}

export function lineQueue(id) {
  const line = loadLines().lines.find((l) => l.id === id);
  return line ? (readQueue(line).items || []) : [];
}

export function counts() {
  const out = {};
  for (const line of loadLines().lines) out[line.id] = (readQueue(line).items || []).length;
  return out;
}

// ── CLI ──
function routeBaskets() {
  const dir = join(ROOT, 'data', 'agency', 'sepet');
  let n = 0;
  const per = {};
  for (const f of (existsSync(dir) ? readdirSync(dir) : []).filter((x) => x.endsWith('.json'))) {
    let b; try { b = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    for (const it of (b.items || [])) {
      const id = routeToLine(it);
      per[id] = (per[id] || 0) + 1; n++;
    }
  }
  console.log(`✓ ${n} sepet öğesi hatlara dağıtıldı:`, JSON.stringify(per));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2] || '--status';
  const { lines } = loadLines();
  if (arg === '--config') {
    for (const l of lines) console.log(`${l.emoji} ${l.name} [${l.id}] ${l.handle} → ${l.queue}${l.active ? '' : '  (hesap bekliyor)'}\n   ${l.editorial}`);
  } else if (arg === '--route-baskets') {
    routeBaskets();
  } else {
    console.log('Marka hattı kuyrukları:');
    for (const [id, c] of Object.entries(counts())) {
      const l = lines.find((x) => x.id === id);
      console.log(`  ${l.emoji} ${l.name.padEnd(22)} ${String(c).padStart(3)} öğe   ${l.active ? 'CANLI' : '⛔ hesap bekliyor'}`);
    }
  }
}
