/* Tüm sayfaların head'ine PWA meta etiketlerini ekler.
   Idempotent + cache-bust: pwa.js'i sürüm query'siyle günceller.
*/
import { readFile, writeFile } from 'fs/promises';

const PAGES = ['index.html','plajlar.html','villalar.html','turlar.html','hizmetler.html','haberler.html','restoranlar.html','admin.html'];
const PWA_VERSION = 'v=2';

const PWA_BLOCK = `<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#0a2e4c">
<link rel="icon" type="image/svg+xml" href="icons/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Kalkan Info">
<meta name="mobile-web-app-capable" content="yes">
`;

const PWA_SCRIPT = `<script src="js/pwa.js?${PWA_VERSION}" defer></script>`;

for (const page of PAGES) {
  try {
    let html = await readFile(page, 'utf-8');
    let changed = false;

    // 1) Head içine manifest+meta block ekle (eğer yoksa)
    if (!html.includes('rel="manifest"')) {
      html = html.replace('</head>', PWA_BLOCK + '</head>');
      changed = true;
    }

    // 2) </body> öncesine pwa.js ekle (varsa version güncelle)
    if (html.includes('js/pwa.js')) {
      // Eski script tag'ini bul ve versiyonla değiştir
      html = html.replace(/<script src="js\/pwa\.js[^"]*"[^>]*><\/script>/g, PWA_SCRIPT);
      changed = true;
    } else {
      html = html.replace('</body>', PWA_SCRIPT + '\n</body>');
      changed = true;
    }

    if (changed) {
      await writeFile(page, html, 'utf-8');
      console.log(`✓ ${page} — güncellendi`);
    } else {
      console.log(`- ${page} — değişiklik yok`);
    }
  } catch (e) {
    console.warn(`✗ ${page} — ${e.message}`);
  }
}
