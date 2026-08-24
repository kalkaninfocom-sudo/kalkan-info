#!/usr/bin/env node
/**
 * scripts/agency/control-tower.mjs — KALKANINFO DAILY CONTROL TOWER
 * ---------------------------------------------------------------------------
 * Telegram'ı ham agent-output kanalından çıkarıp TEK "karar ekranı"na indirir.
 * YENİ SİSTEM DEĞİL — mevcut çıktı artefaktları + health-check üzerinde salt-okuma
 * aggregation. Hiçbir üretim/pipeline mantığına dokunmaz, hiçbir kaynağa yazmaz
 * (opsiyonel kendi snapshot'ı hariç).
 *
 * Kaynaklar (hepsi mevcut):
 *   - health-check.mjs runHealthChecks()          → SYSTEM HEALTH + DATA AVAILABILITY
 *   - data/agency/content-ideas.json (ideas)      → INTELLIGENCE / TOPICS
 *   - data/agency/content-ideas.json (dropped)    → DUPLICATES
 *   - data/agency/critic-log.json                 → QUALITY WARNINGS
 *   - data/agency/briefing/<date>.json + lines/*  → CONTENT STATUS
 *   - data/satis-takip.json                       → SALES STATUS
 *   - data/agency/today-plan.json (orchestrator)  → TODAY'S PRIORITIES
 *
 * PRENSİP: veri yok/stale → sahte "0/temiz" DEĞİL, açık DATA_UNAVAILABLE.
 *
 * Kullanım:
 *   node scripts/agency/control-tower.mjs         # Telegram'a tek mesaj
 *   node scripts/agency/control-tower.mjs --dry    # sadece stdout (test)
 *   node scripts/agency/control-tower.mjs --no-health  # canlı health atla (hızlı offline test)
 *   node scripts/agency/control-tower.mjs --snapshot   # data/agency/control-tower-<date>.json yaz
 *
 * Workflow: .github/workflows/morning-briefing.yml (brifingden sonra ek adım — bkz. plan).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// .env.local yükle (yerel; CI'da secret dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const DRY = process.argv.includes('--dry');
const NO_HEALTH = process.argv.includes('--no-health');
const SNAPSHOT = process.argv.includes('--snapshot');
const DATE = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); // YYYY-MM-DD

// ── ortak yardımcılar ──────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

/** JSON oku; yoksa/bozuksa null (DATA_UNAVAILABLE sinyali — sahte boş değil). */
function readJson(rel) {
  try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return null; }
}

/** generated_at/date/updated alanından gün-yaşı (mtime GÜVENİLMEZ — git checkout sıfırlar). */
function ageDays(obj, fields = ['generated_at', 'date', 'updated', 'decided_at']) {
  if (!obj) return Infinity;
  const meta = obj._meta || obj;
  for (const f of fields) {
    const v = obj[f] ?? meta[f];
    if (v) { const t = Date.parse(v); if (!isNaN(t)) return (Date.now() - t) / 86400000; }
  }
  return Infinity;
}
const fmtAge = (d) => (d === Infinity ? '?' : d < 1 ? `${Math.round(d * 24)}s` : `${d.toFixed(1)}g`);

// Bir bölüm sonucu: { title, lines[], flag:'ok'|'warn'|'crit'|'unavail' }
const UNAVAIL = (title, reason) => ({ title, lines: [`  ⚠ DATA_UNAVAILABLE (${reason})`], flag: 'unavail' });

