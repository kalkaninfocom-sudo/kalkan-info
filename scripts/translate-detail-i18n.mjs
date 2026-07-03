#!/usr/bin/env node
/**
 * translate-detail-i18n.mjs
 *
 * Restoran + Hizmet DETAY sayfalari icin ICERIK cevirisi (EN/DE/RU/FR).
 * Ucretsiz cheap-llm router (NVIDIA/Ollama/Gemini) kullanir — Claude token yakmaz.
 *
 * NE CEVIRIR:
 *   data/restoranlar.json  -> her hedef restoranin efektif metinleri:
 *     taglineI18n, aboutTitleI18n, aboutP1I18n, aboutP2I18n,
 *     menuTitleI18n, menuSubI18n, summaryI18n,
 *     menuCatI18n (kategori etiketleri), menuItemsI18n (menu ogeleri)
 *     Kaynak: restoranlar.json alanlari + scripts/restoran-content.mjs CUSTOM tohumlari.
 *
 *   data/hizmet-saglayicilari.json -> secili servis(ler)in saglayicilari:
 *     summaryI18n, specialtiesI18n, typeI18n  + servis-seviyesi titleI18n
 *
 * Sekli mevcut *I18n alanlari ile ayni: { tr, en, de, ru, fr }.
 * IDEMPOTENT: zaten cevrili (lang mevcut) alanlari atlar. --force ile ezer.
 *
 * KULLANIM:
 *   node scripts/translate-detail-i18n.mjs --restoran omar-s-kokobus-kokorec-kofte-tavuk-ekmek
 *   node scripts/translate-detail-i18n.mjs --restoran aubergine korsan-kalamar harbor-lights
 *   node scripts/translate-detail-i18n.mjs --doviz            # 3 doviz saglayicisi
 *   node scripts/translate-detail-i18n.mjs --service doviz kuafor-erkek
 *   node scripts/translate-detail-i18n.mjs --all-restoran     # TUM restoranlar (yavas)
 *   node scripts/translate-detail-i18n.mjs --restoran omar --dry-run
 *   node scripts/translate-detail-i18n.mjs --restoran omar --force
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM } from './restoran-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── .env.local yukle (cheap-llm process.env okur) ──
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const { cheapLLM, availableProviders } = await import('../lib/cheap-llm.mjs');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const listAfter = (f) => {
  const i = argv.indexOf(f);
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) out.push(argv[j]);
  return out;
};
const DRY = has('--dry-run');
const FORCE = has('--force');
const LANGS = ['en', 'de', 'ru', 'fr'];
const LANG_NAME = { en: 'English', de: 'German (Deutsch)', ru: 'Russian (Русский)', fr: 'French (Français)' };

const RESTORAN_FILE = path.join(ROOT, 'data', 'restoranlar.json');
const HIZMET_SAG_FILE = path.join(ROOT, 'data', 'hizmet-saglayicilari.json');

// ── Ortak ceviri sistem promptu (numarali-satir formati) ──
function transSystem(lang) {
  return `You are a professional ${LANG_NAME[lang]} translator for a Kalkan (Antalya, Turkey) tourism website. `
    + `Translate each numbered Turkish line into natural ${LANG_NAME[lang]}. `
    + `Rules: (1) Keep proper nouns, brand names and dish names (e.g. kokoreç, köfte, tavuk ekmek, meze, Kalkan, Western Union, EUR/USD/GBP) natural — well-known Turkish dish names may stay, but the surrounding text must read naturally in ${LANG_NAME[lang]}. `
    + `(2) Preserve any leading emoji at the start of a line. `
    + `(3) Keep it concise; do not merge or split lines. `
    + `(4) Translate EVERY line, including generic single words/headings (e.g. Turkish "Menümüz" -> "Our Menu"); never leave a normal Turkish word untranslated just because it is short. `
    + `(5) Output ONLY \`<index>|<translation>\` lines — no commentary, no code fences.`;
}

// Numarali-satir cevirici — nested JSON'dan cok daha guvenilir (kucuk cikti, kolay parse).
// Girdi string dizisi -> ayni uzunlukta cevrili dizi (basarisiz oge = null).
async function translateLines(strings, lang) {
  if (!strings.length) return [];
  const numbered = strings.map((s, i) => `${i + 1}|${String(s).replace(/\r?\n/g, ' ')}`).join('\n');
  const prompt = `Translate these ${strings.length} Turkish lines to ${LANG_NAME[lang]}.\n`
    + `Output EXACTLY one line per input as \`<index>|<translation>\` — same indexes, no extra lines, `
    + `no commentary, no code fences.\n\n${numbered}`;
  const maxTokens = Math.min(3200, 80 + strings.length * 45);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await cheapLLM(prompt, { system: transSystem(lang), maxTokens, temperature: 0.2, timeoutMs: 90000 });
      const out = new Array(strings.length).fill(null);
      for (const line of String(text).split('\n')) {
        const m = line.match(/^\s*(\d+)\s*\|(.*)$/);
        if (m) { const i = +m[1] - 1; if (i >= 0 && i < out.length && m[2].trim()) out[i] = m[2].trim(); }
      }
      if (out.some(x => x != null)) return out;
      lastErr = new Error('bos yanit');
    } catch (e) { lastErr = e; }
  }
  throw new Error(lastErr ? lastErr.message : 'ceviri yok');
}

function ensureI18n(obj, field) {
  if (!obj[field] || typeof obj[field] !== 'object' || Array.isArray(obj[field])) obj[field] = {};
  return obj[field];
}

// ═══════════════════════ RESTORAN ═══════════════════════
function effectiveContent(r) {
  const c = CUSTOM[r.id] || {};
  const menu = c.menu || r.menu || null;
  return {
    tagline: c.tagline || r.summary || '',
    aboutTitle: c.aboutTitle || r.name || '',
    aboutP1: c.aboutP1 || r.summary || '',
    aboutP2: c.aboutP2 || '',
    menuTitle: c.menuTitle || r.menuTitle || 'Menümüz',
    menuSub: c.menuSub || r.menuSub || '',
    summary: r.summary || '',
    menu, // { cat: [items] } | null
  };
}

async function translateRestoran(r) {
  const src = effectiveContent(r);
  const scalarFields = {
    tagline: 'taglineI18n', aboutTitle: 'aboutTitleI18n', aboutP1: 'aboutP1I18n',
    aboutP2: 'aboutP2I18n', menuTitle: 'menuTitleI18n', menuSub: 'menuSubI18n', summary: 'summaryI18n',
  };
  // TR taban degerlerini yerlestir (fallback tutarliligi)
  for (const [k, field] of Object.entries(scalarFields)) {
    if (src[k]) ensureI18n(r, field).tr = src[k];
  }
  const cats = src.menu ? Object.keys(src.menu) : [];
  if (cats.length) {
    const catLabels = {}; cats.forEach(c => (catLabels[c] = c));
    ensureI18n(r, 'menuCatI18n').tr = catLabels;
    ensureI18n(r, 'menuItemsI18n').tr = src.menu;
  }

  let changed = false;
  for (const lang of LANGS) {
    const scalarNeed = FORCE || Object.entries(scalarFields).some(([k, f]) => src[k] && !r[f]?.[lang]);
    const menuNeed = cats.length && (FORCE || !r.menuCatI18n?.[lang] || !r.menuItemsI18n?.[lang]);
    if (!scalarNeed && !menuNeed) continue;

    process.stdout.write(`    [${lang}] ${r.id}`);
    // (1) Scalar metinler — kucuk, hizli call
    if (scalarNeed) {
      try {
        const keys = Object.keys(scalarFields).filter(k => src[k]);
        const tr = await translateLines(keys.map(k => src[k]), lang);
        keys.forEach((k, i) => { ensureI18n(r, scalarFields[k])[lang] = tr[i] || src[k]; });
        changed = true;
        process.stdout.write(' text=ok');
      } catch (e) {
        process.stdout.write(` text=FAIL(${e.message.slice(0, 40)})`);
      }
    }
    // (2) Menu — kategori BAZINDA kucuk call'lar (kucuk model icin guvenilir)
    if (menuNeed) {
      const catMap = {}; const itemsMap = {}; let okCount = 0;
      for (const c of cats) {
        itemsMap[c] = src.menu[c].slice(); // TR fallback kopya
        catMap[c] = c;
        try {
          const tr = await translateLines([c, ...src.menu[c]], lang); // [etiket, ...ogeler]
          if (tr[0]) catMap[c] = tr[0];
          src.menu[c].forEach((it, j) => { const v = tr[1 + j]; if (v) itemsMap[c][j] = v; });
          okCount++;
        } catch (e) { /* bu kategori TR kalir */ }
      }
      if (okCount) {
        ensureI18n(r, 'menuCatI18n')[lang] = catMap;
        ensureI18n(r, 'menuItemsI18n')[lang] = itemsMap;
        changed = true;
        process.stdout.write(` menu=${okCount}/${cats.length}`);
      } else {
        process.stdout.write(' menu=FAIL');
      }
    }
    process.stdout.write('\n');
  }
  return changed;
}

