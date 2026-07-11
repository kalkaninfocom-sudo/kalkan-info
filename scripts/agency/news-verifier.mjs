#!/usr/bin/env node
/**
 * scripts/agency/news-verifier.mjs — HABER DOĞRULAYICI
 * -------------------------------------------------------
 * Haber Hattı (haber) kuyruğundaki öğeleri yayından ÖNCE tarar:
 *   1. Kaynak varlığı kontrolü (source / sourceUrl)
 *   2. Hassasiyet tespiti (isSensitive → asla otomatik onay)
 *   3. Tek LLM çağrısı: sansasyon · iç çelişki · spekülasyon · güvenilirlik puanı
 *   4. Karar: ok / needs-source / reject — kuyruk öğesine geri yaz
 *
 * Dışa aktarımlar:
 *   verifyItem(item)            → { credibility, flags, verdict, notes }
 *   verifyHaberQueue({write})   → { ok, needsSource, reject }
 *
 * CLI:
 *   node scripts/agency/news-verifier.mjs          # verify tüm kuyruk (sadece kontrol edilmemişler)
 *   node scripts/agency/news-verifier.mjs --force  # tümünü yeniden kontrol et
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isSensitive } from './brand-router.mjs';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// .env.local yükle (CI'da env zaten dolu)
try {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch {}

const HABER_QUEUE = join(ROOT, 'data', 'agency', 'lines', 'haber.json');

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function readQueue() {
  try {
    return JSON.parse(readFileSync(HABER_QUEUE, 'utf8'));
  } catch {
    return { line: 'haber', updated: null, items: [] };
  }
}

function writeQueue(q) {
  mkdirSync(dirname(HABER_QUEUE), { recursive: true });
  q.updated = new Date().toISOString();
  writeFileSync(HABER_QUEUE, JSON.stringify(q, null, 2), 'utf8');
}

/** JSON'u toleranslı ayrıştır (markdown fence, fazla metin toleransı). */
function parseJSON(text) {
  let t = String(text || '').trim()
    .replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  try { return JSON.parse(t); } catch { return null; }
}

// ── Ana dışa aktarım: tek öğe doğrula ──────────────────────────────────────

/**
 * Tek bir haber öğesini doğrula.
 * @param {object} item  haber.json items[] öğesi
 * @returns {{ credibility:number, flags:string[], verdict:'ok'|'needs-source'|'reject', notes:string }}
 */
export async function verifyItem(item) {
  const flags = [];
  let credibility = 80; // başlangıç puanı; LLM düşürür/yükseltir
  let llmNotes = '';
  let provider = 'none';

  // ── 1. Kaynak varlığı ────────────────────────────────────────────────────
  const hasSource = !!(item.source || item.sourceUrl);
  if (!hasSource) {
    flags.push('kaynak yok');
    credibility -= 25;
  }

  // ── 2. Hassasiyet ───────────────────────────────────────────────────────
  const sensitive = isSensitive(item);
  if (sensitive) {
    flags.push('hassas — insan onayı');
  }

  // ── 3. LLM kontrolü (fail-safe) ─────────────────────────────────────────
  try {
    const text = [item.title, item.hook, item.body, item.summary, item.content]
      .filter(Boolean).join('\n').slice(0, 1200);

    const prompt =
      `Aşağıdaki haber öğesini analiz et ve YALNIZCA geçerli JSON döndür. Başka hiçbir şey yazma.\n\n` +
      `Başlık: ${item.title || '(yok)'}\n` +
      `Kaynak: ${item.source || item.sourceUrl || '(yok)'}\n` +
      `İçerik: ${text}\n\n` +
      `JSON formatı (anahtarlar AYNEN bu isimlerde olacak):\n` +
      `{\n` +
      `  "sansasyon": false,\n` +
      `  "celiski": false,\n` +
      `  "spekulasyon": false,\n` +
      `  "credibility": 75,\n` +
      `  "notlar": "kısa açıklama"\n` +
      `}\n\n` +
      `Kriterler:\n` +
      `- sansasyon: başlık veya içerik gerçekle orantısız şok/korku/öfke dili kullanıyor mu?\n` +
      `- celiski: haber içinde mantıksal/olgusal iç çelişki veya tutarsızlık var mı?\n` +
      `- spekulasyon: doğrulanabilir olgular mı yoksa salt tahmin/iddia mı?\n` +
      `- credibility: 0-100 arası puan (yüksek = güvenilir)\n` +
      `- notlar: Türkçe, 1-2 cümle\n`;

    const system =
      'Sen haber doğrulama uzmanısın. Kalkan İnfo markasının itibarını koruyan bir kapı bekçisisin. ' +
      'Abartı ve sansasyona karşı hassassın. SADECE JSON döndür, başka metin yazma.';

    const res = await cheapLLM(prompt, {
      system,
      json: true,
      maxTokens: 300,
      temperature: 0.1,
      timeoutMs: 25000,
    });

    provider = res.provider || 'unknown';
    const parsed = parseJSON(res.text);

    if (parsed) {
      // sansasyon → flag + ciddi puan düşürme
      if (parsed.sansasyon === true) flags.push('sansasyonel dil');
      if (parsed.celiski === true) flags.push('iç çelişki');
      if (parsed.spekulasyon === true) flags.push('spekülasyon');

      // LLM puanı ağırlıklı: %60 LLM + %40 mevcut
      const llmScore = typeof parsed.credibility === 'number'
        ? Math.max(0, Math.min(100, parsed.credibility))
        : credibility;
      credibility = Math.round(llmScore * 0.6 + credibility * 0.4);

      llmNotes = (parsed.notlar || '').slice(0, 300);
    } else {
      flags.push('llm-yanıt-ayrıştırılamadı');
      llmNotes = `Ham yanıt: ${(res.text || '').slice(0, 120)}`;
    }
  } catch (err) {
    // LLM başarısız olsa bile hassas öğe hold'da kalır — fail-safe
    flags.push(`llm-hatası: ${String(err.message).slice(0, 80)}`);
    provider = 'none';
  }

  // ── 4. Karar ────────────────────────────────────────────────────────────
  let verdict;
  if (flags.includes('sansasyonel dil')) {
    verdict = 'reject';
  } else if (
    !hasSource ||
    flags.includes('spekülasyon') ||
    credibility < 50 ||
    sensitive
  ) {
    verdict = 'needs-source';
  } else {
    verdict = 'ok';
  }

  const notes = [llmNotes, !hasSource ? 'Kaynak URL/adı eksik.' : '']
    .filter(Boolean).join(' ').trim();

  return { credibility, flags, verdict, notes, provider };
}

