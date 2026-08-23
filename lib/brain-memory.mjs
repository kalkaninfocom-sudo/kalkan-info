/**
 * lib/brain-memory.mjs — 2. BEYİN HAFIZA KATMANI
 * ---------------------------------------------------------------------------
 * Beynin YAPTIĞI her iş + SONUCU tek yerde. Katman 2 (engagement) ve
 * katman 3 (stratejist) bunu okur/yazar. "Hafızası olan vs olmayan" farkı
 * beyni ajan yapan asıl şey (arXiv 2603.07670) — bu dosya o farkı kurar.
 *
 * TASARIM: YEREL-ÖNCELİKLİ (standalone, migration beklemez).
 *   - Birincil: append-only JSONL → data/agency/brain-memory.jsonl (her zaman çalışır).
 *   - Opsiyonel: BRAIN_MEMORY_REMOTE=1 + Supabase env varsa best-effort uzak insert
 *     (brain_memory tablosu; migration push edilince otomatik devreye girer). Non-fatal.
 *
 * KAYIT ŞEKLİ (bir satır = bir olay):
 *   { id, ts, kind, tags[], data{} }
 *   kind: 'action'   → beyin bir iş yaptı (yayın/reel/gazete/site-edit...)
 *         'outcome'  → bir işin ölçülen sonucu (engagement; ref=action/media_id)
 *         'insight'  → stratejistin çıkardığı korelasyon/ders
 *         'plan'     → yarının içerik planı
 *
 * API:
 *   record(kind, data, tags?)          → kayıt ekle, {id,ts,...} döndür
 *   query({ kind, since, tag, filter, limit }) → filtreli oku (yeni→eski)
 *   stats()                            → kısa özet (kind sayıları, ilk/son ts)
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'data', 'agency', 'brain-memory.jsonl');

// .env.local yükle (yerel; pm2/CI'da env zaten dolu olabilir)
(() => {
  const p = join(ROOT, '.env.local');
  if (!existsSync(p)) return;
  try {
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {}
})();

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const REMOTE = process.env.BRAIN_MEMORY_REMOTE === '1' && SUPA_URL && SUPA_KEY;

// çakışmasız-yeterli id (Date.now yerel dosyada tamam; kriptografik değil)
function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDir() {
  try { mkdirSync(dirname(FILE), { recursive: true }); } catch {}
}

/** Uzak (Supabase) best-effort insert — asla throw etmez. */
async function remoteInsert(row) {
  if (!REMOTE) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/brain_memory`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ id: row.id, ts: row.ts, kind: row.kind, tags: row.tags, data: row.data }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* non-fatal — yerel JSONL zaten kalıcı */ }
}

/**
 * Bir olayı hafızaya yaz.
 * @param {'action'|'outcome'|'insight'|'plan'} kind
 * @param {object} data  serbest yük (ör. {job:'plaj-reel', lang:'ru', hour:8})
 * @param {string[]} [tags]  hızlı filtre etiketleri (ör. ['reel','plaj'])
 * @returns {Promise<{id,ts,kind,tags,data}>}
 */
export async function record(kind, data = {}, tags = []) {
  const row = { id: newId(), ts: new Date().toISOString(), kind, tags: Array.isArray(tags) ? tags : [], data };
  ensureDir();
  appendFileSync(FILE, JSON.stringify(row) + '\n');
  await remoteInsert(row);
  return row;
}

/** Tüm satırları oku (bozuk satırları atlar). */
function readAll() {
  if (!existsSync(FILE)) return [];
  const out = [];
  for (const line of readFileSync(FILE, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* bozuk satır atla */ }
  }
  return out;
}

/**
 * Filtreli sorgu — yeni→eski sıralı.
 * @param {object} [o]
 * @param {string} [o.kind]   sadece bu kind
 * @param {string|Date} [o.since]  bu ts'ten sonrası
 * @param {string} [o.tag]    bu etiketi içerenler
 * @param {(row)=>boolean} [o.filter]  ek predicate
 * @param {number} [o.limit]  en fazla N
 */
export function query({ kind, since, tag, filter, limit } = {}) {
  const sinceMs = since ? new Date(since).getTime() : null;
  let rows = readAll();
  if (kind) rows = rows.filter(r => r.kind === kind);
  if (tag) rows = rows.filter(r => Array.isArray(r.tags) && r.tags.includes(tag));
  if (sinceMs != null) rows = rows.filter(r => new Date(r.ts).getTime() >= sinceMs);
  if (typeof filter === 'function') rows = rows.filter(filter);
  rows.reverse(); // yeni→eski
  return limit ? rows.slice(0, limit) : rows;
}

/** Kısa özet — sağlık/gözlem için. */
export function stats() {
  const rows = readAll();
  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  return {
    total: rows.length,
    byKind,
    first: rows[0]?.ts || null,
    last: rows[rows.length - 1]?.ts || null,
    remote: !!REMOTE,
    file: FILE,
  };
}

// CLI: node lib/brain-memory.mjs [stats|tail N]
if (process.argv[1]?.endsWith('brain-memory.mjs')) {
  const cmd = process.argv[2] || 'stats';
  if (cmd === 'stats') console.log(JSON.stringify(stats(), null, 2));
  else if (cmd === 'tail') console.log(JSON.stringify(query({ limit: Number(process.argv[3]) || 10 }), null, 2));
  else console.log('kullanım: node lib/brain-memory.mjs [stats|tail N]');
}