// ── 1) SYSTEM HEALTH + 2) DATA AVAILABILITY (health-check reuse) ────────────
async function sectionHealth() {
  if (NO_HEALTH) return { health: UNAVAIL('🩺 SYSTEM HEALTH', 'canlı kontrol atlandı (--no-health)'), data: null, checks: [] };
  const { runHealthChecks } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'health-check.mjs')).href);
  const checks = await runHealthChecks(); // [{name, ok, critical, detail}]
  const icon = (c) => (c.ok ? '✅' : c.critical ? '🔴' : '🟡');
  const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
  const sys = ['IG Token', 'LLM'].map((n) => byName[n]).filter(Boolean);
  const dat = ['Veri', 'Aktivite'].map((n) => byName[n]).filter(Boolean);
  return {
    checks,
    health: {
      title: '🩺 SYSTEM HEALTH',
      lines: sys.map((c) => `  ${icon(c)} ${c.name}: ${c.detail}`),
      flag: sys.some((c) => !c.ok && c.critical) ? 'crit' : sys.some((c) => !c.ok) ? 'warn' : 'ok',
    },
    data: {
      title: '📡 DATA AVAILABILITY',
      lines: dat.map((c) => `  ${icon(c)} ${c.name}: ${c.detail}`),
      flag: dat.some((c) => !c.ok && c.critical) ? 'crit' : dat.some((c) => !c.ok) ? 'warn' : 'ok',
    },
  };
}

// ── GAZETE (bugünkü sayı + baskı provası) — gazete-heartbeat reuse ──────────
// ajansAI orkestrasyon katmanı: gazete kendi adanmış workflow'unda ÜRETİLİR (dokunmayız),
// ama durumu tek karar ekranında görünür olur. Salt-okuma; üretim mantığına dokunmaz.
async function sectionGazete() {
  const { checkTodayIssue } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'gazete-heartbeat.mjs')).href);
  const checks = checkTodayIssue(DATE); // [{name, ok, critical, detail}]
  const icon = (c) => (c.ok ? '✅' : c.critical ? '🔴' : '🟡');
  return {
    title: '📰 GAZETE (bugünkü sayı + prova)',
    lines: checks.map((c) => `  ${icon(c)} ${c.name}: ${c.detail}`),
    flag: checks.some((c) => !c.ok && c.critical) ? 'crit' : checks.some((c) => !c.ok) ? 'warn' : 'ok',
  };
}

// ── 3) INTELLIGENCE / TOPICS + 4) DUPLICATES (content-ideas.json) ───────────
function readIdeas() {
  const ci = readJson('data/agency/content-ideas.json');
  if (!ci) return { ci: null };
  return { ci, age: ageDays(ci) };
}

function sectionTopics(ideasBundle) {
  const { ci, age } = ideasBundle;
  if (!ci) return UNAVAIL('🧠 INTELLIGENCE / TOPICS', 'content-ideas.json yok');
  if (age > 2) return UNAVAIL('🧠 INTELLIGENCE / TOPICS', `brifing bayat (${fmtAge(age)}) — cron/token kontrol`);
  const ideas = Array.isArray(ci.ideas) ? ci.ideas : [];
  if (!ideas.length) return { title: '🧠 INTELLIGENCE / TOPICS', lines: ['  (bugün üretilmiş içerik fikri yok)'], flag: 'warn' };
  const top = ideas.slice(0, 4).map((i) => `  • ${esc(String(i.fikir || i.baslik || '').slice(0, 120))}`);
  return { title: `🧠 INTELLIGENCE / TOPICS (bugün ${ideas.length} fikir)`, lines: top, flag: 'ok' };
}