// ── Kuyruk doğrulama ────────────────────────────────────────────────────────

/**
 * data/agency/lines/haber.json kuyruğundaki tüm (veya yalnız denetlenmemiş) öğeleri doğrula.
 * @param {{ write?: boolean, force?: boolean }} opts
 * @returns {{ ok: number, needsSource: number, reject: number }}
 */
export async function verifyHaberQueue({ write = true, force = false } = {}) {
  const q = readQueue();
  const counts = { ok: 0, needsSource: 0, reject: 0 };

  for (const item of q.items || []) {
    // --force olmadan zaten doğrulanmışları atla
    if (!force && item.verify) {
      counts[item.verify.verdict === 'ok' ? 'ok' :
             item.verify.verdict === 'reject' ? 'reject' : 'needsSource']++;
      continue;
    }

    const result = await verifyItem(item);
    item.verify = {
      credibility: result.credibility,
      flags: result.flags,
      verdict: result.verdict,
      notes: result.notes,
      checkedAt: new Date().toISOString(),
      provider: result.provider,
    };

    // Onaylanmamış öğeleri hold'a al (mevcut 'approved'/'published' dokunma)
    if (result.verdict !== 'ok' && item.status !== 'approved' && item.status !== 'published') {
      item.status = 'hold';
    }

    counts[result.verdict === 'ok' ? 'ok' :
           result.verdict === 'reject' ? 'reject' : 'needsSource']++;
  }

  if (write) writeQueue(q);
  return counts;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const force = process.argv.includes('--force');

  if (!existsSync(HABER_QUEUE)) {
    console.log('[haber-doğrulayıcı] Kuyruk dosyası bulunamadı:', HABER_QUEUE);
    process.exit(0);
  }

  console.log(`[haber-doğrulayıcı] Kuyruk taranıyor${force ? ' (--force: tümü)' : ' (sadece kontrol edilmemişler)'}...\n`);

  const q = readQueue();
  const items = q.items || [];
  const toCheck = force ? items : items.filter(it => !it.verify);

  console.log(`Toplam: ${items.length} öğe  |  Kontrol edilecek: ${toCheck.length}\n`);

  let ok = 0, needsSource = 0, reject = 0;

  for (const item of items) {
    if (!force && item.verify) {
      // Önceden doğrulanmış — sadece özetle say
      const v = item.verify;
      const icon = v.verdict === 'ok' ? '✓' : v.verdict === 'reject' ? '✗' : '?';
      console.log(`  ${icon} [önce:${v.verdict.padEnd(12)}] [${v.credibility}] ${(item.title || '').slice(0, 70)}`);
      if (v.verdict === 'ok') ok++;
      else if (v.verdict === 'reject') reject++;
      else needsSource++;
      continue;
    }

    process.stdout.write(`  → ${(item.title || item.id || '?').slice(0, 70)} ... `);

    const result = await verifyItem(item);

    // Kuyrukta güncelle
    item.verify = {
      credibility: result.credibility,
      flags: result.flags,
      verdict: result.verdict,
      notes: result.notes,
      checkedAt: new Date().toISOString(),
      provider: result.provider,
    };
    if (result.verdict !== 'ok' && item.status !== 'approved' && item.status !== 'published') {
      item.status = 'hold';
    }

    const icon = result.verdict === 'ok' ? '✓' : result.verdict === 'reject' ? '✗' : '?';
    const flagStr = result.flags.length ? `  [${result.flags.join(', ')}]` : '';
    console.log(`${icon} [${result.verdict.padEnd(12)}] [${result.credibility}]${flagStr}`);
    if (result.notes) console.log(`     ${result.notes}`);

    if (result.verdict === 'ok') ok++;
    else if (result.verdict === 'reject') reject++;
    else needsSource++;
  }

  // Geri yaz
  writeQueue(q);

  console.log(`\n── Sonuç ──────────────────────────────`);
  console.log(`  ✓ Onay:         ${ok}`);
  console.log(`  ? Kaynak gerek: ${needsSource}`);
  console.log(`  ✗ Reddedildi:   ${reject}`);
  console.log(`  Kuyruk güncellendi: ${HABER_QUEUE}`);
}
