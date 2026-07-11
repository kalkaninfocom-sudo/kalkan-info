#!/usr/bin/env node
/**
 * scripts/agency/line-producer.mjs — Marka HATTI içerik üreticisi
 *
 * Her marka hattı (Kalkan Info / Haber / Magazin / TV) KENDİ editöryal sesiyle içerik üretir ve
 * brand-router ile KENDİ kuyruğuna düşer → hatlar karışmaz. IG hesapları gelmeden çalışır
 * (kuyrukları doldurur; hesap+token gelince yayın katmanı postlar). Beyin: cheap-llm (ücretsiz).
 *
 * Kullanım:
 *   node scripts/agency/line-producer.mjs haber 3      # haber hattına 3 içerik
 *   node scripts/agency/line-producer.mjs --all 2      # her hatta 2 içerik
 *   node scripts/agency/line-producer.mjs magazin      # varsayılan 3
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLines, routeToLine, counts } from './brand-router.mjs';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// .env.local yükle (cheap-llm anahtarları için)
try {
  const p = join(ROOT, '.env.local');
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const KALKAN = `Bölge: Kalkan / Kaş / Patara (Antalya, Likya kıyısı). Turizm markası. Gerçek bilgiye dayan, uydurma;
işletmeye özel rakam/tarih uydurma. Klişe/dolgu yok. Kısa, net, marka kalitesi.`;

function promptFor(line, n) {
  const typeList = (line.types || ['post']).join(' | ');
  const system = `Sen "${line.name}" (${line.handle}) marka hattının editörüsün. ` +
    `EDİTÖRYAL ÇİZGİ: ${line.editorial} ` +
    `SADECE bu hattın sesine/kapsamına uygun içerik üret; başka hatta (${line.id === 'haber' ? 'magazin/genel' : 'haber/başka'}) kayma. Türkçe.`;
  const user =
    `${KALKAN}\n\n"${line.name}" için ${n} adet ÖZGÜN içerik fikri üret. Her biri bu hattın editöryal çizgisine tam uysun.\n` +
    `Her fikir: { "type": (${typeList} içinden biri), "category": (kısa kategori), "title": (çekici başlık), ` +
    `"hook": (1 cümle kanca), "body": (2-3 cümle gövde) }.\n` +
    `SADECE şu JSON, başka metin yok: {"items":[{"type":"...","category":"...","title":"...","hook":"...","body":"..."}]}`;
  return { system, user };
}

function parseItems(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
  try { const j = JSON.parse(t); return Array.isArray(j.items) ? j.items : (Array.isArray(j) ? j : []); }
  catch { return []; }
}

export async function produceForLine(lineId, n = 3) {
  const line = loadLines().lines.find((l) => l.id === lineId);
  if (!line) throw new Error('Hat yok: ' + lineId);
  const { system, user } = promptFor(line, n);
  const res = await cheapLLM(user, { system, json: true, maxTokens: 900, temperature: 0.6, timeoutMs: 60000 });
  const items = parseItems(res.text).slice(0, n);
  const routed = [];
  const stamp = Date.now().toString(36);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const item = {
      id: `${lineId}-${stamp}-${i}`,
      line: lineId,
      type: it.type || (line.types || ['post'])[0],
      category: it.category || lineId,
      title: String(it.title || '').trim(),
      hook: String(it.hook || '').trim(),
      body: String(it.body || '').trim(),
      lang: 'tr',
      status: 'pending',
      source: 'line-producer',
      _provider: res.provider,
      createdAt: new Date().toISOString(),
    };
    if (!item.title) continue;
    routeToLine(item);
    routed.push(item);
  }
  return { line, provider: res.provider, routed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const n = parseInt(args.find((a) => /^\d+$/.test(a)) || '3', 10);
  const lineArg = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  const ids = all ? loadLines().lines.map((l) => l.id) : [lineArg || 'kalkaninfo'];
  (async () => {
    for (const id of ids) {
      try {
        const { line, provider, routed } = await produceForLine(id, n);
        console.log(`\n${line.emoji} ${line.name} (${provider}) — ${routed.length} içerik → ${line.queue}`);
        for (const r of routed) console.log(`   • [${r.type}] ${r.title}\n     ${r.hook}`);
      } catch (e) { console.log(`✗ ${id}: ${e.message}`); }
    }
    console.log('\nKuyruk durumu:', JSON.stringify(counts()));
  })();
}
