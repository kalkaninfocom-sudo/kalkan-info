// data/*.json bütünlük testleri
// Run: pnpm test
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname || '.', '..', 'data');

const jsonFiles = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));

describe('data/*.json validity', () => {
  for (const file of jsonFiles) {
    it(`${file} is valid JSON`, () => {
      const raw = readFileSync(join(DATA_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

describe('hizmet-saglayicilari.json structure', () => {
  const j = JSON.parse(readFileSync(join(DATA_DIR, 'hizmet-saglayicilari.json'), 'utf-8'));

  it('has services object', () => {
    expect(j.services).toBeTypeOf('object');
    expect(Object.keys(j.services).length).toBeGreaterThan(20);
  });

  it('every category has title, icon, providers[]', () => {
    for (const [key, svc] of Object.entries(j.services)) {
      expect(svc.title, `${key}.title`).toBeTypeOf('string');
      expect(svc.icon, `${key}.icon`).toBeTypeOf('string');
      expect(Array.isArray(svc.providers), `${key}.providers`).toBe(true);
    }
  });

  it('tekne-turu has 15 providers', () => {
    expect(j.services['tekne-turu'].providers.length).toBe(15);
  });

  it('every provider has id and name', () => {
    for (const [catKey, svc] of Object.entries(j.services)) {
      for (const p of svc.providers) {
        expect(p.id, `${catKey} provider.id`).toBeTypeOf('string');
        expect(p.name, `${catKey} provider.name`).toBeTypeOf('string');
      }
    }
  });
});

describe('voiceover-scripts.json', () => {
  const j = JSON.parse(readFileSync(join(DATA_DIR, 'voiceover-scripts.json'), 'utf-8'));
  it('has 10 antik kent scripts', () => {
    expect(Object.keys(j.scripts).length).toBeGreaterThanOrEqual(10);
  });
  it('each kent has all 5 languages', () => {
    for (const [slug, langs] of Object.entries(j.scripts)) {
      for (const lang of ['tr', 'en', 'de', 'ru', 'fr']) {
        expect(langs[lang], `${slug}.${lang}`).toBeTypeOf('string');
        expect(langs[lang].length, `${slug}.${lang} length`).toBeGreaterThan(50);
      }
    }
  });
});
