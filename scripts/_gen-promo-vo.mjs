#!/usr/bin/env node
/**
 * _gen-promo-vo.mjs — webapp-promo reel için per-sahne TR+EN seslendirme (edge-tts, ücretsiz).
 * content/webapp-promo.json okur → remotion/public/audio/<lang>/<key>.mp3 + manifest.json (süreler).
 * Süreler composition timing'ini sürükler (caption = anlatım senkron).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ttsFree, audioDuration, VOICES } from './lib/tts-free.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'content', 'webapp-promo.json'), 'utf8'));

const LANGS = {
  tr: { voice: VOICES.tr_male, rate: '-4%' },
  en: { voice: VOICES.en_male, rate: '-4%' },
};

for (const [lang, opt] of Object.entries(LANGS)) {
  const dir = join(ROOT, 'remotion', 'public', 'audio', lang);
  mkdirSync(dir, { recursive: true });
  const manifest = { lang, voice: opt.voice, scenes: [] };
  let total = 0;
  for (const s of cfg.scenes) {
    const text = (s.vo && s.vo[lang]) || '';
    const out = join(dir, `${s.key}.mp3`);
    if (!text) { manifest.scenes.push({ key: s.key, dur: 0, file: null }); continue; }
    ttsFree(text, out, { voice: opt.voice, rate: opt.rate });
    const dur = audioDuration(out) || 0;
    total += dur;
    manifest.scenes.push({ key: s.key, dur: Number(dur.toFixed(2)), file: `audio/${lang}/${s.key}.mp3` });
    console.log(`✓ [${lang}] ${s.key} → ${dur.toFixed(2)}s`);
  }
  manifest.total = Number(total.toFixed(2));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  [${lang}] toplam VO: ${total.toFixed(1)}s → manifest.json\n`);
}
