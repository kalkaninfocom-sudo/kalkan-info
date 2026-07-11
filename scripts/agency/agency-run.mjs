#!/usr/bin/env node
/**
 * scripts/agency/agency-run.mjs — AJANS MASTER ORKESTRATÖR
 *
 * Kurulan tüm modülleri tek uçtan-uca akışta zincirler (bir hat veya --all için):
 *   1) line-producer   → hat kendi içeriğini üretir
 *   2) editor-gate     → yayın öncesi editör denetimi (approved/hold/reject)
 *   3) news-verifier   → (yalnız haber) kaynak/sansasyon doğrulama
 *   4) line-multilang  → 5 dilde caption
 *   5) localization-qa → çeviri kalite denetimi
 *   6) line-card       → (opsiyonel --cards) her hat kendi markasıyla görsel
 * Her aşama hata-güvenli (try/catch); biri patlarsa akış durmaz. Ücretsiz LLM.
 *
 * Kullanım:
 *   node scripts/agency/agency-run.mjs magazin 2          # magazin: 2 içerik üret + tam pipeline
 *   node scripts/agency/agency-run.mjs --all 1            # her hatta 1
 *   node scripts/agency/agency-run.mjs magazin 2 --cards  # görselleri de üret (puppeteer, yavaş)
 */
import { pathToFileURL } from 'node:url';
import { loadLines, counts } from './brand-router.mjs';
import { produceForLine } from './line-producer.mjs';
import { reviewLine } from './editor-gate.mjs';
import { verifyHaberQueue } from './news-verifier.mjs';
import { enrichLine } from './line-multilang.mjs';
import { qaLine } from './localization-qa.mjs';

const now = () => new Date().toISOString().slice(11, 19);
const step = async (label, fn) => {
  const t = Date.now();
  try { const r = await fn(); console.log(`   ✓ ${label}  (${((Date.now() - t) / 1000).toFixed(1)}s)`); return r; }
  catch (e) { console.log(`   ⚠ ${label} atlandı: ${String(e.message).slice(0, 90)}`); return null; }
};

export async function runLine(lineId, { produce = 2, cards = false } = {}) {
  const line = loadLines().lines.find((l) => l.id === lineId);
  if (!line) { console.log(`✗ hat yok: ${lineId}`); return; }
  console.log(`\n${line.emoji} ${line.name} — pipeline [${now()}]`);

  if (produce > 0) await step(`üret (${produce})`, () => produceForLine(lineId, produce));
  await step('editör denetimi', () => reviewLine(lineId, { write: true }));
  if (lineId === 'haber') await step('haber doğrulama', () => verifyHaberQueue({ write: true }));
  await step('5 dile aç', () => enrichLine(lineId, {}));
  await step('yerelleştirme QA', () => qaLine(lineId, { write: true }));
  if (cards) {
    const mod = await import('./line-card.mjs');
    await step('markalı kart', () => mod.renderLineCards({ lineId, lang: 'tr' }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const cards = args.includes('--cards');
  const produce = parseInt(args.find((a) => /^\d+$/.test(a)) || '2', 10);
  const lineArg = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  const ids = all ? loadLines().lines.map((l) => l.id) : [lineArg || 'magazin'];
  (async () => {
    console.log(`═══ AJANS ÇALIŞMASI — ${ids.join(', ')} (üret:${produce}${cards ? ', +kart' : ''}) ═══`);
    for (const id of ids) await runLine(id, { produce, cards });
    console.log(`\n📊 Hat kuyrukları:`, JSON.stringify(counts()));
    console.log('✓ Ajans çalışması bitti.');
  })().catch((e) => { console.error('ölümcül:', e.message); process.exit(1); });
}
