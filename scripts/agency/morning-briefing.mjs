#!/usr/bin/env node
/**
 * scripts/agency/morning-briefing.mjs — GÜNLÜK 07:00 TÜM-AJAN BRİFİNGİ
 * ---------------------------------------------------------------------
 * Berkay: "28 ajanın hepsinden 07:00'de güncel rapor istiyorum — Kalkan hakkında internette
 * neler dönüyor araştırsınlar, gazete + reels için içerik bulsunlar; ve rolüne göre KalkanInfo'yu
 * geliştirecek, katma değer katacak, eksikleri bulacak öneriler üretsinler."
 *
 * AKIŞ:
 *   1. TAZE İNTERNET SİNYALLERİ topla (bir kez, ortak bağlam):
 *      - Kalkan-merkezli haberler (data/haberler.json — RSS aggregator çıktısı)
 *      - Küratörlü mekan IG gönderileri (data/ig-venue-intake.json)
 *      - Bugünkü etkinlikler (events-lib)
 *   2. 28 AJANIN HER BİRİ rolüne + öğrendiklerine (knowledge) göre üretir:
 *      - kalkan_guncel: bugün alanında öne çıkan 1-2 gerçek gözlem (sinyallerden, uydurma yok)
 *      - icerik_fikirleri: gazete/reels için 1-2 somut içerik fikri
 *      - gelistirme: KalkanInfo'yu geliştirecek / eksik gördüğü 1 öneri
 *   3. Departman bazlı RAPOR → Telegram (kurucuya) + data/agency/briefing/<date>.json
 *   4. Tüm içerik fikirleri düzleştirilip data/agency/content-ideas.json → gazete/reels tüketir.
 *
 * Kota-güvenli: cheap-llm (groq/cerebras/nvidia/gemini), ajanlar arası küçük gecikme, non-fatal.
 * Kullanım: node scripts/agency/morning-briefing.mjs [--dry] [--only=muhabir,growth]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel; CI'da env dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const DRY = process.argv.includes('--dry');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]?.split(',').filter(Boolean) || null;
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN, TG_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;

async function readJson(rel, fallback) {
  try { return JSON.parse(await readFile(join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

// ─── 1) TAZE SİNYALLER ───
async function gatherSignals() {
  const parts = [];
  // Haberler (Kalkan-merkezli, en güncel 10)
  const news = await readJson('data/haberler.json', { items: [] });
  const newsItems = (news.items || []).slice(0, 10)
    .map(n => `- [${n.category || 'haber'}] ${n.title}${n.source ? ' ('+n.source+')' : ''}`);
  if (newsItems.length) parts.push('HABERLER (bugün RSS):\n' + newsItems.join('\n'));

  // IG mekan sinyalleri
  const ig = await readJson('data/ig-venue-intake.json', { items: [] });
  const igItems = (ig.items || []).slice(0, 8)
    .map(i => `- @${i.username}: ${String(i.caption || '').replace(/\s+/g, ' ').slice(0, 90)}`);
  if (igItems.length) parts.push('MEKAN IG GÖNDERİLERİ:\n' + igItems.join('\n'));

  // Bugünkü etkinlikler
  try {
    const { eventsForDate } = await import(pathToFileURL(join(ROOT, 'scripts', 'events-lib.mjs')).href);
    const evs = await eventsForDate(date);
    if (evs?.length) parts.push('BUGÜNKÜ ETKİNLİKLER:\n' + evs.slice(0, 8)
      .map(e => `- ${e.time || ''} ${e.type || ''} · ${e.venueName || ''}`).join('\n'));
  } catch {}

  return parts.join('\n\n') || '(taze sinyal bulunamadı — genel Kalkan bağlamıyla üret)';
}

// ─── Karakter dosyası (.claude/agents/kalkan-<id>.md) → system prompt (TEK KAYNAK) ───
// "Arkası dolu" karakter tanımı tek yerde yaşar; prod (ücretsiz LLM) de dev (Claude Code subagent) de aynı karakteri kullanır.
async function loadCharacterSystem(id, fallback) {
  try {
    const raw = await readFile(join(ROOT, '.claude', 'agents', `kalkan-${id}.md`), 'utf8');
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim(); // YAML frontmatter'ı at, gövde = system
    return body.length > 40 ? body : fallback;
  } catch { return fallback; }
}

// ─── Ajan hafızası (knowledge) → prompt enjeksiyonu ───
async function agentKnowledge(id) {
  const k = await readJson(`data/agency/knowledge/${id}.json`, null);
  const lessons = (k?.lessons || []).slice(-3).map(l => l.summary).filter(Boolean);
  return lessons.length ? `\n\nÖĞRENDİKLERİN (kendi alanında son okumaların — bu bakışı uygula):\n- ${lessons.join('\n- ')}` : '';
}

// ─── Role-bazlı GERÇEK VERİ enjeksiyonu (BAĞLA): her ajan kendi işine ait taze, gerçek veriyi görür ───
// Amaç: ajanlar havada beyin fırtınası yapmasın; hasat sepeti + gerçek IG metriği + etik durum girdisiyle karar versin.
async function agentDataFeed(id) {
  const feed = [];
  const NEWS = ['muhabir', 'yayin-yonetmeni', 'news-verifier', 'magazin-editoru', 'gazete-sosyal', 'trend', 'director', 'reels-uretici', 'bulten-editoru', 'gazete-reel-en', 'hava-plan'];
  const METRIC = ['analyst', 'growth', 'ads', 'director', 'trend'];
  const GUARD = ['guard', 'kvkk-guardian', 'reklam-uyum'];

  // Haber sepeti (gerçek hasat, pending) → haber/üretim ajanları işleyip geliştirebilir
  if (NEWS.includes(id)) {
    const lines = [];
    for (const sc of ['kalkan', 'kas', 'bolge']) {
      const b = await readJson(`data/agency/sepet/${sc}.json`, { items: [] });
      for (const it of (b.items || []).filter(i => (i.status || 'pending') === 'pending').slice(0, 4))
        lines.push(`- [${sc}→${it.placement || 'haberler'}] ${it.title}`);
    }
    if (lines.length) feed.push('HABER SEPETİ (gerçek, taze — sen bunları işleyip içeriğe çevirebilirsin):\n' + lines.join('\n'));
  }
  // Gerçek IG metrikleri → analiz/büyüme/reklam/karar ajanları
  if (METRIC.includes(id)) {
    const r = await readJson('data/agency/ig-report.json', null);
    if (r?.son_30_gun) {
      const p = r.profil || {}, s = r.son_30_gun || {};
      const best = r.en_iyi ? `EN İYİ: "${String(r.en_iyi.baslik || r.en_iyi.caption || '').slice(0, 60)}". ` : '';
      const worst = r.en_zayif ? `EN ZAYIF: "${String(r.en_zayif.baslik || r.en_zayif.caption || '').slice(0, 60)}". ` : '';
      feed.push(`GERÇEK IG METRİĞİ (son 30g): takipçi ${p.takipci}, reach ${s.reach}, profil ziyareti ${s.profil_ziyareti}, web tık ${s.website_tik}, toplam etkileşim ${s.toplam_etkilesim}. ${best}${worst}→ önerini bu GERÇEK sayılara dayandır, uydurma.`);
    }
  }
  // Etik/hassas durum → guard ajanları
  if (GUARD.includes(id)) {
    let held = 0;
    for (const sc of ['kalkan', 'kas', 'bolge']) {
      const b = await readJson(`data/agency/sepet/${sc}.json`, { items: [] });
      held += (b.items || []).filter(i => i.status === 'hold').length;
    }
    feed.push(`ETİK DURUM: sepette ${held} hassas içerik 'hold' bekliyor (trajedi/kişisel veri → insan onayı ŞART, sansasyon YOK, kaynak atfı zorunlu). Bu kuralı denetle ve hatırlat.`);
  }
  return feed.length ? '\n\n★ SANA AİT GERÇEK VERİ (uydurma değil — kararını BUNA dayandır):\n' + feed.join('\n\n') : '';
}

const BRIEF_SCHEMA = `{"kalkan_guncel":"...","icerik_fikirleri":[{"tur":"gazete|reels","baslik":"...","aci":"..."}],"gelistirme":"..."}`;

// Kalkan içerik sütunları — briefing'in ÖZGÜN/ZAMANSIZ içerik üretmesini sağlar (haber tekrarı değil).
const KALKAN_PILLARS =
`KALKAN İÇERİK SÜTUNLARI (sürekli haber gerekmez — bunlardan ÖZGÜN, ZAMANSIZ içerik üret):
• TARİH & ANTİK: Patara (Likya Birliği'nin başkenti, dünyanın en eski deniz fenerlerinden, Aziz Nikolaos'un doğduğu topraklar, Roma senato/meclis yapısı, geniş antik plaj), Xanthos-Letoon (UNESCO), Kaş (antik Antiphellos), Likya kaya mezarları, Likya Yolu.
• İŞLETME HİKAYELERİ: bir mekân kaç yıllık, kurucu/aile hikayesi, imza lezzetin kökeni, mekânın adının hikayesi, nesilden nesile tarif.
• KÜLTÜR & YAŞAM: yerel gelenek, el sanatı, balıkçılık, zeytin/badem hasadı, mevsimsel yaşam.
• DOĞA & YER: Kaputaş, Kalamar koyu, gizli koylar, tekne rotaları, dalış, caretta caretta.
• LEZZET: yöresel yemek, meze kültürü, deniz ürünü, Kalkan kahvaltısı.
• PRATİK REHBER: "Kalkan'da bir gün", gün batımı noktaları, aile/çift önerileri.
• MEVSİM: içinde bulunulan aya özgü açı (yaz geceleri, tekne turu, festival).`;

function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
  for (const c of [t, t.replace(/\\"/g, '"'), t.replace(/\\\\/g, '\\')]) {
    try { const j = JSON.parse(c); if (j && (j.kalkan_guncel || j.icerik_fikirleri)) return j; } catch {}
  }
  return null;
}

// Ajans direktifi — VİRAL Instagram içerik emri (data/agency/viral-brief.json). Düzenlenebilir tek kaynak.
function buildViralDirective(vb) {
  if (!vb || !vb.hedef) return '';
  const d = vb.canli_veri_dersleri || {};
  const f = vb.viral_formul || {};
  return `\n★ AJANS DİREKTİFİ — VİRAL INSTAGRAM ★\n` +
    `HEDEF: ${vb.hedef}\n` +
    (d.ne_ise_yaradi ? `İŞE YARAYAN (canlı IG verisi): ${d.ne_ise_yaradi.join(' | ')}\n` : '') +
    (d.ne_cokuyor ? `ÇÖKEN: ${d.ne_cokuyor.join(' | ')}\n` : '') +
    (d.kitle_gercegi ? `KİTLE: ${d.kitle_gercegi}\n` : '') +
    (f.hook ? `HOOK: ${f.hook}\n` : '') +
    (f.cta_zorunlu ? `CTA (zorunlu): ${f.cta_zorunlu}\n` : '') +
    (f.sharelik_acilar ? `PAYLAŞILABİLİR AÇILAR: ${f.sharelik_acilar.join(' · ')}\n` : '') +
    (vb.gorsel_kaynak?.klasorler ? `GERÇEK GÖRSEL KAYNAĞI (uydurma yok): ${Object.values(vb.gorsel_kaynak.klasorler).join(' · ')}\n` : '') +
    (vb.teknik_kurallar ? `TEKNİK: ${vb.teknik_kurallar.join(' · ')}\n` : '') +
    `→ icerik_fikirleri üretirken bu direktife UY: Instagram-öncelikli, viral potansiyeli yüksek, gerçek Kalkan görseliyle eşleşen, CTA'lı içerik öner.`;
}

async function main() {
  console.log(`\n════ GÜNLÜK BRİFİNG — ${date} ════`);
  const agents = (await readJson('data/agency/agents.json', { agents: {} })).agents;
  const viralDirective = buildViralDirective(await readJson('data/agency/viral-brief.json', null));
  if (viralDirective) console.log('★ viral-brief.json yüklendi → tüm ajanlara enjekte edilecek');
  let ids = Object.keys(agents);
  if (ONLY) ids = ids.filter(id => ONLY.includes(id));
  console.log(`${ids.length} ajan · taze sinyaller toplanıyor...`);

  const signals = await gatherSignals();
  const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);

  const results = [];
  for (const id of ids) {
    const a = agents[id];
    const know = await agentKnowledge(id);
    const dataFeed = await agentDataFeed(id);
    const charSys = await loadCharacterSystem(id, a.system || ''); // zengin karakter (varsa) → system
    const task =
      `Bugün ${date}. Sen Kalkan turizm markası için içerik üreticisisin. Kalkan hakkında SÜREKLİ yeni haber çıkmaz — ` +
      `görevin taze haberi tekrarlamak DEĞİL; ROLÜNE göre ÖZGÜN, ZAMANSIZ (evergreen), ilgi çekici içerik üretmek.\n\n` +
      `${KALKAN_PILLARS}\n` +
      `${viralDirective}\n\n` +
      `(Opsiyonel taze sinyaller — YALNIZ gerçekten turistik/ilginç ise kullan; ihale/ÇED/meclis/bürokratik/rutin haberi ASLA kullanma):\n${signals}` +
      `${dataFeed}\n\n` +
      `ROLÜNE göre üret:\n` +
      `1) kalkan_guncel: alanında bugün işlenebilecek 1 taze VEYA zamansız açı (kısa; yoksa güçlü bir evergreen açı).\n` +
      `2) icerik_fikirleri: gazete VEYA reels için 1-2 ÖZGÜN içerik — her biri {tur, baslik (çekici başlık), aci (1 cümle: ne anlatır)}. ` +
      `Tarih/işletme hikayesi/kültür/lezzet/doğa gibi EVERGREEN'e öncelik ver.\n` +
      `3) gelistirme: KalkanInfo'yu (kalkaninfo.com) geliştirecek 1 somut öneri.\n\n` +
      `ODAK: Kendi uzmanlık alanına EN YAKIN sütundan üret, başka ajanın alanına kayma — ör. lezzet ajanı→yemek/işletme hikayesi, rehber→tarih/antik, magazin→gece hayatı/kültür, provider→villa/konaklama açısı. Aynı klişe başlığı ("Kalkan'da bir gün") tekrarlama.\n` +
      `KURALLAR: Tarih/efsane için genel bilgiye dayan (Patara/Likya iyi belgeli). İŞLETMEYE ÖZEL rakam/tarih (kaç yıllık, ciro vb.) UYDURMA — ` +
      `açıyı öner, gerçek detayın işletmeden alınacağını belirt. Klişe/dolgu/övgü yok. Türkçe. SADECE şu JSON: ${BRIEF_SCHEMA}`;

    if (DRY) { console.log(`  [dry] ${id}`); continue; }
    let out = null;
    for (let attempt = 1; attempt <= 2 && !out; attempt++) {
      try {
        const res = await cheapLLM(task, {
          system: charSys + know, json: true, maxTokens: 500, temperature: 0.4,
          // Karakter ajanları KALİTE ister → RouteLLM (akıllı güçlü model) önce, ücretsiz fallback sonra.
          order: (process.env.CHEAP_LLM_ORDER || 'routellm,groq,cerebras,nvidia,gemini,claude').split(','), timeoutMs: 60000,
        });
        out = parseJson(res.text);
        if (out) out._provider = res.provider;
      } catch (e) { /* dene */ }
    }
    if (out) {
      results.push({ id, name: a.name, department: a.department, ...out });
      console.log(`  ✓ ${id} (${out._provider || '?'})`);
    } else {
      console.log(`  ✗ ${id} — üretemedi (atlandı)`);
    }
    await new Promise(r => setTimeout(r, 800)); // kota-dostu stagger
  }

  if (DRY) { console.log('dry — çıktı yazılmadı'); return; }

  // ─── Çıktılar ───
  const briefDir = join(ROOT, 'data', 'agency', 'briefing');
  await mkdir(briefDir, { recursive: true });
  const brief = { date, generated_at: new Date().toISOString(), count: results.length, agents: results };
  await writeFile(join(briefDir, `${date}.json`), JSON.stringify(brief, null, 2));

  // İçerik fikirlerini düzleştir → gazete/reels tüketir
  const ideas = results.flatMap(r => (r.icerik_fikirleri || []).map(i => ({
    agent: r.id, department: r.department, tur: i.tur || 'gazete',
    baslik: i.baslik || '', aci: i.aci || i.fikir || '',
    fikir: [i.baslik, i.aci || i.fikir].filter(Boolean).join(' — '),
  }))).filter(i => i.fikir);
  await writeFile(join(ROOT, 'data', 'agency', 'content-ideas.json'),
    JSON.stringify({ date, generated_at: new Date().toISOString(), ideas }, null, 2));
  console.log(`✓ ${results.length} ajan raporu · ${ideas.length} içerik fikri → briefing/${date}.json + content-ideas.json`);

  // ─── Telegram: departman bazlı özet ───
  await sendTelegram(results, ideas);
}

