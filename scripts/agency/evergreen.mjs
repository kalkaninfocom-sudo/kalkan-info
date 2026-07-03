// scripts/agency/evergreen.mjs — Haber azken/ek olarak SİTEDEN evergreen içerik.
// Berkay: "haber bulamadığımızda antik kentlerden az-bilinenler + hizmetlerden reklam."
// LLM YOK → olgusal (veriden), güvenilir, güne göre rotasyon (her gün farklı kent + farklı hizmet).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (f) => { try { return JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8')); } catch { return null; } };
const arr = (d) => Array.isArray(d) ? d : (d?.items || (d && Object.values(d).find(Array.isArray)) || []);

function dayOfYear(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y) return 0;
  return Math.floor((Date.UTC(y, (m || 1) - 1, d || 1) - Date.UTC(y, 0, 0)) / 86400000);
}

/** { antik:{name,fact,tag,image}, ad:{name,tagline,cta,icon,image} } — LLM'siz, güne göre. */
export function getEvergreen(dateStr) {
  const doy = dayOfYear(dateStr);
  const out = {};

  const allCities = arr(load('antik-kentler.json'));
  // Kalkan/Kaş/Patara çekirdek + tanınmış Likya kentleri öne (Berkay: "Kalkan/Kaş/Patara ile ilgili olsun").
  const CORE = /(patara|ksanthos|xanthos|letoon|kekova|simena|kaş|kas|kalkan|kaputaş|kaputas|saklıkent|saklikent|likya|myra|olimpos|üçağız|kaleköy)/i;
  const coreCities = allCities.filter(c => CORE.test(`${c.name || ''} ${(Array.isArray(c.tags) ? c.tags.join(' ') : '')}`));
  const cities = coreCities.length ? coreCities : allCities;
  if (cities.length) {
    const c = cities[doy % cities.length];
    const bits = [...(Array.isArray(c.highlights) ? c.highlights : []), ...(Array.isArray(c.tips) ? c.tips : [])]
      .filter(x => typeof x === 'string' && x.trim().length > 20);
    let fact = bits.length ? bits[doy % bits.length]
      : (typeof c.history === 'string' ? c.history : (c.summary || '')).split(/(?<=[.!?])\s/)[0];
    fact = String(fact || '').replace(/\s+/g, ' ').trim();
    if (fact.length > 180) fact = fact.slice(0, 177).trimEnd() + '…';
    out.antik = { name: c.name || '', fact, tag: (Array.isArray(c.tags) && c.tags[0]) || '', image: c.image || '' };
  }

  const services = arr(load('hizmetler.json'));
  if (services.length) {
    const featured = services.filter(s => s.featured);
    const pool = featured.length ? featured : services;
    const a = pool[doy % pool.length];
    let tagline = String(a.summary || a.details || '').replace(/\s+/g, ' ').trim();
    if (tagline.length > 95) tagline = tagline.slice(0, 92).trimEnd() + '…';
    out.ad = {
      name: a.name || '', tagline, icon: a.icon || '', image: a.image || '',
      cta: a.phone || 'kalkaninfo.com/hizmetler',
    };
  }
  return out;
}
