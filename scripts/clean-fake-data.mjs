#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

// 1) Reset restaurant ratings to null (uydurma puanlar)
{
  const path = new URL('data/restoranlar.json', root);
  const data = JSON.parse(await readFile(path, 'utf8'));
  let reset = 0;
  for (const item of data.items || []) {
    if (item.rating != null) { item.rating = null; reset++; }
    item.reviewCount = 0;
    if ('ratingSource' in item) delete item.ratingSource;
  }
  data._meta = data._meta || {};
  data._meta.ratingPolicy = 'Puanlar yalnizca dogrulanmis kaynaktan (orn. Google Places) gelir; aksi durumda gosterilmez.';
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`Restoranlar: ${reset} uydurma rating sifirlandi.`);
}

// 2) Remove verified:false providers from hizmet-saglayicilari
{
  const path = new URL('data/hizmet-saglayicilari.json', root);
  const data = JSON.parse(await readFile(path, 'utf8'));
  let removed = 0;
  let droppedCats = [];
  const services = data.services || {};
  for (const [key, cat] of Object.entries(services)) {
    const before = (cat.providers || []).length;
    // Sahte = verified !== true VE gercek phone yok. Gercek telefonu olanlar verified yoksa bile tutulur.
    cat.providers = (cat.providers || []).filter(p => p.verified === true || (p.phone && p.phone.trim()));
    const after = cat.providers.length;
    removed += (before - after);
    if (after === 0) { droppedCats.push(key); delete services[key]; }
  }
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`Hizmetler: ${removed} sahte saglayici silindi. Bos kategoriler kaldirildi: ${droppedCats.join(', ') || '(yok)'}`);
}
