// scripts/build-all.mjs — Vercel build orchestrator
// vercel.json buildCommand 256 karakter limitli olduğu için tüm build
// adımlarını burada zincirle. Her adım fail-safe (hata olursa build kırılmaz).

import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'supabase-config', cmd: 'node', args: ['scripts/build-supabase-config.mjs'], required: true },
  { name: 'tailwind',        cmd: 'node', args: ['scripts/build-tailwind.mjs'],        required: true },
  { name: 'inject-gtm',      cmd: 'node', args: ['scripts/inject-gtm.mjs'],            required: false },
  { name: 'restoran-pages',  cmd: 'node', args: ['scripts/build-restoran-pages.mjs'],  required: false },
  { name: 'news-aggregator', cmd: 'node', args: ['scripts/news-aggregator.mjs'],       required: false },
  { name: 'fetch-eczane',    cmd: 'node', args: ['scripts/fetch-eczane.mjs'],          required: false },
  { name: 'build-ads',       cmd: 'node', args: ['scripts/build-ads.mjs'],             required: false },
  { name: 'newspaper-index',  cmd: 'node', args: ['scripts/build-newspaper-index.mjs'], required: false },
  { name: 'agent-panel',     cmd: 'node', args: ['scripts/build-agent-panel.mjs'],     required: false },
  { name: 'sitemap',         cmd: 'node', args: ['scripts/build-sitemap.mjs'],         required: false }, // i18n hreflang + taze lastmod (SEO C3/H2)
];

let hardFail = false;
for (const step of steps) {
  console.log(`\n──── [build-all] ${step.name} ────`);
  const res = spawnSync(step.cmd, step.args, { stdio: 'inherit' });
  if (res.status !== 0) {
    if (step.required) {
      console.error(`❌ [build-all] ${step.name} REQUIRED — fail, build durdu`);
      hardFail = true;
      break;
    }
    console.warn(`⚠️  [build-all] ${step.name} fail (non-critical) — devam ediliyor`);
  } else {
    console.log(`✅ [build-all] ${step.name} OK`);
  }
}

process.exit(hardFail ? 1 : 0);
