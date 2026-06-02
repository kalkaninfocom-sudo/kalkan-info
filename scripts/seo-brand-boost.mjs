#!/usr/bin/env node
/**
 * SEO Brand Boost — "kalkaninfo" araması icin marka adi sinyali guclendir.
 * - Organization & WebSite JSON-LD'ye alternateName ekler
 * - Sitemap lastmod tarihlerini bugune ceker
 * - robots.txt'ye AI bot ve crawl-delay direktifleri ekler
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);

const ALT_NAMES = ['kalkaninfo', 'kalkaninfo.com', 'Kalkaninfo', 'kalkan info', 'Kalkan Bilgi'];

// 1) HTML dosyalarinda Organization/WebSite JSON-LD'ye alternateName ekle
const htmlFiles = (await readdir(root)).filter(f => f.endsWith('.html'));
let touched = 0;
for (const file of htmlFiles) {
  const path = join(root, file);
  let html = await readFile(path, 'utf8');
  let changed = false;

  // Organization JSON-LD'yi yakala ve alternateName enjekte et
  html = html.replace(
    /<script type="application\/ld\+json">(\{[^<]*"@type":"Organization"[^<]*\})<\/script>/g,
    (m, json) => {
      try {
        const obj = JSON.parse(json);
        if (!obj.alternateName) {
          obj.alternateName = ALT_NAMES;
          changed = true;
          return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
        }
      } catch (e) {}
      return m;
    }
  );

  // WebSite JSON-LD'ye alternateName ekle
  html = html.replace(
    /<script type="application\/ld\+json">(\{[^<]*"@type":"WebSite"[^<]*\})<\/script>/g,
    (m, json) => {
      try {
        const obj = JSON.parse(json);
        if (!obj.alternateName) {
          obj.alternateName = ALT_NAMES;
          changed = true;
          return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
        }
      } catch (e) {}
      return m;
    }
  );

  if (changed) {
    await writeFile(path, html);
    touched++;
    console.log(`  + ${file}`);
  }
}
console.log(`HTML: ${touched} dosyaya alternateName eklendi.`);

// 2) Sitemap lastmod tarihlerini bugune cek
{
  const path = join(root, 'sitemap.xml');
  let xml = await readFile(path, 'utf8');
  xml = xml.replace(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g, `<lastmod>${today}</lastmod>`);
  await writeFile(path, xml);
  console.log(`Sitemap: tum lastmod -> ${today}`);
}

// 3) robots.txt — AI bot policy + GPTBot / Google-Extended davet
{
  const path = join(root, 'robots.txt');
  let txt = await readFile(path, 'utf8');
  if (!txt.includes('GPTBot')) {
    txt += `\n# AI Crawlers — markamizin AI cevaplarinda gorunmesi icin izinli\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Applebot\nAllow: /\n\nUser-agent: CCBot\nAllow: /\n`;
    await writeFile(path, txt);
    console.log('robots.txt: AI bot policy eklendi.');
  } else {
    console.log('robots.txt: zaten guncel.');
  }
}
