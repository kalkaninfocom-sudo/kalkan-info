#!/usr/bin/env node
/**
 * IndexNow submit — sitemap.xml'deki tüm URL'leri Bing/Yandex/DuckDuckGo'ya bildirir.
 * Kullanım: node scripts/indexnow-submit.mjs
 * Key dosyası: <KEY>.txt site kökünde olmalı (deploy edilmiş).
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const KEY = 'feb304b5944ab5102ce7608641ae251e';
const HOST = 'kalkaninfo.com';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const sm = await readFile(join(root, 'sitemap.xml'), 'utf8');
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
console.log(`sitemap'ten ${urls.length} URL okundu.`);

// IndexNow tek istekte 10.000'e kadar kabul eder.
const body = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: urls
};

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body)
});

console.log('IndexNow HTTP:', res.status, res.statusText);
const text = await res.text();
console.log('response body:', text || '(boş — 200/202 normaldir)');
// 200 OK / 202 Accepted = başarılı. 403 = key doğrulanamadı (dosya deploy oldu mu?).
// 422 = URL host uyuşmuyor. 429 = rate limit.
