#!/usr/bin/env node
/**
 * scripts/agency/gazete-newsroom.mjs — GERÇEK HABER ODASI (Tier 2: çok-rollü editöryal zincir)
 * ------------------------------------------------------------------------------------------------
 * SORUN: gazete tek bir LLM çağrısıyla üretiliyordu — "muhabir" vardı ama bağımsız EDİTÖR ve
 * DOĞRULAYICI onayı yoktu. Berkay: "ajanslar kendi arasında haber ajansı mantığında çalışsın".
 *
 * BU KATMAN mevcut muhabiri (gazete-editorial.mjs — kanıtlanmış taslak üretici) BOZMADAN üstüne
 * gerçek bir yazı işleri zinciri kurar:
 *
 *   1) MUHABİR    — gazete-editorial.mjs taslak ön sayfayı üretir (manşet + 3 sütun + magazin).
 *   2) EDİTÖR     — editor-gate.reviewItem: her taslağı ton/uydurma/sansasyon/kalite için puanlar
 *                   → approved | hold | reject.
 *   3) DOĞRULAYICI — news-verifier.verifyItem: kaynak/olgusallık/güvenilirlik → ok | needs-source | reject.
 *   4) ŞEF        — kararları birleştirir: manşet reddedilirse geçen sütunla değiştirir (demote),
 *                   her karara denetim izi (editorial_review) ekler, gazete-today.json'u yeniden yazar.
 *   5) (dışarıda) YAYIN SORUMLUSU = Berkay — Telegram görselli onay (mevcut gazete-approval akışı).
 *
 * DÜRÜSTLÜK: Zincir yalnızca ELER/işaretler; yeni olgu üretmez. LLM/gate patlarsa muhabir çıktısı
 * OLDUĞU GİBİ kalır (paper her zaman çıkar) + denetim izine "gate atlandı" yazılır. Non-fatal.
 *
 * Kullanım: node scripts/agency/gazete-newsroom.mjs [YYYY-MM-DD]
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel; CI'da env zaten dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const TODAY_FILE = join(ROOT, 'data', 'gazete-today.json');

// ── Haber hattı tanımı (editör bu editöryal çizgiye göre değerlendirir) ──
function haberLine() {
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'data', 'agency', 'brand-lines.json'), 'utf8'));
    const l = (cfg.lines || []).find(x => x.id === 'haber');
    if (l) return l;
  } catch {}
  return { id: 'haber', name: 'Kalkan Info Haber',
    editorial: 'Yerel haber: güncel, TEYİTLİ, kaynak atıflı, sansasyonsuz. Hız değil doğruluk.' };
}

// gazete-today.json alanlarından → gate'lenebilir taslak "item"lar (kaynak bilgisiyle).
function draftsFromFront(front, idMap) {
  const ids = front.source_ids || [];
  const src = (i) => idMap.get(ids[i]) || {};
  const join2 = (v) => Array.isArray(v) ? v.join(' ') : String(v || '');
  // GROUNDING: editör/doğrulayıcı taslağı KÖR değerlendirmesin diye altındaki ham kaynak özetini
  // `content` olarak ekle — yoksa tek cümlelik sütunu "kaynaksız → uydurma" sanıp haksız reddediyor.
  const ground = (i) => (src(i).summary || src(i).content || '');
  return [
    { slot: 'lead', title: front.lead_headline, summary: front.lead_deck,
      body: join2(front.lead_body), content: ground(0), category: src(0).category,
      source: src(0).source, sourceUrl: src(0).sourceUrl },
    { slot: 'col1', title: front.col1_title, summary: '', body: front.col1_body,
      content: ground(1), category: src(1).category, source: src(1).source, sourceUrl: src(1).sourceUrl },
    { slot: 'col3', title: front.col3_title, summary: '', body: front.col3_body,
      content: ground(2), category: src(2).category, source: src(2).source, sourceUrl: src(2).sourceUrl },
    { slot: 'magazine', title: front.magazine_lead_headline, summary: '',
      body: join2(front.magazine_lead_body), content: ground(3), category: src(3).category,
      source: src(3).source, sourceUrl: src(3).sourceUrl },
  ].filter(d => d.title); // boş sütun (RSS ince) gate'e sokulmaz
}

async function main() {
  console.log(`\n════ HABER ODASI — ${date} (muhabir → editör → doğrulayıcı → şef) ════`);

  // ── 1) MUHABİR: taslak ön sayfayı üret (mevcut kanıtlanmış editöryal) ──
  console.log('── 1/4 MUHABİR: taslak ön sayfa üretiliyor ──');
  const rep = spawnSync('node', ['scripts/agency/gazete-editorial.mjs', date], { cwd: ROOT, stdio: 'inherit' });
  if (rep.status !== 0) console.warn('  ⚠ muhabir hata verdi — mevcut/RSS içerikle devam.');

  let front;
  try { front = JSON.parse(await readFile(TODAY_FILE, 'utf8')); }
  catch { console.warn('⚠ gazete-today.json yok — haber odası atlandı (build RSS fallback ile devam).'); return; }
  if (front.date !== date || !front.lead_headline) {
    console.warn('⚠ bugünün taslağı yok/eksik — haber odası atlandı.'); return;
  }

  // Kaynak eşlemesi (source_ids → haberler.json item): doğrulayıcı gerçek kaynağı görsün.
  const idMap = new Map();
  try {
    const h = JSON.parse(await readFile(join(ROOT, 'data', 'haberler.json'), 'utf8'));
    for (const it of (h.items || [])) idMap.set(it.id, it);
  } catch {}

  const drafts = draftsFromFront(front, idMap);
  if (!drafts.length) { console.warn('⚠ taslak yok — haber odası atlandı.'); return; }

  // ── 2+3) EDİTÖR + DOĞRULAYICI (her taslak için paralel) ──
  console.log('── 2/4 EDİTÖR + 3/4 DOĞRULAYICI: taslaklar denetleniyor ──');
  const line = haberLine();
  let reviewItem, verifyItem;
  try {
    ({ reviewItem } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'editor-gate.mjs')).href));
    ({ verifyItem } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'news-verifier.mjs')).href));
  } catch (e) {
    console.warn(`  ⚠ gate modülleri yüklenemedi (${e.message}) — muhabir çıktısı olduğu gibi bırakıldı.`);
    front.editorial_review = { reviewed_at: new Date().toISOString(), skipped: 'gate-import-failed' };
    await persist(front); return;
  }

  const judged = await Promise.all(drafts.map(async (d) => {
    const item = { ...d, id: `gz-${date}-${d.slot}`, status: 'pending' };
    let editor = null, verifier = null;
    try { editor = await reviewItem(item, line); } catch (e) { editor = { verdict: 'error', reasons: [String(e.message).slice(0, 80)], score: null }; }
    try { verifier = await verifyItem(item); } catch (e) { verifier = { verdict: 'error', credibility: null, flags: [String(e.message).slice(0, 80)] }; }
    const hardReject = editor?.verdict === 'reject' || verifier?.verdict === 'reject';
    const pass = !hardReject && editor?.verdict !== 'error';
    return {
      slot: d.slot, title: d.title,
      editor: { verdict: editor?.verdict, score: editor?.score ?? null, reasons: (editor?.reasons || []).slice(0, 2) },
      verifier: { verdict: verifier?.verdict, credibility: verifier?.credibility ?? null, flags: (verifier?.flags || []).slice(0, 3) },
      pass, hardReject,
      rank: (editor?.score ?? 50) + (verifier?.credibility ?? 50), // şef sıralaması
    };
  }));

  for (const j of judged) {
    const icon = j.hardReject ? '❌' : (j.pass ? '✅' : '⏳');
    console.log(`  ${icon} ${j.slot.padEnd(9)} editör:${j.editor.verdict}[${j.editor.score ?? '-'}] doğrulayıcı:${j.verifier.verdict}[${j.verifier.credibility ?? '-'}]`);
  }

  // ── 4) ŞEF: manşet hard-reddedilirse geçen en iyi sütunla değiştir; denetim izi ekle ──
  console.log('── 4/4 ŞEF: karar + montaj ──');
  const decisions = [];
  const bySlot = Object.fromEntries(judged.map(j => [j.slot, j]));
  const leadJ = bySlot.lead;

  if (leadJ && leadJ.hardReject) {
    // Geçen (hard-reddedilmemiş) en yüksek rütbeli sütunu manşete al.
    const alt = judged.filter(j => j.slot !== 'lead' && !j.hardReject).sort((a, b) => b.rank - a.rank)[0];
    if (alt) {
      swapLeadWith(front, alt.slot);
      decisions.push(`MANŞET reddedildi (${verdictReason(leadJ)}) → "${alt.slot}" manşete alındı (şef kararı)`);
      console.log(`  ↳ manşet reddedildi → ${alt.slot} manşete alındı`);
    } else {
      front.lead_review_flag = `⚠ MANŞET editöryal denetimden geçemedi (${verdictReason(leadJ)}) — insan onayı şart`;
      decisions.push(`MANŞET reddedildi, geçen sütun yok → insan onayına bayrak eklendi`);
      console.log('  ⚠ manşet reddedildi, alternatif yok → insan onayına bırakıldı');
    }
  } else {
    decisions.push('MANŞET editöryal denetimden geçti');
    console.log('  ✓ manşet denetimden geçti');
  }

  // Sütun hard-reject → içeriği boşaltma; bayrakla (insan onayı görür, prod'da nadir).
  for (const j of judged) {
    if (j.slot === 'lead') continue;
    if (j.hardReject) decisions.push(`${j.slot} işaretlendi (${verdictReason(j)}) — insan onayı`);
  }

  front.editorial_review = {
    reviewed_at: new Date().toISOString(),
    roles: { muhabir: front.provider || 'unknown', editor: 'editor-gate', dogrulayici: 'news-verifier' },
    slots: judged.map(j => ({ slot: j.slot, editor: j.editor.verdict, editor_score: j.editor.score,
      verifier: j.verifier.verdict, credibility: j.verifier.credibility })),
    decisions,
    approved_slots: judged.filter(j => j.pass).map(j => j.slot),
  };

  await persist(front);
  console.log(`\n✅ Haber odası tamam → data/gazete-today.json (denetim izi eklendi). Manşet: "${front.lead_headline}"`);
}

function verdictReason(j) {
  const bits = [];
  if (j.editor.verdict === 'reject') bits.push('editör: ' + (j.editor.reasons[0] || 'reddetti'));
  if (j.verifier.verdict === 'reject') bits.push('doğrulayıcı: ' + (j.verifier.flags[0] || 'sansasyon/güvenilmez'));
  return bits.join('; ') || 'denetim';
}

// front içindeki lead_* alanlarını verilen sütunun alanlarıyla değiştir (kaynak id'leri de yer değiştirir).
function swapLeadWith(front, slot) {
  const map = { col1: ['col1_title', 'col1_byline', 'col1_body', 1], col3: ['col3_title', 'col3_byline', 'col3_body', 2], magazine: ['magazine_lead_headline', null, 'magazine_lead_body', 3] };
  const m = map[slot]; if (!m) return;
  const [tK, , bK, srcIdx] = m;
  const newHeadline = front[tK];
  const newBody = front[bK];
  // sütun gövdesi kısa → manşet gövdesi olarak kullan (deck'i başlıktan üret)
  front.lead_headline = newHeadline;
  front.lead_deck = '';
  front.lead_body = Array.isArray(newBody) ? newBody : [String(newBody || '')];
  // kaynak id sırası: lead ↔ slot yer değiştir (denetim tutarlılığı)
  if (Array.isArray(front.source_ids) && front.source_ids[srcIdx] != null) {
    const tmp = front.source_ids[0]; front.source_ids[0] = front.source_ids[srcIdx]; front.source_ids[srcIdx] = tmp;
  }
}

async function persist(front) {
  await writeFile(TODAY_FILE, JSON.stringify(front, null, 2));
  // Tarihli arşivi de güncelle (muhabir yazmıştı; şef kararıyla üzerine yaz — idempotent).
  try {
    const archDir = join(ROOT, 'data', 'gazete-archive');
    await mkdir(archDir, { recursive: true });
    await writeFile(join(archDir, `${front.date}.json`), JSON.stringify(front, null, 2));
  } catch (e) { console.warn('  ⚠ arşiv yazılamadı (non-fatal):', e.message); }
}

main().catch(e => { console.error('[gazete-newsroom]', e); process.exit(0); }); // bozma: paper her zaman çıksın