// ═══════════════════════ HIZMET SAGLAYICILARI ═══════════════════════
async function translateProvider(p) {
  const scalar = { summary: 'summaryI18n', type: 'typeI18n' };
  for (const [k, f] of Object.entries(scalar)) if (p[k]) ensureI18n(p, f).tr = p[k];
  if (Array.isArray(p.specialties) && p.specialties.length) ensureI18n(p, 'specialtiesI18n').tr = p.specialties;

  let changed = false;
  for (const lang of LANGS) {
    const need = FORCE
      || (p.summary && !p.summaryI18n?.[lang])
      || (p.type && !p.typeI18n?.[lang])
      || (p.specialties?.length && !p.specialtiesI18n?.[lang]);
    if (!need) continue;

    // Duz liste: [summary?, type?, ...specialties]
    const slots = [];
    if (p.summary) slots.push(['summary', 0]);
    if (p.type) slots.push(['type', 0]);
    (p.specialties || []).forEach((_, j) => slots.push(['spec', j]));
    const strings = slots.map(([kind, j]) => kind === 'summary' ? p.summary : kind === 'type' ? p.type : p.specialties[j]);

    process.stdout.write(`    [${lang}] provider ${p.id || p.name} ...`);
    try {
      const tr = await translateLines(strings, lang);
      const specArr = (p.specialties || []).slice();
      slots.forEach(([kind, j], i) => {
        const v = tr[i];
        if (kind === 'summary') ensureI18n(p, 'summaryI18n')[lang] = v || p.summary;
        else if (kind === 'type') ensureI18n(p, 'typeI18n')[lang] = v || p.type;
        else if (v) specArr[j] = v;
      });
      if (p.specialties?.length) ensureI18n(p, 'specialtiesI18n')[lang] = specArr;
      changed = true;
      process.stdout.write(' ok\n');
    } catch (e) {
      process.stdout.write(` FAIL (${e.message.slice(0, 80)})\n`);
    }
  }
  return changed;
}

