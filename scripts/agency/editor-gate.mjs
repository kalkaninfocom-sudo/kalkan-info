#!/usr/bin/env node
/**
 * scripts/agency/editor-gate.mjs — Baş Editör Ön-Yayın Kapısı
 *
 * Her içerik kalemi yayına çıkmadan bu kapıdan geçer:
 *   1. Hassas içerik (trajedi/PII) → otomatik 'hold'
 *   2. Editöryal LLM değerlendirmesi → skor + ton/hat/uydurma/sansasyon
 *   3. Karar kuralları → 'approved' | 'hold' | 'reject'
 *   4. Karar item'a geri yazılır
 *
 * API:
 *   reviewItem(item, line)             → { verdict, reasons, score, fixes? }
 *   reviewLine(lineId, {write=true})   → { lineId, approved, hold, reject }
 *
 * CLI:
 *   node scripts/agency/editor-gate.mjs haber          # tek hat
 *   node scripts/agency/editor-gate.mjs --all          # tüm hatlar
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── .env.local yükle ──────────────────────────────────────────────────────────
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
try {
  const envContent = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* .env.local yoksa devam */ }

import { loadLines, isSensitive } from './brand-router.mjs';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

// ── Kuyruk okuma/yazma (brand-router ile aynı mantık) ────────────────────────
function queuePath(line) {
  return join(ROOT, line.queue || `data/agency/lines/${line.id}.json`);
}
function readQueue(line) {
  try { return JSON.parse(readFileSync(queuePath(line), 'utf8')); }
  catch { return { line: line.id, updated: null, items: [] }; }
}
function writeQueue(line, q) {
  const p = queuePath(line);
  mkdirSync(dirname(p), { recursive: true });
  q.updated = new Date().toISOString();
  writeFileSync(p, JSON.stringify(q, null, 2), 'utf8');
}

// ── Editöryal LLM değerlendirmesi ────────────────────────────────────────────
const SYSTEM = `Sen Kalkan Info ajansının baş editörüsün. Senden YALNIZCA geçerli JSON isteniyor. Hiçbir açıklama, markdown, ek metin YAZMA. Sadece JSON nesnesi döndür.`;

async function editorialCheck(item, line) {
  const metin = [item.title, item.hook, item.body, item.summary, item.content]
    .filter(Boolean).join('\n').slice(0, 1200); // token tasarrufu

  const prompt = `Aşağıdaki içerik parçasını "${line.name}" hattının editöryal kuralına göre değerlendir.

HAT EDİTÖRYEL KURALI: "${line.editorial}"

İÇERİK:
Başlık: ${item.title || '(yok)'}
Hook: ${item.hook || '(yok)'}
Gövde: ${metin}

Değerlendirme kriterleri:
- uydurmaRiski: İçerik uydurmacı, teyitsiz iddia veya yanıltıcı bilgi içeriyor mu?
- sansasyon: Klişe, sansasyonel, abartılı veya dolgu içerik mi?
- tonUygun: Hattın editöryal tonuna uyuyor mu?
- hatUyumu: Bu içerik gerçekten bu hatta mı ait (başka hatta daha uygun değil mi)?
- score: 0-100 arası genel yayın kalite puanı (100 = mükemmel yayına hazır)
- notlar: Kısa Türkçe açıklama (max 100 karakter)
- oneri: Gerekirse düzeltme önerisi (max 100 karakter, gerekmiyorsa boş string)

Yanıt YALNIZCA bu JSON formatında olsun, başka hiçbir şey yazma:
{"score":75,"tonUygun":true,"hatUyumu":true,"uydurmaRiski":false,"sansasyon":false,"notlar":"...","oneri":""}`;

  const { text, provider } = await cheapLLM(prompt, {
    system: SYSTEM,
    json: true,
    maxTokens: 300,
    temperature: 0.1,
    timeoutMs: 25000,
  });

  // JSON çıkar — model bazen markdown code block içine sarabilir
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`LLM geçersiz JSON döndürdü: ${text.slice(0, 120)}`);
  const parsed = JSON.parse(m[0]);
  return { ...parsed, provider };
}

// ── Ana reviewItem fonksiyonu ─────────────────────────────────────────────────
/**
 * Tek bir içerik öğesini incele.
 * @param {object} item  Kuyruk öğesi
 * @param {object} line  Hat tanımı (brand-lines.json'dan)
 * @returns {Promise<{verdict:'approved'|'hold'|'reject', reasons:string[], score:number, fixes?:string[]}>}
 */
