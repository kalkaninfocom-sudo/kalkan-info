#!/usr/bin/env node
/**
 * scripts/agency/agent-learn.mjs <agentId> — Tek agent'ı ÖĞRETİR
 * ---------------------------------------------------------------
 * Bir agent'ın alanına uygun (reading-list.json) SIRADAKİ okunmamış kaynağı seçer,
 * içeriği çeker (RSS/HTML→text; ağ yoksa booklist kavramından öğrenir), cheap-llm ile
 * "bu agent'ın işine yarayacak 3 somut/uygulanabilir ders" çıkarır ve
 * data/agency/knowledge/<agentId>.json'a ekler.
 *
 *   Şema: { agent, lessons:[{source,url,summary,learnedAt}], updatedAt }
 *
 * Kurallar:
 *   - URL dedup: knowledge'daki learned url'ler tekrar okunmaz (idempotent).
 *   - Non-fatal: her hata yutulur, exit 0 (scheduler'ı/round-robin'i bozmaz).
 *   - Olgusallık: LLM'e "kaynağı özetle, uydurma yok" talimatı verilir.
 *   - Ucuz LLM ZORUNLU: doğrudan Anthropic çağrısı YOK → lib/cheap-llm.mjs.
 *
 * Kullanım:
 *   node scripts/agency/agent-learn.mjs muhabir
 *   node scripts/agency/agent-learn.mjs growth --dry   # ne öğrenirdi göster, yazma
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const READING_LIST = join(ROOT, 'data', 'agency', 'reading-list.json');
const AGENTS = join(ROOT, 'data', 'agency', 'agents.json');
const KNOWLEDGE_DIR = join(ROOT, 'data', 'agency', 'knowledge');

// .env.local yükle (diğer scripts/agency/*.mjs ile aynı pattern)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const DRY = process.argv.includes('--dry');

/** Non-fatal çıkış — round-robin ve scheduler'ı bozma. */
function done(msg, code = 0) { console.log(`[agent-learn] ${msg}`); process.exit(code); }

/** Basit HTML/XML → düz metin (etiket sök, boşluk sıkıştır). */
function stripHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** RSS/Atom feed'inden ilk item'ları {title,link,summary} olarak çıkar (regex, bağımlılıksız). */
function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) || [];
  for (const b of blocks.slice(0, 8)) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? stripHtml(m[1].replace(/<!\[CDATA\[|\]\]>/g, '')) : '';
    };
    // Atom <link href="..."/> desteği
    let link = pick('link');
    if (!link) { const lm = b.match(/<link[^>]*href="([^"]+)"/i); if (lm) link = lm[1]; }
    const title = pick('title');
    const summary = pick('description') || pick('summary') || pick('content');
    if (title) items.push({ title, link, summary });
  }
  return items;
}

async function fetchText(url, timeoutMs = 12000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'KalkanInfoAgentLearn/1.0 (+https://kalkaninfo.com)', accept: 'text/html,application/rss+xml,application/xml,*/*' },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return await res.text();
}

async function loadKnowledge(agentId) {
  try { return JSON.parse(await readFile(join(KNOWLEDGE_DIR, `${agentId}.json`), 'utf8')); }
  catch { return { agent: agentId, lessons: [], updatedAt: null }; }
}

