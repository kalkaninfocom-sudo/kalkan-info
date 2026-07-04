#!/usr/bin/env node
/**
 * scripts/agency/site-freshness.mjs
 * SİTE GÜNCELLEME DÖNGÜSÜ — güvenli iskelet (#6).
 *
 * Ajanlar beat'lerinde (site bölgeleri) sürekli çalışsın istiyor Berkay. GÜVENLİ tasarım:
 * canlı veriyi OTOMATİK DÜZENLEMEZ. Her bölge için veri-güdümlü FRESHNESS AUDIT yapar
 * (fotoğrafsız/çevirisiz/bayat kayıt tespiti) → öneri üretir → data/agency/site-proposals.json'a yazar
 * → ajansAI dashboard'da "Öneriler" sekmesinde görünür → Berkay onaylayınca (ileride) uygulanır.
 *
 * Uydurma YOK: her bulgu gerçek veri sayımından gelir. İsteğe bağlı 1 satır LLM önerisi (--llm, groq).
 *
 * Kullanım: node scripts/agency/site-freshness.mjs [--llm] [--telegram]
 * Zamanlama: haftalık (GitHub Actions veya scheduler). Env: (opsiyonel) TELEGRAM_*, cheap-llm anahtarları.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA = join(ROOT, 'data');

try {
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const USE_LLM = process.argv.includes('--llm');
const USE_TG = process.argv.includes('--telegram');

const load = (f) => { try { const d = JSON.parse(readFileSync(join(DATA, f), 'utf8')); return d.items || d.villas || d.turlar || (Array.isArray(d) ? d : Object.values(d).find(Array.isArray)) || []; } catch { return null; } };
const agents = (() => { try { return JSON.parse(readFileSync(join(DATA, 'agency', 'agents.json'), 'utf8')).agents || {}; } catch { return {}; } })();
const person = (id) => agents[id]?.person || agents[id]?.name || id;

// bölge → sorumlu ajan + veri dosyası + kontroller
const SECTIONS = [
  { key: 'restoranlar', beat: 'Restoranlar', agent: 'menu-chef', file: 'restoranlar.json', i18n: 'summaryI18n', url: '/restoranlar' },
  { key: 'villalar', beat: 'Villalar', agent: 'provider-matcher', file: 'villalar.json', i18n: 'summaryI18n', url: '/villalar' },
  { key: 'oteller', beat: 'Oteller', agent: 'provider-matcher', file: 'oteller.json', i18n: 'summaryI18n', url: '/oteller' },
  { key: 'antik', beat: 'Antik Kentler', agent: 'gezgin-rehber', file: 'antik-kentler.json', i18nSidecar: 'antik-kentler-i18n.json', url: '/antik-kentler' },
  { key: 'turlar', beat: 'Turlar', agent: 'tatil-planner', file: 'turlar.json', i18n: 'summaryI18n', url: '/turlar' },
  { key: 'plajlar', beat: 'Plajlar', agent: 'gezgin-rehber', file: 'plajlar.json', i18n: 'summaryI18n', url: '/plajlar' },
  { key: 'haberler', beat: 'Haberler', agent: 'muhabir', file: 'haberler.json', dateField: 'date', url: '/haberler' },
];

const hasPhoto = (r) => !!(r.image || r.photo || (Array.isArray(r.gallery) && r.gallery.length));
const gallerySize = (r) => Array.isArray(r.gallery) ? r.gallery.length : 0;

function auditSection(sec) {
  const rows = load(sec.file);
  if (!rows) return { ...sec, error: 'veri okunamadı', issues: [] };
  const total = rows.length;
  const issues = [];

  // Haber/tarihli bölümler: sadece bayatlık (foto/galeri/i18n uygulanmaz)
  if (sec.dateField) {
    const dates = rows.map((r) => new Date(r[sec.dateField]).getTime()).filter((t) => !isNaN(t));
    if (dates.length) {
      const ageH = (Date.now() - Math.max(...dates)) / 3600000;
      if (ageH > 48) issues.push({ type: 'bayat', count: Math.round(ageH), text: `En yeni içerik ${Math.round(ageH / 24)} gün önce — güncelleme gerek` });
    }
    const score = issues.length ? 40 : 100;
    return { key: sec.key, beat: sec.beat, url: sec.url, agent: sec.agent, agentPerson: person(sec.agent), total, score, issues,
      suggestion: issues.length ? `${sec.beat}: ${issues[0].text}` : `${sec.beat}: güncel ✓` };
  }

  // Fotoğraf
  const noPhoto = rows.filter((r) => !hasPhoto(r)).length;
  if (noPhoto) issues.push({ type: 'foto', count: noPhoto, text: `${noPhoto} kayıt fotoğrafsız` });
  const thinGallery = rows.filter((r) => hasPhoto(r) && gallerySize(r) < 3).length;
  if (thinGallery) issues.push({ type: 'galeri', count: thinGallery, text: `${thinGallery} kaydın galerisi zayıf (<3 foto)` });

  // i18n (çeviri)
  if (sec.i18nSidecar) {
    // antik: sidecar dosyasında çeviri var mı
    let translated = 0; try { const s = JSON.parse(readFileSync(join(DATA, sec.i18nSidecar), 'utf8')); translated = Object.keys(s).length; } catch {}
    const missing = total - translated;
    if (missing > 0) issues.push({ type: 'i18n', count: missing, text: `${missing}/${total} kentin 5-dil çevirisi eksik` });
  } else if (sec.i18n) {
    const noI18n = rows.filter((r) => { const v = r[sec.i18n]; return !v || (typeof v === 'object' && !Object.keys(v).length); }).length;
    if (noI18n) issues.push({ type: 'i18n', count: noI18n, text: `${noI18n}/${total} kaydın çevirisi (${sec.i18n}) eksik` });
  }

  // Bayatlık (tarihli bölümler)
  if (sec.dateField) {
    const dates = rows.map((r) => new Date(r[sec.dateField]).getTime()).filter((t) => !isNaN(t));
    if (dates.length) {
      const newest = Math.max(...dates);
      const ageH = (Date.now() - newest) / 3600000;
      if (ageH > 48) issues.push({ type: 'bayat', count: Math.round(ageH), text: `En yeni içerik ${Math.round(ageH / 24)} gün önce — güncelleme gerek` });
    }
  }
  if (sec.key === 'villalar' && total < 10) issues.push({ type: 'kapsam', count: total, text: `Sadece ${total} villa — katalog genişletilebilir` });

  // Freshness skoru (0-100): sorunlu kayıt oranından
  const problemUnits = issues.reduce((s, i) => s + (i.type === 'bayat' ? total * 0.3 : i.count), 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - (problemUnits / Math.max(total, 1)) * 100)));

  const suggestion = issues.length
    ? `${sec.beat}: ` + issues.map((i) => i.text).join('; ') + '.'
    : `${sec.beat}: bölüm güncel görünüyor ✓`;

  return { key: sec.key, beat: sec.beat, url: sec.url, agent: sec.agent, agentPerson: person(sec.agent), total, score, issues, suggestion };
}

async function llmEnrich(proposals) {
  try {
    const { cheapLLM } = await import('../../lib/cheap-llm.mjs');
    for (const p of proposals) {
      if (!p.issues?.length) continue;
      const prompt = `Kalkan Info sitesinin "${p.beat}" bölümünde şu eksikler var: ${p.issues.map((i) => i.text).join('; ')}. ` +
        `Bu bölümden sorumlu editör olarak, bu hafta atılacak EN somut 1 adımı tek cümlede öner (sade, uygulanabilir, abartısız).`;
      const { text } = await cheapLLM(prompt, { maxTokens: 80, order: ['groq', 'cerebras', 'nvidia', 'gemini', 'claude'] });
      p.action = String(text || '').split('\n')[0].trim();
    }
  } catch (e) { console.warn('  ⚠️ LLM zenginleştirme atlandı:', e.message); }
}

async function main() {
  console.log('🔄 Site freshness audit (beat başına)\n');
  const proposals = SECTIONS.map(auditSection);
  if (USE_LLM) { console.log('  🧠 LLM öneri zenginleştirme...'); await llmEnrich(proposals); }

  for (const p of proposals) {
    const bar = p.error ? '⚠' : (p.score >= 85 ? '🟢' : p.score >= 60 ? '🟡' : '🔴');
    console.log(`${bar} ${p.beat} (${p.agentPerson}) — skor ${p.score ?? '-'} · ${p.issues?.length || 0} bulgu`);
    (p.issues || []).forEach((i) => console.log(`     • ${i.text}`));
    if (p.action) console.log(`     → öneri: ${p.action}`);
  }

  const out = { generatedAt: new Date().toISOString(), proposals };
  writeFileSync(join(DATA, 'agency', 'site-proposals.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n✅ data/agency/site-proposals.json yazıldı (${proposals.length} bölge). Dashboard "Öneriler" sekmesinde görünür.`);

  if (USE_TG && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
    const worst = proposals.filter((p) => (p.score ?? 100) < 85).slice(0, 6);
    const text = ['🔄 Haftalık site güncelleme önerileri', '',
      ...worst.map((p) => `${p.score < 60 ? '🔴' : '🟡'} ${p.beat} (${p.agentPerson}): ${p.suggestion}${p.action ? '\n   → ' + p.action : ''}`),
      '', 'Detay: kalkaninfo.com/ajansAI → Öneriler'].join('\n');
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID, text, disable_web_page_preview: true }),
      });
      console.log('📨 Telegram özeti gönderildi.');
    } catch (e) { console.warn('Telegram atlandı:', e.message); }
  }
}
main().catch((e) => { console.error('[site-freshness] fatal:', e); process.exit(1); });
