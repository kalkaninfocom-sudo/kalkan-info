import { readFile, writeFile } from 'node:fs/promises';

const RELATED_BLOCK = `
<!-- RELATED EXPERIENCES — audit-architect P1 -->
<section class="related-experiences" data-related-block aria-labelledby="related-h2">
  <h2 id="related-h2">Yakın Deneyimler</h2>
  <div class="related-grid">
    <a href="../turlar.html" class="related-card">
      <h3>Tur Önerileri</h3>
      <p>Bu antik kenti dahil eden günlük turlar</p>
    </a>
    <a href="../villalar.html" class="related-card">
      <h3>Yakın Villalar</h3>
      <p>Bölgeye yakın konaklama seçenekleri</p>
    </a>
    <a href="../plajlar.html" class="related-card">
      <h3>Yakın Plajlar</h3>
      <p>Gezinin ardından dinlenebileceğin koylar</p>
    </a>
  </div>
</section>
<style>
  .related-experiences { max-width:1100px; margin:48px auto; padding:0 16px; }
  .related-experiences h2 { font-family:Montserrat,sans-serif; font-weight:700; font-size:1.5rem; color:#0a2e4c; margin-bottom:20px; }
  .related-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
  .related-card { display:block; padding:18px; background:#fff; border:1px solid #e3edf6; border-radius:14px; box-shadow:0 1px 2px rgba(13,58,95,.06),0 8px 24px -8px rgba(13,58,95,.18); text-decoration:none; transition:transform .22s ease, box-shadow .22s ease; }
  .related-card:hover { transform:translateY(-2px); box-shadow:0 8px 32px -8px rgba(13,58,95,.35); }
  .related-card h3 { font-family:Montserrat,sans-serif; font-weight:700; font-size:1.05rem; color:#134c79; margin-bottom:6px; }
  .related-card p { font-family:Inter,sans-serif; font-size:.92rem; color:#0a2e4c; line-height:1.5; margin:0; }
</style>`;

const slugs = ['patara','xanthos','letoon','tlos','pinara','simena','antiphellos','myra','andriake','aperlae'];
const base = '/c/Users/socie/kalkan-info/antik-kentler';

let updated = 0;
for (const slug of slugs) {
  const path = `${base}/${slug}.html`;
  let html = await readFile(path, 'utf8');
  if (html.includes('data-related-block')) {
    console.log(`SKIP (already has block): ${slug}.html`);
    continue;
  }
  // Insert before <!-- FOOTER --> or before <footer
  const insertBefore = html.includes('<!-- FOOTER -->') ? '<!-- FOOTER -->' : '<footer';
  const idx = html.indexOf(insertBefore);
  if (idx === -1) {
    console.log(`WARN: no footer marker found in ${slug}.html`);
    continue;
  }
  html = html.slice(0, idx) + RELATED_BLOCK + '\n\n' + html.slice(idx);
  await writeFile(path, html, 'utf8');
  console.log(`OK: ${slug}.html`);
  updated++;
}
console.log(`Done: ${updated} files updated.`);
