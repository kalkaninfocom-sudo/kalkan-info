#!/usr/bin/env node
/**
 * scripts/agency/tv-producer.mjs — Kalkan Info TV "Prodüktörü/Kurgucu"
 *
 * Berkay'ın çektiği ham sokak röportajı metadata/transkriptini alır,
 * yayına hazır dikey reel PLANI + 5 dil altyazı metni üretir.
 * (Gerçek video render bu dosyanın sorumluluğu değil — plan + altyazı çıktı verir.)
 *
 * Kullanım:
 *   node scripts/agency/tv-producer.mjs          # data/agency/tv-intake.json'dan üret
 *
 * API:
 *   produceEpisode(raw)  → reel plan objesi
 *   produceAll({write})  → tüm işlenmemiş öğeleri işle
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLines, routeToLine } from './brand-router.mjs';
import { cheapLLM } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INTAKE_PATH = join(ROOT, 'data', 'agency', 'tv-intake.json');
const LANGS = ['tr', 'en', 'de', 'fr', 'ru'];

// .env.local yükle (cheap-llm anahtarları için)
try {
  const p = join(ROOT, '.env.local');
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* .env.local olmayabilir */ }

// Entry guard — doğrudan CLI ya da import yoluyla çalışabilir
const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

// ── TV hattının editöryal tanımını brand-lines'tan al ──
function tvLine() {
  const { lines } = loadLines();
  return lines.find((l) => l.id === 'tv') || { id: 'tv', editorial: 'Sokak röportajları, insan hikâyeleri, kısa dikey video. Samimi, meraklı, insan odaklı.' };
}

// ── JSON parse yardımcısı (LLM çıktısını güvenli şekilde çöz) ──
function parseJSON(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  return JSON.parse(t);
}

// ── Heuristik fallback — LLM başarısız olursa transkriptten minimal plan üret ──
function heuristicPlan(raw) {
  const words = String(raw.transcript || '').trim().split(/\s+/);
  const snippet = words.slice(0, 12).join(' ');
  const title = raw.title || (raw.person ? `${raw.person} ile Röportaj` : 'Kalkan Sokak Röportajı');
  const durationSec = raw.durationSec || 60;

  // 3–4 saniyelik dilimler halinde basit cut noktaları hesapla
  const momentCount = Math.min(4, Math.max(3, Math.floor(durationSec / 15)));
  const secilenAnlar = Array.from({ length: momentCount }, (_, i) => ({
    t: Math.round((durationSec / momentCount) * i),
    altyazi: i === 0 ? snippet : words.slice(i * 10, i * 10 + 8).join(' ') || snippet,
  }));

  return {
    baslik: title,
    hook: `"${snippet}…"`,
    secilenAnlar,
    sonKart: raw.venue ? `${raw.venue} — Kalkan` : 'Kalkan • Likya Kıyısı',
    sure_sn: durationSec,
    _fallback: true,
  };
}

// ── ADIM 1: Transkriptten reel planı üret (tek cheapLLM JSON çağrısı) ──
async function extractPlan(raw, line) {
  const system = `Sen "${line.name || 'Kalkan Info TV'}" (${line.handle || '@kalkaninfo.tv'}) marka hattının TV prodüktörüsün.
EDİTÖRYAL ÇİZGİ: ${line.editorial}
Görev: Ham sokak röportajı transkriptini yayına hazır dikey reel planına çevir.
SADECE JSON döndür, başka metin yok.`;

  const person = raw.person ? `Konuşan kişi: ${raw.person}` : '';
  const venue = raw.venue ? `Mekan: ${raw.venue}` : '';
  const dur = raw.durationSec ? `Video süresi: ${raw.durationSec} sn` : '';
  const notes = raw.notes ? `Notlar: ${raw.notes}` : '';
  const context = [person, venue, dur, notes].filter(Boolean).join(' | ');

  const user = `${context ? context + '\n\n' : ''}TRANSKRİPT:\n${raw.transcript}

Yukarıdaki sokak röportajından bir dikey reel planı çıkar. Döndüreceğin JSON şeması:
{
  "baslik": "Reelin Türkçe başlığı (max 60 karakter)",
  "hook": "İlk 3 saniyede ekranda görünecek kanca yazısı (max 12 kelime, merak uyandırsın)",
  "secilenAnlar": [
    { "t": <saniye olarak zaman damgası>, "altyazi": "Bu anda ekrandaki Türkçe altyazı (max 10 kelime)" }
  ],
  "sonKart": "Son kart CTA metni (max 10 kelime, takip et / keşfet / yorum yaz vb.)",
  "sure_sn": <önerilen reel süresi saniye cinsinden (15–60 arası)>
}
secilenAnlar: 3–6 adet, en güçlü anlar. Kronolojik sırada.
SADECE bu JSON, başka metin yok.`;

  const res = await cheapLLM(user, { system, json: true, maxTokens: 800, temperature: 0.5, timeoutMs: 45000 });
  const plan = parseJSON(res.text);

  // Zorunlu alanlar var mı kontrol et
  if (!plan.baslik || !Array.isArray(plan.secilenAnlar) || plan.secilenAnlar.length === 0) {
    throw new Error('LLM eksik plan döndürdü');
  }

  return { plan, provider: res.provider };
}

