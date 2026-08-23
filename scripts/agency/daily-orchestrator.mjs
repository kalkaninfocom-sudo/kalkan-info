#!/usr/bin/env node
/**
 * scripts/agency/daily-orchestrator.mjs — 2. BEYİN: GÜNLÜK İÇERİK ORKESTRATÖRÜ (Katman 4)
 * ---------------------------------------------------------------------------------------
 * Döngüyü kapatır: strateji (öğren) → BUGÜN NE ÜRETELİM (uygula) → mevcut reel-approval
 * builder'ı çalıştır → o zaten qualityGate + 5-dil + social_posts pending + Telegram yapar.
 * Yayın: mevcut auto-publish-stale (güvenli içerikte gate→approved) + insan onayı = trust ladder.
 *
 * NEDEN İNCE: reel builder'lar + yayın rayları ZATEN var (kendi cron'larında). Eksik olan tek
 * şey stratejiyi üretime BAĞLAMAKTI. Bu orkestratör o kararı verir; medyayı yeniden yazmaz.
 *
 * GÜVENLİK / TRUST LADDER:
 *   - Villa reel'i ASLA (yasal — memory: villalar HARİÇ).
 *   - Varsayılan ÖNİZLEME: kararı yazar + Telegram önerir, üretim yapmaz (mevcut cron'ları çift-üretmez).
 *   - Gerçek üretim: --run VEYA ORCHESTRATOR_RUN=1 (Berkay bilinçli açar; cron konsolidasyonu docs'ta).
 *   - Günde MAX_THEMES tema (varsayılan 1) — bütçe + spam koruması.
 *
 * Kullanım:
 *   node scripts/agency/daily-orchestrator.mjs              # önizleme (karar + öneri)
 *   node scripts/agency/daily-orchestrator.mjs --run        # gerçekten üret (builder çalıştır)
 *   node scripts/agency/daily-orchestrator.mjs --max=2      # günde 2 tema
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdvice } from '../../lib/strategy-advisor.mjs';
import { record, query } from '../../lib/brain-memory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const RUN = process.argv.includes('--run') || process.env.ORCHESTRATOR_RUN === '1';
const MAX_THEMES = Number((process.argv.find(a => a.startsWith('--max=')) || '').split('=')[1]) ||
  Number(process.env.ORCHESTRATOR_MAX_THEMES || 1);
const DEDUP_DAYS = Number(process.env.ORCHESTRATOR_DEDUP_DAYS || 3);

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN, TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;

// ── Tema kataloğu (villa BİLEREK YOK — yasal) ──
const THEMES = [
  { key: 'plaj', script: 'scripts/agency/plaj-reel-approval.mjs', label: 'Haftanın Plajı reel', needsPhotos: false },
  { key: 'restoran', script: 'scripts/agency/restoran-reel-approval.mjs', label: 'Restoran reel', needsPhotos: false },
  { key: 'antik', script: 'scripts/agency/antik-reel-approval.mjs', label: 'Antik kent reel', needsPhotos: true },
];
// Foto bekleyen temalar üretimden hariç (env ile açılabilir: PHOTOS_READY=antik,...)
const PHOTOS_READY = new Set((process.env.PHOTOS_READY || '').split(',').map(s => s.trim()).filter(Boolean));

// Strateji konusu → tema (anahtar kelime)
function themeFromTopic(topic) {
  const t = String(topic || '').toLowerCase();
  if (/plaj|beach|deniz|koy|kumsal/.test(t)) return 'plaj';
  if (/restoran|yemek|food|mangal|ocakbaşı|meze|lokanta|cafe|kahvaltı/.test(t)) return 'restoran';
  if (/antik|tarih|ruin|patara|likya|kaya mezar|history|ören/.test(t)) return 'antik';
  return null;
}

function eligible(theme) {
  return !theme.needsPhotos || PHOTOS_READY.has(theme.key);
}

async function tg(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { /* non-fatal */ }
}

/** Son DEDUP_DAYS günde üretilmiş temaları hafızadan çıkar. */
function recentThemeKeys() {
  const acts = query({ kind: 'action', tag: 'orchestrator', since: new Date(Date.now() - DEDUP_DAYS * 864e5) });
  return new Set(acts.map(a => a.data?.theme).filter(Boolean));
}

