#!/usr/bin/env node
/**
 * Tek seferlik: The Social Kalkan IG fotolarini business_discovery ile cek + indir.
 * assets/img/restoran/the-social-kalkan-{hero,1..N}.jpg olarak kaydeder.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// .env.local yukle
const env = {};
try {
  const raw = await readFile(join(root, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const IG_ID = env.IG_BUSINESS_ID;
const TOKEN = env.IG_LONG_LIVED_TOKEN;
if (!IG_ID || !TOKEN) { console.error('IG_BUSINESS_ID / IG_LONG_LIVED_TOKEN eksik'); process.exit(1); }

const USER = 'thesocialkalkan';
const url = `https://graph.facebook.com/v21.0/${IG_ID}?fields=business_discovery.username(${USER}){name,biography,website,profile_picture_url,followers_count,media_count,media.limit(25){media_url,caption,media_type,thumbnail_url,permalink,timestamp}}&access_token=${TOKEN}`;

const res = await fetch(url);
const json = await res.json();
if (json.error) { console.error('API ERROR:', JSON.stringify(json.error, null, 2)); process.exit(1); }

const bd = json.business_discovery;
console.log('NAME:', bd.name);
console.log('BIO:', bd.biography);
console.log('WEBSITE:', bd.website);
console.log('FOLLOWERS:', bd.followers_count, 'POSTS:', bd.media_count);

const media = (bd.media?.data || []).filter(m => m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM');
console.log('IMAGE/CAROUSEL count:', media.length);

const outDir = join(root, 'assets', 'img', 'restoran');
await mkdir(outDir, { recursive: true });

const slug = 'the-social-kalkan';
let idx = 0;
const saved = [];
for (const m of media) {
  const src = m.media_url || m.thumbnail_url;
  if (!src) continue;
  idx++;
  const name = idx === 1 ? `${slug}-hero.jpg` : `${slug}-${idx - 1}.jpg`;
  try {
    const r = await fetch(src);
    if (!r.ok) { console.warn('skip', idx, r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(join(outDir, name), buf);
    saved.push({ name, caption: (m.caption || '').slice(0, 120), permalink: m.permalink });
    console.log('  saved', name, buf.length, 'bytes');
  } catch (e) { console.warn('err', idx, e.message); }
}
// caption'lari da yaz (metin uretimi icin)
await writeFile(join(outDir, `${slug}-captions.json`), JSON.stringify({ profile: { name: bd.name, bio: bd.biography, website: bd.website, followers: bd.followers_count, posts: bd.media_count }, saved }, null, 2));
console.log('DONE. Saved', saved.length, 'images');
