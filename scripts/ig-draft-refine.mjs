#!/usr/bin/env node
/**
 * ig-draft-refine.mjs — Taslakların BOZUK özet/tip alanlarını düzelt (IG'ye vurmadan).
 * Kaynak: data/*-draft.json içindeki stored `biography` + `name`. cheapLLM (groq/cerebras,
 * OLLAMA ATLANIR — kaliteli editöryal iş). Villalar HARİÇ.
 *
 * node scripts/ig-draft-refine.mjs [--only su-sporlari,wellness]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { glob } from 'node:fs/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try { const p = join(ROOT, '.env.local'); if (existsSync(p)) for (const line of readFileSync(p,'utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,''); } } catch {}

const ARGS = process.argv.slice(2);
const onlyArg = ARGS[ARGS.indexOf('--only')+1];
const ONLY = ARGS.includes('--only') && onlyArg ? onlyArg.split(',').map(s=>s.trim()) : null;
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const { cheapLLM } = await import(pathToFileURL(join(ROOT,'lib','cheap-llm.mjs')).href);

const SYSTEM = 'Sen turizm editörüsün. Sana Kalkan bölgesindeki bir işletmenin adı, kategorisi ve Instagram bio\'su verilir. ' +
  'SADECE geçerli JSON dön: {"ozet":"...","tip":"..."}. ' +
  'ozet = tek cümle, olgusal, Türkçe, max 20 kelime, REKLAM DİLİ YOK (harika/muhteşem/eşsiz yasak), bio\'da açıkça geçmeyeni UYDURMA. ' +
  'tip = 2-4 kelimelik kısa tür etiketi (ör. "gün batımı tekne turu", "yoga stüdyosu", "üçüncü dalga kahve"). Bio boşsa ozet="" bırak.';

async function refineDraft(file) {
  const d = JSON.parse(await readFile(file, 'utf8'));
  const items = d.items || [];
  let fixed = 0;
  for (const it of items) {
    const bio = (it.biography || '').trim();
    const needs = !it.summary || it.summary.length < 8 || !it.type;
    if (!needs) continue;
    if (!bio && !it.name) continue;
    try {
      const { text } = await cheapLLM(
        `İşletme: ${it.name}\nKategori: ${it.category}\nBio: ${bio || '(bio yok)'}`,
        { system: SYSTEM, json: true, maxTokens: 160, temperature: 0.4, order: ['groq','cerebras','nvidia'] }
      );
      const out = JSON.parse(String(text).replace(/```json|```/g,'').trim());
      if (out.ozet && typeof out.ozet === 'string') it.summary = out.ozet.trim();
      if (out.tip && typeof out.tip === 'string') it.type = out.tip.trim();
      fixed++;
      process.stdout.write('.');
      await sleep(700);
    } catch (e) { process.stdout.write('x'); await sleep(1500); }
  }
  await writeFile(file, JSON.stringify(d, null, 2), 'utf8');
  console.log(`\n  ✓ ${basename(file)}: ${fixed}/${items.length} özet yenilendi`);
  return fixed;
}

const files = [];
for await (const f of glob(join(ROOT, 'data', '*-draft.json'))) {
  const key = basename(f).replace('-draft.json','');
  if (key === 'villalar') continue;                    // villalar hariç
  if (ONLY && !ONLY.includes(key)) continue;
  files.push(f);
}
console.log(`🔧 Özet düzeltme — ${files.length} taslak dosyası\n`);
let total = 0;
for (const f of files) total += await refineDraft(f);
console.log(`\nBitti: ${total} özet groq/cerebras ile yenilendi.`);
