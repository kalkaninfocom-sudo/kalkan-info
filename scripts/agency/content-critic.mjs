#!/usr/bin/env node
/**
 * scripts/agency/content-critic.mjs — LLM ELEŞTİRMEN (Düzeltme C)
 * ---------------------------------------------------------------------
 * Kalkan İnfo içeriğini yayından ÖNCE kalite rubriğine göre puanlayan LLM eleştirmeni.
 * Marka sesi: sakin, dürüst, abartısız. Güçlü model (RouteLLM) tercih edilir.
 *
 * Kullanım (CLI):
 *   node scripts/agency/content-critic.mjs <tip> <json-dosyası>
 *     <tip>          : içerik tipi (ör. restoran-reel, gazete, ig-kart, villa-reel...)
 *     <json-dosyası> : puanlanacak içeriği barındıran JSON dosyası (props/metin)
 *
 * Programatik:
 *   import { runCritic } from './content-critic.mjs';
 *   const sonuc = await runCritic('gazete', icerikObjesiVeyaMetin);
 *   // sonuc = { tip, scores, weightedAvg, pass, issues[], revisionNote, ... }
 *
 * Çıktı: stdout (özet) + data/agency/critic-log.json (append). weightedAvg < eşik → pass:false.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel; CI/SuperComputer'da env dolu olabilir)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const RUBRIC_PATH = join(ROOT, 'data', 'agency', 'quality-rubric.json');
const LOG_PATH = join(ROOT, 'data', 'agency', 'critic-log.json');

// Rubriği oku (yoksa güvenli varsayılan: geçer say, ama uyarı ver).
async function loadRubric() {
  try {
    return JSON.parse(await readFile(RUBRIC_PATH, 'utf8'));
  } catch (e) {
    console.warn(`[eleştirmen] Rubrik okunamadı (${e.message}) — varsayılan eşik 3.0 kullanılacak`);
    return { version: '0', thresholds: { pass: 3.0, warn: 2.0 }, criteria: [] };
  }
}

// İçeriği (obje ya da metin) eleştirmen için düz metne çevir.
function contentToText(icerik) {
  if (icerik == null) return '';
  if (typeof icerik === 'string') return icerik;
  // Bilinen alanları öncelikli topla; kalanını da ekle.
  const parts = [];
  const pick = ['baslik', 'title', 'headline', 'ust', 'alt', 'metin', 'text', 'summary',
    'ozet', 'caption', 'tagline', 'line', 'body', 'aci', 'name', 'kicker'];
  for (const k of pick) {
    if (icerik[k]) parts.push(`${k}: ${String(icerik[k]).slice(0, 500)}`);
  }
  // Kartlar/reel için ekran metinleri dizisi olabilir.
  if (Array.isArray(icerik.screens)) {
    parts.push('ekranlar: ' + icerik.screens.map(s =>
      typeof s === 'string' ? s : (s.text || s.title || JSON.stringify(s))).join(' | ').slice(0, 800));
  }
  if (Array.isArray(icerik.slides)) {
    parts.push('slaytlar: ' + icerik.slides.map(s =>
      typeof s === 'string' ? s : (s.text || s.title || JSON.stringify(s))).join(' | ').slice(0, 800));
  }
  if (!parts.length) return JSON.stringify(icerik).slice(0, 1500);
  return parts.join('\n');
}

// JSON gövdesini toleranslı ayrıştır.
function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
  for (const c of [t, t.replace(/\\"/g, '"')]) {
    try { return JSON.parse(c); } catch {}
  }
  return null;
}

/**
 * Bir içeriği rubriğe göre puanlar.
 * @param {string} tip - içerik tipi etiketi (loglama + bağlam için).
 * @param {(string|object)} icerik - puanlanacak içerik.
 * @param {object} [opts] - { rubric, log=true, verbose=false }
 * @returns {Promise<{tip,scores,weightedAvg,pass,issues,revisionNote,_provider,at}>}
 */
