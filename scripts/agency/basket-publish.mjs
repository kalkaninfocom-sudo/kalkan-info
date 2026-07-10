#!/usr/bin/env node
/**
 * scripts/agency/basket-publish.mjs — SEPETTEN SEÇ → YAYINLA
 * -------------------------------------------------------------------------------------------------
 * ig-news-harvest.mjs izlenen hesaplardan gelen içerikleri coğrafi SEPETLERE koyar (status:pending):
 *   data/agency/sepet/kalkan.json · kas.json · bolge.json
 * Bu script "çok sepetten bize uygun içerikleri seç → kendi haber ajansımızda yayınla" adımıdır:
 * seçilen pending içerikleri data/haberler.json'a taşır (status:published) → gazete-editorial.mjs +
 * ig-news-post.mjs bunu okuyup GAZETE + "Kalkan İnfo Haber" IG kartı üretir.
 *
 * Kullanım:
 *   node scripts/agency/basket-publish.mjs --list                 # tüm sepetlerdeki bekleyen içerikleri göster
 *   node scripts/agency/basket-publish.mjs --list --scope kalkan  # sadece kalkan sepetini göster
 *   node scripts/agency/basket-publish.mjs --id <id> [<id> ...]   # bu id'leri yayınla
 *   node scripts/agency/basket-publish.mjs --scope kalkan --all   # kalkan sepetindeki TÜM bekleyeni yayınla
 *   node scripts/agency/basket-publish.mjs --all                  # tüm sepetlerdeki TÜM bekleyeni yayınla
 *   node scripts/agency/basket-publish.mjs --id <id> --reject     # içeriği yayınlamadan sepetten düş (status:rejected)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCOPES = ['kalkan', 'kas', 'bolge'];
const SEPET_DIR = join(ROOT, 'data', 'agency', 'sepet');

const ARGS = process.argv.slice(2);
const has = (f) => ARGS.includes(f);
const val = (f) => { const i = ARGS.indexOf(f); return i >= 0 ? ARGS[i + 1] : null; };
const LIST = has('--list');
const ALL = has('--all');
const REJECT = has('--reject');
const SCOPE = val('--scope');
// --id id1 id2 ... (bir sonraki flag'e kadar)
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

function pendingOf(basket) { return (basket.items || []).filter(i => (i.status || 'pending') === 'pending'); }
// Listede gösterilecek: seçime hazır (pending) + hassas beklemede (hold). rejected/published gizli.
function stagedOf(basket) { return (basket.items || []).filter(i => ['pending', 'hold'].includes(i.status || 'pending')); }

async function main() {
  const baskets = await loadBaskets();
  const scopes = SCOPE ? [SCOPE].filter(s => SCOPES.includes(s)) : SCOPES;
  if (SCOPE && !scopes.length) { console.error(`Geçersiz --scope: ${SCOPE} (kalkan|kas|bolge)`); process.exit(1); }

  // ── LİSTE ──
  if (LIST || (!IDS.length && !ALL)) {
    let pend = 0, held = 0;
    for (const sc of scopes) {
      const items = stagedOf(baskets[sc]);
      const p = items.filter(i => (i.status || 'pending') === 'pending').length;
      const h = items.filter(i => i.status === 'hold').length;
      pend += p; held += h;
      console.log(`\n══ SEPET: ${sc.toUpperCase()} (${p} hazır${h ? ` · ${h} ⚠hassas` : ''}) ══`);
      for (const it of items) {
        const sc2 = typeof it.editorial_score === 'number' ? it.editorial_score.toFixed(2) : '?';
        const place = it.placement || 'haberler';
        const flag = it.status === 'hold' ? ' ⚠HASSAS(insan onayı şart)' : '';
        console.log(`  • [${it.id}]${flag}\n     ${it.title}  (skor ${sc2} · ${it.emotion || 'bilgi'} · →${place})\n     ${(it.summary || '').slice(0, 120)}  — ${it.source}`);
      }
      if (!items.length) console.log('  (boş)');
    }
    console.log(`\n${pend} içerik seçime hazır${held ? ` · ${held} hassas (yalnız --id ile yayınlanır)` : ''}.`);
    console.log(`Yayınla: node scripts/agency/basket-publish.mjs --id <id> [<id> ...]   |   tümü (hassas hariç): --all  (veya --scope kalkan --all)`);
    return;
  }

  // ── SEÇ → YAYINLA / REDDET ──
  // --all yalnız 'pending' seçer (hassas/hold hariç). --id ise pending VEYA hold'u açıkça seçebilir (insan kararı).
  const selected = [];
  for (const sc of scopes) {
    for (const it of stagedOf(baskets[sc])) {
      const isPending = (it.status || 'pending') === 'pending';
      if (IDS.includes(it.id) || (ALL && isPending)) selected.push({ sc, it });
    }
  }
  if (!selected.length) { console.log('Eşleşen içerik yok (hassas içerik yalnız --id ile). --list ile kontrol et.'); return; }

  if (REJECT) {
    for (const { it } of selected) it.status = 'rejected';
    for (const sc of scopes) await writeFile(join(SEPET_DIR, `${sc}.json`), JSON.stringify(baskets[sc], null, 2));
    console.log(`✓ ${selected.length} içerik reddedildi (status:rejected) — yayınlanmadı.`);
    return;
  }

  // haberler.json'a taşı (başa ekle)
  const HABER_PATH = join(ROOT, 'data', 'haberler.json');
  const haber = await readJson(HABER_PATH, []);
  const arr = Array.isArray(haber) ? haber : (haber.items || []);
  const existing = new Set(arr.map(h => h.sourceUrl).filter(Boolean));
  const today = new Date().toISOString().slice(0, 10);

  const toPublish = [];
  for (const { it } of selected) {
    if (existing.has(it.sourceUrl)) { it.status = 'published'; continue; } // zaten yayında
    // haberler.json'a temiz içerik: iç meta alanlarını (sepet/skor/etik) ayıkla; placement'i iz olarak tut
    const { status, scope, sensitive, editorial_score, emotion, _origin, _provider, ...rest } = it;
    toPublish.push({ ...rest, publishedAt: today });
    it.status = 'published';
  }

  if (toPublish.length) {
    const merged = [...toPublish, ...arr];
    await writeFile(HABER_PATH, JSON.stringify(merged, null, 2));
  }
  for (const sc of scopes) await writeFile(join(SEPET_DIR, `${sc}.json`), JSON.stringify(baskets[sc], null, 2));

  console.log(`✓ ${toPublish.length} içerik haberler.json'a yayınlandı → gazete + "Kalkan İnfo Haber" IG akışı tüketecek.`);
  if (selected.length - toPublish.length > 0) console.log(`  (${selected.length - toPublish.length} zaten yayındaydı, atlandı.)`);
}

if (!existsSync(SEPET_DIR)) { console.log('Sepet yok. Önce: node scripts/agency/ig-news-harvest.mjs --watch'); process.exit(0); }
main().catch(e => { console.error('[basket-publish]', e.message); process.exit(1); });
