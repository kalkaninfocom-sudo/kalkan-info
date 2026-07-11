#!/usr/bin/env node
/**
 * basket-publish-v2.mjs -- placement-aware sepet yayinlayici
 *
 * basket-publish.mjs gibi calisir ama placement alani ile routing yapar:
 *   haberler  -> data/haberler.json (on ekle)
 *   etkinlik  -> data/etkinlik-takvimi.json (oneoff append)
 *   restoran  -> data/haberler.json + tag Isletme
 *   magazine  -> data/haberler.json + magazine:true flag
 *   ig-card   -> sadece IG kart uretilir, siteye yazilmaz
 *
 * Kullanim:
 *   node scripts/agency/basket-publish-v2.mjs --list
 *   node scripts/agency/basket-publish-v2.mjs --list --scope kalkan
 *   node scripts/agency/basket-publish-v2.mjs --id <id> [<id> ...]
 *   node scripts/agency/basket-publish-v2.mjs --scope kalkan --all
 *   node scripts/agency/basket-publish-v2.mjs --all
 *   node scripts/agency/basket-publish-v2.mjs --all --low-conf   # conf<0.7 dahil
 *   node scripts/agency/basket-publish-v2.mjs --id <id> --reject
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCOPES   = ['kalkan', 'kas', 'bolge'];
const SEPET_DIR = join(ROOT, 'data', 'agency', 'sepet');

const ARGS    = process.argv.slice(2);
const has     = (f) => ARGS.includes(f);
const val     = (f) => { const i = ARGS.indexOf(f); return i >= 0 ? ARGS[i + 1] : null; }
const LIST    = has('--list');
const ALL     = has('--all');
const REJECT  = has('--reject');
const LOW_CONF = has('--low-conf');
const MIN_CONF = LOW_CONF ? 0 : 0.7;
const SCOPE   = val('--scope');
const IDS = (() => {
  const i = ARGS.indexOf('--id');
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < ARGS.length && !ARGS[k].startsWith('--'); k++) out.push(ARGS[k]);
  return out;
})();

async function readJson(p, fb) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fb; } }

async function loadBaskets() {
  const b = {};
  for (const sc of SCOPES) b[sc] = await readJson(join(SEPET_DIR, `${sc}.json`), { items: [] });
  return b;
}

function pendingOf(basket) {
  return (basket.items || []).filter(i => (i.status || 'pending') === 'pending');
}
function stagedOf(basket) {
  return (basket.items || []).filter(i => ['pending', 'hold'].includes(i.status || 'pending'));
}

// placement -> target dosya bilgisi
const PLACEMENT_TARGETS = {
  haberler: { file: 'data/haberler.json', type: 'haberler' },
  etkinlik: { file: 'data/etkinlik-takvimi.json', type: 'etkinlik' },
  restoran: { file: 'data/haberler.json', type: 'haberler', extraTag: 'Isletme' },
  magazine: { file: 'data/haberler.json', type: 'haberler', magazineFlag: true },
  'ig-card': { file: null, type: 'ig-only' },
};

async function publishItem(it, today) {
  const placement = it.placement || 'haberler';
  const target    = PLACEMENT_TARGETS[placement] || PLACEMENT_TARGETS.haberler;

  if (target.type === 'ig-only') {
    console.log(`  [ig-card] ${it.id} -- siteye yazilmadi, IG kart icin isaretlendi`);
    return { written: false, igOnly: true };
  }

  if (target.type === 'etkinlik') {
    const path = join(ROOT, target.file);
    const data = await readJson(path, { _meta: {}, recurring: [], oneoff: [] });
    const { status, scope, confidence, editorial_score, emotion, _origin, _provider, ...rest } = it;
    const entry = {
      ...rest,
      id:         it.id,
      type:       it.category || 'Etkinlik',
      date:       it.date || today,
      verified:   false,
      source:     'agency-basket',
      confidence: it.confidence || 0.7,
    };
    if (!data.oneoff) data.oneoff = [];
    if (!data.oneoff.find(e => e.id === entry.id)) {
      data.oneoff.unshift(entry);
      await writeFile(path, JSON.stringify(data, null, 2));
      console.log(`  [etkinlik] ${it.id} -> ${target.file}`);
    }
    return { written: true };
  }

  // haberler / restoran / magazine -> haberler.json
  const path = join(ROOT, target.file);
  const data = await readJson(path, { items: [] });
  const arr  = Array.isArray(data) ? data : (data.items || []);
  if (arr.find(h => h.sourceUrl && h.sourceUrl === it.sourceUrl)) {
    console.log(`  [skip] ${it.id} zaten yayinda`);
    return { written: false, duplicate: true };
  }
  const { status, scope, editorial_score, emotion, _origin, _provider, ...rest } = it;
  const entry = { ...rest, publishedAt: today };
  if (target.extraTag && !entry.tags.includes(target.extraTag)) entry.tags.push(target.extraTag);
  if (target.magazineFlag) entry.magazine = true;
  const merged = [entry, ...arr];
  if (Array.isArray(data)) {
    await writeFile(path, JSON.stringify(merged, null, 2));
  } else {
    data.items = merged;
    data._meta = data._meta || {};
    data._meta.updated = new Date().toISOString();
    await writeFile(path, JSON.stringify(data, null, 2));
  }
  console.log(`  [${placement}] ${it.id} -> ${target.file}`);
  return { written: true };
}

async function main() {
  const baskets = await loadBaskets();
  const scopes  = SCOPE ? [SCOPE].filter(s => SCOPES.includes(s)) : SCOPES;
  if (SCOPE && !scopes.length) { console.error(`Gecersiz --scope: ${SCOPE}`); process.exit(1); }

  // LIST
  if (LIST || (!IDS.length && !ALL)) {
    let total = 0;
    for (const sc of scopes) {
      const items = stagedOf(baskets[sc]);
      const shown = LOW_CONF ? items : items.filter(i => (i.confidence ?? 1) >= MIN_CONF);
      const hidden = items.length - shown.length;
      console.log(`
== SEPET: ${sc.toUpperCase()} (${shown.length} hazir${hidden ? " · " + hidden + " dusuk-guven gizli (--low-conf)" : ""}) ==`);
      for (const it of shown) {
        const place = it.placement || 'haberler';
        const conf  = it.confidence != null ? it.confidence.toFixed(2) : '?';
        const flag  = it.status === 'hold' ? ' HASSAS(insan-onayi-sart)' : '';
        console.log(`  * [${it.id}]${flag}
    ${it.title}  (guven:${conf} -> ${place})
    ${(it.summary || "").slice(0, 100)}`);
        total++;
      }
      if (!shown.length) console.log('  (bos)');
    }
    console.log(`
${total} icerik secime hazir. Yayin: --id <id> | --all | --scope kalkan --all`);
    return;
  }

  // SELECT
  const selected = [];
  for (const sc of scopes) {
    for (const it of stagedOf(baskets[sc])) {
      const isPending = (it.status || 'pending') === 'pending';
      const confOk    = (it.confidence ?? 1) >= MIN_CONF;
      if (IDS.includes(it.id) || (ALL && isPending && confOk)) selected.push({ sc, it });
    }
  }
  if (!selected.length) {
    console.log('Esleyen icerik yok. --list ile kontrol et.');
    return;
  }

  if (REJECT) {
    for (const { it } of selected) it.status = 'rejected';
    for (const sc of scopes)
      await writeFile(join(SEPET_DIR, `${sc}.json`), JSON.stringify(baskets[sc], null, 2));
    console.log(`v ${selected.length} icerik reddedildi.`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  let published = 0, skipped = 0, igOnly = 0;
  for (const { it } of selected) {
    const result = await publishItem(it, today);
    if (result.igOnly)        { igOnly++;    it.status = 'ig-only'; }
    else if (result.duplicate){ skipped++;   it.status = 'published'; }
    else if (result.written)  { published++; it.status = 'published'; }
    else                      { skipped++;   it.status = 'published'; }
  }
  for (const sc of scopes)
    await writeFile(join(SEPET_DIR, `${sc}.json`), JSON.stringify(baskets[sc], null, 2));

  console.log(`
v ${published} yayinlandi, ${igOnly} ig-only, ${skipped} atlandi.`);
  if (published > 0) console.log('Sonraki: gazete + ig-news-post.mjs otomatik alacak.');
}

if (!existsSync(SEPET_DIR)) {
  console.log('Sepet yok. Once: node scripts/agency/ig-news-harvest.mjs');
  process.exit(0);
}
main().catch(e => { console.error('[basket-publish-v2]', e.message); process.exit(1); });
