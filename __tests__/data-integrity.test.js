// data/*.json bütünlük testleri — genişletilmiş versiyon
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

describe('villalar.json structure', () => {
  const j = JSON.parse(readFileSync(join(DATA_DIR, 'villalar.json'), 'utf-8'));
  const items = j.items || [];

  it('has at least 3 villas', () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('every villa has required fields: id, name, capacity, bedrooms', () => {
    for (const v of items) {
      expect(v.id, `villa.id`).toBeTypeOf('string');
      expect(v.name, `${v.id}.name`).toBeTypeOf('string');
      expect(v.capacity, `${v.id}.capacity`).toBeTruthy();
      expect(v.bedrooms, `${v.id}.bedrooms`).toBeDefined();
    }
  });

  it('every villa has a summary string', () => {
    for (const v of items) {
      expect(v.summary, `${v.id}.summary`).toBeTypeOf('string');
      expect(v.summary.length, `${v.id}.summary length`).toBeGreaterThan(0);
    }
  });
});

describe('restoranlar.json structure', () => {
  const j = JSON.parse(readFileSync(join(DATA_DIR, 'restoranlar.json'), 'utf-8'));
  const items = j.items || [];

  it('has at least 1 restoran', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it('every restoran has nameI18n with all 5 languages', () => {
    for (const r of items) {
      const langs = r.nameI18n || {};
      for (const lang of ['tr', 'en', 'de', 'ru', 'fr']) {
        expect(langs[lang], `${r.id || r.name}.nameI18n.${lang}`).toBeTypeOf('string');
      }
    }
  });
});

describe('turlar.json structure', () => {
  const j = JSON.parse(readFileSync(join(DATA_DIR, 'turlar.json'), 'utf-8'));
  it('is a non-empty object', () => {
    expect(j).toBeTypeOf('object');
    const items = j.items || j.tours || [];
    expect(items.length ?? Object.keys(j).length).toBeGreaterThan(0);
  });
});

describe('plajlar.json structure', () => {
  const j = JSON.parse(readFileSync(join(DATA_DIR, 'plajlar.json'), 'utf-8'));
  it('is a non-empty object', () => {
    expect(j).toBeTypeOf('object');
    const items = j.items || j.beaches || [];
    expect(items.length ?? Object.keys(j).length).toBeGreaterThan(0);
  });
});

describe('antik-kentler.json structure', () => {
  const j = JSON.parse(readFileSync(join(DATA_DIR, 'antik-kentler.json'), 'utf-8'));
  it('is a non-empty object', () => {
    expect(j).toBeTypeOf('object');
    const items = j.items || j.sites || [];
    expect(items.length ?? Object.keys(j).length).toBeGreaterThan(0);
  });
});
