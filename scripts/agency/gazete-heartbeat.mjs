#!/usr/bin/env node
/**
 * scripts/agency/gazete-heartbeat.mjs — GÜNLÜK GAZETE "BUGÜN SAYI ÇIKTI MI?" NÖBETİ
 * ---------------------------------------------------------------------------------
 * Boşluk G1: gazete-approval.yml sessizce fail olursa (LLM/Remotion/build patlar, push
 * atlanır) kimse fark etmiyordu — health-check.yml sadece "4+ gündür üretim yok" der (gevşek).
 * Bu script gazete-approval.yml'in SON adımı olarak koşar ve O GÜNE ait sayının GERÇEKTEN
 * üretildiğini doğrular. Eksikse → Telegram ALARM + exit 1 (job kırmızı olur = ikinci sinyal).
 * Sağlamsa → opsiyonel Healthchecks.io/Cronitor ping (dış dead-man's-switch: workflow HİÇ
 * çalışmazsa o servis alarm verir).
 *
 * Kapsam: VARLIK doğrular (sayı basıldı mı), KALİTE değil (o content-critic'in işi).
 *
 * Kullanım: node scripts/agency/gazete-heartbeat.mjs [--date=YYYY-MM-DD] [--verbose]
 *   exit 0 = sayı yerinde · exit 1 = kritik eksik (alarm gönderildi)
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID (alarm), HEALTHCHECK_URL (ops. ping)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
try { for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); } } catch {}

const argDate = (process.argv.find(a => a.startsWith('--date=')) || '').split('=')[1];
const VERBOSE = process.argv.includes('--verbose');
const today = argDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

function readJson(rel) { try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return null; } }

/**
 * Bugünkü sayının üretim kanıtlarını topla. [{ name, ok, critical, detail }]
 */
export function checkTodayIssue(date = today) {
  const checks = [];

  // 1) Editöryal içerik bugüne ait ve dolu mu?
  const ed = readJson('data/gazete-today.json');
  if (!ed) checks.push({ name: 'Editöryal', ok: false, critical: true, detail: 'data/gazete-today.json yok/okunamıyor' });
  else if (ed.date !== date) checks.push({ name: 'Editöryal', ok: false, critical: true, detail: `gazete-today.json tarihi ${ed.date || '?'} ≠ bugün ${date}` });
  else if (!ed.lead_headline || !String(ed.lead_headline).trim()) checks.push({ name: 'Editöryal', ok: false, critical: true, detail: 'gazete-today.json bugüne ait ama manşet BOŞ (boş sayı riski)' });
  else checks.push({ name: 'Editöryal', ok: true, critical: true, detail: `manşet: "${String(ed.lead_headline).slice(0, 48)}…"` });

  // 2) TR ana sayfalar diske yazıldı mı?
  for (const type of ['morning', 'magazine']) {
    const rel = `newspaper/archive/${date}/${type}.html`;
    const ok = existsSync(join(ROOT, rel));
    checks.push({ name: `${type}.html`, ok, critical: true, detail: ok ? 'üretildi' : `EKSİK: ${rel}` });
  }

  // 3) Arşiv index bugünü içeriyor mu? (ana sayfa kartı buradan)
  const idx = readJson('data/newspaper-index.json');
  const hasToday = !!idx && JSON.stringify(idx).includes(date);
  checks.push({ name: 'Index', ok: hasToday, critical: true, detail: hasToday ? 'index bugünü içeriyor' : `newspaper-index.json'da ${date} yok` });

  // 4) Çeviri sayfaları VAR MI (dosya varlığı — uyarı; TR akışı korunur)
  const missLang = ['en', 'de', 'ru', 'fr'].filter(l => !existsSync(join(ROOT, `newspaper/archive/${date}/morning.${l}.html`)));
  checks.push({ name: 'Çeviri dosyaları', ok: missLang.length === 0, critical: false, detail: missLang.length ? `eksik dil: ${missLang.join(',')}` : '5 dil tam' });

  // 5) Çeviri GERÇEKTEN yapıldı mı? (Berkay: "5 dilde görünüyor ama haber TR")
  // Manşet TEK BAŞINA yanıltıcı: özel-isim başlık ("23. Likya Su Yolu Yürüyüşü") diller arası aynı
  // kalabilir → yanlış alarm. Bu yüzden manşet VE deck (cümle) İKİSİ de TR ile birebir aynıysa
  // "gerçekten çevrilmemiş" say. Deck bir cümle olduğundan çevrildiyse kesin farklılaşır.
  const grab = (rel, cls) => { try { return (readFileSync(join(ROOT, rel), 'utf8').match(new RegExp(`class="${cls}">([^<]{4,})`, 'i')) || [])[1]?.trim() || ''; } catch { return ''; } };
  const trLead = grab(`newspaper/archive/${date}/morning.html`, 'lead-headline');
  const trDeck = grab(`newspaper/archive/${date}/morning.html`, 'lead-deck');
  if (trLead) {
    const untranslated = ['en', 'de', 'ru', 'fr'].filter(l => {
      const h = grab(`newspaper/archive/${date}/morning.${l}.html`, 'lead-headline');
      const d = grab(`newspaper/archive/${date}/morning.${l}.html`, 'lead-deck');
      const headSame = h && h === trLead;
      const deckSame = trDeck ? (d && d === trDeck) : true; // deck yoksa yalnız başlığa düş
      return headSame && deckSame; // ikisi de TR → çeviri çökmüş
    });
    checks.push({ name: 'Çeviri içeriği', ok: untranslated.length === 0, critical: true,
      detail: untranslated.length ? `TR içerikle yayınlanan dil(ler): ${untranslated.join(',')} — çeviri çökmüş (rate-limit/kota)` : 'diller gerçekten çevrildi' });
  }

  // 6) BASKI PROVASI — "tek harf hatası olmadan": tüm sayfalarda dizgi kusuru tara.
  //    (a) {{placeholder}} sızıntısı = şablon dolmamış (dizgi hatası), (b) sayfa gövdesiz/kırık.
  const pages = [];
  for (const type of ['morning', 'magazine']) for (const l of ['', 'en', 'de', 'ru', 'fr']) {
    pages.push(`newspaper/archive/${date}/${type}${l ? '.' + l : ''}.html`);
  }
  const leaks = [], broken = [];
  let scanned = 0;
  for (const rel of pages) {
    let html; try { html = readFileSync(join(ROOT, rel), 'utf8'); } catch { continue; } // yoksa üstteki varlık kontrolü yakalar
    scanned++;
    if (/\{\{\s*\w+\s*\}\}/.test(html)) leaks.push(rel.split('/').pop());           // doldurulmamış placeholder
    if (!/<\/html>/i.test(html) || html.length < 2000) broken.push(rel.split('/').pop()); // gövdesiz/yarım render
  }
  checks.push({ name: 'Baskı provası', ok: leaks.length === 0 && broken.length === 0, critical: true,
    detail: (leaks.length || broken.length)
      ? `${leaks.length ? 'dizgi sızıntısı {{}}: ' + leaks.join(',') : ''}${leaks.length && broken.length ? ' · ' : ''}${broken.length ? 'kırık/eksik sayfa: ' + broken.join(',') : ''}`
      : (scanned ? `${scanned}/${pages.length} sayfa temiz (placeholder/kırık yok)` : 'sayfa yok — prova için üretim bekleniyor') });

  return checks;
}