/** Bugünün tema(larını) seç: strateji → yoksa rotasyon; dedup + foto + villa filtreli. */
function decideThemes(advice, max) {
  const recent = recentThemeKeys();
  const picks = [];

  // 1) Strateji planı varsa konudan tema türet (öncelik)
  for (const item of advice.tomorrow || []) {
    if (picks.length >= max) break;
    const key = themeFromTopic(item.topic);
    const th = THEMES.find(t => t.key === key);
    if (th && eligible(th) && !recent.has(th.key) && !picks.some(p => p.theme.key === th.key)) {
      picks.push({ theme: th, lang: item.lang || advice.topLang, why: `strateji: "${item.topic}" (${item.why || 'plan'})` });
    }
  }

  // 2) Yetersizse rotasyon: yakında yapılmamış + uygun ilk temalar
  if (picks.length < max) {
    for (const th of THEMES) {
      if (picks.length >= max) break;
      if (!eligible(th) || recent.has(th.key) || picks.some(p => p.theme.key === th.key)) continue;
      picks.push({ theme: th, lang: advice.topLang, why: advice.mode === 'cold-start' ? 'keşif rotasyonu' : 'rotasyon (strateji temayı belirtmedi)' });
    }
  }

  // 3) Hâlâ boşsa (hepsi yakında yapıldı) — en eskiyi zorla (dedup'u gevşet)
  if (!picks.length) {
    const th = THEMES.find(eligible);
    if (th) picks.push({ theme: th, lang: advice.topLang, why: 'tüm temalar yakında yapıldı — en güvenli temaya düşüldü' });
  }
  return picks.slice(0, max);
}

function runBuilder(script, lang) {
  const env = { ...process.env, PREFER_LANG: lang || '' }; // builder desteklerse dil ipucu; desteklemezse zararsız
  const r = spawnSync('node', [join(ROOT, script)], { stdio: 'inherit', env, timeout: 20 * 60_000 });
  return { ok: r.status === 0, status: r.status, error: r.error?.message || null };
}

async function main() {
  const advice = getAdvice();
  const picks = decideThemes(advice, MAX_THEMES);

  console.log(`[orkestratör] mod: ${advice.mode} · veri: ${advice.dataPoints} ölçüm · en-iyi dil: ${advice.topLang} · saat: ${advice.topHourBucket}`);
  if (advice.avoid?.length) console.log(`[orkestratör] azalt: ${advice.avoid.join(', ')}`);
  console.log(`[orkestratör] bugün ${picks.length} tema seçildi (max ${MAX_THEMES}, ${RUN ? 'ÜRETİM' : 'ÖNİZLEME'}):`);
  picks.forEach(p => console.log(`   • ${p.theme.label} [${p.lang}] — ${p.why}`));

  const planRow = {
    decided_at: new Date().toISOString(), mode: advice.mode, dataPoints: advice.dataPoints,
    topLang: advice.topLang, topHourBucket: advice.topHourBucket, avoid: advice.avoid || [],
    themes: picks.map(p => ({ theme: p.theme.key, label: p.theme.label, lang: p.lang, why: p.why })),
    executed: RUN,
  };

  const results = [];
  if (RUN) {
    for (const p of picks) {
      // villa güvenlik çiti (katalogda yok ama çift-güvence)
      if (p.theme.key === 'villa') { console.log('   ⛔ villa atlandı (yasal)'); continue; }
      console.log(`\n▶ ÜRETİM: ${p.theme.label} [${p.lang}] → ${p.theme.script}`);
      const res = runBuilder(p.theme.script, p.lang);
      results.push({ theme: p.theme.key, lang: p.lang, ...res });
      await record('action', { theme: p.theme.key, label: p.theme.label, lang: p.lang, script: p.theme.script, ok: res.ok, why: p.why }, ['orchestrator', p.theme.key]);
      console.log(res.ok ? `   ✔ ${p.theme.label} üretildi (sepete/onaya düştü).` : `   ⚠ ${p.theme.label} başarısız (status ${res.status}).`);
    }
    planRow.results = results;
  } else {
    // Önizleme: sadece plan kaydı (üretim yok) — döngü kararı görünür, cron'lar çift-üretmez.
    await record('plan', { ...planRow, kind_note: 'orchestrator-preview' }, ['orchestrator', 'preview']);
  }

  // Snapshot + Telegram
  try {
    mkdirSync(join(ROOT, 'data', 'agency'), { recursive: true });
    writeFileSync(join(ROOT, 'data', 'agency', 'today-plan.json'), JSON.stringify(planRow, null, 2));
  } catch {}

  const head = RUN
    ? `🧠 2. Beyin — bugün üretildi (${results.filter(r => r.ok).length}/${picks.length} başarılı):`
    : `🧠 2. Beyin önerisi (önizleme — üretmedim):`;
  const body = picks.map(p => `• ${p.theme.label} [${p.lang}] — ${p.why}`).join('\n');
  const tail = RUN ? '' : '\nÜretmek için: daily-orchestrator --run (veya ORCHESTRATOR_RUN=1).';
  await tg(`${head}\n${body}${tail}`);

  console.log(`\n[orkestratör] bitti → data/agency/today-plan.json${RUN ? '' : ' (önizleme)'}`);
}

main().catch(e => { console.error('[orkestratör] ölümcül:', e.message); process.exit(1); });
