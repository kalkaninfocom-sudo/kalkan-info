#!/usr/bin/env node
/**
 * scripts/agency/gazete-editorial-en.mjs — GAZETE EDİTÖRYAL EN ÇEVİRİ (İngiliz kitle için ikizi)
 * ----------------------------------------------------------------------------------------------
 * gazete-editorial.mjs TR editöryalini (data/gazete-today.json) ürettikten SONRA çalışır.
 * Metin alanlarını (manşet/deck/gövde/sütun/magazine + evergreen antik/reklam) ucuz-LLM
 * (lib/cheap-llm.mjs: ollama→groq→cerebras→nvidia→gemini→claude) ile İngilizceye ÇEVİRİR ve
 * data/gazete-today.en.json + data/gazete-archive/<date>.en.json'a yazar.
 *
 * DÜRÜSTLÜK: LLM'e "SADECE çevir; YENİ olgu/isim/rakam UYDURMA" talimatı verilir.
 * IDEMPOTENT: en.json zaten aynı kaynak (source_generated_at) için üretilmişse atlar.
 * TR yoksa/LLM başarısızsa: dosya YAZILMAZ, exit 0 (EN reel adımı graceful atlanır).
 *
 * Kullanım: node scripts/agency/gazete-editorial-en.mjs [YYYY-MM-DD] [--force]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel çalıştırma; CI'da env zaten dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const FORCE = process.argv.includes('--force');

// TR haber kategorisi → EN etiket (deterministik; reel kart etiketleri için).
const CAT_EN = {
  'Turizm': 'Tourism', 'Plaj': 'Beach', 'Etkinlik': 'Events', 'Kültür': 'Culture',
  'Belediye': 'Municipality', 'Gündem': 'News', 'Hava': 'Weather', 'Asayiş': 'Safety',
};
const catEn = (tr) => CAT_EN[String(tr || '').trim()] || String(tr || '').trim();

// TR byline "Rol · Kategori" → kaynak/kategori parçalarını ayıkla.
const lastSeg = (s) => String(s || '').split('·').pop()?.trim() || '';
const afterFirst = (s) => { const i = String(s || '').indexOf('·'); return i >= 0 ? String(s).slice(i + 1).trim() : ''; };

const EDITORIAL_SYSTEM =
  'You are the English-edition sub-editor of "Kalkan Today", a daily holiday newspaper for the Kalkan/Kaş/Patara region (Antalya, Turkey), aimed at British and international visitors.\n' +
  'TASK: Translate the given Turkish editorial fields into natural, concise British English.\n' +
  'RULES:\n' +
  '1. TRANSLATE ONLY — never invent, add, embellish or omit facts, names, dates or numbers.\n' +
  '2. Keep the news-agency tone: active verbs, tight phrasing, no clickbait.\n' +
  '3. Keep proper nouns (place names, people, venues) as in the source; do not localise Kalkan/Kaş/Patara.\n' +
  '4. Preserve the JSON structure exactly: same keys, arrays stay arrays with the same number of items.\n' +
  'OUTPUT: return ONLY the valid JSON object requested, nothing else.';

async function main() {
  console.log(`\n════ GAZETE EDİTÖRYAL EN — ${date} ════`);

  // 1) TR kaynağı yükle (bugünkü gazete-today.json, tarih uyuşmazsa arşivden)
  let tr;
  const todayPath = join(ROOT, 'data', 'gazete-today.json');
  const archPath = join(ROOT, 'data', 'gazete-archive', `${date}.json`);
  try {
    const t = JSON.parse(await readFile(todayPath, 'utf8'));
    tr = (t.date === date) ? t : null;
  } catch {}
  if (!tr && existsSync(archPath)) { try { tr = JSON.parse(await readFile(archPath, 'utf8')); } catch {} }
  if (!tr) { console.warn('⚠ TR editöryal (gazete-today.json / arşiv) bulunamadı — EN çeviri atlandı.'); return; }
  if (!tr.lead_headline) { console.warn('⚠ TR editöryalde lead_headline yok — atlandı.'); return; }

  // 2) Idempotency — aynı kaynak zaten çevrildiyse atla
  const enTodayPath = join(ROOT, 'data', 'gazete-today.en.json');
  if (!FORCE && existsSync(enTodayPath)) {
    try {
      const prev = JSON.parse(await readFile(enTodayPath, 'utf8'));
      if (prev.date === date && prev.source_generated_at === tr.generated_at && prev.lead_headline) {
        console.log('ℹ EN çeviri güncel (source_generated_at aynı) — atlandı. (--force ile zorla)');
        return;
      }
    } catch {}
  }

  // 3) Evergreen (siteden, TR) — birlikte çevir ki EN reel'de İngilizce görünsün
  const { getEvergreen } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'evergreen.mjs')).href);
  const eg = getEvergreen(date) || {};

  // 4) Çevrilecek metin bloğu (yalnız metin; foto/url/isim-etiket korunur)
  const input = {
    lead_headline: tr.lead_headline || '',
    lead_deck: tr.lead_deck || '',
    lead_body: Array.isArray(tr.lead_body) ? tr.lead_body : (tr.lead_body ? [tr.lead_body] : []),
    col1_title: tr.col1_title || '',
    col1_body: tr.col1_body || '',
    col3_title: tr.col3_title || '',
    col3_body: tr.col3_body || '',
    magazine_lead_headline: tr.magazine_lead_headline || '',
    magazine_lead_body: Array.isArray(tr.magazine_lead_body) ? tr.magazine_lead_body : (tr.magazine_lead_body ? [tr.magazine_lead_body] : []),
    eg_antik_name: eg.antik?.name || '',
    eg_antik_tag: eg.antik?.tag || '',
    eg_antik_fact: eg.antik?.fact || '',
    eg_ad_name: eg.ad?.name || '',
    eg_ad_tagline: eg.ad?.tagline || '',
  };

  const prompt =
    'Translate the string values of the following JSON from Turkish to British English. ' +
    'Return the SAME JSON shape (identical keys; arrays keep the same length). ' +
    'Do NOT translate empty strings (leave them empty). Only translate — do not add or drop any fact.\n\n' +
    'INPUT JSON:\n' + JSON.stringify(input, null, 2);

  const parseJson = (text) => {
    let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    for (const cand of [t, t.replace(/\\"/g, '"').replace(/\\n/g, ' '), t.replace(/\\\\/g, '\\')]) {
      try { const j = JSON.parse(cand); if (j && j.lead_headline) return j; } catch {}
    }
    return null;
  };

  let en, provider;
  const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
  for (let attempt = 1; attempt <= 3 && !en; attempt++) {
    try {
      const res = await cheapLLM(prompt, { system: EDITORIAL_SYSTEM, json: true, timeoutMs: 180000, maxTokens: 1100, temperature: 0.2 });
      const parsed = parseJson(res.text);
      if (parsed && parsed.lead_headline) { en = parsed; provider = res.provider; }
      else console.warn(`  deneme ${attempt}: geçersiz JSON, tekrar...`);
    } catch (e) { console.warn(`  deneme ${attempt}: ${String(e.message || e).slice(0, 80)}`); }
  }
  if (!en) { console.warn('⚠ 3 denemede geçerli EN çeviri alınamadı — atlandı.'); return; }

  const arrOf = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string') : (v ? [String(v)] : []);
  const pick = (v, fb) => (typeof v === 'string' && v.trim()) ? v : fb;

  // 5) EN çıktı — TR ile aynı şema; bylines/caption İngilizce (kaynak adı + EN kategori)
  const leadSource = afterFirst(tr.lead_byline) || 'Kalkan Today';
  const col1Cat = catEn(lastSeg(tr.col1_byline));
  const col3Cat = catEn(lastSeg(tr.col3_byline));
  const capParts = String(tr.lead_caption || '').replace(/^Foto:\s*/i, '').split('·');
  const capSource = (capParts[0] || leadSource).trim();
  const capCat = catEn((capParts[1] || '').trim());

  const out = {
    date,
    lang: 'en',
    generated_at: new Date().toISOString(),
    source_generated_at: tr.generated_at || null,
    provider: provider || 'unknown',
    source_ids: tr.source_ids || [],
    lead_headline: pick(en.lead_headline, tr.lead_headline),
    lead_deck: pick(en.lead_deck, tr.lead_deck || ''),
    lead_body: arrOf(en.lead_body).length ? arrOf(en.lead_body) : arrOf(tr.lead_body),
    lead_byline: `Kalkan Today Editor · ${leadSource}`,
    ...(tr.lead_image ? { lead_image: tr.lead_image } : {}),
    lead_caption: `Photo: ${capSource}${capCat ? ` · ${capCat}` : ''}`,
    col1_title: pick(en.col1_title, tr.col1_title || ''),
    col1_byline: `Bulletin${col1Cat ? ` · ${col1Cat}` : ''}`,
    col1_body: pick(en.col1_body, tr.col1_body || ''),
    col3_title: pick(en.col3_title, tr.col3_title || ''),
    col3_byline: `Coast${col3Cat ? ` · ${col3Cat}` : ''}`,
    col3_body: pick(en.col3_body, tr.col3_body || ''),
    magazine_lead_headline: pick(en.magazine_lead_headline, tr.magazine_lead_headline || ''),
    magazine_lead_body: arrOf(en.magazine_lead_body).length ? arrOf(en.magazine_lead_body) : arrOf(tr.magazine_lead_body),
    // Evergreen (EN) — reel builder doğrudan kullanır (render'da LLM gerekmez)
    eg_antik_name: pick(en.eg_antik_name, eg.antik?.name || ''),
    eg_antik_tag: pick(en.eg_antik_tag, eg.antik?.tag || ''),
    eg_antik_fact: pick(en.eg_antik_fact, eg.antik?.fact || ''),
    eg_ad_name: pick(en.eg_ad_name, eg.ad?.name || ''),
    eg_ad_tagline: pick(en.eg_ad_tagline, eg.ad?.tagline || ''),
    eg_ad_cta: eg.ad?.cta || 'kalkaninfo.com/en/services',
  };

  await writeFile(enTodayPath, JSON.stringify(out, null, 2));
  console.log(`✓ EN çeviri üretildi (sağlayıcı: ${out.provider}) → data/gazete-today.en.json`);
  console.log(`  Headline: "${out.lead_headline}"`);

  try {
    const archDir = join(ROOT, 'data', 'gazete-archive');
    await mkdir(archDir, { recursive: true });
    await writeFile(join(archDir, `${date}.en.json`), JSON.stringify(out, null, 2));
    console.log(`  ↳ arşivlendi: data/gazete-archive/${date}.en.json`);
  } catch (e) { console.warn('  ⚠ arşiv yazılamadı (non-fatal):', e.message); }
}

main().catch(e => { console.error('[gazete-editorial-en]', e); process.exit(0); }); // bozma: hata olsa da akış devam