export async function runCritic(tip, icerik, opts = {}) {
  const rubric = opts.rubric || await loadRubric();
  const criteria = rubric.criteria || [];
  const passThreshold = rubric?.thresholds?.pass ?? 3.0;
  const metin = contentToText(icerik);

  const kriterListesi = criteria.map(c =>
    `- "${c.id}" (${c.label}, ağırlık ${c.weight}): ${c.description}`).join('\n');
  const scoreSchema = `{${criteria.map(c => `"${c.id}":0`).join(',')}}`;

  const system =
    'Sen Kalkan İnfo\'nun kıdemli editörüsün. Marka sesi: SAKİN, DÜRÜST, ABARTISIZ. ' +
    'Sansasyon, klişe, dolgu ve yapay viral hilelerini SEVMEZSİN. Doğruluk ve etik senin için ' +
    'en yüksek önceliktir. İçerikleri acımasız ama adil biçimde, gerçek bir editör titizliğiyle puanlarsın.';

  const prompt =
    `Aşağıdaki "${tip}" tipindeki içeriği Kalkan İnfo kalite rubriğine göre puanla.\n\n` +
    `RUBRİK KRİTERLERİ (her birine 0-5 arası tam veya ondalık puan ver):\n${kriterListesi}\n\n` +
    `İÇERİK:\n"""\n${metin}\n"""\n\n` +
    `Şu JSON'u DÖNDÜR (başka hiçbir şey yazma):\n` +
    `{"scores":${scoreSchema},"issues":["tespit ettiğin sorunlar, kısa"],"revisionNote":"içeriği geçer hale getirmek için TEK cümlelik somut revize önerisi"}\n` +
    `Puanlar dürüst olsun; zayıf içeriğe yüksek puan verme. issues Türkçe olsun.`;

  const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);

  let parsed = null, provider = '?';
  for (let attempt = 1; attempt <= 2 && !parsed; attempt++) {
    try {
      const res = await cheapLLM(prompt, {
        system, json: true, maxTokens: 600, temperature: 0.2,
        // Kalite değerlendirmesi → GÜÇLÜ hakem önce (üretici≠hakem). Claude ilk sırada;
        // ucuz içeriği ucuz model onaylamasın (kör nokta). Ücretsiz fallback en sonda.
        order: (process.env.CRITIC_LLM_ORDER || 'claude,routellm,gemini,groq,cerebras,nvidia').split(','),
        timeoutMs: 60000, verbose: opts.verbose,
      });
      parsed = parseJson(res.text);
      provider = res.provider;
    } catch (e) {
      if (opts.verbose) console.warn(`[eleştirmen] deneme ${attempt} hata: ${e.message}`);
    }
  }

  // LLM başarısızsa: ihtiyatlı davran — otomatik geçirME, insan baksın (pass:false).
  if (!parsed || !parsed.scores) {
    const sonuc = {
      tip, scores: {}, weightedAvg: 0, pass: false,
      issues: ['Eleştirmen modeli yanıt üretemedi — otomatik geçiş engellendi, insan onayı gerekli'],
      revisionNote: '', _provider: provider, at: new Date().toISOString(), _error: true,
    };
    await appendLog(sonuc, opts);
    return sonuc;
  }

  // Ağırlıklı ortalama hesapla.
  let wSum = 0, wTot = 0;
  const scores = {};
  for (const c of criteria) {
    let s = Number(parsed.scores[c.id]);
    if (!isFinite(s)) s = 0;
    s = Math.max(0, Math.min(5, s)); // 0-5 aralığına kıs
    scores[c.id] = s;
    wSum += s * c.weight;
    wTot += c.weight;
  }
  const weightedAvg = wTot ? +(wSum / wTot).toFixed(2) : 0;
  // HARD VETO: doğruluk veya etik 3'ün altındaysa — ağırlıklı ortalamadan BAĞIMSIZ olarak
  // kalır VE yayını sert bloklar (hardBlock). Uydurma/etik ihlali telafi edilemez.
  const vetoFail = (scores.dogruluk != null && scores.dogruluk < 3) ||
                   (scores.etik != null && scores.etik < 3);
  const pass = weightedAvg >= passThreshold && !vetoFail;

  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  if (vetoFail) {
    const dusuk = [];
    if (scores.dogruluk != null && scores.dogruluk < 3) dusuk.push(`doğruluk ${scores.dogruluk}/5`);
    if (scores.etik != null && scores.etik < 3) dusuk.push(`etik ${scores.etik}/5`);
    issues.unshift(`⛔ HARD VETO (${dusuk.join(', ')}) — uydurma/etik riski, yayın bloklandı`);
  }

  const sonuc = {
    tip, scores, weightedAvg, pass, hardBlock: vetoFail,
    issues,
    revisionNote: parsed.revisionNote || '',
    _provider: provider, at: new Date().toISOString(),
  };
  await appendLog(sonuc, opts);
  return sonuc;
}

/**
 * KALİTE KAPISI (Düzeltme C) — approval scriptlerinin Telegram'dan ÖNCE çağırdığı sarmalayıcı.
 * Akış: eleştir → geçerse devam · kalırsa revize notunu logla + TEK revize döngüsü →
 * ikinci kez de kalırsa "DÜŞÜK PUAN" uyarısı döndür (yayını ENGELLEMEZ; insan karar verir).
 *
 * @param {string} tip
 * @param {(string|object)} icerik
 * @param {object} [opts] - { revise?: async (icerik, revisionNote)=>yeniIcerik }
 * @returns {Promise<{pass:boolean, sonuc, icerik, warning:(string|null)}>}
 */
