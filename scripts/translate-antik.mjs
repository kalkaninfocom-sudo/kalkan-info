#!/usr/bin/env node
/**
 * scripts/translate-antik.mjs
 * Antik kent detay sayfaları için içerik çevirileri üretir (EN/DE/RU/FR).
 *
 * SORUN: antik-kentler.json içeriği (summary, history, highlights, tips, transport) SADECE Türkçe.
 * build-antik-pages.mjs sadece UI/başlıkları data-en ile çeviriyordu → gövde her dilde TR kalıyordu.
 *
 * Bu script her öncelikli kent için TR içeriği 4 dile çevirir (cheap-llm ücretsiz router) →
 * data/antik-kentler-i18n.json. build-antik-pages.mjs bunu okuyup data-en/de/ru/fr basar.
 *
 * Kullanım:
 *   node scripts/translate-antik.mjs                 # eksik olanları üret (idempotent)
 *   node scripts/translate-antik.mjs --force         # hepsini yeniden üret
 *   node scripts/translate-antik.mjs --slug=patara   # tek kent
 *   node scripts/translate-antik.mjs --lang=de       # tek dil
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheapJSON } from '../lib/cheap-llm.mjs';
import { PRIORITY, EXTENDED, EN_OVERVIEW } from './build-antik-pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = join(ROOT, 'data', 'antik-kentler.json');
const OUT = join(ROOT, 'data', 'antik-kentler-i18n.json');

// ── .env.local fallback (cheap-llm anahtarları için) ─────────────────────────
try {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch {}

const FORCE = process.argv.includes('--force');
const ONLY_SLUG = (process.argv.find((a) => a.startsWith('--slug=')) || '').split('=')[1] || null;
const ONLY_LANG = (process.argv.find((a) => a.startsWith('--lang=')) || '').split('=')[1] || null;

const LANGS = ['en', 'de', 'ru', 'fr'];
const LANG_NAME = { en: 'English', de: 'German (Deutsch)', ru: 'Russian (Русский)', fr: 'French (Français)' };

// Kentin çevrilecek TR kaynak alanları (sayfada gösterilenler)
function trSource(item, slug) {
  return {
    summary: item.summary || '',
    history: item.history || '',
    extended: EXTENDED[slug] || item.history || '',
    highlights: Array.isArray(item.highlights) ? item.highlights : [],
    tips: item.tips || '',
    transport: item.transport || '',
  };
}

async function translateCity(name, src, lang) {
  const sys = `You are a professional tourism translator. Translate Turkish heritage-site content into natural, fluent ${LANG_NAME[lang]}. Keep proper nouns (place names, saints, historical figures) intact. Do NOT summarize or add content — translate faithfully. Preserve the number of highlight items exactly.`;
  const prompt = `Translate the following Turkish content about the ancient city "${name}" into ${LANG_NAME[lang]}.
Return STRICT JSON with EXACTLY these keys (no extra text):
{"summary":"...","history":"...","extended":"...","highlights":["...", "..."],"tips":"...","transport":"..."}
"highlights" MUST have exactly ${src.highlights.length} items in the same order.

TURKISH SOURCE:
summary: ${src.summary}
history: ${src.history}
extended: ${src.extended}
highlights: ${JSON.stringify(src.highlights)}
tips: ${src.tips}
transport: ${src.transport}`;

  // 6 alan + 2 uzun history paragrafı → yüksek token gerek (truncation JSON'u bozar).
  const { data, provider } = await cheapJSON(prompt, { system: sys, maxTokens: 4096 });
  // Doğrulama + normalizasyon
  const out = {
    summary: String(data.summary || '').trim(),
    history: String(data.history || '').trim(),
    extended: String(data.extended || '').trim(),
    highlights: Array.isArray(data.highlights) ? data.highlights.map((h) => String(h).trim()) : [],
    tips: String(data.tips || '').trim(),
    transport: String(data.transport || '').trim(),
  };
  // highlights sayısı tutmuyorsa TR'den tamamla (kayıp olmasın)
  if (out.highlights.length !== src.highlights.length) {
    console.warn(`    ⚠️  ${lang}: highlights ${out.highlights.length}/${src.highlights.length} — TR ile tamamlanıyor`);
    for (let i = out.highlights.length; i < src.highlights.length; i++) out.highlights.push(src.highlights[i]);
    out.highlights = out.highlights.slice(0, src.highlights.length);
  }
  // Not: EN summary override (manuel EN_OVERVIEW) main()'de slug bazlı yapılıyor.
  return { out, provider };
}

async function main() {
  const data = JSON.parse(await readFile(DATA, 'utf8'));
  const byId = new Map(data.items.map((it) => [it.id, it]));
  const existing = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {};

  const slugs = ONLY_SLUG ? [ONLY_SLUG] : PRIORITY;
  const langs = ONLY_LANG ? [ONLY_LANG] : LANGS;

  let done = 0, skipped = 0, failed = 0;
  for (const slug of slugs) {
    const item = byId.get(slug);
    if (!item) { console.warn(`⏭  ${slug}: veri yok`); continue; }
    const src = trSource(item, slug);
    existing[slug] = existing[slug] || {};

    for (const lang of langs) {
      if (!FORCE && existing[slug][lang]?.history) { skipped++; continue; }
      process.stdout.write(`🌐 ${slug} → ${lang} ... `);
      try {
        const { out, provider } = await translateCity(item.name, src, lang);
        // EN summary override: manuel EN_OVERVIEW daha kaliteli
        if (lang === 'en' && EN_OVERVIEW[slug]) out.summary = EN_OVERVIEW[slug];
        existing[slug][lang] = out;
        await writeFile(OUT, JSON.stringify(existing, null, 2) + '\n', 'utf8'); // her adımda kaydet (kesinti güvenli)
        console.log(`✓ (${provider})`);
        done++;
      } catch (e) {
        console.log(`✗ ${e.message}`);
        failed++;
      }
    }
  }
  console.log(`\n✅ Bitti — ${done} çeviri üretildi, ${skipped} atlandı, ${failed} hata. → ${OUT}`);
}

main().catch((e) => { console.error('[translate-antik] fatal:', e); process.exit(1); });
