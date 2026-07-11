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

// Her ajana KENDİ uzmanlık alanını zorla → tüm ajanlar aynı temaya (ör. "gizli koylar") gitmesin.
// Anahtarlar data/agency/agents.json'daki ajan id'leriyle birebir eşleşir (28 ajan).
const AGENT_FOCUS = {
  'writer':          'ODAK: Hikaye anlatımı, yerel ses, marka dili. IG/sosyal caption odaklı.',
  'guard':           'ODAK: Marka güvenliği, ton uyumu, risk tespiti. İçerik önce güvenli olmalı.',
  'analyst':         'ODAK: Metrik, büyüme, rakam. Hangi içerik türü daha fazla etkileşim getiriyor?',
  'growth':          'ODAK: Büyüme kanalları, partnership, viral potansiyel. Yeni kitle nasıl çekilir?',
  'ads':             'ODAK: Reklam açısı, conversion, CTA. Ücretli dağıtım için hangi içerik?',
  'reception':       'ODAK: Turist soruları, concierge bilgisi, pratik bilgi. Ne soruyorlar?',
  'reels-uretici':   'ODAK: Video formatı, hook, montaj ritmi. Hangi sahne reel olur?',
  'ilan-uzmani':     'ODAK: İş ilanları, yerel istihdam, sezonluk fırsatlar.',
  'bulten-editoru':  'ODAK: Haftalık bülten, özetleme, seçici editöryal.',
  'director':        'ODAK: Bugün için TEK en yüksek etkili içerik kararı. Hepsini değil, BİRİNİ seç.',
  'trend':           'ODAK: Trend sinyalleri, hashtag fırsatları, zamanında içerik.',
  'yayin-yonetmeni': 'ODAK: Sayı kurgusu, manşet hiyerarşisi, gazete yapısı.',
  'muhabir':         'ODAK: Yerel haber, olay, teyit. Gerçek olgu, kaynak atfı.',
  'foto-editoru':    'ODAK: Görsel seçimi, kompozisyon, aydınlık/sakin estetik.',
  'magazin-editoru': 'ODAK: Gece hayatı, kültür, lezzet, magazin tonu.',
  'gazete-sosyal':   'ODAK: Gazete içeriğini IG/FB\'ye uyarla, kısa ve paylaşılabilir.',
  'reklam-uyum':     'ODAK: Yasal uyum, ilan etiketleme, KVKK riski.',
  'news-verifier':   'ODAK: Haber doğrulama, kaynak güvenilirliği, çelişki tespiti.',
  'hava-plan':       'ODAK: Hava durumu bazlı program önerileri, aktivite planlaması.',
  'gazete-reel-en':  'ODAK: İngilizce reel script, uluslararası turist dili, BBC tarzı kısalık.',
  'tatil-planner':   'ODAK: Tatil rotaları, konaklama önerileri, gün planları.',
  'gezgin-rehber':   'ODAK: Antik kentler, Likya Yolu, tarihi rehberlik.',
  'menu-chef':       'ODAK: Yöresel lezzetler, restoran menüsü, balık/zeytinyağı mutfağı.',
  'provider-matcher':'ODAK: Villa/transfer/tekne sağlayıcı eşleştirme, rezervasyon.',
  'dil-cevirmen':    'ODAK: Çeviri kalitesi, kültürel adaptasyon, çok dilli içerik.',
  'deploy-agent':    'ODAK: Site teknik sağlığı, performans, deploy sorunları.',
  'audit-agent':     'ODAK: İçerik kalite denetimi, tutarsızlık, eksik bilgi.',
  'kvkk-guardian':   'ODAK: KVKK/GDPR uyumu, kişisel veri, hukuki risk.',
};

