// scripts/daily-status-report.mjs
// Günlük durum raporu — Berkay'a Telegram'dan "bugün ne yapıldı / ne yarım kaldı / sıradaki ne".
//
// İki kaynak:
//   1. git log --since=midnight  → bugün yapılan commit'ler ("✅ Bugün")
//   2. docs/PROJE_DURUMU.md (yoksa docs/YOL_HARITASI_GAZETE_OTOMASYON.md) durum tablosu
//      → 🔨 (sürüyor) / ⏳ (bekliyor) / ⛔ (bloke) satırları + ▶️ Sıradaki net adım
//
// Çalıştırma:
//   node scripts/daily-status-report.mjs            → raporu üret + Telegram'a gönder
//   node scripts/daily-status-report.mjs --dry-run  → göndermeden ekrana bas
//
// Env: TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID (yoksa graceful → stdout, çökme yok).
//
// NOT: git log yalnızca repo'nun bulunduğu makinede (PC) çalışır. Vercel serverless'ta
// git yoktur — bu yüzden cron tarafı (api/cron-rebuild?job=daily-status) yalnızca yol
// haritası bölümünü gönderir. "Bugün yapılanlar" için bu scripti PC'de zamanla (bkz. docs/GUNLUK_RAPOR.md).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DOC_CANDIDATES = [
  'docs/PROJE_DURUMU.md',
  'docs/YOL_HARITASI_GAZETE_OTOMASYON.md',
];

