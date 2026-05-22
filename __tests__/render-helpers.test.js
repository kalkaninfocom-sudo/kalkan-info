// render.js pure helper unit tests
// KalkanData is an IIFE that assigns to a const — we extract helpers via eval in a jsdom-like env.
// Since vitest runs in node, we set up minimal globals then eval the module.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal browser-API stubs needed by render.js
const globalStubs = () => {
  // localStorage stub
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
      _store: {},
      getItem(k) { return this._store[k] ?? null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; },
    };
  }
  // document stub (lang)
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = { documentElement: { lang: 'tr' } };
  }
};

let KalkanData;

beforeAll(() => {
  globalStubs();
  const src = readFileSync(
    resolve(import.meta.dirname || '.', '..', 'js', 'render.js'),
    'utf-8',
  );
  // The IIFE assigns to `const KalkanData = (()=>{...})()` — eval in global scope gives us the value
  // We wrap so the const leaks to our binding.
  const wrapped = `(function(){ ${src}; return KalkanData; })()`;
  KalkanData = eval(wrapped); // eslint-disable-line no-eval
});

// ── escape ──────────────────────────────────────────────────────────────────
describe('escape (escapeHTML)', () => {
  it('escapes < and > to HTML entities', () => {
    const result = KalkanData.escape('<script>');
    expect(result).toBe('&lt;script&gt;');
  });

  it('escapes & to &amp;', () => {
    expect(KalkanData.escape('a & b')).toBe('a &amp; b');
  });

  it('escapes double-quotes to &quot;', () => {
    expect(KalkanData.escape('"hello"')).toBe('&quot;hello&quot;');
  });

  it('returns empty string for null/undefined input', () => {
    expect(KalkanData.escape(null)).toBe('');
    expect(KalkanData.escape(undefined)).toBe('');
  });

  it('leaves safe strings unchanged', () => {
    expect(KalkanData.escape('Hello Kalkan')).toBe('Hello Kalkan');
  });
});

// ── safeImage ────────────────────────────────────────────────────────────────
describe('safeImage', () => {
  it('returns img tag for a valid https URL', () => {
    const html = KalkanData.safeImage('https://example.com/img.jpg', 'test');
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/img.jpg');
  });

  it('returns img tag for a root-relative URL starting with /', () => {
    const html = KalkanData.safeImage('/assets/photo.webp', 'photo');
    expect(html).toContain('<img');
  });

  it('returns placeholder div for empty url', () => {
    const html = KalkanData.safeImage('', 'alt text');
    expect(html).not.toContain('<img');
    expect(html).toContain('<div');
  });

  it('returns placeholder div for null url', () => {
    const html = KalkanData.safeImage(null, 'alt');
    expect(html).not.toContain('<img');
  });

  it('returns placeholder div for javascript: protocol (XSS guard)', () => {
    const html = KalkanData.safeImage('javascript:alert(1)', 'xss');
    expect(html).not.toContain('<img');
    expect(html).toContain('<div');
  });
});

// ── ratingStars ──────────────────────────────────────────────────────────────
describe('ratingStars', () => {
  it('returns empty string for 0 rating', () => {
    expect(KalkanData.ratingStars(0)).toBe('');
  });

  it('returns empty string for falsy rating', () => {
    expect(KalkanData.ratingStars(null)).toBe('');
    expect(KalkanData.ratingStars(undefined)).toBe('');
  });

  it('returns a span containing the star character for valid rating', () => {
    const html = KalkanData.ratingStars(4.5);
    expect(html).toContain('★');
    expect(html).toContain('4.5');
  });

  it('formats rating to one decimal place', () => {
    const html = KalkanData.ratingStars(3);
    expect(html).toContain('3.0');
  });

  it('handles maximum rating of 5', () => {
    const html = KalkanData.ratingStars(5);
    expect(html).toContain('5.0');
  });
});

// ── tagPill ──────────────────────────────────────────────────────────────────
describe('tagPill', () => {
  it('renders a span with the label text', () => {
    const html = KalkanData.tagPill('Deniz');
    expect(html).toContain('<span');
    expect(html).toContain('Deniz');
  });

  it('escapes HTML in the label', () => {
    const html = KalkanData.tagPill('<b>XSS</b>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('applies sea kind class by default', () => {
    const html = KalkanData.tagPill('test');
    expect(html).toContain('text-sea-600');
  });

  it('applies sun kind styling when kind is sun', () => {
    const html = KalkanData.tagPill('Öne Çıkan', 'sun');
    expect(html).toContain('text-[#9a6b00]');
  });
});

// ── filterItems ──────────────────────────────────────────────────────────────
describe('filterItems', () => {
  const items = [
    { id: '1', category: 'plaj', name: 'Kaputaş', featured: true },
    { id: '2', category: 'plaj', name: 'Patara', featured: false },
    { id: '3', category: 'koy', name: 'Ölüdeniz', featured: false },
  ];

  it('returns all items when no filter provided', () => {
    expect(KalkanData.filterItems(items).length).toBe(3);
  });

  it('filters by category', () => {
    const result = KalkanData.filterItems(items, { category: 'plaj' });
    expect(result.length).toBe(2);
    expect(result.every(i => i.category === 'plaj')).toBe(true);
  });

  it('filters by featured flag', () => {
    const result = KalkanData.filterItems(items, { featured: true });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by search query (case insensitive)', () => {
    const result = KalkanData.filterItems(items, { q: 'patara' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when nothing matches', () => {
    expect(KalkanData.filterItems(items, { category: 'nonexistent' })).toEqual([]);
  });
});