async function main() {
  const agentId = process.argv[2];
  if (!agentId) done('kullanım: agent-learn.mjs <agentId> [--dry]', 0);

  // reading-list + agents yükle
  let list, agentsDef;
  try { list = JSON.parse(await readFile(READING_LIST, 'utf8')); } catch (e) { done(`reading-list okunamadı: ${e.message}`); }
  try { agentsDef = JSON.parse(await readFile(AGENTS, 'utf8')).agents || {}; } catch { agentsDef = {}; }

  const cfg = list.agents?.[agentId] || list.defaults || {};
  const sources = cfg.sources || list.defaults?.sources || [];
  const booklist = cfg.booklist || list.defaults?.booklist || [];
  const agentMeta = agentsDef[agentId] || {};
  const beat = agentMeta.role || agentMeta.beat || agentId;

  const kb = await loadKnowledge(agentId);
  const learnedUrls = new Set(kb.lessons.map(l => l.url).filter(Boolean));

  // 0) ÖNCELİK: işin ALTINDAKİ bilim/matematik (foundations) — okunmamışsa ÖNCE onu öğren
  const foundations = cfg.foundations || list.defaults?.foundations || [];
  const nextFoundation = foundations.find(b => !learnedUrls.has(`book://${b.title}`));

  let sourceLabel, sourceUrl, material;

  if (nextFoundation) {
    sourceUrl = `book://${nextFoundation.title}`;
    sourceLabel = `${nextFoundation.title} — ${nextFoundation.author} [TEMEL BİLİM]`;
    material = `İşinin ALTINDAKİ bilim/mekanizma. Kitap: "${nextFoundation.title}" (${nextFoundation.author}). ` +
      `Ana kavramlar: ${(nextFoundation.concepts || []).join(', ')}. Bu mekanizmayı bu agentın işine NASIL uygulayacağını çıkar.`;
  }

  // 1) Foundation kalmadıysa: okunmamış ilk URL kaynağı (güncel makale/blog)
  const nextSource = !material && sources.find(s => s.url && !learnedUrls.has(s.url));

  if (!material && nextSource) {
    sourceUrl = nextSource.url;
    sourceLabel = nextSource.title || nextSource.url;
    try {
      const raw = await fetchText(nextSource.url);
      if (nextSource.type === 'rss' || /^<\?xml|<rss|<feed/i.test(raw.trim())) {
        const items = parseFeed(raw);
        material = items.map(i => `• ${i.title}${i.summary ? ' — ' + i.summary.slice(0, 300) : ''}`).join('\n').slice(0, 4000);
      } else {
        material = stripHtml(raw).slice(0, 4000);
      }
      if (!material || material.length < 40) throw new Error('içerik boş/kısa');
    } catch (e) {
      // Ağ yoksa/başarısızsa → aynı kaynağı işaretleme, kitap kavramına düş
      console.log(`[agent-learn] kaynak çekilemedi (${sourceLabel}): ${e.message} → kitap kavramına düşülüyor`);
      material = null;
    }
  }

  // 2) Ağ yoksa/kaynak yoksa → okunmamış bir kitap kavramından öğren
  if (!material) {
    // kitaplar için sözde-url: book://<title> (dedup için)
    const nextBook = booklist.find(b => !learnedUrls.has(`book://${b.title}`));
    if (!nextBook) done(`öğrenilecek yeni kaynak yok (tüm kaynaklar + kitaplar okunmuş): ${agentId}`);
    sourceUrl = `book://${nextBook.title}`;
    sourceLabel = `${nextBook.title} — ${nextBook.author}`;
    material = `Kitap: "${nextBook.title}" (${nextBook.author}). Ana kavramlar: ${(nextBook.concepts || []).join(', ')}.`;
  }

  // 3) cheap-llm ile 3 somut ders çıkar
  const { cheapLLM } = await import('../../lib/cheap-llm.mjs');
  const system = `Sen bir mesleki eğitmensin. "${agentMeta.name || agentId}" adlı ajans agentı şu işi yapıyor: ${beat}. `
    + `Sana verilen kaynağı OKU ve bu agentın işinin ALTINDAKİ MEKANİZMAYI/MATEMATİĞİ kavramasını sağlayacak 3 ders çıkar. `
    + `Yüzeysel ipucu DEĞİL: NEDEN işe yaradığını (bilişsel/psikolojik/istatistiksel mekanizma — renk-duygu eşlemesi, dikkat/retention matematiği, ikna ilkesi, önyargı) + çıktısına NASIL uygulanacağını ver. `
    + `Etik çerçeve: bu bilgi daha iyi/etkili ve DÜRÜST içerik için; aldatma/karanlık desen için değil. `
    + `KURAL: Sadece verilen kaynaktan özetle — UYDURMA, kaynakta olmayan iddia ekleme. `
    + `Her ders tek net cümle, doğrudan işe uygulanabilir. Türkçe. `
    + `SADECE JSON döndür: {"lessons":["ders1","ders2","ders3"]}`;
  const prompt = `KAYNAK: ${sourceLabel}\n\nİÇERİK:\n${material}\n\nBu agentın işinin ARKASINDAKİ mekanizmayı kavratacak + çıktısına uygulanabilir 3 ders (JSON).`;

  let lessons = [];
  try {
    const { text, provider } = await cheapLLM(prompt, { system, json: true, maxTokens: 400 });
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    lessons = (parsed.lessons || []).filter(Boolean).slice(0, 3).map(String);
    console.log(`[agent-learn] ${agentId} ← ${sourceLabel} (LLM: ${provider}) · ${lessons.length} ders`);
  } catch (e) {
    done(`LLM ders çıkaramadı (${agentId}): ${e.message}`);
  }
  if (!lessons.length) done(`boş ders (${agentId}) — atlandı`);

  if (DRY) {
    console.log(`[dry] ${agentId} öğrenirdi: ${sourceLabel}\n` + lessons.map((l, i) => `  ${i + 1}. ${l}`).join('\n'));
    process.exit(0);
  }

  // 4) knowledge/<agentId>.json'a ekle (özet = 3 ders birleşik)
  const learnedAt = new Date().toISOString();
  const summary = lessons.map((l, i) => `${i + 1}. ${l}`).join('\n');
  kb.agent = agentId;
  kb.lessons.push({ source: sourceLabel, url: sourceUrl, summary, learnedAt });
  // son 12 dersle sınırla (dosya şişmesin, en yeniler kalsın)
  if (kb.lessons.length > 12) kb.lessons = kb.lessons.slice(-12);
  kb.updatedAt = learnedAt;

  try {
    if (!existsSync(KNOWLEDGE_DIR)) await mkdir(KNOWLEDGE_DIR, { recursive: true });
    await writeFile(join(KNOWLEDGE_DIR, `${agentId}.json`), JSON.stringify(kb, null, 2));
    done(`✅ ${agentId} öğrendi: ${sourceLabel} (${kb.lessons.length} toplam ders)`);
  } catch (e) {
    done(`yazma hatası (${agentId}): ${e.message}`);
  }
}

main().catch(e => done(`beklenmeyen hata: ${e.message}`));
