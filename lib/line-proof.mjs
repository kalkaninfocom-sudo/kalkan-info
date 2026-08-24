/**
 * lib/line-proof.mjs — İŞLETME SİSTEMİ PROVA ARAÇ SETİ (Katman 2 ortak zemin)
 * ---------------------------------------------------------------------------
 * Haber ajansında kanıtlanan "prova/nöbetçi" deseni (gazete-heartbeat) her üretim hattına
 * uygulanabilir olsun diye çekirdek primitifleri buraya çıkarır. Yeni bir işletme sistemi
 * (envanter, rezervasyon, güven...) eklemek = registry'ye satır + burada hazır kontroller.
 *
 * İlke: mtime GÜVENİLMEZ (git checkout sıfırlar) → tazelik İÇERİK tarih alanından ölçülür.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** .env.local'i process.env'e yükle (yerelde; CI'da zaten dolu). Bir kez çağır. */
export function loadEnvLocal(root) {
  try {
    for (const l of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
}

/** İçerik tarih alanından gün-yaşı (mtime değil). Yoksa Infinity. */
export function contentAgeDays(root, rel, fields = ['generated_at', 'updated', 'date', 'decided_at', 'created_at']) {
  try {
    const j = JSON.parse(readFileSync(join(root, rel), 'utf8'));
    const meta = j._meta || j;
    for (const f of fields) {
      const v = j[f] ?? meta[f];
      if (v) { const t = Date.parse(v); if (!isNaN(t)) return (Date.now() - t) / 86400000; }
    }
  } catch {}
  return Infinity;
}

export const fmtAge = (d) => (d === Infinity ? '?' : d < 1 ? `${Math.round(d * 24)}sa önce` : `${d.toFixed(1)}g önce`);

/**
 * TAZELİK KONTROLÜ: hat beklenen pencerede çıktı üretti mi?
 * @returns {{name,ok,critical,detail}}
 */
export function freshnessCheck({ root, name, file, fields, maxAgeDays, critical = true }) {
  if (!existsSync(join(root, file))) return { name, ok: false, critical, detail: `çıktı dosyası yok: ${file}` };
  const age = contentAgeDays(root, file, fields);
  if (age === Infinity) return { name, ok: false, critical, detail: `tarih okunamadı (${file}) — bozuk/eksik alan` }; // kritik hattın alarmı yutulmasın
  const ok = age <= maxAgeDays;
  return { name, ok, critical, detail: ok ? `taze (${fmtAge(age)})` : `BAYAT: ${fmtAge(age)} (beklenen ≤${maxAgeDays}g) → cron/token kontrol` };
}

/**
 * Supabase social_posts tazeliği (efemeral çıktılı hatlar: reel/bülten/ilan).
 * Anahtar yoksa GRACEFUL: {ok:true, detail:'izlenemiyor'} — YANLIŞ ALARM ÜRETMEZ.
 * @returns {Promise<{name,ok,critical,detail}>}
 */
export async function supabasePackCheck({ name, packPrefix, maxAgeDays, critical = true }) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { name, ok: true, critical: false, detail: 'izlenemiyor (Supabase anahtarı yok)' };
  try {
    const q = `${url}/rest/v1/social_posts?content_pack_id=like.${packPrefix}*&order=created_at.desc&limit=1&select=created_at,content_pack_id`;
    const r = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { name, ok: false, critical: false, detail: `Supabase HTTP ${r.status}` };
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return { name, ok: false, critical, detail: `hiç kayıt yok (${packPrefix}*)` };
    const age = (Date.now() - Date.parse(rows[0].created_at)) / 86400000;
    const ok = age <= maxAgeDays;
    return { name, ok, critical, detail: ok ? `taze (${fmtAge(age)})` : `BAYAT: ${fmtAge(age)} (beklenen ≤${maxAgeDays}g)` };
  } catch (e) { return { name, ok: false, critical: false, detail: `Supabase hata: ${String(e.message).slice(0, 50)}` }; }
}

/** Telegram bildirimi (env yoksa sessiz). */
export async function sendTelegram(text) {
  const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!TG || !CHAT) { console.log('ℹ Telegram env yok — bildirim atlandı.'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15000),
    });
  } catch (e) { console.log('⚠ Telegram hata:', e.message); }
}

/** Dış dead-man's-switch ping (Healthchecks.io/Cronitor). Non-blocking. */
export async function pingHealthcheck(base, ok) {
  if (!base) return;
  const url = ok ? base : `${base.replace(/\/$/, '')}/fail`;
  try { await fetch(url, { signal: AbortSignal.timeout(10000) }); } catch {}
}

/** İkon: ok=✅ · kritik-fail=🔴 · uyarı=🟡 */
export const proofIcon = (c) => (c.ok ? '✅' : c.critical ? '🔴' : '🟡');

export default { loadEnvLocal, contentAgeDays, fmtAge, freshnessCheck, supabasePackCheck, sendTelegram, pingHealthcheck, proofIcon };