export async function qualityGate(tip, icerik, opts = {}) {
  console.log('── Kalite kapısı (LLM eleştirmen) ──');
  const sonuc = await runCritic(tip, icerik, opts);
  if (sonuc.pass) {
    console.log(`  ✓ Kalite: ${sonuc.weightedAvg}/5 — GEÇTİ (${sonuc._provider})`);
    return { pass: true, sonuc, icerik, warning: null };
  }

  console.log(`  ⚠ Kalite: ${sonuc.weightedAvg}/5 — KALDI. Revize notu: ${sonuc.revisionNote || '(yok)'}`);
  // Tek revize döngüsü: revize callback varsa içeriği düzeltmeyi dene, yoksa yeniden değerlendir.
  let revised = icerik;
  if (typeof opts.revise === 'function') {
    try {
      const yeni = await opts.revise(icerik, sonuc.revisionNote);
      if (yeni) { revised = yeni; console.log('  ↻ İçerik revize edildi, yeniden değerlendiriliyor...'); }
    } catch (e) {
      console.warn(`  revize denemesi hata: ${e.message}`);
    }
  } else {
    console.log('  ↻ Revize callback yok — içerik yeniden değerlendiriliyor (tek döngü)...');
  }

  const sonuc2 = await runCritic(tip, revised, opts);
  if (sonuc2.pass) {
    console.log(`  ✓ Revizyon sonrası: ${sonuc2.weightedAvg}/5 — GEÇTİ`);
    return { pass: true, sonuc: sonuc2, icerik: revised, warning: null };
  }

  // İkinci kez de kaldı → DÜŞÜK PUAN uyarısı (insan karar verir).
  const warning = `⚠️ DÜŞÜK PUAN (${sonuc2.weightedAvg}/5) — ` +
    `${(sonuc2.issues || []).slice(0, 2).join('; ') || sonuc2.revisionNote || 'kalite eşiğinin altında'}`;
  console.log(`  ❌ İkinci değerlendirme de KALDI → Telegram'a DÜŞÜK PUAN uyarısıyla gönderilecek.`);
  return { pass: false, sonuc: sonuc2, icerik: revised, warning: warning.slice(0, 320) };
}

// Eleştirmen sonucunu data/agency/critic-log.json'a ekle (runtime; .gitignore'da).
async function appendLog(sonuc, opts = {}) {
  if (opts.log === false) return;
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    let log = { entries: [] };
    try { log = JSON.parse(await readFile(LOG_PATH, 'utf8')); } catch {}
    if (!Array.isArray(log.entries)) log.entries = [];
    log.entries.push(sonuc);
    // Son 500 kaydı tut (dosya şişmesin).
    if (log.entries.length > 500) log.entries = log.entries.slice(-500);
    await writeFile(LOG_PATH, JSON.stringify(log, null, 2));
  } catch (e) {
    console.warn(`[eleştirmen] Log yazılamadı: ${e.message}`);
  }
}

// ─── CLI ───
async function cli() {
  const [tip, dosya] = process.argv.slice(2);
  if (!tip || !dosya) {
    console.error('Kullanım: node scripts/agency/content-critic.mjs <tip> <json-dosyası>');
    process.exit(1);
  }
  let icerik;
  try {
    icerik = JSON.parse(readFileSync(dosya, 'utf8'));
  } catch (e) {
    console.error(`Dosya okunamadı/JSON değil: ${dosya} (${e.message})`);
    process.exit(1);
  }
  console.log(`\n════ İÇERİK ELEŞTİRMENİ — tip: ${tip} ════`);
  const sonuc = await runCritic(tip, icerik, { verbose: true });
  console.log('\nPUANLAR:');
  for (const [k, v] of Object.entries(sonuc.scores)) console.log(`  ${k}: ${v}/5`);
  console.log(`\nAĞIRLIKLI ORTALAMA: ${sonuc.weightedAvg} → ${sonuc.pass ? '✅ GEÇTİ' : '❌ KALDI'} (model: ${sonuc._provider})`);
  if (sonuc.issues.length) console.log('SORUNLAR:\n' + sonuc.issues.map(i => `  • ${i}`).join('\n'));
  if (sonuc.revisionNote) console.log(`REVİZE NOTU: ${sonuc.revisionNote}`);
  process.exit(sonuc.pass ? 0 : 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch(e => { console.error('[content-critic]', e); process.exit(1); });
}