// Ham LLM metninden JSON nesnesi ayıkla (kod bloğu/gürültü toleranslı; hafif onarım denemeleri ile).
function extractJsonObject(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
  const candidates = [t, t.replace(/\\"/g, '"'), t.replace(/\\\\/g, '\\'), t.replace(/,\s*([}\]])/g, '$1')];
  for (const c of candidates) {
    try { const j = JSON.parse(c); if (j && typeof j === 'object') return j; } catch {}
  }
  return null;
}

// Bir "fikir" nesnesini {tur, baslik, aci} biçimine normalize et (rol-şeması ne olursa olsun).
function normalizeIdea(x, defaultTur = 'gazete') {
  if (!x) return null;
  if (typeof x === 'string') return { tur: defaultTur, baslik: x, aci: '' };
  const baslik = x.baslik || x.konu || x.manset || x.title || x.baslik_tr || x.headline || '';
  const aci = x.aci || x.acik || x.aciklama || x.spot || x.ozet || x.aci_tr || x.pitch || '';
  const tur = /reel/i.test(String(x.tur || x.format || x.format_onerisi || '')) ? 'reels' : (x.tur || defaultTur);
  if (!baslik && !aci) return null;
  return { tur, baslik: String(baslik), aci: String(aci) };
}

// Bir metin/nesne alanını tek satırlık string'e indir (kalkan_guncel için).
function coerceText(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const parts = [v.manset, v.spot, v.ozet, v.acik, v.aciklama, v.govde, v.karar, v.genel_not, v.durum]
      .filter(x => typeof x === 'string' && x.trim());
    if (parts.length) return parts.join(' — ');
    try { return JSON.stringify(v).slice(0, 200); } catch { return ''; }
  }
  return String(v);
}

/**
 * Herhangi bir geçerli JSON çıktısını birleşik BRIEF_SCHEMA'ya ({kalkan_guncel, icerik_fikirleri, gelistirme})
 * normalize eder. Ajanlar kendi rol-şemalarıyla (director→secilen_fikir, trend→sinyaller, muhabir→manset/spot,
 * reklam-uyum→karar/genel_not vb.) dönse bile içerik kaybolmaz — süzülüp ortak yapıya taşınır.
 */
function parseJson(text) {
  const j = extractJsonObject(text);
  if (!j) return null;

  // 1) kalkan_guncel — string ya da nesne (manşet/spot) olabilir; başka rol alanlarından da türet.
  let kalkan_guncel = coerceText(
    j.kalkan_guncel ?? j.manset ?? j.karar ?? j.genel_not ?? j.durum ?? j.ozet ?? '');

  // 2) icerik_fikirleri — birçok rol-şemasından topla.
  let ideas = [];
  if (Array.isArray(j.icerik_fikirleri)) ideas = j.icerik_fikirleri;
  else if (Array.isArray(j.sinyaller)) ideas = j.sinyaller;            // trend
  else if (Array.isArray(j.fikirler)) ideas = j.fikirler;
  else if (j.secilen_fikir) ideas = [j.secilen_fikir];                 // director (tek karar)
  else if (j.manset || j.govde) ideas = [{ baslik: j.manset, aci: j.spot || j.govde }]; // muhabir
  const icerik_fikirleri = ideas.map(x => normalizeIdea(x)).filter(Boolean);

  // 3) gelistirme — geliştirme önerisi ya da rol karşılığı.
  const gelistirme = coerceText(
    j.gelistirme ?? j.oneri ?? j.sonraki_gun_notu ?? j.genel_not ?? '');

  // muhabir gibi kalkan_guncel'i olmayan ama manşeti olan ajanlarda gözlemi doldur.
  if (!kalkan_guncel && icerik_fikirleri.length) kalkan_guncel = icerik_fikirleri[0].baslik;

  // Hiçbir anlamlı alan yoksa (tamamen alakasız/bozuk) → başarısız say.
  if (!kalkan_guncel && !icerik_fikirleri.length && !gelistirme) return null;

  return { kalkan_guncel, icerik_fikirleri, gelistirme, _raw_schema: Object.keys(j).slice(0, 8).join(',') };
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

// ─────────────────────────────────────────────────────────────────────────────
// Düzeltme B — Anti-Slop + Çeşitlilik
// ─────────────────────────────────────────────────────────────────────────────

// Başlığı karşılaştırma/kota için normalize et (Türkçe küçük harf, noktalama temizliği).
function normalizeTitle(s) {
  return String(s || '')
    .toLocaleLowerCase('tr')
    .replace(/['’"`]/g, '')
    .replace(/[^a-zçğıöşü0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Klişe/slop kalıpları — bu ifadeleri içeren başlıklar elenir (Düzeltme B).
const CLICHE_RE = [
  /s[ıi]rr[ıi]/i,            // "sırrı"
  /gizli cennet/i,
  /saklı cennet/i,
  /ke[sş]fedilmey/i,        // "keşfedilmeyi bekleyen"
  /fısıltı/i,
  /efsane[sd]en daha fazlası/i,
  /zaman yolculuğu/i,
  /likya'?n[ıi]n kalbi/i,
  /bir efsane mi/i,
];

// İki başlık arasındaki örtüşme katsayısı (0-1). 0.70+ → benzer sayılır.
function titleSimilarity(a, b) {
  const A = new Set(normalizeTitle(a).split(' ').filter(w => w.length > 2));
  const B = new Set(normalizeTitle(b).split(' ').filter(w => w.length > 2));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

// Bir ajana bugünkü içerik sütununu ata (birden fazla varsa gün bazında döngüsel seç).
function assignColumn(agentColumns, id, dayNum) {
  const cols = agentColumns[id];
  if (!Array.isArray(cols) || cols.length === 0) return null; // teknik ajan → içerik üretmez
  return cols[dayNum % cols.length];
}

/**
 * İçerik fikirlerini klişe/kota/benzerlik/rol açısından süzer ve çeşitlendirir (Düzeltme B).
 * @param {Array} ideas - düzleştirilmiş fikir listesi ({agent, baslik, aci, tur, ...}).
 * @param {object} cfg - content-columns.json içeriği.
 * @param {object} history - topic-history.json içeriği ({topics:[{topic,baslik,date}]}).
 * @returns {{ kept: Array, dropped: Array, history: object }}
 */
export function filterAndDiversify(ideas, cfg, history) {
  const agentColumns = cfg.agentColumns || {};
  const quota = cfg.dailyTopicQuota || {};
  const dropped = [];
  const kept = [];

  // 7 günlük rolling pencere için tarih eşiği.
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const recent = (history.topics || []).filter(t => {
    const d = new Date(t.date || 0);
    return !isNaN(d) && d >= cutoff;
  });

  // Bir başlığın eşleştiği kota konusunu bul (normalize edilmiş içerme kontrolü).
  const quotaKeys = Object.keys(quota);
  function matchedTopic(baslik) {
    const norm = normalizeTitle(baslik);
    return quotaKeys.find(k => norm.includes(normalizeTitle(k))) || null;
  }

  // Bugün her konu için sayaç — geçmiş (7g) + bugün eklenenler.
  const todayCount = {};
  for (const t of recent) {
    if (t.topic) todayCount[t.topic] = (todayCount[t.topic] || 0) + 1;
  }

  const newHistoryEntries = [];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

  for (const idea of ideas) {
    const baslik = idea.baslik || idea.fikir || '';

    // (4) Rol denetimi: teknik ajan (agentColumns boş) fikir ürettiyse ele.
    const cols = agentColumns[idea.agent];
    if (Array.isArray(cols) && cols.length === 0) {
      dropped.push({ ...idea, _neden: 'rol-ihlali (teknik ajan içerik üretemez)' });
      console.log(`  ⊘ elendi [rol]: ${idea.agent} — "${baslik.slice(0, 60)}"`);
      continue;
    }

    // (1) Klişe filtresi.
    const cliche = CLICHE_RE.find(re => re.test(baslik));
    if (cliche) {
      dropped.push({ ...idea, _neden: `klişe (${cliche.source})` });
      console.log(`  ⊘ elendi [klişe]: "${baslik.slice(0, 60)}"`);
      continue;
    }

    // (3) Benzerlik dedup: daha önce KABUL edilenlerden birine %70+ benziyorsa ele.
    const dup = kept.find(k => titleSimilarity(k.baslik || k.fikir || '', baslik) >= 0.70);
    if (dup) {
      dropped.push({ ...idea, _neden: `benzer başlık ("${(dup.baslik || '').slice(0, 40)}")` });
      console.log(`  ⊘ elendi [benzer]: "${baslik.slice(0, 60)}"`);
      continue;
    }

    // (2) Konu kotası.
    const topic = matchedTopic(baslik);
    if (topic) {
      const limit = quota[topic];
      const used = todayCount[topic] || 0;
      if (used >= limit) {
        dropped.push({ ...idea, _neden: `kota aşımı ("${topic}" limit ${limit})` });
        console.log(`  ⊘ elendi [kota]: "${baslik.slice(0, 60)}" (${topic} ${used}/${limit})`);
        continue;
      }
      todayCount[topic] = used + 1;
      newHistoryEntries.push({ topic, baslik, date: today });
    }

    kept.push(idea);
  }

  // Kalan (klişe olmayan ama kota konusu da olmayan) başlıkları da geçmişe ekleyerek
  // ileride benzerlik takibi güçlensin.
  history.topics = [...recent, ...newHistoryEntries];
  return { kept, dropped, history };
}

async function main() {
  console.log(`\n════ GÜNLÜK BRİFİNG — ${date} ════`);
  const agents = (await readJson('data/agency/agents.json', { agents: {} })).agents;
  // Düzeltme B: içerik sütunları + kota yapılandırması (yoksa boş varsayılan).
  const columnsCfg = await readJson('data/agency/content-columns.json',
    { columns: {}, agentColumns: {}, dailyTopicQuota: {} });
  const dayNum = Math.floor(Date.parse(date) / (24 * 3600 * 1000)); // gün bazlı döngüsel atama için
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

    // Düzeltme B — ÖN-ATAMA: her ajana bugünkü içerik sütununu ver.
    const assignedColumn = assignColumn(columnsCfg.agentColumns || {}, id, dayNum);
    const isTechnical = Array.isArray((columnsCfg.agentColumns || {})[id]) &&
      (columnsCfg.agentColumns || {})[id].length === 0;
    const columnDirective = isTechnical
      ? `\n★ ROL SINIRI: Sen TEKNİK bir ajansın. İÇERİK FİKRİ ÜRETME (icerik_fikirleri BOŞ dizi olsun). ` +
        `Yalnızca kendi teknik alanında 'gelistirme' önerisi ver.\n`
      : assignedColumn
        ? `\n★ BUGÜNKÜ İÇERİK SÜTUNUN: "${assignedColumn}" — fikirlerini ÖNCELİKLE bu sütuna odakla.\n`
        : '';

    const task =
      `Bugün ${date}. Sen Kalkan turizm markası için içerik üreticisisin. Kalkan hakkında SÜREKLİ yeni haber çıkmaz — ` +
      `görevin taze haberi tekrarlamak DEĞİL; ROLÜNE göre ÖZGÜN, ZAMANSIZ (evergreen), ilgi çekici içerik üretmek.\n\n` +
      `${KALKAN_PILLARS}\n` +
      `${viralDirective}\n` +
      `${columnDirective}\n` +
      `(Opsiyonel taze sinyaller — YALNIZ gerçekten turistik/ilginç ise kullan; ihale/ÇED/meclis/bürokratik/rutin haberi ASLA kullanma):\n${signals}` +
      `${dataFeed}\n\n` +
      `ROLÜNE göre üret:\n` +
      `1) kalkan_guncel: alanında bugün işlenebilecek 1 taze VEYA zamansız açı (kısa; yoksa güçlü bir evergreen açı).\n` +
      `2) icerik_fikirleri: gazete VEYA reels için 1-2 ÖZGÜN içerik — her biri {tur, baslik (çekici başlık), aci (1 cümle: ne anlatır)}. ` +
      `Tarih/işletme hikayesi/kültür/lezzet/doğa gibi EVERGREEN'e öncelik ver.\n` +
      `3) gelistirme: KalkanInfo'yu (kalkaninfo.com) geliştirecek 1 somut öneri.\n\n` +
      `ODAK: Kendi uzmanlık alanına EN YAKIN sütundan üret, başka ajanın alanına kayma — ör. lezzet ajanı→yemek/işletme hikayesi, rehber→tarih/antik, magazin→gece hayatı/kültür, provider→villa/konaklama açısı. Aynı klişe başlığı ("Kalkan'da bir gün") tekrarlama.\n` +
      `SENİN ÖZEL ODAK ALANI (başka ajanın işine kayma): ${AGENT_FOCUS[id] || ''}\n` +
      `KURALLAR: Tarih/efsane için genel bilgiye dayan (Patara/Likya iyi belgeli). İŞLETMEYE ÖZEL rakam/tarih (kaç yıllık, ciro vb.) UYDURMA — ` +
      `açıyı öner, gerçek detayın işletmeden alınacağını belirt. Klişe/dolgu/övgü yok. Türkçe.\n` +
      `★ ÇIKTI ŞEMASI ZORUNLU: Karakter tanımındaki kendi çıktı şemanı KULLANMA. YALNIZCA aşağıdaki birleşik şemayı, ` +
      `başka hiçbir alan eklemeden ve markdown/kod bloğu olmadan döndür. icerik_fikirleri en fazla 2 öğe, her alan kısa tut.\n` +
      `SADECE şu JSON: ${BRIEF_SCHEMA}`;

    if (DRY) { console.log(`  [dry] ${id}`); continue; }
    let out = null;
    for (let attempt = 1; attempt <= 2 && !out; attempt++) {
      try {
        const res = await cheapLLM(task, {
          system: charSys + know, json: true, maxTokens: 700, temperature: 0.4,
          // Karakter ajanları KALİTE ister → RouteLLM (akıllı güçlü model) önce, ücretsiz fallback sonra.
          order: (process.env.CHEAP_LLM_ORDER || 'routellm,groq,cerebras,nvidia,gemini,claude').split(','), timeoutMs: 60000,
        });
        out = parseJson(res.text);
        if (out) out._provider = res.provider;
        // Ayrıştırma başarısız olduysa (LLM cevabı geldi ama JSON değil) nedeni gör:
        else if (attempt === 2) {
          const preview = String(res.text || '').replace(/\s+/g, ' ').slice(0, 160);
          console.log(`    ⚠ ${id} — JSON ayrıştırılamadı (provider=${res.provider || '?'}): "${preview}"`);
        }
      } catch (e) {
        // Sessiz yutma YOK: son denemede hata mesajını logla (secret basmadan, kısaltarak).
        if (attempt === 2) {
          const msg = String(e?.message || e || 'bilinmeyen hata')
            .replace(/(key|token|secret|bearer|authorization)[=:\s"']+[^\s"']+/gi, '$1=***')
            .slice(0, 160);
          console.log(`    ⚠ ${id} — hata: ${msg}`);
        }
      }
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
  const rawIdeas = results.flatMap(r => (r.icerik_fikirleri || []).map(i => ({
    agent: r.id, department: r.department, tur: i.tur || 'gazete',
    baslik: i.baslik || '', aci: i.aci || i.fikir || '',
    fikir: [i.baslik, i.aci || i.fikir].filter(Boolean).join(' — '),
  }))).filter(i => i.fikir);

  // ─── Düzeltme B: Anti-Slop + Çeşitlilik süzgeci ───
  const history = await readJson('data/agency/topic-history.json', { topics: [] });
  const { kept: ideas, dropped, history: newHistory } =
    filterAndDiversify(rawIdeas, columnsCfg, history);
  await writeFile(join(ROOT, 'data', 'agency', 'topic-history.json'),
    JSON.stringify(newHistory, null, 2));
  console.log(`✓ Çeşitlilik süzgeci: ${rawIdeas.length} ham → ${ideas.length} kaldı · ${dropped.length} elendi`);

  await writeFile(join(ROOT, 'data', 'agency', 'content-ideas.json'),
    JSON.stringify({ date, generated_at: new Date().toISOString(), ideas, dropped }, null, 2));
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

// Yalnızca doğrudan CLI olarak çalıştırıldığında main() koş (import edildiğinde değil — test/yeniden kullanım için).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error('[morning-briefing]', e); process.exit(0); });
}
