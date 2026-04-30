/* Tüm sayfaların sticky nav'ına "Antik Kentler" linki ekler.
   Pattern: <a ... href="turlar.html"> ... </a> sonrası.
*/
import { readFile, writeFile } from 'fs/promises';

const PAGES = ['index.html','plajlar.html','villalar.html','turlar.html','restoranlar.html','hizmetler.html','haberler.html'];

const ANTIK_LINK = `<a class="px-4 py-3 hover:bg-sea-700 underline-grow" href="antik-kentler.html">Antik Kentler</a>`;

for (const page of PAGES) {
  try {
    let html = await readFile(page, 'utf-8');
    if (html.includes('antik-kentler.html')) {
      console.log(`- ${page} — zaten var`);
      continue;
    }
    // Turlar linkinden sonra ekle (en yaygın pattern)
    const turlarPattern = /(<a[^>]*href="turlar\.html"[^>]*>\s*Turlar\s*<\/a>)/i;
    if (turlarPattern.test(html)) {
      html = html.replace(turlarPattern, `$1\n      ${ANTIK_LINK}`);
      await writeFile(page, html, 'utf-8');
      console.log(`✓ ${page} — Antik Kentler linki eklendi`);
    } else {
      console.warn(`✗ ${page} — Turlar pattern bulunamadı`);
    }
  } catch (e) {
    console.warn(`✗ ${page} — ${e.message}`);
  }
}
