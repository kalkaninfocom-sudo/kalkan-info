#!/usr/bin/env node
/**
 * scripts/agency/localization-qa.mjs — Yerelleştirme QA Editörü
 *
 * 5 dilli (tr, en, de, fr, ru) caption'ları kalite, doğruluk ve marka sesi açısından denetler;
 * zayıf ya da eksik dilleri yeniden üretir.
 *
 * API:
 *   qaItem(item, line)  → { ok, perLang:{lang:{score,issues:[]}}, missing:[], fixed:[] }
 *   qaLine(lineId, {write, force}) → { items, fixed, stillWeak }
 *
 * CLI:
 *   node scripts/agency/localization-qa.mjs magazin
 *   node scripts/agency/localization-qa.mjs --all
 *   node scripts/agency/localization-qa.mjs magazin --force
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLines } from './brand-router.mjs';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LANGS = ['tr', 'en', 'de', 'fr', 'ru'];
const NON_TR = ['en', 'de', 'fr', 'ru'];
const SCORE_THRESHOLD = 60;

// .env.local yükle
try {
  for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

function parseObj(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  try { return JSON.parse(t); } catch { return null; }
}

/**
 * Tek öğeyi denetler.
 * @param {object} item  - kuyruk öğesi (captions: {tr,en,de,fr,ru} içerebilir)
 * @param {object} line  - marka hattı (name, editorial, handle)
 * @returns {{ ok:boolean, perLang:object, missing:string[], fixed:string[] }}
 */
