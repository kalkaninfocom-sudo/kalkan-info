/**
 * fb-pages-harvest.mjs
 * FB Graph API sayfalarindan gonderi topla, gate, sepete yaz.
 * Env: FB_PAGE_TOKEN, FB_PAGE_IDS (virgul) veya FB_PAGE_ID
 * node scripts/agency/fb-pages-harvest.mjs [--dry] [--min 0.6] [--limit 30]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARGS = process.argv.slice(2);
const DRY  = ARGS.includes('--dry');
const MIN  = (() => { const i = ARGS.indexOf('--min'); return i >= 0 ? parseFloat(ARGS[i+1]) : 0.55; })();
const POST_LIMIT = (() => { const i = ARGS.indexOf('--limit'); return i >= 0 ? parseInt(ARGS[i+1]) : 20; })();

const env = { ...process.env };
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
for (const [k, v] of Object.entries(env)) process.env[k] = v;

const slug = (s) => String(s || '').toLowerCase()
  .replace(/[ç]/g, 'c').replace(/[ğ]/g, 'g')
  .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o')
  .replace(/[ş]/g, 's').replace(/[ü]/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

async function readJson(rel, fallback) {
  try { return JSON.parse(await readFile(join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

async function fetchPagePosts(pageId, token, limit) {
  const fields = 'id,message,created_time,permalink_url';
  const url = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=${fields}&limit=${limit}&access_token=${token}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.warn(`[FB] ${pageId} HTTP ${res.status}`); return []; }
    return (await res.json()).data || [];
  } catch (e) { console.warn(`[FB] ${e.message}`); return []; }
}

async function fetchPageName(pageId, token) {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=name&access_token=${token}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) { const d = await res.json(); return d.name || pageId; }
  } catch {}
  return pageId;
}

function postToSignal(post, pageId, pageName) {
  const message = (post.message || '').trim();
  if (!message || message.length < 20) return null;
  return {
    permalink:   post.permalink_url || `https://www.facebook.com/${pageId}/posts/${post.id}`,
    sourceName:  pageName, username: pageId,
    category:    'FB Sayfasi', headline: message.slice(0, 400),
    source:      'fb', createdTime: post.created_time,
  };
}

async function main() {
  console.log('\n=== FB SAYFA HABER HASADI ===');
  const token = env.FB_PAGE_TOKEN;
  if (!token) { console.error('FB_PAGE_TOKEN bulunamadi.'); process.exit(1); }
  const rawIds = (env.FB_PAGE_IDS || env.FB_PAGE_ID || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!rawIds.length) { console.error('FB_PAGE_IDS veya FB_PAGE_ID bulunamadi.'); process.exit(1); }
  console.log(`-> ${rawIds.length} sayfa: ${rawIds.join(', ')}`);
  const SCOPES    = ['kalkan', 'kas', 'bolge'];
  const SEPET_DIR = join(ROOT, 'data', 'agency', 'sepet');
  const baskets   = {};
  for (const sc of SCOPES) baskets[sc] = await readJson(`data/agency/sepet/${sc}.json`, { items: [] });
  const haberler  = await readJson('data/haberler.json', { items: [] });
  const pubArr    = Array.isArray(haberler) ? haberler : (haberler.items || []);
  const seenUrls  = new Set([
    ...pubArr.map(h => h.sourceUrl).filter(Boolean),
    ...SCOPES.flatMap(sc => (baskets[sc].items || []).map(i => i.sourceUrl).filter(Boolean)),
  ]);
  const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
  const { runGate }  = await import(pathToFileURL(join(ROOT, 'lib', 'news-gate.mjs')).href);
  const today = new Date().toISOString().slice(0, 10);
  const accepted = [], rejected = [];
  for (const pageId of rawIds) {
    const pageName = await fetchPageName(pageId, token);
    console.log(`\n-- ${pageName} (${pageId}) --`);
    const posts = await fetchPagePosts(pageId, token, POST_LIMIT);
    console.log(`   ${posts.length} gonderi`);
    for (const post of posts) {
      const signal = postToSignal(post, pageId, pageName);
      if (!signal) continue;
      if (seenUrls.has(signal.permalink)) continue;
      const g = await runGate(cheapLLM, signal, {
        order: (env.CHEAP_LLM_ORDER || 'groq,cerebras,nvidia,gemini,claude').split(','),
        minValue: MIN,
      });
      if (!g) { console.log('  ? kapi basarisiz'); continue; }
      const val       = g.news_value ?? 0;
      const conf      = g.confidence ?? 1;
      const scope     = SCOPES.includes(g.scope) ? g.scope : 'alakasiz';
      const placement = g.placement || 'haberler';
      if (!g.is_news || g.usable === false || scope === 'alakasiz' || val < MIN) {
        const why = !g.is_news ? 'haber-degil' : g.usable === false ? 'uygun-degil' : scope === 'alakasiz' ? 'bolge-disi' : 'dusuk-deger';
        rejected.push({ page: pageName, val, why });
        console.log(`  x (${val.toFixed(2)}) ${why}`);
        continue;
      }
      const item = {
        id:        `fb-${slug(g.our_headline)}-${today}`,
        title:     g.our_headline,
        category:  g.category || 'Gundem',
        placement, confidence: conf, scope, date: today, image: '',
        summary:   g.our_summary, content: g.our_summary,
        tags:      ['Kalkan Info Haber', scope === 'kalkan' ? 'Kalkan' : scope === 'kas' ? 'Kas' : 'Bolge'],
        source:    `Kalkan Info Haber -- FB/${pageName}`,
        sourceUrl: signal.permalink, status: 'pending',
        _origin:   'fb-page', _provider: g._provider,
      };
      accepted.push(item); seenUrls.add(signal.permalink);
      console.log(`  v [${scope}/${placement}] (${val.toFixed(2)}) ${g.our_headline}`);
      await new Promise(r => setTimeout(r, 700));
    }
  }
  console.log(`\nOzet: ${accepted.length} gecti -- ${rejected.length} elendi`);
  if (DRY) { console.log('[dry]'); console.log(JSON.stringify(accepted, null, 2)); return; }
  if (!accepted.length) { console.log('Yeni icerik yok.'); return; }
  await mkdir(SEPET_DIR, { recursive: true });
  for (const sc of SCOPES) {
    const add = accepted.filter(i => i.scope === sc);
    if (!add.length) continue;
    baskets[sc].items   = [...add, ...(baskets[sc].items || [])];
    baskets[sc].updated = today;
    await writeFile(join(SEPET_DIR, `${sc}.json`), JSON.stringify(baskets[sc], null, 2));
    console.log(`v ${add.length} -> sepet/${sc}.json`);
  }
  console.log('Sonraki: node scripts/agency/basket-publish-v2.mjs --list');
}
main().catch(e => { console.error('[fb-pages-harvest]', e.message); process.exit(1); });
