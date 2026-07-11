#!/usr/bin/env node
/**
 * scripts/agency/line-multilang.mjs — Hat içeriğini 5 DİLE aç
 *
 * Bir marka hattının kuyruğundaki öğeler için yayına hazır Instagram caption'ı 5 dilde üretir
 * (tr, en, de, fr, ru) ve öğeye `captions` olarak yazar. Tek cheap-llm çağrısı/öğe (tüm diller).
 * "Her üretilen içerik 5 dilde" vizyonunun hat katmanı. Ücretsiz beyin (cheap-llm).
 *
 * Kullanım:
 *   node scripts/agency/line-multilang.mjs magazin     # magazin kuyruğundaki caption'sız öğeleri çevir
 *   node scripts/agency/line-multilang.mjs --all
 *   node scripts/agency/line-multilang.mjs magazin --force   # hepsini yeniden üret
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLines } from './brand-router.mjs';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LANGS = ['tr', 'en', 'de', 'fr', 'ru'];

try {
  for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

function parseObj(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
  try { return JSON.parse(t); } catch { return null; }
}

async function captionsFor(line, item) {
  const system =
    `Sen "${line.name}" (${line.handle}) marka hattının sosyal medya editörüsün. ` +
    `EDİTÖRYAL SES: ${line.editorial} Instagram caption'ı yazarsın: kısa, etkileyici, emoji ölçülü, en fazla 5 hashtag.`;
  const user =
    `Şu içerikten yayına hazır bir Instagram caption üret ve 5 dile aç. Birebir çeviri DEĞİL — her dil kendi içinde doğal olsun.\n` +
    `İçerik → Başlık: ${item.title} | Kanca: ${item.hook || ''} | Gövde: ${item.body || ''}\n` +
    `Diller: tr, en, de, fr, ru. Marka: Kalkan Info. Yer: Kalkan/Kaş.\n` +
    `SADECE şu JSON: {"tr":"...","en":"...","de":"...","fr":"...","ru":"..."}`;
  const res = await cheapLLM(user, { system, json: true, maxTokens: 900, temperature: 0.6, timeoutMs: 60000 });
  const obj = parseObj(res.text) || {};
  const caps = {};
  for (const l of LANGS) if (obj[l]) caps[l] = String(obj[l]).trim();
  return { caps, provider: res.provider };
}

export async function enrichLine(lineId, { force = false } = {}) {
  const line = loadLines().lines.find((l) => l.id === lineId);
  if (!line) throw new Error('Hat yok: ' + lineId);
  const qPath = join(ROOT, line.queue);
  let q; try { q = JSON.parse(readFileSync(qPath, 'utf8')); } catch { q = { line: lineId, items: [] }; }
  const items = q.items || [];
  let done = 0, provider = null;
  for (const it of items) {
    if (!force && it.captions && Object.keys(it.captions).length >= LANGS.length) continue;
    if (!it.title) continue;
    try {
      const { caps, provider: p } = await captionsFor(line, it);
      if (Object.keys(caps).length) { it.captions = caps; it.langs = Object.keys(caps); provider = p; done++; }
    } catch (e) { console.log(`   ⚠ ${it.id}: ${e.message}`); }
    await new Promise((r) => setTimeout(r, 400));
  }
  q.updated = new Date().toISOString();
  writeFileSync(qPath, JSON.stringify(q, null, 2), 'utf8');
  return { line, done, total: items.length, provider };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const all = args.includes('--all');
  const lineArg = args.find((a) => !a.startsWith('--'));
  const ids = all ? loadLines().lines.map((l) => l.id) : [lineArg || 'kalkaninfo'];
  (async () => {
    for (const id of ids) {
      try {
        const { line, done, total, provider } = await enrichLine(id, { force });
        console.log(`${line.emoji} ${line.name}: ${done}/${total} öğe 5 dile açıldı${provider ? ` (${provider})` : ''}`);
      } catch (e) { console.log(`✗ ${id}: ${e.message}`); }
    }
  })();
}