// ── ADIM 2: Hook + altyazılar + sonKart → 5 dile çevir (tek batch çağrı) ──
async function translateSubtitles(plan) {
  // Çevrilecek metin setini tek dizide topla: hook, tüm altyazılar, sonKart
  const parts = [plan.hook, ...plan.secilenAnlar.map((m) => m.altyazi), plan.sonKart];
  const numbered = parts.map((p, i) => `${i + 1}. ${p}`).join('\n');

  const system = `Çeviri asistanısın. Türkçe kısa metin parçalarını verilen dillere çevir.
Orijinal ton: samimi, kısa, insan odaklı. SADECE JSON döndür.`;

  const user = `Aşağıdaki ${parts.length} Türkçe metin parçasını İngilizce (en), Almanca (de), Fransızca (fr) ve Rusça (ru) dillerine çevir.
Orijinal Türkçe (tr) de yanıtın içinde olsun.

METİNLER:
${numbered}

Döndüreceğin JSON şeması (her dil için ${parts.length} elemanlı dizi):
{
  "tr": ["1. orijinal","2. orijinal",...],
  "en": ["1. en","2. en",...],
  "de": ["1. de","2. de",...],
  "fr": ["1. fr","2. fr",...],
  "ru": ["1. ru","2. ru",...]
}
SADECE bu JSON, başka metin yok.`;

  const res = await cheapLLM(user, { system, json: true, maxTokens: 1200, temperature: 0.3, timeoutMs: 45000 });
  const raw = parseJSON(res.text);

  // parts yapısına göre dil dizilerini subtitle nesnesine dönüştür
  // parts[0] = hook, parts[1..n-1] = moment altyazıları, parts[n] = sonKart
  const momentCount = plan.secilenAnlar.length;
  const subtitles = {};
  for (const lang of LANGS) {
    const arr = Array.isArray(raw[lang]) ? raw[lang] : parts; // fallback: orijinal
    subtitles[lang] = {
      hook: String(arr[0] || plan.hook),
      moments: arr.slice(1, 1 + momentCount).map((t) => String(t || '')),
      sonKart: String(arr[1 + momentCount] || plan.sonKart),
    };
  }

  return { subtitles, provider: res.provider };
}

// ── Fallback çeviri: LLM başarısız olursa TR içeriği tüm dillere koy ──
function fallbackSubtitles(plan) {
  const subtitles = {};
  for (const lang of LANGS) {
    subtitles[lang] = {
      hook: plan.hook,
      moments: plan.secilenAnlar.map((m) => m.altyazi),
      sonKart: plan.sonKart,
    };
  }
  return subtitles;
}

/**
 * Ham röportaj verisinden yayına hazır reel planı üret.
 * @param {object} raw - { id, title?, transcript, venue?, person?, durationSec?, notes? }
 * @returns {Promise<object>} - Reel plan objesi
 */
export async function produceEpisode(raw) {
  if (!raw || !raw.transcript) throw new Error('produceEpisode: transcript zorunlu');
  if (!raw.id) throw new Error('produceEpisode: id zorunlu');

  const line = tvLine();
  let planResult, subtitles;

  // ADIM 1: Plan çıkar
  try {
    planResult = await extractPlan(raw, line);
  } catch (e) {
    if (IS_CLI) console.error(`  [tv-producer] LLM plan hatası (heuristik devreye giriyor): ${e.message}`);
    const fallback = heuristicPlan(raw);
    planResult = { plan: fallback, provider: 'heuristic' };
  }

  const { plan, provider: planProvider } = planResult;

  // ADIM 2: Çeviri
  try {
    const result = await translateSubtitles(plan);
    subtitles = result.subtitles;
  } catch (e) {
    if (IS_CLI) console.error(`  [tv-producer] Çeviri hatası (TR fallback): ${e.message}`);
    subtitles = fallbackSubtitles(plan);
  }

  // ADIM 3: Nihai item objesi
  const item = {
    id: `tv-${raw.id}`,
    line: 'tv',
    type: 'reel',
    category: 'roportaj',
    title: plan.baslik,
    hook: plan.hook,
    plan: {
      secilenAnlar: plan.secilenAnlar,
      sonKart: plan.sonKart,
      sure_sn: plan.sure_sn || raw.durationSec || 60,
    },
    subtitles,
    status: 'pending',
    source: 'tv-producer',
    _sourceId: raw.id,
    _provider: planProvider,
    createdAt: new Date().toISOString(),
  };

  // ADIM 4: TV hattı kuyruğuna yaz
  routeToLine(item);

  return item;
}

