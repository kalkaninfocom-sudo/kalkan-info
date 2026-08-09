#!/usr/bin/env node
/**
 * review-mining.mjs — Gerçek Google yorumlarından "müşterinin kendi diliyle" hook üretir.
 *
 * Fikir (AI-affiliate playbook): en güçlü hook kaynağı uydurma pazarlama değil,
 * müşterinin ZATEN yazdığı gerçek cümlelerdir. Yorumları madenle → scroll durduran
 * hook'lara çevir. Çıktı reel/caption motorlarına girdi olur.
 *
 * Girdi : data/restoran-reviews/<slug>.json  (fetch-google-reviews.mjs cache'i)
 * Çıktı : content/hooks/<slug>.json  { slug, name, points[], hooks[], provider }
 * LLM   : cheap-llm (ollama→nvidia→gemini→claude) — bedava öncelik.
 *
 * Kullanım:
 *   node scripts/agency/review-mining.mjs --slug=aubergine
 *   node scripts/agency/review-mining.mjs --slug=aubergine,ala-kalkan
 *   node scripts/agency/review-mining.mjs --all          (tüm cache'li yorumlar)
 *   node scripts/agency/review-mining.mjs --all --min=5  (en az 5 yorumu olanlar)
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheapJSON } from '../../lib/cheap-llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REVIEW_DIR = join(ROOT, 'data', 'restoran-reviews');
const OUT_DIR = join(ROOT, 'content', 'hooks');

const args = process.argv.slice(2);
const has = (n) => args.includes(`--${n}`);
const flag = (n, d = null) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const MIN = parseInt(flag('min', '3'), 10);

function extractSnippets(data) {
  const revs = Array.isArray(data?.reviews) ? data.reviews : [];
  return revs
    .map((r) => (r?.snippet || r?.text || '').trim())
    .filter((s) => s.length > 12)
    .slice(0, 40);
}

const SYSTEM =
  'Sen bir kısa-video hook yazarısın. Sadece geçerli JSON dön. Pazarlama klişesi YASAK ' +
  '("harika", "muhteşem", "kaçırmayın", "eşsiz lezzet" gibi). Gerçek insan gibi yaz.';

function buildPrompt(name, snippets) {
  return [
    `Aşağıda "${name}" (Kalkan'da bir mekan) için GERÇEK Google yorumları var.`,
    '',
    snippets.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '',
    'GÖREV:',
    '1) "points": Yorumlardan EN ÇARPICI, SPESİFİK 5 cümle/ifadeyi AYNEN al (kelimesi kelimesine, ÖZETLEME, kategoriye indirgeme). ',
    '   Kötü örnek: "lezzet", "fiyat", "manzara" (tek kelime = YASAK). ',
    '   İyi örnek: "levrek resmen lokum gibiydi", "şimdiye kadar yediğim en iyi mezeler".',
    '2) "hooks": Bu gerçek cümlelerden 10 kısa video hook türet. KURALLAR:',
    '   - Müşterinin çarpıcı ifadesini KORU/kullan (uydurma değil).',
    '   - Her hook <12 kelime, iddialı/merak uyandıran, gerçek insan ağzından.',
    '   - Jenerik soru kalıbı YASAK: "nasıl?", "uygun mu?", "acaba?", "kaç punto?" gibi boş hook YAZMA.',
    '   - Pazarlama klişesi YASAK: "harika", "muhteşem", "kaçırmayın", "eşsiz".',
    '   - İyi hook örneği: "Bu levreği yiyince balık çıtanı yükseltiyorsun.", "8 yıldır aynı mezeyi arıyordum, buldum."',
    '',
    'SADECE şu JSON: {"points":["...5..."],"hooks":["...10..."]}',
  ].join('\n');
}

async function mineOne(slug) {
  const path = join(REVIEW_DIR, `${slug}.json`);
  if (!existsSync(path)) { console.warn(`  ⚠ ${slug}: yorum cache yok (${path})`); return null; }
  const data = JSON.parse(await readFile(path, 'utf8'));
  const snippets = extractSnippets(data);
  if (snippets.length < MIN) { console.warn(`  ⚠ ${slug}: yeterli yorum yok (${snippets.length} < ${MIN})`); return null; }

  const name = data.name || slug;
  // Hook yazımı = kaliteli editöryal iş → yerel 3B ollama'yı ATLA (zayıf kalır), 70B+ modele git.
  const { data: out, provider } = await cheapJSON(buildPrompt(name, snippets), {
    system: SYSTEM,
    order: ['groq', 'cerebras', 'nvidia', 'ollama'], // hızlı bedava 70B'ler önce; ollama son çare
    temperature: 0.8,
    timeoutMs: 45000,
  });
  const flat = (v) => (Array.isArray(v) ? v[0] : v);
  const points = (Array.isArray(out?.points) ? out.points : []).map(flat).filter(Boolean).slice(0, 5);
  const hooks = (Array.isArray(out?.hooks) ? out.hooks : []).map(flat).filter(Boolean).slice(0, 10);
  if (!hooks.length) { console.warn(`  ⚠ ${slug}: LLM hook üretmedi (provider=${provider})`); return null; }

  const result = { slug, name, source_reviews: snippets.length, points, hooks, provider, generated_at: new Date().toISOString() };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, `${slug}.json`), JSON.stringify(result, null, 2), 'utf8');
  console.log(`  ✓ ${slug} (${snippets.length} yorum → ${hooks.length} hook, ${provider})`);
  return result;
}

async function resolveSlugs() {
  if (flag('slug')) return flag('slug').split(',').map((s) => s.trim()).filter(Boolean);
  if (has('all')) {
    const files = await readdir(REVIEW_DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  }
  return [];
}

(async () => {
  const slugs = await resolveSlugs();
  if (!slugs.length) {
    console.error('Kullanım: --slug=aubergine[,ala-kalkan] veya --all [--min=5]');
    process.exit(2);
  }
  console.log(`🔎 Yorum-madenciliği — ${slugs.length} mekan\n`);
  let ok = 0;
  for (const s of slugs) { const r = await mineOne(s); if (r) ok++; }
  console.log(`\nBitti: ${ok}/${slugs.length} → content/hooks/`);
})();