async function sendTelegram(results, ideas) {
  if (!TG_TOKEN || !TG_CHAT) { console.log('ℹ Telegram env yok — rapor dosyada.'); return; }
  const deptNames = { sosyal: '📱 Sosyal', gazete: '📰 Gazete', concierge: '🧭 Concierge', teknik: '🔧 Teknik' };
  const byDept = {};
  for (const r of results) (byDept[r.department] ||= []).push(r);

  const esc = s => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  let body = `<b>☀️ Günlük Ajans Brifingi — ${date}</b>\n${results.length} ajan raporladı.\n`;

  for (const [dept, list] of Object.entries(byDept)) {
    body += `\n<b>${deptNames[dept] || dept}</b>\n`;
    for (const r of list) {
      const guncel = esc(String(r.kalkan_guncel || '').slice(0, 160));
      body += `• <b>${esc(r.name || r.id)}</b>: ${guncel}\n`;
    }
  }

  // En iyi içerik fikirleri (gazete + reels ayrı)
  const gz = ideas.filter(i => /gazete/i.test(i.tur)).slice(0, 6);
  const rl = ideas.filter(i => /reel/i.test(i.tur)).slice(0, 6);
  if (gz.length) body += `\n<b>📰 Gazete fikirleri</b>\n` + gz.map(i => `• ${esc(i.fikir)}`).join('\n') + '\n';
  if (rl.length) body += `\n<b>🎬 Reels fikirleri</b>\n` + rl.map(i => `• ${esc(i.fikir)}`).join('\n') + '\n';

  // KalkanInfo geliştirme önerileri (ilk 6)
  const dev = results.map(r => r.gelistirme).filter(Boolean).slice(0, 6);
  if (dev.length) body += `\n<b>🚀 KalkanInfo geliştirme önerileri</b>\n` + dev.map(d => `• ${esc(String(d).slice(0, 140))}`).join('\n');

  // Telegram mesaj limiti ~4096 → parçala
  const chunks = [];
  for (let i = 0; i < body.length; i += 3800) chunks.push(body.slice(i, i + 3800));
  for (const c of chunks) {
    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text: c, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
    } catch (e) { console.warn('telegram fail:', e.message); }
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('✓ Telegram brifingi gönderildi');
}

main().catch(e => { console.error('[morning-briefing]', e); process.exit(0); });
