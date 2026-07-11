#!/usr/bin/env node
/**
 * scripts/agency/telegram-bot.mjs — TELEGRAM KOMUT BOTU (Berkay telefondan yönetsin)
 * ---------------------------------------------------------------------------------------------
 * Berkay bilgisayar başında olmadan telefonundan Telegram'a yazıp ajansı yönetebilsin:
 *   /liste          → sepeti göster (basket-publish --list)
 *   /yayinla <id>   → içeriği yayınla (basket-publish --id <id>)
 *   /reddet <id>    → içeriği reddet (basket-publish --id <id> --reject)
 *   /durum          → always-on servis durumu + sepet sayısı + son hasat zamanı
 *   /brifing        → 28 ajan brifingini ARKA PLANDA çalıştır (bitince motor bildirir)
 *   /guncelle       → git pull + npm install (önce ONAY ister: "/guncelle onayla")
 *   /yardim         → komut listesi
 *   (serbest metin) → Kalkan İnfo asistanı olarak cheapLLM ile cevap
 *
 * Mimari: POLLING (webhook değil) — her 3 sn getUpdates. offset ile her mesaj bir kez işlenir.
 * Güvenlik: SADECE TELEGRAM_ADMIN_CHAT_ID'den gelen mesajlara cevap verir.
 * Hata-güvenli: her komut try/catch; bot asla çökmez. Uzun çıktı 4000 karakter chunk'a bölünür.
 *
 * Kullanım: node scripts/agency/telegram-bot.mjs   (systemd: kalkan-telegram-bot)
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ─── .env.local yükle (SuperComputer'da env zaten dolu olabilir; ikisi de çalışır) ───
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) for (const l of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.CHEAP_LLM_ORDER = process.env.CHEAP_LLM_ORDER || 'routellm,groq,cerebras,nvidia,gemini,claude';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '');
const API = `https://api.telegram.org/bot${TOKEN}`;
const POLL_MS = 3000;
const CMD_TIMEOUT = 10 * 60_000; // 10 dk

// --selftest "<mesaj>" → komutu bir kez çalıştır, cevabı Telegram yerine STDOUT'a yaz (Berkay'a spam yok).
const SELFTEST = process.argv.includes('--selftest');
const SELFTEST_MSG = (() => { const i = process.argv.indexOf('--selftest'); return i >= 0 ? (process.argv[i + 1] || '/yardim') : null; })();

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const log = (...a) => console.log(`[${now()}]`, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

if (!TOKEN || !ADMIN) {
  console.error('✗ TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID yok — .env.local kontrol et.');
  process.exit(1);
}

// /guncelle için basit onay durumu (in-memory).
let updatePending = false;

// ─── Telegram yardımcıları ───
function chunk(text, limit = 4000) {
  const out = [];
  let buf = '';
  for (const line of String(text || '').split('\n')) {
    if (line.length > limit) {
      if (buf) { out.push(buf); buf = ''; }
      for (let i = 0; i < line.length; i += limit) out.push(line.slice(i, i + limit));
      continue;
    }
    if ((buf + (buf ? '\n' : '') + line).length > limit) { out.push(buf); buf = line; }
    else buf += (buf ? '\n' : '') + line;
  }
  if (buf) out.push(buf);
  return out.length ? out : [''];
}

async function send(text, opts = {}) {
  if (SELFTEST) { console.log('─── BOT CEVABI ───\n' + text + '\n──────────────────'); return; }
  for (const c of chunk(text)) {
    try {
      await fetch(`${API}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN, text: c, disable_web_page_preview: true, ...opts }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) { log('⚠ send hata:', e.message); }
    await sleep(300);
  }
}

// Bir node script'i senkron çalıştır, stdout'u string döndür (hata-güvenli).
function runNode(script, args = []) {
  try {
    return execFileSync('node', [join(ROOT, script), ...args], {
      cwd: ROOT, env: process.env, timeout: CMD_TIMEOUT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    // execFileSync hata kodunda fırlatır ama stdout yine de dolu olabilir.
    const out = (e.stdout || '') + (e.stderr ? `\n[stderr] ${e.stderr}` : '');
    return out || `⚠ komut hatası: ${e.message}`;
  }
}

// ─── Sepet / durum yardımcıları ───
function readJson(rel, fb) { try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return fb; } }

function pendingCount() {
  let pend = 0, held = 0;
  for (const sc of ['kalkan', 'kas', 'bolge']) {
    const b = readJson(`data/agency/sepet/${sc}.json`, { items: [] });
    for (const it of (b.items || [])) {
      const s = it.status || 'pending';
      if (s === 'pending') pend++; else if (s === 'hold') held++;
    }
  }
  return { pend, held };
}

function serviceStatus(name) {
  try {
    const active = execFileSync('systemctl', ['is-active', name], { encoding: 'utf8' }).trim();
    let since = '';
    try {
      const show = execFileSync('systemctl', ['show', name, '--property=ActiveEnterTimestamp', '--value'],
        { encoding: 'utf8' }).trim();
      since = show || '';
    } catch {}
    return { active, since };
  } catch (e) {
    const active = (e.stdout || '').trim() || 'bilinmiyor';
    return { active, since: '' };
  }
}

// Sepet dosyalarının en son değişiklik zamanı ≈ son hasat zamanı.
function lastHarvestTime() {
  let newest = 0;
  for (const sc of ['kalkan', 'kas', 'bolge']) {
    const b = readJson(`data/agency/sepet/${sc}.json`, null);
    const u = b?.updated || b?._meta?.updated;
    if (u) { const t = Date.parse(u); if (!isNaN(t) && t > newest) newest = t; }
  }
  return newest ? new Date(newest).toISOString().slice(0, 10) : 'bilinmiyor';
}

// ─── Komut işleyicileri ───
const HELP =
  '🤖 <b>Kalkan İnfo Komut Botu</b>\n\n' +
  '/liste — sepetteki bekleyen içerikleri göster\n' +
  '/yayinla &lt;id&gt; — içeriği yayınla\n' +
  '/reddet &lt;id&gt; — içeriği reddet (yayınlama)\n' +
  '/durum — motor durumu + sepet sayısı + son hasat\n' +
  '/brifing — 28 ajan brifingini arka planda başlat\n' +
  '/guncelle — repo güncelle (git pull + npm install; önce onay ister)\n' +
  '/yardim — bu liste\n\n' +
  'Düz metin yazarsan Kalkan İnfo asistanı olarak cevaplarım.';

async function handleCommand(text) {
  const [cmdRaw, ...rest] = text.trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/@.*$/, ''); // /liste@BotName → /liste
  const arg = rest.join(' ').trim();

  switch (cmd) {
    case '/start':
    case '/yardim':
    case '/help':
      await send(HELP, { parse_mode: 'HTML' });
      return;

    case '/liste': {
      await send('📋 Sepet okunuyor…');
      const out = runNode('scripts/agency/basket-publish.mjs', ['--list']);
      await send(out.trim() || '(sepet boş)');
      return;
    }

    case '/yayinla': {
      if (!arg) { await send('Kullanım: /yayinla <id>\n(id\'yi /liste ile bul)'); return; }
      await send(`📤 Yayınlanıyor: ${arg}`);
      const out = runNode('scripts/agency/basket-publish.mjs', ['--id', ...arg.split(/\s+/)]);
      await send(out.trim() || '(çıktı yok)');
      return;
    }

    case '/reddet': {
      if (!arg) { await send('Kullanım: /reddet <id>'); return; }
      await send(`🚫 Reddediliyor: ${arg}`);
      const out = runNode('scripts/agency/basket-publish.mjs', ['--id', ...arg.split(/\s+/), '--reject']);
      await send(out.trim() || '(çıktı yok)');
      return;
    }

    case '/durum': {
      const { pend, held } = pendingCount();
      const eng = serviceStatus('kalkan-always-on');
      const bot = serviceStatus('kalkan-telegram-bot');
      const since = eng.since ? eng.since.replace(/\+.*$/, '').trim() : 'bilinmiyor';
      const msg =
        `📊 <b>Ajans Durumu</b>\n` +
        `• Motor (always-on): <b>${eng.active}</b>${since !== 'bilinmiyor' ? ` (çalışıyor: ${since})` : ''}\n` +
        `• Komut botu: <b>${bot.active}</b>\n` +
        `• Sepet: <b>${pend}</b> hazır${held ? ` · ${held} hassas (⚠ insan onayı)` : ''}\n` +
        `• Son hasat (sepet güncelleme): ${lastHarvestTime()}`;
      await send(msg, { parse_mode: 'HTML' });
      return;
    }

    case '/brifing': {
      // Arka planda çalıştır (spawn detached) — hemen cevap ver, uzun sürer.
      await send('🧠 Brifing başlatıldı (28 ajan, RouteLLM). ~5 dk sürer, bitince motor bildirir.');
      try {
        const child = spawn('node', [join(ROOT, 'scripts/agency/morning-briefing.mjs')], {
          cwd: ROOT, env: process.env, detached: true, stdio: 'ignore',
        });
        child.unref();
      } catch (e) { await send(`⚠ brifing başlatılamadı: ${e.message}`); }
      return;
    }

    case '/guncelle': {
      if (arg.toLowerCase() === 'onayla' && updatePending) {
        updatePending = false;
        await send('⬇️ git pull + npm install çalışıyor…');
        let out = '';
        try {
          out += execFileSync('git', ['pull', '--ff-only'], { cwd: ROOT, env: process.env, timeout: CMD_TIMEOUT, encoding: 'utf8' });
        } catch (e) { out += `git pull hata: ${(e.stdout || '') + (e.stderr || e.message)}`; }
        try {
          out += '\n' + execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, env: process.env, timeout: CMD_TIMEOUT, encoding: 'utf8' }).slice(-400);
        } catch (e) { out += `\nnpm install hata: ${(e.stderr || e.message)?.slice(-300)}`; }
        await send('✅ Güncelleme bitti:\n' + out.trim().slice(-3500));
      } else {
        updatePending = true;
        await send('⚠️ git pull + npm install yapılacak (repo güncellenecek).\nOnaylıyorsan yaz: <b>/guncelle onayla</b>', { parse_mode: 'HTML' });
      }
      return;
    }

    default:
      // Bilinmeyen /komut → yardım.
      if (cmd.startsWith('/')) { await send(`Bilinmeyen komut: ${cmd}\n\n${HELP}`, { parse_mode: 'HTML' }); return; }
      // Buraya düşmez (serbest metin ayrı ele alınır) ama güvenlik için:
      await handleFreeText(text);
  }
}

// ─── Serbest metin → Kalkan İnfo asistanı ───
async function handleFreeText(text) {
  // Sepet/haber/yayın niyeti içeriyorsa (substring) komuta yönlendir — spec: 'sepet','haber','yayınla' içeriyorsa.
  if (/(sepet|liste|bekleyen|haber)/i.test(text)) { await send('📋 Sepetteki bekleyen içerikleri görmek için /liste yaz.'); return; }
  if (/(yayınla|yayinla|onayla)/i.test(text)) { await send('📤 Yayınlamak için: /yayinla <id> (id\'yi /liste ile bul).'); return; }
  if (/(durum|motor|çalışıyor mu|calisiyor mu)/i.test(text)) { await send('📊 Motor durumu için /durum yaz.'); return; }

  try {
    const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
    const system =
      'Sen Kalkan İnfo (kalkaninfo.com) ajansının Telegram asistanısın. Kalkan/Kaş/Patara bölgesi, yerel turizm, ' +
      'tarih, lezzet, etkinlik ve gazete/sosyal medya içeriği konusunda kurucuya (Berkay) kısa, net, faydalı yardım edersin. ' +
      'Türkçe, sakin ve dürüst bir dil kullan. Bilmediğini uydurma. Yanıtı kısa tut (en fazla birkaç cümle).';
    const res = await cheapLLM(text, { system, maxTokens: 500, temperature: 0.5, timeoutMs: 45000 });
    await send(res.text || '(boş yanıt)');
  } catch (e) {
    await send(`⚠ şu an cevap üretemedim: ${String(e.message).slice(0, 120)}`);
  }
}

// ─── Mesaj yönlendirici ───
async function processMessage(msg) {
  const chatId = String(msg.chat?.id || '');
  const text = msg.text || '';
  if (chatId !== ADMIN) { log(`⛔ yetkisiz chat ${chatId} — yok sayıldı`); return; } // GÜVENLİK
  if (!text.trim()) return;
  log(`◀ mesaj: ${text.slice(0, 80)}`);
  try {
    if (text.trim().startsWith('/')) await handleCommand(text);
    else await handleFreeText(text);
  } catch (e) {
    log('⚠ işleme hata:', e.message);
    try { await send(`⚠ komut işlenirken hata: ${String(e.message).slice(0, 140)}`); } catch {}
  }
}

// ─── Polling döngüsü ───
async function main() {
  // Selftest: tek komutu çalıştır, çık (canlı polling başlatma, Telegram'a gönderme yok).
  if (SELFTEST) {
    console.log(`[selftest] mesaj: ${SELFTEST_MSG}`);
    if (SELFTEST_MSG.trim().startsWith('/')) await handleCommand(SELFTEST_MSG);
    else await handleFreeText(SELFTEST_MSG);
    process.exit(0);
  }

  log('═══ TELEGRAM KOMUT BOTU AÇILDI ═══');
  // Başlangıçta bekleyen eski güncellemeleri atla (offset'i sona al).
  let offset = 0;
  try {
    const r = await (await fetch(`${API}/getUpdates?offset=-1&timeout=0`, { signal: AbortSignal.timeout(15000) })).json();
    if (r.ok && r.result?.length) offset = r.result[r.result.length - 1].update_id + 1;
  } catch (e) { log('⚠ ilk getUpdates:', e.message); }

  await send('🟢 Kalkan İnfo komut botu açıldı. /yardim ile komutları gör.');

  for (;;) {
    try {
      const url = `${API}/getUpdates?offset=${offset}&timeout=25`;
      const res = await (await fetch(url, { signal: AbortSignal.timeout(30000) })).json();
      if (res.ok && Array.isArray(res.result)) {
        for (const u of res.result) {
          offset = u.update_id + 1;
          if (u.message) await processMessage(u.message);
        }
      }
    } catch (e) {
      log('⚠ poll hata (devam):', e.message);
      await sleep(POLL_MS);
    }
    await sleep(POLL_MS);
  }
}

main().catch(e => { console.error('[telegram-bot] ölümcül:', e); process.exit(1); });
