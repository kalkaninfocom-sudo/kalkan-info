#!/usr/bin/env node
/**
 * scripts/agency/health-check.mjs — Ajans SAĞLIK NÖBETİ (Fix #4: kırılganlığı azalt)
 *
 * Canlı sistemi izler, bir şey bozulunca Telegram'dan ALARM verir. Live üretim mantığına DOKUNMAZ (additive).
 * Kontroller: IG token geçerli mi · LLM sağlayıcı yanıt veriyor mu · ajans son N günde üretim yaptı mı ·
 * kritik veri dosyaları yerinde mi. "dadılık" yükünü azaltır — her müşteri pipeline'ını elle kontrol etmek yerine
 * bozulunca haber alırsın.
 *
 * Kullanım: node scripts/agency/health-check.mjs [--always] [--verbose]
 *   varsayılan: sorun VARSA Telegram alarmı + exit 1; her şey iyiyse sessiz + exit 0
 *   --always : sorun olmasa da özet gönder (test/heartbeat)
 * Workflow: .github/workflows/health-check.yml (günlük)
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cheapLLM, availableProviders } from '../../lib/cheap-llm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
try { for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); } } catch {}

// İçerikteki tarih alanından yaş (git checkout mtime'ı sıfırladığı için mtime GÜVENİLMEZ).
function contentAgeDays(rel, fields = ['generated_at', 'date', 'updated']) {
  try {
    const j = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
    const meta = j._meta || j;
    for (const f of fields) {
      const v = j[f] ?? meta[f];
      if (v) { const t = Date.parse(v); if (!isNaN(t)) return (Date.now() - t) / 86400000; }
    }
  } catch {}
  return Infinity;
}

export async function checkIgToken() {
  const tok = process.env.IG_LONG_LIVED_TOKEN, id = process.env.IG_BUSINESS_ID;
  if (!tok || !id) return { ok: false, critical: false, detail: 'IG token/business_id env yok (IG otomasyonları pasif)' };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=id,username&access_token=${tok}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.id) return { ok: true, critical: true, detail: `IG token GEÇERLİ (@${j.username || j.id})` };
    const err = j.error?.message || `HTTP ${r.status}`;
    return { ok: false, critical: true, detail: `IG token GEÇERSİZ/DOLMUŞ: ${String(err).slice(0, 80)} → yenile` };
  } catch (e) { return { ok: false, critical: true, detail: `IG token kontrolü hata: ${e.message}` }; }
}

export async function checkLLM() {
  const provs = availableProviders();
  if (!provs.length) return { ok: false, critical: true, detail: 'HİÇ LLM sağlayıcı anahtarı yok (içerik üretilemez)' };

  // Tercih sırası: gemini ve groq öne al (en güvenilir ücretsiz tier), sonra kalan sağlayıcılar.
  const PREFERRED = ['gemini', 'groq'];
  const order = [
    ...PREFERRED.filter(p => provs.includes(p)),
    ...provs.filter(p => !PREFERRED.includes(p) && p !== 'ollama'),
  ];

  async function attempt() {
    return cheapLLM('OK de.', { maxTokens: 5, timeoutMs: 30000, order });
  }

  try {
    const r = await attempt();
    return { ok: true, critical: true, detail: `LLM çalışıyor (${r.provider}); mevcut: ${provs.join(',')}` };
  } catch (firstErr) {
    // Geçici blip olabilir — 3 saniye bekle, bir kez daha dene.
    await new Promise(res => setTimeout(res, 3000));
    try {
      const r = await attempt();
      return { ok: true, critical: true, detail: `LLM çalışıyor (${r.provider}, retry sonrası); mevcut: ${provs.join(',')}` };
    } catch (secondErr) {
      return { ok: false, critical: true, detail: `LLM sağlayıcı yanıt vermiyor: ${String(secondErr.message).slice(0, 70)}` };
    }
  }
}

export function checkActivity() {
  // Ajans son 4 günde üretim yaptı mı? (içerik tarih alanından — mtime değil)
  const age = Math.min(
    contentAgeDays('data/agency/content-ideas.json'),
    contentAgeDays('data/gazete-today.json'),
    contentAgeDays('data/haberler.json'),
  );
  if (age === Infinity) return { ok: false, critical: false, detail: 'Aktivite tarihi okunamadı (yeni kurulum olabilir)' };
  if (age > 4) return { ok: false, critical: true, detail: `Ajans ${age.toFixed(1)} gündür üretim yapmamış → cron/token kontrol et` };
  return { ok: true, critical: true, detail: `Ajans aktif (son üretim ${age.toFixed(1)} gün önce)` };
}

export function checkData() {
  const missing = ['data/restoranlar.json', 'data/etkinlik-takvimi.json'].filter(p => !existsSync(join(ROOT, p)));
  if (missing.length) return { ok: false, critical: true, detail: `Kritik veri eksik: ${missing.join(', ')}` };
  return { ok: true, critical: false, detail: 'Veri dosyaları yerinde' };
}

/**
 * Tüm sağlık kontrollerini çalıştır → [{ name, ok, critical, detail }]. Control Tower bunu import eder.
 * main() de bunu kullanır — davranış aynı, sadece dışarıdan çağrılabilir.
 */
export async function runHealthChecks() {
  return [
    { name: 'IG Token', ...(await checkIgToken()) },
    { name: 'LLM', ...(await checkLLM()) },
    { name: 'Aktivite', ...checkActivity() },
    { name: 'Veri', ...checkData() },
  ];
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

async function main() {
  const always = process.argv.includes('--always');
  const results = await runHealthChecks();
  const lines = results.map((c) => `${c.ok ? '✅' : (c.critical ? '🔴' : '🟡')} ${c.name}: ${c.detail}`);
  const problems = results.filter((c) => !c.ok && c.critical);
  console.log('── AJANS SAĞLIK ──\n' + lines.join('\n'));

  if (problems.length) {
    await sendTelegram('🚨 AJANS ALARMI — ' + problems.length + ' kritik sorun\n\n' + lines.join('\n'));
    process.exit(1);
  } else if (always) {
    await sendTelegram('✅ Ajans sağlıklı\n\n' + lines.join('\n'));
  }
  console.log(problems.length ? '✗ sorunlu' : '✓ sağlıklı');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('[health-check]', e.message); process.exit(1); });
}
