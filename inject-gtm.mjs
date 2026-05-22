/* GTM Inject — adds Google Tag Manager (GTM-PLWTGK2G) to <head> and <noscript> after <body> on every HTML file */
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';

const GTM_ID = 'GTM-PLWTGK2G';
const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'test-results', 'temporary screenshots', 'investor-deck', '.git']);

const HEAD_TAG = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');</script>
<!-- End Google Tag Manager -->`;

const NOSCRIPT_TAG = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

const files = await walk(ROOT);
let injected = 0, skipped = 0, errors = 0;

for (const file of files) {
  try {
    let html = await readFile(file, 'utf8');
    if (html.includes(GTM_ID)) { skipped++; continue; }

    const headMatch = html.match(/<head[^>]*>/i);
    if (!headMatch) { console.warn(`⚠️  No <head>: ${relative(ROOT, file)}`); errors++; continue; }
    html = html.replace(headMatch[0], `${headMatch[0]}\n${HEAD_TAG}`);

    const bodyMatch = html.match(/<body[^>]*>/i);
    if (bodyMatch) html = html.replace(bodyMatch[0], `${bodyMatch[0]}\n${NOSCRIPT_TAG}`);

    await writeFile(file, html, 'utf8');
    injected++;
  } catch (e) {
    console.error(`❌ ${relative(ROOT, file)}: ${e.message}`);
    errors++;
  }
}

console.log(`✅ Injected: ${injected}`);
console.log(`⏭️  Skipped (already had GTM): ${skipped}`);
console.log(`⚠️  Errors: ${errors}`);
console.log(`Total scanned: ${files.length}`);