export async function reviewItem(item, line) {
  const reasons = [];
  const fixes = [];

  // ── 1. HARD BLOCK: hassas içerik ──────────────────────────────────────────
  if (isSensitive(item)) {
    const verdict = 'hold';
    reasons.push('hassas içerik (trajedi/PII) — insan onayı');
    const result = { verdict, reasons, score: 0 };
    // Geri yaz
    item.status = verdict;
    item.editor = {
      score: 0,
      reasons,
      reviewedAt: new Date().toISOString(),
      provider: 'hard-block',
    };
    return result;
  }

  // ── 2. EDİTÖRYEL LLM kontrolü ────────────────────────────────────────────
  let llm = null;
  let llmError = null;
  try {
    llm = await editorialCheck(item, line);
  } catch (e) {
    llmError = e.message;
  }

  // LLM başarısız olursa fail-safe: belirsiz öğeleri 'hold' yap
  if (!llm) {
    reasons.push(`LLM değerlendirmesi başarısız (${llmError?.slice(0, 80)}) — ihtiyatlı beklemeye alındı`);
    const verdict = 'hold';
    item.status = verdict;
    item.editor = {
      score: null,
      reasons,
      reviewedAt: new Date().toISOString(),
      provider: 'fail-safe',
    };
    return { verdict, reasons, score: 0 };
  }

  const score = typeof llm.score === 'number' ? Math.max(0, Math.min(100, llm.score)) : 50;

  // ── 3. KARAR KURALLARI ────────────────────────────────────────────────────
  let verdict = 'approved';

  if (llm.uydurmaRiski) {
    verdict = 'reject';
    reasons.push('uydurma/teyitsiz iddia riski — yayınlanamaz');
  }
  if (llm.sansasyon) {
    verdict = 'reject';
    reasons.push('sansasyonel/klişe içerik — hattın standartları dışında');
  }
  // hold koşulları (reject yoksa)
  if (verdict !== 'reject') {
    if (score < 55) {
      verdict = 'hold';
      reasons.push(`düşük kalite puanı (${score}/100) — revizyon gerekiyor`);
    }
    if (llm.hatUyumu === false) {
      verdict = 'hold';
      reasons.push('hat uyumsuzluğu — içerik başka bir hatta daha uygun');
    }
    if (llm.tonUygun === false) {
      verdict = 'hold';
      reasons.push('ton uyumsuzluğu — hattın editöryal sesiyle örtüşmüyor');
    }
  }

  if (reasons.length === 0) {
    reasons.push('tüm kriterler geçildi');
  }
  if (llm.notlar) reasons.push(`editör notu: ${llm.notlar}`);
  if (llm.oneri) fixes.push(llm.oneri);

  // ── 4. KARARI ITEM'A GERİ YAZ ────────────────────────────────────────────
  item.status = verdict;
  item.editor = {
    score,
    reasons,
    reviewedAt: new Date().toISOString(),
    provider: llm.provider || 'unknown',
  };

  return { verdict, reasons, score, ...(fixes.length ? { fixes } : {}) };
}

// ── Hat bazlı toplu inceleme ──────────────────────────────────────────────────
/**
 * Bir hattın kuyruğunu oku, daha önce editor değerlendirmesi olmayan öğeleri incele.
 * @param {string} lineId
 * @param {{write?:boolean}} opts  write=true → kuyruğu güncelle
 * @returns {Promise<{lineId:string, approved:number, hold:number, reject:number}>}
 */
export async function reviewLine(lineId, { write = true } = {}) {
  const { lines } = loadLines();
  const line = lines.find((l) => l.id === lineId);
  if (!line) throw new Error(`Hat bulunamadı: ${lineId}`);

  const q = readQueue(line);
  const items = q.items || [];
  const summary = { lineId, approved: 0, hold: 0, reject: 0 };

  for (const item of items) {
    // Daha önce değerlendirilmişse atla
    if (item.editor) {
      summary[item.status] = (summary[item.status] || 0) + 1;
      continue;
    }
    try {
      const result = await reviewItem(item, line);
      summary[result.verdict] = (summary[result.verdict] || 0) + 1;
    } catch (e) {
      // Beklenmedik hata → fail-safe hold
      item.status = 'hold';
      item.editor = {
        score: null,
        reasons: [`beklenmedik hata: ${e.message.slice(0, 100)}`],
        reviewedAt: new Date().toISOString(),
        provider: 'error-fallback',
      };
      summary.hold = (summary.hold || 0) + 1;
    }
  }

  if (write) writeQueue(line, q);
  return summary;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const VERDICT_ICON = { approved: '✅', hold: '⏳', reject: '❌' };

function printItemLine(item) {
  const v = item.editor?.verdict || item.status || '?';
  const icon = VERDICT_ICON[v] || '❓';
  const score = item.editor?.score != null ? ` [${item.editor.score}/100]` : '';
  const topReason = (item.editor?.reasons || []).find(r => r !== 'tüm kriterler geçildi') || 'onaylandı';
  console.log(`  ${icon}${score} ${(item.title || item.id || '(başlıksız)').slice(0, 60)}`);
  console.log(`     → ${topReason}`);
}

async function runCLI() {
  const arg = process.argv[2] || '--all';
  const { lines } = loadLines();

  const targets = arg === '--all'
    ? lines.map((l) => l.id)
    : [arg];

  let grandTotal = { approved: 0, hold: 0, reject: 0 };

  for (const lineId of targets) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) { console.error(`⚠️  Hat bulunamadı: ${lineId}`); continue; }

    const q = readQueue(line);
    const items = q.items || [];
    if (items.length === 0) {
      console.log(`\n${line.emoji} ${line.name} [${lineId}] — kuyruk boş`);
      continue;
    }

    console.log(`\n${line.emoji} ${line.name} [${lineId}] — ${items.length} öğe değerlendiriliyor…`);

    const summary = await reviewLine(lineId, { write: true });

    // Güncellenen kuyruğu oku (item.editor dolu olacak)
    const updated = readQueue(line);
    for (const item of updated.items || []) printItemLine(item);

    console.log(`\n  Özet → ✅ ${summary.approved} onaylı  ⏳ ${summary.hold} bekleme  ❌ ${summary.reject} reddedildi`);
    grandTotal.approved += summary.approved || 0;
    grandTotal.hold += summary.hold || 0;
    grandTotal.reject += summary.reject || 0;
  }

  if (targets.length > 1) {
    console.log(`\n══════════════════════════════════════════`);
    console.log(`GENEL TOPLAM → ✅ ${grandTotal.approved}  ⏳ ${grandTotal.hold}  ❌ ${grandTotal.reject}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCLI().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
}