function sectionDuplicates(ideasBundle) {
  const { ci, age } = ideasBundle;
  if (!ci) return UNAVAIL('♻️ DUPLICATES', 'content-ideas.json yok');
  if (age > 2) return UNAVAIL('♻️ DUPLICATES', `brifing bayat (${fmtAge(age)})`);
  const dropped = Array.isArray(ci.dropped) ? ci.dropped : [];
  if (!dropped.length) return { title: '♻️ DUPLICATES', lines: ['  ✅ elenen tekrar yok'], flag: 'ok' };
  // _neden ön-ekine göre grupla: "benzer" / "kota" / "klişe" / "rol"
  const buckets = { benzer: 0, kota: 0, 'klişe': 0, rol: 0, diger: 0 };
  const ornek = {};
  for (const d of dropped) {
    const n = String(d._neden || '').toLowerCase();
    const key = n.includes('benzer') ? 'benzer' : n.includes('kota') ? 'kota'
      : n.includes('klişe') || n.includes('klise') ? 'klişe' : n.includes('rol') ? 'rol' : 'diger';
    buckets[key]++;
    if (!ornek[key]) ornek[key] = String(d.baslik || d.fikir || '').slice(0, 40);
  }
  const parts = Object.entries(buckets).filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${v}`).join(' · ');
  const eg = ornek.benzer || ornek['klişe'] || ornek.kota || '';
  return {
    title: `♻️ DUPLICATES (elenen ${dropped.length})`,
    lines: [`  ${parts}${eg ? `   [örn: "${esc(eg)}"]` : ''}`],
    flag: dropped.length > ((Array.isArray(ci.ideas) ? ci.ideas.length : 0)) ? 'warn' : 'ok',
  };
}

// ── 5) QUALITY WARNINGS (critic-log.json — runtime, gitignore'da olabilir) ──
function sectionQuality() {
  const log = readJson('data/agency/critic-log.json');
  if (!log) return UNAVAIL('⚠️ QUALITY WARNINGS', 'critic-log.json yok (bugün builder çalışmamış olabilir)');
  const entries = Array.isArray(log.entries) ? log.entries : [];
  const today = entries.filter((e) => String(e.at || '').slice(0, 10) === DATE);
  const scope = today.length ? today : entries.slice(-10); // bugün yoksa son 10
  const hardBlock = scope.filter((e) => e.hardBlock).length;
  const lowScore = scope.filter((e) => e.pass === false && !e.hardBlock).length;
  if (!scope.length) return { title: '⚠️ QUALITY WARNINGS', lines: ['  (kayıt yok)'], flag: 'ok' };
  const lastFail = [...scope].reverse().find((e) => e.pass === false);
  const eg = lastFail ? `  son: "${esc(String((lastFail.issues || [])[0] || lastFail.tip || '').slice(0, 80))}"` : null;
  const label = today.length ? 'bugün' : 'son kayıtlar';
  return {
    title: '⚠️ QUALITY WARNINGS',
    lines: [`  ${label}: hardBlock ${hardBlock} · düşük-puan ${lowScore} (${scope.length} değerlendirme)`, ...(eg ? [eg] : [])],
    flag: hardBlock > 0 ? 'crit' : lowScore > 0 ? 'warn' : 'ok',
  };
}

// ── 6) CONTENT STATUS (briefing count + hat kuyrukları via brand-router) ────
async function sectionContent() {
  const brief = readJson(`data/agency/briefing/${DATE}.json`);
  const briefLine = brief
    ? `  brifing: ${brief.count || (brief.agents || []).length} ajan (${fmtAge(ageDays(brief))})`
    : '  brifing: ⚠ bugünkü sayı yok';
  let queueLine = '  hat kuyrukları: DATA_UNAVAILABLE';
  try {
    const { counts } = await import(pathToFileURL(join(ROOT, 'scripts', 'agency', 'brand-router.mjs')).href);
    const c = counts(); // { kalkaninfo, haber, magazin, tv }
    queueLine = '  kuyruk: ' + Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ');
  } catch { /* brand-router okunamazsa DATA_UNAVAILABLE kalır */ }
  return {
    title: '📦 CONTENT STATUS',
    lines: [briefLine, queueLine],
    flag: brief ? 'ok' : 'warn',
  };
}

// ── 7) SALES STATUS (satis-takip.json — satis-reminder mantığı) ─────────────
const SALES_ETIKET = {
  aranacak: '📞 Aranacak', ulasilamadi: '🔁 Ulaşılamadı', ulasildi: '🗣️ Ulaşıldı',
  'demo-gonderildi': '📤 Demo', ilgilendi: '👀 İlgilendi', 'fiyat-sordu': '💬 Fiyat',
  takip: '🔔 Takip', reddetti: '❌ Reddetti', satis: '✅ SATIŞ',
};
function sectionSales() {
  const data = readJson('data/satis-takip.json');
  if (!data) return UNAVAIL('💼 SALES STATUS', 'satis-takip.json yok');
  const h = Array.isArray(data.hedefler) ? data.hedefler : [];
  if (!h.length) return { title: '💼 SALES STATUS', lines: ['  (satış hedefi yok)'], flag: 'warn' };
  const aranacak = h.filter((x) => x.durum === 'aranacak' || x.durum === 'ulasilamadi').length;
  const takip = h.filter((x) => x.durum === 'takip' && (!x.takipTarih || x.takipTarih <= DATE)).length;
  const sicak = h.filter((x) => ['ilgilendi', 'fiyat-sordu', 'demo-gonderildi'].includes(x.durum)).length;
  const say = {};
  for (const x of h) say[x.durum] = (say[x.durum] || 0) + 1;
  const skor = Object.entries(say).map(([k, v]) => `${SALES_ETIKET[k] || k}: ${v}`).join(' · ');
  return {
    title: '💼 SALES STATUS',
    lines: [`  📞 aranacak ${aranacak} · 🔔 takip ${takip} · 🔥 sıcak ${sicak}`, `  ${skor}`],
    flag: aranacak > 0 || takip > 0 ? 'warn' : 'ok',
    _derive: { aranacak, takip, sicak },
  };
}

// ── 8) TODAY'S PRIORITIES (today-plan.json + türetilmiş) ────────────────────
function sectionPriorities(ctx) {
  const plan = readJson('data/agency/today-plan.json');
  const prios = [];
  // Türetilmiş, kanıta dayalı öncelikler (health/quality/sales)
  const ig = (ctx.checks || []).find((c) => c.name === 'IG Token');
  if (ig && !ig.ok && ig.critical) prios.push('IG token yenile (yayın bloke)');
  if (ctx.qualityFlag === 'crit') prios.push('Kalite HARD-BLOCK içeriğini incele (uydurma/etik)');
  if (ctx.salesDerive && ctx.salesDerive.aranacak > 0) prios.push(`${ctx.salesDerive.aranacak} işletmeyi ara (satış)`);
  // Orchestrator teması (varsa)
  let orchLine = null;
  if (plan && ageDays(plan) <= 2 && Array.isArray(plan.themes) && plan.themes.length) {
    orchLine = `orchestrator (${plan.executed ? 'üretim' : 'önizleme'}): ` +
      plan.themes.map((t) => `${t.label} [${t.lang}]`).join(', ');
    for (const t of plan.themes.slice(0, 2)) prios.push(`Üret/onayla: ${t.label}`);
  }
  const lines = [];
  if (orchLine) lines.push(`  ${esc(orchLine)}`);
  if (prios.length) prios.slice(0, 5).forEach((p, i) => lines.push(`  ${i + 1}. ${esc(p)}`));
  else lines.push('  (bugün kritik öncelik yok)');
  if (!plan) lines.push('  ℹ orchestrator planı yok (today-plan.json DATA_UNAVAILABLE)');
  return { title: "🎯 TODAY'S PRIORITIES", lines, flag: prios.length ? 'warn' : 'ok' };
}

// ── 9) ACTIONS REQUIRED (yalnız gerçek aksiyon) ─────────────────────────────
function sectionActions(sections, ctx) {
  const actions = [];
  for (const s of sections) {
    if (s.flag === 'crit') actions.push(`${s.title.replace(/^[^ ]+ /, '')}: kritik`);
  }
  const ig = (ctx.checks || []).find((c) => c.name === 'IG Token');
  if (ig && !ig.ok && ig.critical) actions.push('IG token yenile');
  if (ctx.salesDerive && ctx.salesDerive.aranacak > 0) actions.push(`${ctx.salesDerive.aranacak} işletme ara`);
  const uniq = [...new Set(actions)];
  return {
    title: '✅ ACTIONS REQUIRED',
    lines: uniq.length ? uniq.map((a) => `  • ${esc(a)}`) : ['  ✅ acil aksiyon yok'],
    flag: uniq.length ? 'warn' : 'ok',
  };
}

// ── Telegram (kendi kendine yeten; 4096 satır-sınırında chunk) ──────────────
function chunkForTelegram(text, limit = 4000) {
  const out = [];
  let buf = '';
  for (const line of String(text || '').split('\n')) {
    if ((buf + (buf ? '\n' : '') + line).length > limit) { if (buf) out.push(buf); buf = line; }
    else buf += (buf ? '\n' : '') + line;
  }
  if (buf) out.push(buf);
  return out;
}
async function sendTelegram(text) {
  const TG = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!TG || !CHAT) { console.log('ℹ Telegram env yok — mesaj stdout\'ta kaldı.'); return false; }
  let ok = true;
  for (const c of chunkForTelegram(text)) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT, text: c, parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { console.log('⚠ Telegram:', j.description); ok = false; }
    } catch (e) { console.log('⚠ Telegram hata:', e.message); ok = false; }
    await new Promise((r) => setTimeout(r, 400));
  }
  return ok;
}

// ── main ────────────────────────────────────────────────────────────────────
async function build() {
  const ctx = {};

  // health (2 bölüm) — bölüm bazında güvenli
  let health, data, checks = [];
  try { const h = await sectionHealth(); health = h.health; data = h.data; checks = h.checks || []; }
  catch (e) { health = UNAVAIL('🩺 SYSTEM HEALTH', e.message); }
  ctx.checks = checks;

  const ideasBundle = (() => { try { return readIdeas(); } catch { return { ci: null }; } })();
  const safe = (fn, title) => { try { return fn(); } catch (e) { return UNAVAIL(title, e.message); } };

  const topics = safe(() => sectionTopics(ideasBundle), '🧠 INTELLIGENCE / TOPICS');
  const dups = safe(() => sectionDuplicates(ideasBundle), '♻️ DUPLICATES');
  const quality = safe(() => sectionQuality(), '⚠️ QUALITY WARNINGS');
  ctx.qualityFlag = quality.flag;
  const content = await (async () => { try { return await sectionContent(); } catch (e) { return UNAVAIL('📦 CONTENT STATUS', e.message); } })();
  const sales = safe(() => sectionSales(), '💼 SALES STATUS');
  ctx.salesDerive = sales._derive || null;
  const priorities = safe(() => sectionPriorities(ctx), "🎯 TODAY'S PRIORITIES");
  // Gazete: her sabahki sayı + baskı provası tek karar ekranında (ajansAI orkestrasyon görünürlüğü).
  const gazete = await (async () => { try { return await sectionGazete(); } catch (e) { return UNAVAIL('📰 GAZETE', e.message); } })();

  const coreSections = [health, data, gazete, topics, dups, quality, content, sales, priorities].filter(Boolean);
  const actions = sectionActions(coreSections, ctx);
  const sections = [...coreSections, actions];

  // özet durum satırı (kaç kritik/uyarı)
  const crit = sections.filter((s) => s.flag === 'crit').length;
  const unavail = sections.filter((s) => s.flag === 'unavail').length;
  const header = `🗼 <b>KALKANINFO DAILY CONTROL TOWER</b> — ${DATE}` +
    (crit ? `  🔴 ${crit} kritik` : '') + (unavail ? `  ⚠ ${unavail} veri-yok` : '');

  const body = sections.map((s) => `<b>${s.title}</b>\n${s.lines.join('\n')}`).join('\n\n');
  const text = `${header}\n\n${body}`;

  return { text, sections, crit, unavail };
}

async function main() {
  const { text, crit, unavail } = await build();

  if (SNAPSHOT) {
    try {
      mkdirSync(join(ROOT, 'data', 'agency'), { recursive: true });
      writeFileSync(join(ROOT, 'data', 'agency', `control-tower-${DATE}.json`),
        JSON.stringify({ date: DATE, generated_at: new Date().toISOString(), crit, unavail, text }, null, 2));
    } catch (e) { console.warn('snapshot yazılamadı:', e.message); }
  }

  if (DRY) {
    // HTML etiketlerini stdout'ta sadeleştir (okunur olsun)
    console.log('\n' + text.replace(/<\/?b>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') + '\n');
    console.log(`[control-tower] DRY — gönderilmedi. kritik:${crit} veri-yok:${unavail}`);
    return;
  }
  const ok = await sendTelegram(text);
  console.log(ok ? '✅ Control Tower gönderildi.' : 'ℹ Gönderilemedi (yukarıya bak).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('[control-tower]', e); process.exit(1); });
}

export { build };