async function sendTelegram(text) {
  const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!TG || !CHAT) { console.log('ℹ Telegram env yok — alarm gönderilemedi.'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15000),
    });
  } catch (e) { console.log('⚠ Telegram hata:', e.message); }
}

/** Dış dead-man's-switch ping (Healthchecks.io / Cronitor). Başarısızlık sessiz — non-blocking. */
async function pingHealthcheck(ok) {
  const base = process.env.HEALTHCHECK_URL;
  if (!base) { if (VERBOSE) console.log('ℹ HEALTHCHECK_URL yok — ping atlandı.'); return; }
  const url = ok ? base : `${base.replace(/\/$/, '')}/fail`;
  try { await fetch(url, { signal: AbortSignal.timeout(10000) }); if (VERBOSE) console.log(`✓ ping → ${url}`); }
  catch (e) { console.log('⚠ healthcheck ping hata:', e.message); }
}

async function main() {
  const checks = checkTodayIssue();
  const lines = checks.map(c => `${c.ok ? '✅' : (c.critical ? '🔴' : '🟡')} ${c.name}: ${c.detail}`);
  console.log(`── GAZETE HEARTBEAT (${today}) ──\n` + lines.join('\n'));

  const problems = checks.filter(c => !c.ok && c.critical);
  if (problems.length) {
    await sendTelegram(`🚨 GAZETE ÇIKMADI (${today}) — ${problems.length} kritik eksik\n\n` + lines.join('\n') + '\n\n→ gazete-approval.yml loglarını kontrol et.');
    await pingHealthcheck(false);
    console.log('✗ bugünkü sayı EKSİK');
    process.exit(1);
  }
  await pingHealthcheck(true);
  console.log('✓ bugünkü sayı yerinde');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('[gazete-heartbeat]', e.message); process.exit(1); });
}
