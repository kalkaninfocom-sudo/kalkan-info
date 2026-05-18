// scripts/_fetch-pexels-drone.mjs — Pexels Videos API'den drone clipleri indir + Supabase Storage upload

import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const PEXELS_KEY = process.argv[2];
const pack = process.argv[3] || 'patara';

if (!PEXELS_KEY) { console.error('Usage: ... <pexels_key> [pack_id]'); process.exit(1); }

const env = readFileSync('.env.local', 'utf8');
function pick(k) {
  const l = env.split(/\r?\n/).find(l => l.startsWith(k + '='));
  if (!l) return '';
  return l.slice(k.length + 1).replace(/^"|"$/g, '').replace(/\\n$/, '').trim();
}
const SUPA_URL = pick('SUPABASE_URL');
const SUPA_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

// Antik kentler için search query'leri (Pexels'te direkt kent adı az sonuç verir,
// generic Mediterranean/ruins/beach query'leri daha cinematic)
const QUERIES = {
  patara: ['ancient ruins drone', 'mediterranean beach drone', 'turkey coast aerial'],
  xanthos: ['ancient ruins aerial', 'roman ruins drone', 'lycia mediterranean'],
  letoon: ['ancient temple drone', 'roman ruins aerial', 'mediterranean ruins'],
  tlos: ['mountain ruins drone', 'rock cut tombs aerial', 'turkey mountain village'],
  pinara: ['cliff tombs drone', 'ancient cemetery aerial', 'rock tombs turkey'],
  simena: ['sunken city aerial', 'turquoise coast drone', 'castle island drone'],
  antiphellos: ['kas turkey drone', 'mediterranean village aerial', 'street town aerial'],
  phellos: ['mountain hiking drone', 'pine forest aerial', 'ancient mountain ruins'],
  myra: ['ancient amphitheater drone', 'rock tombs cliff aerial', 'roman ruins large'],
  andriake: ['ancient harbor drone', 'salt flats aerial', 'turkey coast flamingo'],
};

const queries = QUERIES[pack] || ['ancient ruins drone'];

async function searchPexelsVideos(query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=5`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) throw new Error(`pexels ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.videos || [];
}

function pickBestFile(video) {
  // Prefer 1080x1920 portrait, else closest portrait, else any HD
  const files = video.video_files || [];
  const portrait = files.filter(f => f.height >= f.width);
  const ideal = portrait.find(f => f.width === 1080 && f.height === 1920);
  if (ideal) return ideal;
  const hd = portrait.filter(f => f.quality === 'hd').sort((a, b) => b.height - a.height)[0];
  return hd || portrait[0] || files[0];
}

async function downloadAndUpload(file, destName) {
  console.log(`  ⬇ ${file.width}x${file.height} ${file.quality}...`);
  const vid = await fetch(file.link);
  const buf = Buffer.from(await vid.arrayBuffer());
  console.log(`    ${(buf.length / 1024 / 1024).toFixed(2)}MB · uploading...`);
  const up = await fetch(`${SUPA_URL}/storage/v1/object/social-media/${pack}/drone/${destName}`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
    body: buf,
  });
  if (!up.ok) throw new Error(`upload ${up.status}: ${await up.text()}`);
  return `${SUPA_URL}/storage/v1/object/public/social-media/${pack}/drone/${destName}`;
}

const out = { pack, queries, clips: [] };
let n = 0;
for (const q of queries) {
  console.log(`🔎 "${q}"`);
  const videos = await searchPexelsVideos(q);
  for (const v of videos.slice(0, 2)) {
    n++;
    const file = pickBestFile(v);
    if (!file) continue;
    const destName = `clip-${String(n).padStart(2, '0')}.mp4`;
    try {
      const publicUrl = await downloadAndUpload(file, destName);
      out.clips.push({
        query: q,
        pexels_id: v.id,
        pexels_url: v.url,
        photographer: v.user?.name,
        duration: v.duration,
        width: file.width,
        height: file.height,
        public_url: publicUrl,
      });
      console.log(`  ✅ ${destName} · ${publicUrl.slice(-50)}`);
    } catch (e) {
      console.error(`  ❌ ${destName}: ${e.message}`);
    }
    if (out.clips.length >= 5) break;
  }
  if (out.clips.length >= 5) break;
}

// Write manifest
const manifestPath = resolve('content', `${pack}-drone-clips.json`);
if (!existsSync('content')) mkdirSync('content', { recursive: true });
writeFileSync(manifestPath, JSON.stringify(out, null, 2));
console.log(`\n✅ ${out.clips.length} clip indirildi · manifest: ${manifestPath}`);
console.log(out.clips.map(c => `  ${c.public_url}`).join('\n'));
