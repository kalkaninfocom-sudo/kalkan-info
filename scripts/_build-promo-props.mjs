#!/usr/bin/env node
/**
 * _build-promo-props.mjs — webapp-promo.json + VO manifest'lerinden Remotion props üretir.
 * Sahne frames = VO süresi + nefes payı. Çıktı: remotion/props-webapp-promo-<lang>.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'content', 'webapp-promo.json'), 'utf8'));
const FPS = cfg.fps || 30;
const PHOTOS = ['cine/01-kaputas.jpg', 'cine/02-panorama.jpg', 'cine/03-limanagzi.jpg'];
const PAD = Math.round(0.8 * FPS);   // sahne sonu nefes payı
const MIN = Math.round(2.6 * FPS);

for (const lang of ['tr', 'en']) {
  const man = JSON.parse(readFileSync(join(ROOT, 'remotion', 'public', 'audio', lang, 'manifest.json'), 'utf8'));
  const durOf = (key) => (man.scenes.find((x) => x.key === key)?.dur) || 0;

  const scenes = cfg.scenes.map((s) => {
    const vo = durOf(s.key);
    const frames = Math.max(MIN, Math.round(vo * FPS) + PAD);
    const screenKey = s.screen || s.key;
    return {
      key: s.key,
      type: s.type,
      frames,
      label: (s.label && s.label[lang]) || '',
      headline: (s.headline && s.headline[lang]) || '',
      sub: (s.sub && s.sub[lang]) || '',
      audio: vo > 0 ? `audio/${lang}/${s.key}.mp3` : null,
      screen: s.type === 'screen' ? `screens/${lang}/${screenKey}.png` : null,
      photos: s.type === 'cinematic' ? PHOTOS : [],
    };
  });

  const total = scenes.reduce((n, x) => n + x.frames, 0);
  const props = { lang, base: 'http://localhost:3055/remotion/public/', music: 'audio/bed.mp3', scenes };
  const out = join(ROOT, 'remotion', `props-webapp-promo-${lang}.json`);
  writeFileSync(out, JSON.stringify(props, null, 2));
  console.log(`✓ [${lang}] ${scenes.length} sahne · ${total} frame · ${(total / FPS).toFixed(1)}s → props-webapp-promo-${lang}.json`);
}
