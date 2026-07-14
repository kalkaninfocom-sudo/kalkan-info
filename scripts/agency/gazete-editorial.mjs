#!/usr/bin/env node
/**
 * scripts/agency/gazete-editorial.mjs — GAZETE EDİTÖRYAL KATMAN (Faz 1: ajans ↔ gazete köprüsü)
 * ------------------------------------------------------------------------------------------
 * SORUN: Gazete içeriği yalnız data/haberler.json'dan (ham RSS) geliyordu; sabah muhabir/magazin
 * agent'ları çalışsa bile çıktı gazeteye HİÇ bağlanmıyordu → RSS değişmezse gazete aynı kalıyordu.
 *
 * BU SCRIPT: ham RSS haberlerini alır, Kalkan-alaka + güncelliğe göre sıralar, en iyi 4'ünü
 * ucuz-LLM (lib/cheap-llm.mjs: ollama→nvidia→gemini→claude) ile EDİTÖRYAL manşet/sütun/magazine
 * metnine dönüştürür ve data/gazete-today.json'a yazar. sources.mjs.getNews() bugünün dosyasını
 * ÖNCE okur (yoksa/eski ise ham RSS'e fallback). Böylece gazete her gün gerçekten taze + agent-yazımı.
 *
 * DÜRÜSTLÜK: LLM'e "sadece verilen bilgiyi yeniden yaz, YENİ olgu/isim/rakam UYDURMA" talimatı verilir.
 * LLM yoksa/başarısızsa: dosya YAZILMAZ, exit 0 → build ham RSS ile devam eder (bozmaz).
 *
 * Kullanım: node scripts/agency/gazete-editorial.mjs [YYYY-MM-DD]
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { groundPhoto } from '../../lib/news-photos.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// .env.local yükle (yerel çalıştırma; CI'da env zaten dolu)
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch {}

const date = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ||
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

// ── Kalkan-alaka skorlama (sources.mjs mantığının hafif kopyası) ──
// ÇEKİRDEK yer adları — 'antalya' KASITLI yok (sources.mjs ile aynı Kalkan-merkez politikası).
const CORE_RX = [/\bkalkan\b/i, /\bkaş\b/i, /\bpatara\b/i, /\bkaputaş\b/i, /\bletoon\b/i,
  /\bksanthos\b/i, /\bxanthos\b/i, /\blik[iy]a\b/i, /\bsaklıkent\b/i,
  /\bislamlar\b/i, /\bbezirgan\b/i, /\bçukurbağ\b/i, /\bkalamar\b/i, /\bdemre\b/i];
const CATS = { Turizm: 2, Plaj: 2, Etkinlik: 2, Kültür: 2, Belediye: 0, Gündem: 0, Hava: 1, Asayiş: -3 };
function score(it) {
  const txt = `${it.title || ''} ${it.summary || ''}`;
  let s = 0;
  const hasCore = CORE_RX.some(rx => rx.test(txt));
  if (hasCore) s += 3;
  else if (/\bantalya\b/i.test(txt)) s -= 4;   // yalnız Antalya → manşet/sütun adayı olmasın
  if (/\bkalkan\b/i.test(txt)) s += 2;
  const src = it.source || '';
  if (/kalkan/i.test(src)) s += 3; else if (/körfez|antalya/i.test(src)) s += 1; else s -= 4;
  s += CATS[it.category] ?? 0;
  return s;
}

// ── TAZELİK GUARD ──
// Rotasyon "son 6 günde yayınlanmadı"yı önceler; ama haberler.json'da 4-7 ay eski (yüksek yerel
// alaka nedeniyle top-30'a giren) haberler de var. Tatilci gazetesine Temmuz'da Aralık haberi
// düşmesin diye tarihe göre ağırlık: taze +, eski büyük −. Böylece rotasyon TAZE arasında döner.
function freshBonus(iso) {
  if (!iso) return 0; // scrape (tarihsiz) → nötr (güncel liste sayılır)
  const d = Date.parse(iso + 'T00:00:00');
  if (isNaN(d)) return 0;
  const ageDays = (Date.parse(date + 'T00:00:00') - d) / 86400000;
  if (ageDays <= 2) return 4;
  if (ageDays <= 7) return 2;
  if (ageDays <= 21) return 0;
  if (ageDays <= 45) return -4;
  return -12;                    // >45 gün: manşet/sütun adayı olmaktan pratikte çıkar
}

// ── TEKRAR KIRICI 1: son N günün gazetesinde kullanılan haber id'leri ──
// Berkay: "her gün aynı haber yapılıp duruyor". gazete-history.json CI'da commit edilmiyordu,
// bu yüzden rotasyon her gün sıfırlanıyordu. Bunun yerine COMMIT'LENEN arşiv dosyalarından
// (data/gazete-archive/<date>.json → source_ids) son N günün kullanılmış haberlerini türetiyoruz.
async function recentlyUsedIds(days = 6) {
  const used = new Set();
  try {
    const dir = join(ROOT, 'data', 'gazete-archive');
    const files = (await readdir(dir))
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f !== `${date}.json`) // bugünün kendi arşivini sayma (idempotent)
      .sort().reverse().slice(0, days);
    for (const f of files) {
      try {
        const j = JSON.parse(await readFile(join(dir, f), 'utf8'));
        for (const id of (j.source_ids || [])) used.add(id);
      } catch {}
    }
  } catch {}
  return used;
}

// ── TEKRAR KIRICI 2: near-duplicate haber çökertme ──
// haberler.json'da "villa turizmi zirveye" / "villa turizmi temmuzda zirve" gibi 3 varyant
// aynı hikaye → hepsi yüksek skorlu → manşet hep villa. Token-set Jaccard ile aynı hikayeyi
// TEK'e indir (en yüksek skorluyu tut), rotasyon gerçekten farklı haber bulabilsin.
const STOP = new Set(['ve','ile','da','de','ta','te','bir','bu','icin','için','olan','oldu','yeni','son','en','the','a','of','in','on']);
function tokenSet(title) {
  return new Set(String(title || '').toLocaleLowerCase('tr')
    .replace(/[^a-zçğıöşü0-9\s]/gi, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
function collapseDupes(ranked) {
  const kept = [];
  const sigs = [];
  for (const it of ranked) {
    const sig = tokenSet(it.title);
    if (sigs.some(s => jaccard(sig, s) >= 0.5)) continue; // aynı hikaye — atla (yüksek skorlu zaten tutuldu)
    kept.push(it); sigs.push(sig);
  }
  return kept;
}

// Aday listesinden son-kullanılmayanı önceleyerek seç (rotasyon). filter opsiyonel kategori filtresi.
function pickFresh(pool, usedIds, taken, filter) {
  const avail = pool.filter(it => !taken.has(it.id) && (!filter || filter(it)));
  const fresh = avail.filter(it => !usedIds.has(it.id));
  const chosen = (fresh[0] || avail[0]) || null;
  if (chosen) taken.add(chosen.id);
  return chosen;
}

// ── AGENT EĞİTİMİ (system prompt) — docs/YAZI_ISLERI_KILAVUZU.md özeti ──
const EDITORIAL_SYSTEM =
  'Sen Kalkan Today gazetesinin deneyimli yazı işleri editörüsün. Gerçek bir haber ajansı gibi yazarsın.\n' +
  'İLKELER:\n' +
  '1. TERS PİRAMİT: en önemli bilgi ilk cümlede (5N1K). Detay sonra.\n' +
  '2. LEDE: tek güçlü, SOMUT cümle. Genel/klişe değil; aktif fiil. Rakam/isim/yer varsa kullan.\n' +
  '3. BAŞLIK: max 9 kelime, fiil içersin, olayı söylesin. Clickbait YOK.\n' +
  '4. KISALIK: deck 1 cümle (≤16 kelime); ikincil haber özeti 1 cümle (≤13 kelime). Dolgu/tekrar yok.\n' +
  '5. YEREL AÇI: tatilci gazetesi — turizm/plaj/etkinlik/mekan/kültür. Kalkan/Kaş/Patara açısını öne çıkar; ulusal politika/asayiş kullanma.\n' +
  '6. OLGUSALLIK: ASLA olgu/isim/tarih/rakam UYDURMA — sadece verilen kaynağı yeniden yaz. Abartma yok.\n' +
  '7. Her ikincil habere mutlaka bir bilgi cümlesi ekle; "sadece başlık" bırakma.\n' +
  'ÇIKTI: yalnızca istenen şemada geçerli JSON döndür, başka hiçbir şey yazma.';

// ── AGENT → GAZETE KÖPRÜSÜ (Fix F) ──
// Sabah 07:00-07:50 muhabir/magazin/yayın-yönetmeni ajanları agency_jobs'a araştırma yazıyor ama
// gazeteye HİÇ bağlanmıyordu (çöpe gidiyordu). Burada o günün agent çıktısını + site etkinliklerini
// çekip editöryal LLM'e EK KAYNAK olarak veriyoruz (uydurma değil, ajanların derlediği).
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
async function fetchAgentResearch(iso) {
  if (!SUPA_URL || !SUPA_KEY) return '';
  try {
    const dayStart = `${iso}T00:00:00`;
    const agents = 'muhabir,magazin-editoru,yayin-yonetmeni,news-verifier';
    const url = `${SUPA_URL}/rest/v1/agency_jobs?agent=in.(${agents})&status=eq.done&created_at=gte.${encodeURIComponent(dayStart)}` +
      `&order=created_at.desc&limit=10&select=agent,result`;
    const r = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
    if (!r.ok) return '';
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return '';
    return rows.filter(x => x.result).map(x => `• [${x.agent}] ${String(x.result).replace(/\s+/g, ' ').slice(0, 320)}`).join('\n');
  } catch { return ''; }
}
async function fetchTodayEvents(iso) {
  try {
    const { eventsForDate } = await import(pathToFileURL(join(ROOT, 'scripts', 'events-lib.mjs')).href);
    const evs = await eventsForDate(iso);
    if (!evs?.length) return '';
    return evs.slice(0, 6).map(e => `• ${e.time || ''} ${e.type || ''} · ${e.venueName || ''}${e.area ? ' (' + e.area + ')' : ''}`).join('\n');
  } catch { return ''; }
}
// Phase 3: küratörlü Kalkan mekanlarının public IG gönderilerinden çıkarılan olgusal haber sinyalleri
// (scripts/ig-venue-watch.mjs üretir → data/ig-venue-news.json). Magazin/mekan açısı için ek kaynak.
async function fetchIgVenueNews() {
  try {
    const d = JSON.parse(await readFile(join(ROOT, 'data', 'ig-venue-news.json'), 'utf8'));
    const items = (d.items || []).filter(x => x.headline);
    if (!items.length) return '';
    return items.slice(0, 5).map(x => `• [${x.category || 'mekan'}] ${x.venueName || x.username}: ${x.headline}`).join('\n');
  } catch { return ''; }
}
// Günlük 07:00 ajan brifinginden GAZETE içerik fikirleri (morning-briefing.mjs → content-ideas.json).
async function fetchBriefingIdeas() {
  try {
    const d = JSON.parse(await readFile(join(ROOT, 'data', 'agency', 'content-ideas.json'), 'utf8'));
    if (d.date !== date) return ''; // yalnız bugünün fikirleri
    const gz = (d.ideas || []).filter(i => /gazete/i.test(i.tur) && i.fikir).slice(0, 6);
    if (!gz.length) return '';
    return gz.map(i => `• [${i.agent}] ${i.fikir}`).join('\n');
  } catch { return ''; }
}

async function main() {
  console.log(`\n════ GAZETE EDİTÖRYAL — ${date} ════`);
  let data;
  try { data = JSON.parse(await readFile(join(ROOT, 'data', 'haberler.json'), 'utf8')); }
  catch { console.warn('⚠ haberler.json okunamadı — editöryal atlandı (build RSS ile devam).'); return; }
  const items = (data.items || []).filter(it => it.title);
  if (!items.length) { console.warn('⚠ Haber yok — editöryal atlandı.'); return; }

  const rankedRaw = items.map(it => ({ it, s: score(it) + freshBonus(it.date) }))
    .sort((a, b) => b.s - a.s || (b.it.date || '').localeCompare(a.it.date || ''))
    .map(r => r.it);
  const collapsed = collapseDupes(rankedRaw);       // near-duplicate hikayeleri tek'e indir
  // Zamanlılık tabanı: 45 günden eski haberi adaylıktan TAMAMEN ele (Temmuz'da Aralık haberi olmasın).
  // Ama havuz çok küçülürse (<3) eskiye de izin ver — boş sütundansa eski-ama-yerel haber yeğdir.
  const isTimely = (it) => freshBonus(it.date) > -12;
  const timely = collapsed.filter(isTimely);
  const ranked = timely.length >= 3 ? timely : collapsed;
  if (timely.length < 3) console.log(`  ⚠ taze-zamanında haber az (${timely.length}) — RSS arzı ince, havuz genişletildi`);

  // Rotasyon: son 6 günde kullanılan haber id'lerini önceleme (her gün farklı manşet).
  const usedIds = await recentlyUsedIds(6);
  const taken = new Set();
  const lead = pickFresh(ranked, usedIds, taken) || ranked[0];
  const col1 = pickFresh(ranked, usedIds, taken, it => ['Etkinlik', 'Kültür', 'Belediye', 'Gündem'].includes(it.category))
            || pickFresh(ranked, usedIds, taken) || ranked[1];
  const col3 = pickFresh(ranked, usedIds, taken, it => ['Plaj', 'Turizm', 'Hava'].includes(it.category))
            || pickFresh(ranked, usedIds, taken) || ranked[2] || ranked[1];
  const mag  = pickFresh(ranked, usedIds, taken) || ranked[1];
  if (usedIds.has(lead?.id)) console.log('  ↳ rotasyon: taze haber tükendi, en yüksek skorluya dönüldü');
  else console.log(`  ↳ rotasyon: manşet "${lead?.title?.slice(0, 50)}" (son 6 günde kullanılmadı)`);

  // Editöryal grounding (paralel çek): agent araştırması + etkinlik + IG sinyali + brifing fikirleri
  const [agentResearch, todayEvents, igVenueNews, briefingIdeas] = await Promise.all([
    fetchAgentResearch(date), fetchTodayEvents(date), fetchIgVenueNews(), fetchBriefingIdeas()]);
  if (agentResearch) console.log('  ↳ agent araştırması eklendi (agency_jobs)');
  if (todayEvents) console.log('  ↳ bugünkü site etkinlikleri eklendi');
  if (igVenueNews) console.log('  ↳ IG mekan sinyalleri eklendi (ig-venue-news)');
  if (briefingIdeas) console.log('  ↳ 07:00 brifing gazete fikirleri eklendi (content-ideas)');

  const brief = (it, n = 320) => it ? `[${it.category || '-'}] ${it.title}\n${(it.summary || it.content || '').slice(0, n)}` : '';
  const prompt =
    `Kalkan (Antalya) için günlük tatilci gazetesi editörüsün. Aşağıda ham haber kaynakları var. ` +
    `Bunları OLGUSAL, abartısız, haber-ajansı tonunda EDİTÖRYAL metne dönüştür. ` +
    `SADECE verilen bilgiyi yeniden yaz/özetle — YENİ olgu, isim, tarih veya rakam UYDURMA. ` +
    `Mümkünse Kalkan/Kaş/Patara/tatilci açısını öne çıkar. Türkçe. KISA VE ÖZ yaz (reels için):\n` +
    `- lead.headline: max 9 kelime, çekici.\n` +
    `- lead.deck: TEK kısa cümle (max 16 kelime).\n` +
    `- lead.body: 2 kısa paragraf.\n` +
    `- col1/col3.title: max 7 kelime.\n` +
    `- col1/col3.body: TEK kısa cümle özet (max 13 kelime) — başlığı tamamlasın, tekrar etmesin.\n` +
    `- magazine.headline: max 8 kelime; magazine.body: 1 cümle.\n\n` +
    `MANŞET KAYNAK:\n${brief(lead)}\n\nSÜTUN-1 KAYNAK:\n${brief(col1)}\n\nSÜTUN-3 KAYNAK:\n${brief(col3)}\n\nMAGAZİN KAYNAK:\n${brief(mag)}` +
    (todayEvents ? `\n\nBUGÜNKÜ ETKİNLİKLER (site verisi — col1/magazine için kullanılabilir):\n${todayEvents}` : '') +
    (agentResearch ? `\n\nAJANS ARAŞTIRMASI (bugün muhabir/magazin ajanlarının derlediği — kaynak; yeni olgu UYDURMA):\n${agentResearch}` : '') +
    (igVenueNews ? `\n\nKALKAN MEKAN IG SİNYALLERİ (mekanların public gönderilerinden — magazin/mekan açısı; caption dışı olgu UYDURMA):\n${igVenueNews}` : '') +
    (briefingIdeas ? `\n\nSABAH AJANS BRİFİNGİ — GAZETE FİKİRLERİ (28 ajanın 07:00 araştırmasından; olgusal kalın):\n${briefingIdeas}` : '');

  const SCHEMA = `{"lead":{"headline":"...","deck":"...","body":"..."},"col1":{"title":"...","body":"..."},"col3":{"title":"...","body":"..."},"magazine":{"headline":"...","body":"..."}}`;
  const jsonRules =
    `\n\nÇOK ÖNEMLİ ÇIKTI KURALI: Yanıtın SADECE geçerli bir JSON nesnesi olsun. ` +
    `Markdown, kod bloğu (\`\`\`), açıklama veya başka metin EKLEME. ` +
    `Tam olarak şu anahtarları kullan (Türkçe değerlerle doldur):\n${SCHEMA}`;

  // Küçük modeller (nvidia 8B) bazen bozuk/çift-escape JSON verir → sağlam parse + 3 deneme.
  const parseJson = (text) => {
    let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    for (const cand of [t, t.replace(/\\"/g, '"').replace(/\\n/g, ' '), t.replace(/\\\\/g, '\\')]) {
      try { const j = JSON.parse(cand); if (j && j.lead) return j; } catch {}
    }
    return null;
  };
  let ed, provider;
  const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
  for (let attempt = 1; attempt <= 3 && !ed; attempt++) {
    try {
      const res = await cheapLLM(prompt + jsonRules, { system: EDITORIAL_SYSTEM, json: true, timeoutMs: 180000, maxTokens: 900, temperature: 0.3, order: ['groq', 'cerebras', 'nvidia', 'gemini', 'claude'] });
      const parsed = parseJson(res.text);
      if (parsed && parsed.lead && parsed.lead.headline) { ed = parsed; provider = res.provider; }
      else console.warn(`  deneme ${attempt}: geçersiz JSON, tekrar...`);
    } catch (e) { console.warn(`  deneme ${attempt}: ${String(e.message || e).slice(0, 80)}`); }
  }
  if (!ed) { console.warn('⚠ 3 denemede geçerli içerik alınamadı — editöryal atlandı (RSS fallback).'); return; }

  const toParas = (t) => String(t || '').split(/\n{2,}|\r?\n/).map(s => s.trim()).filter(Boolean);
  const out = {
    date,
    generated_at: new Date().toISOString(),
    provider: provider || 'unknown',
    source_ids: [lead, col1, col3, mag].filter(Boolean).map(i => i.id),
    // getNews() ile aynı alan adları — doğrudan spread edilir. Görsel/tarih ham kaynaktan.
    lead_headline: ed.lead.headline,
    lead_deck: ed.lead.deck || '',
    lead_body: toParas(ed.lead.body),
    lead_byline: `Kalkan Today Editör · ${lead.source || 'derleme'}`,
    // Foto grounding: RSS gerçek fotosu grounded ise koru; generic/boşsa yer-farkında gerçek Kalkan fotosu.
    lead_image: groundPhoto(lead.image, { id: lead.id, title: lead.title, category: lead.category, matchText: `${lead.title} ${lead.summary || ''}` }),
    lead_caption: `Foto: ${lead.source || 'Kalkan Today arşivi'} · ${lead.category || ''}`.trim(),
    col1_title: ed.col1?.title || col1?.title,
    col1_byline: `Bülten · ${col1?.category || ''}`,
    col1_body: ed.col1?.body || '',
    col3_title: ed.col3?.title || col3?.title,
    col3_byline: `Sahil · ${col3?.category || ''}`,
    col3_body: ed.col3?.body || '',
    magazine_lead_headline: ed.magazine?.headline || '',
    magazine_lead_body: toParas(ed.magazine?.body),
  };
  await writeFile(join(ROOT, 'data', 'gazete-today.json'), JSON.stringify(out, null, 2));
  console.log(`✓ Editöryal içerik üretildi (sağlayıcı: ${out.provider}) → data/gazete-today.json`);
  console.log(`  Manşet: "${out.lead_headline}"`);

  // Haftalık bülten için dated arşiv (Pazar build-bulten-reel bunu okur). gazete-today.json
  // her gün üzerine yazılıyor → o günün editöryalini tarihli sabitle. Idempotent (üzerine yazar).
  try {
    const archDir = join(ROOT, 'data', 'gazete-archive');
    await mkdir(archDir, { recursive: true });
    await writeFile(join(archDir, `${out.date}.json`), JSON.stringify(out, null, 2));
    console.log(`  ↳ arşivlendi: data/gazete-archive/${out.date}.json`);
  } catch (e) { console.warn('  ⚠ arşiv yazılamadı (non-fatal):', e.message); }
}

main().catch(e => { console.error('[gazete-editorial]', e); process.exit(0); }); // bozma: hata olsa da build devam
