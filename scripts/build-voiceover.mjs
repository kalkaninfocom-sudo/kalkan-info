#!/usr/bin/env node
// Sesli rehber MP3 üretici: data/voiceover-scripts.json okur, ElevenLabs API ile her dil için MP3 yazar.
// Idempotent: mevcut dosya varsa atlar (FORCE=1 ile yenile).
// Kullanım: ELEVENLABS_API_KEY=sk_... node scripts/build-voiceover.mjs [slug] [lang]

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(import.meta.dirname || '.', '..');
const OUT_DIR = resolve(ROOT, 'assets/audio');
const SCRIPTS_PATH = resolve(ROOT, 'data/voiceover-scripts.json');

function pickEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envContent = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    const line = envContent.split(/\r?\n/).find(l => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).replace(/^"|"$/g, '').trim();
  } catch (_) {}
  return null;
}

const API_KEY = pickEnv('ELEVENLABS_API_KEY');
if (!API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY bulunamadı. .env.local\'a ekle veya `ELEVENLABS_API_KEY=... node scripts/build-voiceover.mjs` ile çalıştır.');
  process.exit(1);
}

const FILTER_SLUG = process.argv[2];
const FILTER_LANG = process.argv[3];
const FORCE = process.env.FORCE === '1';

const config = JSON.parse(readFileSync(SCRIPTS_PATH, 'utf8'));
const VOICE_ID = config._meta.voice_id;
const MODEL = config._meta.model;
const VOICE_SETTINGS = config._meta.voice_settings;

mkdirSync(OUT_DIR, { recursive: true });

async function tts(text, lang, slug) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: VOICE_SETTINGS,
      language_code: lang === 'tr' ? null : lang,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '?');
    throw new Error(`ElevenLabs ${res.status} (${slug}-${lang}): ${errBody.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  const slugs = Object.keys(config.scripts);
  const langs = config._meta.languages;
  let produced = 0, skipped = 0, errors = 0;
  const t0 = Date.now();

  for (const slug of slugs) {
    if (FILTER_SLUG && slug !== FILTER_SLUG) continue;
    const scriptByLang = config.scripts[slug];
    for (const lang of langs) {
      if (FILTER_LANG && lang !== FILTER_LANG) continue;
      const text = scriptByLang[lang];
      if (!text) {
        console.warn(`⚠️  ${slug}-${lang}: metin yok, atlandı`);
        continue;
      }
      const outPath = resolve(OUT_DIR, `${slug}-${lang}.mp3`);
      if (existsSync(outPath) && !FORCE) {
        skipped++;
        continue;
      }
      try {
        const buf = await tts(text, lang, slug);
        writeFileSync(outPath, buf);
        const sec = (buf.length / 16000).toFixed(1);
        console.log(`✅ ${slug}-${lang}.mp3 — ${(buf.length / 1024).toFixed(0)}KB (~${sec}s)`);
        produced++;
      } catch (e) {
        console.error(`❌ ${slug}-${lang}: ${e.message}`);
        errors++;
      }
    }
  }

  const ms = Date.now() - t0;
  console.log(`\n📊 ${produced} üretildi · ${skipped} atlandı · ${errors} hata · ${ms}ms`);

  // Manifest güncelle
  const manifest = {};
  for (const f of readdirSync(OUT_DIR).filter(f => f.endsWith('.mp3'))) {
    const m = f.match(/^([a-z]+)-([a-z]{2})\.mp3$/);
    if (m) {
      const [, slug, lang] = m;
      manifest[slug] = manifest[slug] || {};
      manifest[slug][lang] = `/assets/audio/${f}`;
    }
  }
  writeFileSync(resolve(ROOT, 'data/audio-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`📋 data/audio-manifest.json güncellendi (${Object.keys(manifest).length} kent)`);
}

main().catch(e => { console.error(e); process.exit(1); });