// ── Intake dosyasını oku / yoksa örnek stub yarat ──
function loadOrCreateIntake() {
  if (existsSync(INTAKE_PATH)) {
    try {
      return JSON.parse(readFileSync(INTAKE_PATH, 'utf8'));
    } catch {
      return { items: [] };
    }
  }

  // Örnek stub: demo amaçlı kısa Türkçe sokak röportajı
  const stub = {
    _meta: { note: 'Kalkan Info TV ham röportaj intake. Her öğe: {id, transcript, venue?, person?, durationSec?, notes?}' },
    items: [
      {
        id: 'demo-001',
        title: 'Kalkan\'da Yaz Sezonu',
        person: 'Mehmet Bey (yerel balıkçı)',
        venue: 'Kalkan Limanı',
        durationSec: 45,
        notes: 'Sabah erken, balık tezgahı önünde çekildi.',
        transcript: `Berkay: Mehmet Bey, bu yaz nasıl geçiyor?
Mehmet: Allah'a şükür, çok iyi. Yabancılar çok geldi bu yıl. Almanlar, Ruslar... hepsi geliyor.
Berkay: Balık satışları arttı mı?
Mehmet: Tabii tabii. Özellikle lufer çok tutuyoruz. Sabah beşte denizdeyiz, sekizde tezgahtayız. İş böyle.
Berkay: Kalkan'ı neden seviyorsunuz?
Mehmet: Burası huzurlu. Büyümüyor fazla, ama kaliteli büyüyor. Ben kırk yıldır buradayım, gitmeyi hiç düşünmedim.`
      }
    ]
  };

  mkdirSync(dirname(INTAKE_PATH), { recursive: true });
  writeFileSync(INTAKE_PATH, JSON.stringify(stub, null, 2), 'utf8');
  if (IS_CLI) console.log(`[tv-producer] Örnek intake oluşturuldu: ${INTAKE_PATH}`);
  return stub;
}

// ── Hangi öğeler zaten işlenmiş? TV kuyruğuna bak. ──
function producedIds() {
  try {
    const qPath = join(ROOT, 'data', 'agency', 'lines', 'tv.json');
    const q = JSON.parse(readFileSync(qPath, 'utf8'));
    return new Set((q.items || []).map((i) => i._sourceId).filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * tv-intake.json'daki tüm işlenmemiş öğeleri üret.
 * @param {object} opts - { write: boolean } (şu an write parametresi routeToLine tarafından otomatik yapılıyor)
 * @returns {Promise<object[]>} - Üretilen plan objeleri
 */
export async function produceAll({ write = true } = {}) {
  const intake = loadOrCreateIntake();
  const done = producedIds();
  const pending = (intake.items || []).filter((i) => i.id && !done.has(String(i.id)));

  if (IS_CLI && pending.length === 0) {
    console.log('[tv-producer] İşlenecek yeni öğe yok.');
  }

  const results = [];
  for (const raw of pending) {
    if (IS_CLI) console.log(`\n▶ İşleniyor: ${raw.id} — ${raw.title || raw.person || '(başlık yok)'}`);
    try {
      const item = await produceEpisode(raw);
      results.push(item);
      if (IS_CLI) {
        console.log(`  ✓ Başlık  : ${item.title}`);
        console.log(`  ✓ Hook    : ${item.hook}`);
        console.log(`  ✓ Anlar   : ${item.plan.secilenAnlar.length} kesim noktası`);
        console.log(`  ✓ Diller  : ${LANGS.join(', ')}`);
        console.log(`  ✓ Süre    : ~${item.plan.sure_sn} sn  |  Sağlayıcı: ${item._provider}`);
      }
    } catch (e) {
      if (IS_CLI) console.error(`  ✗ HATA (${raw.id}): ${e.message}`);
    }
  }

  return results;
}

// ── CLI ──
if (IS_CLI) {
  console.log('📺 Kalkan Info TV Prodüktörü başlatılıyor…\n');
  produceAll().then((results) => {
    if (results.length > 0) {
      console.log(`\n✅ ${results.length} bölüm TV kuyruğuna eklendi → data/agency/lines/tv.json`);
    }
  }).catch((e) => {
    console.error('HATA:', e.message);
    process.exit(1);
  });
}