async function translateService(svc) {
  let changed = false;
  // Servis basligi
  if (svc.title) {
    ensureI18n(svc, 'titleI18n').tr = svc.title;
    for (const lang of LANGS) {
      if (!FORCE && svc.titleI18n?.[lang]) continue;
      try {
        const [t] = await translateLines([svc.title], lang);
        ensureI18n(svc, 'titleI18n')[lang] = t || svc.title;
        changed = true;
      } catch (e) { /* baslik kritik degil */ }
    }
  }
  for (const p of (svc.providers || [])) {
    if (await translateProvider(p)) changed = true;
  }
  return changed;
}

// ═══════════════════════ MAIN ═══════════════════════
async function main() {
  console.log('cheap-llm saglayicilar:', availableProviders().join(', ') || '(yok)');
  const doRestoran = listAfter('--restoran');
  const allRestoran = has('--all-restoran');
  const services = has('--doviz') ? ['doviz'] : listAfter('--service');
  if (!doRestoran.length && !allRestoran && !services.length) {
    console.error('Hedef yok. --restoran <slug...> | --all-restoran | --doviz | --service <id...>');
    process.exit(1);
  }

  // RESTORAN
  if (doRestoran.length || allRestoran) {
    const data = JSON.parse(fs.readFileSync(RESTORAN_FILE, 'utf8'));
    const targets = allRestoran ? data.items.map(x => x.id) : doRestoran;
    console.log(`\n=== RESTORAN (${targets.length}) ===`);
    let anyChanged = false;
    for (const slug of targets) {
      const r = data.items.find(x => x.id === slug || x.id.startsWith(slug));
      if (!r) { console.warn(`  ! ${slug} bulunamadi`); continue; }
      console.log(`  ${r.name}`);
      if (!DRY && await translateRestoran(r)) {
        anyChanged = true;
        // Her restorandan sonra KAYDET — uzun batch'lerde ilerleme kalici olsun.
        fs.writeFileSync(RESTORAN_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log('    -> kaydedildi');
      } else if (DRY) console.log('    (dry-run)');
    }
    if (!DRY && anyChanged) console.log(`  -> tamam: data/restoranlar.json`);
  }

  // HIZMET SAGLAYICILARI
  if (services.length) {
    const data = JSON.parse(fs.readFileSync(HIZMET_SAG_FILE, 'utf8'));
    console.log(`\n=== HIZMET SAGLAYICILARI (${services.join(', ')}) ===`);
    let anyChanged = false;
    for (const sid of services) {
      const svc = data.services?.[sid];
      if (!svc) { console.warn(`  ! servis '${sid}' yok`); continue; }
      console.log(`  ${svc.title} (${(svc.providers || []).length} saglayici)`);
      if (!DRY && await translateService(svc)) anyChanged = true;
      else if (DRY) console.log('    (dry-run)');
    }
    if (!DRY && anyChanged) {
      fs.writeFileSync(HIZMET_SAG_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`  -> kaydedildi: data/hizmet-saglayicilari.json`);
    }
  }
  console.log('\nBitti.');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