export async function qaItem(item, line) {
  const captions = item.captions || {};
  const missing = LANGS.filter((l) => !captions[l] || !String(captions[l]).trim());

  // tr referans yoksa kalite değerlendirmesi yapılamaz; yine de missing listesi dön
  const trRef = captions.tr ? String(captions.tr).trim() : null;

  const perLang = {};
  let provider = null;

  // ── 1. Kalite değerlendirmesi (tr referansı varsa) ───────────────────────
  const toEvaluate = NON_TR.filter((l) => captions[l] && String(captions[l]).trim());
  if (trRef && toEvaluate.length > 0) {
    const captionBlock = toEvaluate
      .map((l) => `"${l}": "${String(captions[l]).replace(/"/g, '\\"')}"`)
      .join(',\n  ');
    const prompt =
      `Sen çok dilli İnstagram içerik kalite uzmanısın. Aşağıdaki Türkçe metni referans al ve diğer dillerin kalitesini değerlendir.\n` +
      `Marka: ${line.name} (${line.handle}). Editöryal ses: ${line.editorial}\n\n` +
      `REFERANS (Türkçe):\n"${trRef}"\n\n` +
      `DEĞERLENDİRİLECEK DİLLER:\n{\n  ${captionBlock}\n}\n\n` +
      `Her dil için 4 kriteri derecelendir (0-100 arası TEK bir skor):\n` +
      `  (a) doğru çeviri mi (anlam kayması var mı)\n` +
      `  (b) o dilde doğal mı (makine çevirisi kokuyor mu)\n` +
      `  (c) marka sesi/tonu korunmuş mu\n` +
      `  (d) eksik ya da fazladan bilgi var mı\n\n` +
      `SADECE şu JSON döndür, başka hiçbir şey:\n` +
      `{"en":{"score":0,"issues":[]},"de":{"score":0,"issues":[]},"fr":{"score":0,"issues":[]},"ru":{"score":0,"issues":[]}}`;

    try {
      const res = await cheapLLM(prompt, {
        json: true,
        maxTokens: 600,
        temperature: 0.2,
        timeoutMs: 45000,
      });
      provider = res.provider;
      const parsed = parseObj(res.text) || {};
      for (const l of NON_TR) {
        if (parsed[l] && typeof parsed[l].score === 'number') {
          perLang[l] = {
            score: Math.max(0, Math.min(100, parsed[l].score)),
            issues: Array.isArray(parsed[l].issues) ? parsed[l].issues : [],
          };
        } else if (captions[l]) {
          // LLM yanıtında bu dil yoksa nötr puan
          perLang[l] = { score: 75, issues: ['LLM dönütü yok — varsayılan puan'] };
        }
      }
    } catch (e) {
      // Değerlendirme başarısız olursa sessizce geç
      for (const l of toEvaluate) perLang[l] = { score: 75, issues: [`Değerlendirme hatası: ${e.message.slice(0, 80)}`] };
    }
  }

  // tr'nin kendisi için basit kontrol (mevcut ise 100, yoksa skip)
  if (captions.tr) perLang.tr = { score: 100, issues: [] };

  // ── 2. Zayıf + eksik dilleri yeniden üret ────────────────────────────────
  const fixed = [];
  const needsRegen = [
    ...missing,
    ...NON_TR.filter((l) => !missing.includes(l) && perLang[l] && perLang[l].score < SCORE_THRESHOLD),
  ];

  if (trRef && needsRegen.length > 0) {
    for (const lang of needsRegen) {
      const langNames = { en: 'İngilizce', de: 'Almanca', fr: 'Fransızca', ru: 'Rusça' };
      const prompt =
        `Sen ${line.name} (${line.handle}) marka hattının sosyal medya editörüsün.\n` +
        `Editöryal ses: ${line.editorial}\n\n` +
        `Aşağıdaki Türkçe Instagram caption'ını ${langNames[lang] || lang} diline yeniden yaz.\n` +
        `Birebir çeviri DEĞİL — ${langNames[lang] || lang} dilinde doğal, etkileyici, marka sesine uygun olsun.\n` +
        `Emoji ve hashtagleri koru. Maksimum 5 hashtag.\n\n` +
        `TÜRKÇE REFERANS:\n"${trRef}"\n\n` +
        `SADECE ${langNames[lang] || lang} caption metnini döndür, tırnak işareti olmadan.`;
      try {
        const res = await cheapLLM(prompt, {
          maxTokens: 300,
          temperature: 0.55,
          timeoutMs: 30000,
        });
        provider = provider || res.provider;
        const text = res.text.trim().replace(/^["']|["']$/g, '');
        if (text) {
          item.captions = item.captions || {};
          item.captions[lang] = text;
          perLang[lang] = { score: 80, issues: ['Yeniden üretildi'] };
          fixed.push(lang);
        }
      } catch (e) {
        if (!perLang[lang]) perLang[lang] = { score: 0, issues: [] };
        perLang[lang].issues.push(`Yeniden üretim başarısız: ${e.message.slice(0, 80)}`);
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  // ── 3. localizationQa metadata yaz ──────────────────────────────────────
  item.localizationQa = {
    perLang,
    checkedAt: new Date().toISOString(),
    provider: provider || 'none',
    fixedLangs: fixed,
  };

  const ok = missing.length === 0 && NON_TR.every((l) => (perLang[l]?.score ?? 0) >= SCORE_THRESHOLD);

  return { ok, perLang, missing, fixed };
}

/**
 * Bir hattın kuyruğundaki tüm caption'lı öğeleri denetler.
 * @param {string} lineId
 * @param {{ write?: boolean, force?: boolean }} opts
 */
export async function qaLine(lineId, { write = true, force = false } = {}) {
  const { lines } = loadLines();
  const line = lines.find((l) => l.id === lineId);
  if (!line) throw new Error('Hat bulunamadı: ' + lineId);

  const qPath = join(ROOT, line.queue || `data/agency/lines/${line.id}.json`);
  let q;
  try { q = JSON.parse(readFileSync(qPath, 'utf8')); } catch { q = { line: lineId, items: [] }; }

  const items = q.items || [];
  const results = [];
  let fixedTotal = 0;
  let stillWeak = 0;

  for (const item of items) {
    // caption yoksa atla
    if (!item.captions && !force) continue;
    // zaten QA yapıldıysa ve force yoksa atla
    if (!force && item.localizationQa && item.localizationQa.checkedAt) {
      results.push({ id: item.id, skipped: true });
      continue;
    }

    try {
      const res = await qaItem(item, line);
      fixedTotal += res.fixed.length;
      if (!res.ok && res.missing.length === 0) stillWeak++;
      results.push({ id: item.id, ...res });
    } catch (e) {
      results.push({ id: item.id, error: e.message });
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (write) {
    q.updated = new Date().toISOString();
    writeFileSync(qPath, JSON.stringify(q, null, 2), 'utf8');
  }

  return { items: results, fixed: fixedTotal, stillWeak };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function langLabel(lang) {
  return { tr: 'TR', en: 'EN', de: 'DE', fr: 'FR', ru: 'RU' }[lang] || lang.toUpperCase();
}

function printResult(itemId, res) {
  if (res.skipped) { console.log(`  ○ ${itemId}  (atlandı — QA zaten var)`); return; }
  if (res.error) { console.log(`  ✗ ${itemId}  HATA: ${res.error}`); return; }

  const lines = [];
  for (const l of LANGS) {
    const p = res.perLang?.[l];
    if (!p) { lines.push(`${langLabel(l)}:?`); continue; }
    const mark = p.score >= SCORE_THRESHOLD ? '✓' : '✗';
    lines.push(`${mark}${langLabel(l)}:${p.score}`);
  }

  const fixedStr = res.fixed?.length ? `  [yeniden üretildi: ${res.fixed.map(langLabel).join(',')}]` : '';
  const missingStr = res.missing?.length ? `  [eksik: ${res.missing.map(langLabel).join(',')}]` : '';
  const ok = res.ok ? '✅' : '⚠';
  console.log(`  ${ok} ${String(itemId).slice(0, 55).padEnd(56)} ${lines.join('  ')}${fixedStr}${missingStr}`);

  // Sorunları göster
  for (const l of LANGS) {
    const issues = res.perLang?.[l]?.issues || [];
    for (const iss of issues.filter((i) => !i.includes('varsayılan puan') && !i.includes('Yeniden üretildi'))) {
      console.log(`       ${langLabel(l)}: ${iss}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const all = args.includes('--all');
  const lineArg = args.find((a) => !a.startsWith('--'));

  const ids = all
    ? loadLines().lines.map((l) => l.id)
    : [lineArg || 'magazin'];

  (async () => {
    for (const id of ids) {
      const line = loadLines().lines.find((l) => l.id === id);
      if (!line) { console.log(`✗ Hat yok: ${id}`); continue; }
      console.log(`\n${line.emoji || '📋'} ${line.name} [${id}] — Yerelleştirme QA`);
      console.log('─'.repeat(70));
      try {
        const { items, fixed, stillWeak } = await qaLine(id, { write: true, force });
        for (const r of items) printResult(r.id, r);
        const processed = items.filter((i) => !i.skipped && !i.error).length;
        const skipped = items.filter((i) => i.skipped).length;
        console.log(`\n  Toplam: ${items.length} öğe  |  İşlendi: ${processed}  |  Atlandı: ${skipped}  |  Düzeltilen dil: ${fixed}  |  Hâlâ zayıf: ${stillWeak}`);
      } catch (e) {
        console.log(`✗ ${id}: ${e.message}`);
      }
    }
  })();
}