// Türkçe-güvenli küçük harf (İ→i, I→ı).
function norm(s) {
  return String(s ?? '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}

// Hücreden markdown süsünü (bold/inline-code) ve marker emojileri temizle.
function cleanCell(s) {
  return String(s ?? '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/⛔/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s, n = 160) {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

// "Canlıya ne lazım" sütunu — boş ya da '—' ise (gereksinim yok) ek metin koyma.
function needSuffix(canli) {
  const c = cleanCell(canli);
  if (!c || /^—/.test(c) || c === '-') return '';
  return ` — ${truncate(c, 120)}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function trDate() {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Bugünkü commit'ler (yerel gece yarısından beri). Repo/git yoksa null döner.
function todaysCommits() {
  // execFileSync: shell devre dışı → Windows cmd.exe '|' ve '%' karakterlerini bozmaz.
  try {
    const out = execFileSync('git', ['log', '--since=midnight', '--pretty=format:%h %s'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return [];
    return out.split(/\r?\n/).map((l) => {
      const i = l.indexOf(' ');
      return i === -1 ? { hash: '', subject: l } : { hash: l.slice(0, i), subject: l.slice(i + 1) };
    });
  } catch {
    return null; // git yok / repo değil
  }
}

// Durum tablosunu ve "Sıradaki" bölümünü ayrıştır.
function parseRoadmap() {
  let md = null;
  let usedDoc = null;
  for (const rel of DOC_CANDIDATES) {
    try {
      md = readFileSync(path.join(ROOT, rel), 'utf8');
      usedDoc = rel;
      break;
    } catch { /* sıradakini dene */ }
  }
  if (md == null) return { usedDoc: null, surulen: [], bekleyen: [], bloke: [], siradaki: [] };

  const lines = md.split(/\r?\n/);
  const surulen = [], bekleyen = [], bloke = [], siradaki = [];

  // --- Tablo satırları ---
  // Birden çok tablo + farklı kolon düzeni var (PROJE_DURUMU çok-tablo, YOL_HARITASI tek-tablo).
  // Her tablonun başlık satırından ("... | Durum | ... | Canlıya ne lazım |") kolon
  // index'lerini çıkar; yalnızca 'Durum' kolonu olan tablolar işlenir. Özet "BLOKE"
  // tablosunda Durum yok → atlanır (her bölümdeki ⛔ satırları zaten yakalanıyor, çift sayım yok).
  let colMap = null; // { is, durum, need }
  const isSeparator = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '');

  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('|')) { colMap = null; continue; } // tablo bitti → harita sıfırla
    const cells = t.split('|').slice(1, -1).map((c) => c.trim()); // baş/son boşları at
    if (isSeparator(cells)) continue;

    const lowered = cells.map(norm);
    const durumIdx = lowered.indexOf('durum');
    if (durumIdx !== -1) {
      // Başlık satırı → kolon haritası kur.
      let isIdx = lowered.findIndex((c) => c === 'iş' || c.includes('iş'));
      if (isIdx === -1) isIdx = 0;
      colMap = { is: isIdx, durum: durumIdx, need: lowered.findIndex((c) => c.includes('canlı')) };
      continue;
    }
    if (!colMap) continue; // Durum'suz tablo (ör. özet BLOKE) → atla

    const is = cleanCell(cells[colMap.is] ?? '');
    const durum = cells[colMap.durum] ?? '';
    const need = colMap.need !== -1 ? (cells[colMap.need] ?? '') : '';
    if (!is) continue;

    if (durum.includes('✅')) continue; // biten
    if (durum.includes('⛔')) bloke.push(`${is}${needSuffix(need)}`);
    else if (durum.includes('🔨')) surulen.push(`${is}${needSuffix(need)}`);
    else if (durum.includes('⏳')) bekleyen.push(`${is}${needSuffix(need)}`);
  }

  // --- "▶️ SIRADAKİ NET ADIM" bölümü ---
  const startIdx = lines.findIndex((l) => /SIRADAK/i.test(l) && l.trim().startsWith('#'));
  if (startIdx !== -1) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('## ') || t.startsWith('# ')) break; // sonraki başlık
      const m = t.match(/^(?:\d+\.|[-*])\s+(.*)$/);
      if (m && m[1]) siradaki.push(truncate(cleanCell(m[1]), 180));
    }
  }

  return { usedDoc, surulen, bekleyen, bloke, siradaki };
}

// HTML formatlı rapor (Telegram parse_mode: HTML) üret.
export function buildReport({ includeGit = true } = {}) {
  const date = trDate();
  const road = parseRoadmap();
  const commits = includeGit ? todaysCommits() : null;

  const L = [];
  L.push(`<b>📊 Kalkan Info — Günlük Durum</b>`);
  L.push(`<i>${escapeHtml(date)}</i>`);
  L.push('');

  // ✅ Bugün
  L.push(`<b>✅ Bugün yapılanlar</b>`);
  if (!includeGit) {
    L.push('• <i>git özeti bu raporda yok (sunucu) — tam liste 00:00 PC raporunda</i>');
  } else if (commits === null) {
    L.push('• <i>git geçmişi okunamadı (repo/git yok)</i>');
  } else if (commits.length === 0) {
    L.push('• Bugün commit yok.');
  } else {
    for (const c of commits.slice(0, 20)) {
      L.push(`• ${c.hash ? `<code>${escapeHtml(c.hash)}</code> ` : ''}${escapeHtml(c.subject)}`);
    }
    if (commits.length > 20) L.push(`• …(+${commits.length - 20} commit daha)`);
  }
  L.push('');

  // Listeyi madde-madde, en fazla `cap` satır ("+N daha") ile döşe.
  const bullets = (arr, cap = 12) => {
    if (!arr.length) { L.push('• Yok.'); return; }
    arr.slice(0, cap).forEach((x) => L.push(`• ${escapeHtml(x)}`));
    if (arr.length > cap) L.push(`• …(+${arr.length - cap} daha)`);
  };

  // 🔨 Yarım / sürüyor
  L.push(`<b>🔨 Yarım / sürüyor</b>`);
  bullets(road.surulen);
  L.push('');

  // ⏳ Bekleyen (varsa)
  if (road.bekleyen.length) {
    L.push(`<b>⏳ Bekleyen</b>`);
    bullets(road.bekleyen);
    L.push('');
  }

  // ⛔ Bloke
  L.push(`<b>⛔ Bloke</b>`);
  bullets(road.bloke);
  L.push('');

  // ▶️ Sıradaki
  L.push(`<b>▶️ Sıradaki</b>`);
  if (road.siradaki.length) road.siradaki.slice(0, 5).forEach((x) => L.push(`• ${escapeHtml(x)}`));
  else L.push('• Yol haritasında net adım yok.');

  if (!road.usedDoc) {
    L.push('');
    L.push('<i>(durum dokümanı bulunamadı — yalnızca git özeti)</i>');
  }

  return L.join('\n');
}

function htmlToPlain(html) {
  return html
    .replace(/<\/?b>/g, '')
    .replace(/<\/?i>/g, '')
    .replace(/<\/?code>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const report = buildReport({ includeGit: true });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (dryRun || !token || !chat) {
    if (!dryRun && (!token || !chat)) {
      console.error('[daily-status] TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID yok → stdout (graceful).');
    }
    console.log(htmlToPlain(report));
    return;
  }

  try {
    const { sendMessage } = await import('../lib/telegram.js');
    await sendMessage(chat, report, { parse_mode: 'HTML' });
    console.log('[daily-status] Telegram raporu gönderildi.');
  } catch (err) {
    console.error('[daily-status] gönderim hatası:', err.message);
    console.log(htmlToPlain(report));
    process.exitCode = 1;
  }
}

// Doğrudan çalıştırıldıysa main; import edildiyse yalnızca buildReport export edilir.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
