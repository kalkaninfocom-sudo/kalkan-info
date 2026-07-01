// scripts/build-newspaper-index.mjs
// newspaper/archive/<YYYY-MM-DD>/ klasörlerini tarar → data/newspaper-index.json
// /gazete sayfası ve ana sayfa "bugünün gazetesi" kartı bunu okur.
// Build-all içinde çağrılır; elle: node scripts/build-newspaper-index.mjs

import { readdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ARCHIVE = join(ROOT, 'newspaper', 'archive');

const DAY_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTH_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

async function has(p) { try { await access(p); return true; } catch { return false; } }

function longDate(iso) {
  const d = new Date(iso + 'T08:00:00');
  return { day: DAY_TR[d.getDay()], long: `${d.getDate()} ${MONTH_TR[d.getMonth()]} ${d.getFullYear()}` };
}

async function main() {
  let dirs = [];
  try { dirs = (await readdir(ARCHIVE, { withFileTypes: true })).filter(d => d.isDirectory() && isDate(d.name)).map(d => d.name); }
  catch { console.log('[news-index] arşiv yok — boş index'); }

  dirs.sort().reverse(); // en yeni önce

  const issues = [];
  for (const date of dirs) {
    const base = join(ARCHIVE, date);
    const editions = {};
    for (const t of ['morning', 'magazine']) {
      const html = await has(join(base, `${t}.html`));
      if (!html) continue;
      editions[t] = {
        html: `/newspaper/archive/${date}/${t}`,
        pdf: (await has(join(base, `${t}.pdf`))) ? `/newspaper/archive/${date}/${t}.pdf` : null,
        card: (await has(join(base, `${t}-card.png`))) ? `/newspaper/archive/${date}/${t}-card.png` : null,
      };
    }
    if (Object.keys(editions).length) {
      const { day, long } = longDate(date);
      issues.push({ date, day, long, editions });
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    total: issues.length,
    latest: issues[0]?.date || null,
    issues,
  };
  await writeFile(join(ROOT, 'data', 'newspaper-index.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(`[news-index] ${issues.length} sayı → data/newspaper-index.json (en yeni: ${out.latest || 'yok'})`);
}

main().catch(e => { console.error('[news-index]', e); process.exit(0); }); // fail-safe
