#!/usr/bin/env node
/**
 * skill-radar.mjs — Yeni Claude Code skill/plugin/MCP radarı (deterministik, read-only)
 *
 * GitHub'da yeni çıkan/güncellenen claude-code skill, plugin ve MCP server'larını tarar,
 * projelerimize (kalkaninfo: yerel işletme/SEO/sosyal/turizm/Türkçe/otomasyon; Aeternum: oyun)
 * alaka göre puanlar, daha önce görülenleri eler (seen.json) ve bir digest üretir.
 *
 * ⚠️ SADECE KEŞİF — hiçbir şey KURMAZ. Kurulum insan onayıyla, ayrı adım.
 *
 * Kullanım:
 *   node skill-radar.mjs                    # yeni + alakalı, markdown digest
 *   node skill-radar.mjs --json             # JSON
 *   node skill-radar.mjs --days 30          # son 30 günde güncellenenler (vars: 14)
 *   node skill-radar.mjs --min-stars 3      # min yıldız (vars: 0)
 *   node skill-radar.mjs --all              # seen filtresi olmadan (hepsi)
 *   node skill-radar.mjs --no-save          # seen.json'u güncelleme
 *   node skill-radar.mjs --top 15 --out digest.md
 *
 * Gereksinim: gh (GitHub CLI) authenticated.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEEN_PATH = join(__dirname, '..', 'skill-radar-seen.json');

// ── argümanlar ──────────────────────────────────────────────
function parseArgs(argv) {
  const a = { fmt: 'md', days: 14, minStars: 0, all: false, save: true, top: 25, out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--json') a.fmt = 'json';
    else if (k === '--md') a.fmt = 'md';
    else if (k === '--telegram') a.fmt = 'telegram';
    else if (k === '--days') a.days = parseInt(argv[++i], 10) || 14;
    else if (k === '--min-stars') a.minStars = parseInt(argv[++i], 10) || 0;
    else if (k === '--all') a.all = true;
    else if (k === '--no-save') a.save = false;
    else if (k === '--top') a.top = parseInt(argv[++i], 10) || 25;
    else if (k === '--out') a.out = argv[++i];
  }
  return a;
}

// ── arama sorguları (GitHub) ────────────────────────────────
const QUERIES = [
  { type: 'topic', q: 'claude-code' },
  { type: 'topic', q: 'claude-skill' },
  { type: 'topic', q: 'claude-code-skill' },
  { type: 'topic', q: 'claude-code-plugin' },
  { type: 'topic', q: 'claude-agent-skill' },
  { type: 'kw', q: 'claude code skill' },
  { type: 'kw', q: 'claude code plugin' },
  { type: 'kw', q: 'claude code subagent' },
];

// ── proje alaka anahtarları (ağırlıklı) ─────────────────────
const KEYWORDS = [
  // kalkaninfo çekirdek (yüksek)
  ['seo', 3], ['local business', 3], ['google business', 3], ['gbp', 3], ['maps', 2],
  ['restaurant', 3], ['tourism', 2], ['travel', 2], ['hospitality', 2],
  ['social media', 3], ['instagram', 3], ['facebook', 2], ['whatsapp', 2],
  ['content', 2], ['copywriting', 2], ['newsletter', 1], ['review', 2],
  ['marketing', 2], ['agency', 2], ['lead', 2], ['crm', 1],
  ['turkish', 3], ['i18n', 1], ['translation', 2], ['multilingual', 2],
  ['automation', 2], ['scheduler', 1], ['cron', 1], ['workflow', 1],
  // görsel/medya (orta)
  ['image', 2], ['video', 2], ['reels', 2], ['photo', 2], ['design', 1], ['screenshot', 1],
  // Aeternum / oyun (orta)
  ['game', 2], ['unreal', 2], ['three.js', 2], ['threejs', 2], ['gamedev', 2], ['3d', 1],
  // altyapı (düşük ama faydalı)
  ['mcp', 1], ['scraping', 1], ['pdf', 1], ['excel', 1], ['sqlite', 1], ['supabase', 1], ['vercel', 1],
];

const KW_RE = KEYWORDS.map(([w, wt]) => [new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), w, wt]);

// ── GitHub arama ────────────────────────────────────────────
function ghSearch(query, limit = 40) {
  const fields = 'fullName,description,stargazersCount,updatedAt,createdAt,url,license,isArchived,isFork';
  let cmd;
  if (query.type === 'topic') {
    cmd = `gh search repos --topic ${JSON.stringify(query.q)} --sort updated --limit ${limit} --json ${fields}`;
  } else {
    cmd = `gh search repos ${JSON.stringify(query.q)} --sort updated --limit ${limit} --json ${fields}`;
  }
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) {
    return [];
  }
}

// ── alaka skoru ─────────────────────────────────────────────
function relevance(repo) {
  const text = `${repo.fullName} ${repo.description || ''}`.toLowerCase();
  let score = 0; const hits = [];
  for (const [re, w, wt] of KW_RE) {
    if (re.test(text)) { score += wt; hits.push(w); }
  }
  // kalite sinyalleri
  if (repo.stargazersCount >= 50) score += 2;
  else if (repo.stargazersCount >= 10) score += 1;
  return { score, hits };
}

// ── seen store ──────────────────────────────────────────────
function loadSeen() { try { return JSON.parse(readFileSync(SEEN_PATH, 'utf8')); } catch { return {}; } }
function saveSeen(seen) { writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 0), 'utf8'); }

// ── ana ─────────────────────────────────────────────────────
function build(a) {
  const cutoff = Date.now() - a.days * 86400e3;
  const byRepo = new Map();
  for (const q of QUERIES) {
    for (const r of ghSearch(q)) {
      if (!r || !r.fullName || r.isArchived || r.isFork) continue;
      const pushed = Date.parse(r.updatedAt || r.createdAt || 0);
      if (pushed && pushed < cutoff) continue;
      if ((r.stargazersCount || 0) < a.minStars) continue;
      if (!byRepo.has(r.fullName)) byRepo.set(r.fullName, r);
    }
  }
  const seen = loadSeen();
  let cands = [];
  for (const r of byRepo.values()) {
    const { score, hits } = relevance(r);
    if (score <= 0) continue;                 // alakasızları at
    const isNew = !seen[r.fullName];
    if (!a.all && !isNew) continue;           // sadece yeni (varsayılan)
    cands.push({
      repo: r.fullName, url: r.url, stars: r.stargazersCount || 0,
      updated: (r.updatedAt || '').slice(0, 10),
      license: (r.license && (r.license.key || r.license.name)) || 'yok/bilinmiyor',
      desc: (r.description || '').slice(0, 160),
      score, matched: hits, isNew,
    });
  }
  cands.sort((x, y) => y.score - x.score || y.stars - x.stars);
  cands = cands.slice(0, a.top);

  // seen güncelle (taranan HER repo işaretlenir ki bir daha "yeni" görünmesin)
  if (a.save) {
    for (const r of byRepo.values()) {
      if (!seen[r.fullName]) seen[r.fullName] = { firstSeen: new Date(Date.parse(r.updatedAt || Date.now())).toISOString().slice(0, 10), stars: r.stargazersCount || 0 };
    }
    saveSeen(seen);
  }
  return { candidates: cands, meta: { scanned: byRepo.size, days: a.days, newOnly: !a.all, seenTotal: Object.keys(seen).length } };
}

// ── markdown digest ─────────────────────────────────────────
function toMd(out) {
  const esc = v => v == null ? '' : String(v).replace(/\|/g, '/');
  let md = '# Claude Skill Radar — Günlük Digest\n\n';
  md += `> Tarandı: ${out.meta.scanned} repo (son ${out.meta.days} gün). ${out.meta.newOnly ? 'Sadece YENİ + alakalı.' : 'Hepsi.'} Toplam takip: ${out.meta.seenTotal}.\n`;
  md += `> ⚠️ Bu liste KEŞİFTİR — hiçbir şey kurulmadı. Kurulum senin onayınla.\n\n`;
  if (!out.candidates.length) { md += '_Bu taramada yeni alakalı skill yok._\n'; return md; }
  md += '| Alaka | Repo | ★ | Lisans | Ne işe yarar | Eşleşen |\n|--|--|--|--|--|--|\n';
  for (const c of out.candidates) {
    md += `| ${c.score} | [${esc(c.repo)}](${c.url}) | ${c.stars} | ${esc(c.license)} | ${esc(c.desc)} | ${c.matched.slice(0, 5).join(', ')} |\n`;
  }
  md += '\n**Kurulum (onayınla):** `gh repo clone <repo>` → içeriği incele → `~/.claude/skills/` veya `agents/`\'a kopyala. Hook/script içeren repolarda önce kodu oku.\n';
  return md;
}

// ── telegram digest (kompakt, düz metin, <4096) ─────────────
function toTelegram(out) {
  const lines = [];
  lines.push('🛰️ Claude Skill Radar');
  lines.push(`Tarandı ${out.meta.scanned} repo · ${out.candidates.length} yeni alakalı`);
  lines.push('(Keşif — kurulum onayınla)');
  lines.push('');
  if (!out.candidates.length) { lines.push('Bu taramada yeni alakalı skill yok.'); }
  for (const c of out.candidates.slice(0, 8)) {
    lines.push(`⭐${c.score} ${c.repo} (${c.stars}★, ${c.license})`);
    if (c.desc) lines.push(`   ${c.desc}`);
    lines.push(`   ${c.url}`);
  }
  let s = lines.join('\n');
  if (s.length > 3900) s = s.slice(0, 3880) + '\n…';
  return s;
}

// ── çalıştır ────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const result = build(args);
const output = args.fmt === 'json' ? JSON.stringify(result, null, 2)
  : args.fmt === 'telegram' ? toTelegram(result)
  : toMd(result);
if (args.out) { writeFileSync(args.out, output, 'utf8'); console.error(`✓ yazıldı: ${args.out}`); }
else process.stdout.write(output + '\n');
