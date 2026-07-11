#!/usr/bin/env node
/**
 * scripts/agency/growth-agent.mjs — Büyüme & Gelir Ajanı
 * -------------------------------------------------------
 * 1) Kitle analizini IG metrikleri üzerinden özetler (ig-report.json).
 * 2) Hat başına içerik önerisi üretir (loadLines + counts).
 * 3) Venue'ları premium harita pini / reklam adayı olarak puanlar (scoreLeads).
 * 4) Tüm bulguları data/agency/growth-report.json dosyasına yazar.
 *
 * CLI:
 *   node scripts/agency/growth-agent.mjs
 *
 * Programatik:
 *   import { analyze, scoreLeads } from './growth-agent.mjs';
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ── .env.local yükle (yerel; CI/SuperComputer'da env zaten dolu) ─────────────
try {
  const p = join(ROOT, '.env.local');
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch {}

// ── İmport'lar (dinamik — .env.local yüklendikten sonra) ─────────────────────
const { loadLines, counts } = await import('./brand-router.mjs');
const { cheapLLM } = await import('../../lib/cheap-llm.mjs');

// ── Yardımcı: JSON dosyası oku, yoksa fallback döndür ────────────────────────
function readJson(rel, fallback = null) {
  try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function writeJson(rel, obj) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// ── scoreLeads: Deterministik venue puanlama ──────────────────────────────────
/**
 * Venue'ları premium onboarding potansiyeline göre sırala.
 * Formül: rating * log10(reviewCount + 1)  → yerleşik + değerli mekanlar üste çıkar.
 * Web/IG varlığı bonus +0.3 (ulaşılabilirlik).
 * Dönüş: En iyi 15 lead [{id, name, category, rating, reviewCount, website, instagram, score, reason}]
 */
export function scoreLeads(venues) {
  if (!Array.isArray(venues) || venues.length === 0) return [];

  const scored = venues.map((v) => {
    const rating = Number(v.rating) || 0;
    const reviews = Number(v.reviewCount) || 0;
    const hasWeb = !!(v.website && v.website.trim());
    const hasIG = !!(v.instagram && v.instagram.trim());
    const base = rating * Math.log10(reviews + 1);
    const bonus = (hasWeb ? 0.2 : 0) + (hasIG ? 0.1 : 0);
    const score = Math.round((base + bonus) * 100) / 100;

    // Kısa Türkçe gerekçe
    const webIG = hasWeb && hasIG ? 'web+IG var' : hasWeb ? 'web var' : hasIG ? 'IG var' : 'web/IG yok';
    const reviewLabel = reviews >= 500 ? `${reviews}+ yorum` : reviews >= 100 ? `${reviews} yorum` : `${reviews} yorum`;
    const tier = score >= 3.5 ? 'yüksek değerli, premium pin adayı' : score >= 2 ? 'iyi aday, outreach açılabilir' : 'potansiyel var, daha az bilinir';
    const reason = `${rating} puan, ${reviewLabel}, ${webIG} → ${tier}`;

    return { id: v.id, name: v.name, category: v.category || v.catLabel || '', rating, reviewCount: reviews, website: v.website || null, instagram: v.instagram || null, score, reason };
  });

  return scored
    .filter((v) => v.reviewCount > 0 && v.rating > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

// ── Kitle özeti (IG verisinden) ───────────────────────────────────────────────
function buildAudienceSummary(ig) {
  if (!ig) {
    return {
      note: 'IG metriği yok — bağlanınca dolar',
      takipci: null,
      reach30: null,
      engagement_rate: null,
      topDemografi: null,
      enIyi: null,
      enZayif: null,
    };
  }

  const takipci = ig.profil?.takipci || 0;
  const reach30 = ig.son_30_gun?.reach || 0;
  const etkilesim = ig.son_30_gun?.toplam_etkilesim || 0;
  const engagement_rate = takipci > 0 ? Math.round((etkilesim / takipci) * 1000) / 10 : null;

  // En baskın demografi
  const demo = ig.demografi_ulke || {};
  const topCountry = Object.entries(demo).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Paylaşım/kaydetme oranı (en iyi içerik sinyali)
  const gonderi = ig.gonderiler || [];
  const avgShares = gonderi.length ? Math.round(gonderi.reduce((s, g) => s + (g.shares || 0), 0) / gonderi.length) : 0;

  return {
    note: `${takipci} takipçi | 30 gün reach: ${reach30} | etkileşim: ${etkilesim} | ER: ${engagement_rate ?? '?'}%`,
    takipci,
    reach30,
    toplam_etkilesim: etkilesim,
    engagement_rate,
    gonderi_sayisi: gonderi.length,
    ort_shares: avgShares,
    topDemografi: topCountry,
    enIyi: ig.en_iyi || null,
    enZayif: ig.en_zayif || null,
  };
}

// ── Heuristic per-line öneriler (LLM fallback) ────────────────────────────────
function heuristicLineRec(line, queueLen, ig) {
  const id = line.id;
  const active = line.active !== false;
  if (!active) return `Hesap henüz açılmamış (tokenEnv: ${line.tokenEnv}). Açılınca içerik sıraya alınabilir.`;

  const takipci = ig?.profil?.takipci || 0;
  const reach = ig?.son_30_gun?.reach || 0;

  if (id === 'kalkaninfo') {
    if (queueLen === 0) return 'Kuyruk boş — hemen Patara/plaj/villa reels veya EN içerik ekle. İngilizce öncelik (küresel turist hedef kitle).';
    if (queueLen < 3) return `${queueLen} öğe kuyrukta — günlük yayın için en az 7 öğeye çıkar. EN içerik oranını %60'a taşı.`;
    return `${queueLen} öğe kuyrukta. İngilizce/Rusça içerik oranını izle; takipçi büyümesi için #kalkanturkey + #lycia hashtagleri ekle.`;
  }
  if (id === 'haber') return `${queueLen} öğe kuyrukta. Hesap açıldığında belediye/turizm haberlerine odaklan; TR dil önceliği.`;
  if (id === 'magazin') return `${queueLen} öğe kuyrukta. Gece hayatı ve etkinlik içerikleri EN+RU kitlesine hitap eder — hesap açılınca DE/RU kitleye yönelik içerik.`;
  if (id === 'tv') return `${queueLen} öğe kuyrukta. Kısa sokak röportajı videoları (Berkay çekimi) hesap açılınca hızlı traction sağlar.`;
  return `${queueLen} öğe kuyrukta.`;
}

// ── Ana analiz fonksiyonu ─────────────────────────────────────────────────────
/**
 * @param {{ write?: boolean }} opts
 * @returns {Promise<object>} growth raporu
 */
export async function analyze({ write = true } = {}) {
  // Veri yükle
  const ig = readJson('data/agency/ig-report.json', null);
  const venueData = readJson('data/harita-mekanlar.json', { venues: [] });
  const venues = venueData.venues || [];
  const lines = loadLines().lines;
  const queueCounts = counts();

  // 1) Kitle özeti
  const audience = buildAudienceSummary(ig);

  // 2) Hat bazlı analiz — tek LLM çağrısı ile tüm hatları birlikte değerlendir
  let perLine;
  const activeLine = lines.find((l) => l.active !== false && l.id === 'kalkaninfo');
  const takipci = ig?.profil?.takipci || 0;
  const reach30 = ig?.son_30_gun?.reach || 0;

  try {
    const linesSummary = lines.map((l) => `${l.id} (${l.name}, aktif:${l.active !== false}, kuyruk:${queueCounts[l.id] ?? 0})`).join('; ');
    const igSummary = ig
      ? `takipçi:${takipci}, 30 gün reach:${reach30}, etkilesim:${ig.son_30_gun?.toplam_etkilesim}, en_iyi:${ig.en_iyi?.date}(reach:${ig.en_iyi?.reach},shares:${ig.en_iyi?.shares}), demografi:${JSON.stringify(ig.demografi_ulke)}`
      : 'IG metriği yok';

    const prompt = `Sen Kalkan Info sosyal medya ajansının büyüme danışmanısın. Aşağıdaki marka hatları ve IG metriklerine göre HER HAT için TEK SATIR Türkçe öneri yaz (hat adı: öneri formatında).

Hatlar: ${linesSummary}

IG metrikleri: ${igSummary}

Bağlam: Kalkan = Türkiye'nin Ege-Akdeniz tatil bölgesi. Hedef kitle: EN (İngiliz/Avrupalı turist) > RU > DE > TR. Yazın pik sezon. Takipçi sayısı düşük (${takipci}) ama reach/takipçi oranı yüksek = büyüme aşaması.

Her satır: "hat_id: öneri" formatında. Sadece ${lines.length} satır, açıklama yok.`;

    const { text, provider } = await cheapLLM(prompt, { maxTokens: 400, temperature: 0.3 });

    // LLM çıktısını satırlara böl ve hat id ile eşleştir
    const lineMap = Object.fromEntries(lines.map((l) => [l.id, null]));
    for (const row of text.split(/\r?\n/).filter(Boolean)) {
      const m = row.match(/^([a-z]+):\s*(.+)$/i);
      if (m) {
        const id = m[1].toLowerCase().trim();
        if (id in lineMap) lineMap[id] = m[2].trim();
      }
    }

    perLine = lines.map((l) => ({
      line: l.id,
      name: l.name,
      active: l.active !== false,
      queue: queueCounts[l.id] ?? 0,
      recommendation: lineMap[l.id] || heuristicLineRec(l, queueCounts[l.id] ?? 0, ig),
    }));
  } catch (llmErr) {
    // LLM başarısız → heuristic fallback
    perLine = lines.map((l) => ({
      line: l.id,
      name: l.name,
      active: l.active !== false,
      queue: queueCounts[l.id] ?? 0,
      recommendation: heuristicLineRec(l, queueCounts[l.id] ?? 0, ig),
    }));
  }

  // 3) Dil önerisi (IG demografi baz)
  const demografi = ig?.demografi_ulke || {};
  const totalDemo = Object.values(demografi).reduce((s, n) => s + n, 0) || 1;
  const trPct = Math.round(((demografi.TR || 0) / totalDemo) * 100);
  const gbPct = Math.round(((demografi.GB || 0) / totalDemo) * 100);
  const dePct = Math.round(((demografi.DE || 0) / totalDemo) * 100);

  const languages = {
    note: ig
      ? `Demografi: TR %${trPct}, GB %${gbPct}, DE %${dePct} (diğer: ${Object.entries(demografi).filter(([k]) => !['TR','GB','DE'].includes(k)).map(([k,v])=>`${k}:${v}`).join(', ') || '-'})`
      : 'IG demografi verisi yok',
    recommendation: trPct > 80
      ? 'Kitle çok TR-ağırlıklı. İngilizce içerik oranını artır (#kalkanturkey, #lycia hashtagleri), Avrupalı turist kitlesine açıl. DE ve RU dil içerikleri de dene.'
      : 'EN içerik öncelikli. Reach yüksek olduğu için EN/TR karışık kuyruk idealdir. Yazın pik sezon RU içerik dene.',
  };

  // 4) Monetizasyon: venue liderler
  const leads = scoreLeads(venues);

  // Outreach pitch şablonu (Türkçe)
  const pitch = `Merhaba [İŞLETME_ADI],

Kalkan Info olarak bölgenin en kapsamlı dijital rehberiyiz (kalkaninfo.com).
Her sezon binlerce yerli/yabancı ziyaretçi haritamızı ve Instagram sayfamızı kullanıyor.

[İŞLETME_ADI]'nı haritamızda öne çıkarmak, premium pin ile görünürlüğünüzü artırmak ve
@kalkan.info sosyal medyasında tanıtmak ister misiniz?

Premium üyelik paketi:
• Kalkan Info haritasında öne çıkan pin (sarı/vurgulu)
• Aylık 1 organik Instagram tanıtım içeriği
• Haftalık IG story mention

Detaylar için WhatsApp veya DM yoluyla ulaşabilirsiniz.

Kalkan Info Ekibi`;

  // 5) TopActions
  const topActions = buildTopActions(audience, perLine, leads, ig);

  // Rapor
  const report = {
    generatedAt: new Date().toISOString(),
    provider: 'growth-agent',
    audience,
    perLine,
    languages,
    monetization: { leads, pitch },
    topActions,
  };

  if (write) {
    writeJson('data/agency/growth-report.json', report);
  }

  return report;
}

// ── TopActions: 3-5 somut adım ───────────────────────────────────────────────
function buildTopActions(audience, perLine, leads, ig) {
  const actions = [];

  // Kuyruk boş veya düşükse
  const mainLine = perLine.find((l) => l.line === 'kalkaninfo');
  if (mainLine && mainLine.queue < 5) {
    actions.push(`Kalkan Info kuyruğuna acil içerik ekle (şu an: ${mainLine.queue} öğe). Hedef: en az 7 sıraya-alınmış reel/post.`);
  }

  // Takipçi düşükse
  const takipci = audience.takipci || 0;
  if (takipci < 500) {
    actions.push(`Takipçi büyütme kampanyası: #kalkanturkey #lycia #kaş hashtagleri + EN dilinde en az haftada 3 reel. Hedef: 500 takipçiye ulaş.`);
  }

  // Website tıklanma düşükse
  const webTik = ig?.son_30_gun?.website_tik || 0;
  if (webTik < 100) {
    actions.push(`IG bio link'i güçlendir (kalkaninfo.com/harita veya öne çıkan içerik). 30 günde ${webTik} website tıkı — arttırmak için her reels açıklamasında "link bio'da" yaz.`);
  }

  // Monetizasyon: ilk lead
  if (leads.length > 0) {
    const top = leads[0];
    actions.push(`Premium onboarding için ilk outreach: "${top.name}" (${top.category}, ${top.score} puan). Pitch mesajını gönder.`);
  }

  // İnaktif hatlar
  const inactiveCount = perLine.filter((l) => !l.active).length;
  if (inactiveCount > 0) {
    actions.push(`${inactiveCount} marka hattı (haber/magazin/tv) hesap beklıyor. Token alındığında bu hatların kuyruğu hazır — önce haber hattını aktife al.`);
  }

  return actions.slice(0, 5);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Büyüme & Gelir Ajanı çalışıyor...\n');
  try {
    const report = await analyze({ write: true });

    // Kitle özeti
    console.log('── KİTLE ANALİZİ ─────────────────────────────────────');
    console.log(report.audience.note);
    if (report.audience.enIyi) {
      console.log(`  En iyi içerik: ${report.audience.enIyi.date} — reach:${report.audience.enIyi.reach}, shares:${report.audience.enIyi.shares}`);
    }
    if (report.audience.topDemografi) {
      console.log(`  Baskın demografi: ${report.audience.topDemografi}`);
    }

    // Dil önerisi
    console.log('\n── DİL ÖNERİSİ ───────────────────────────────────────');
    console.log(report.languages.note);
    console.log(report.languages.recommendation);

    // Per-line
    console.log('\n── HAT BAZLI ÖNERİLER ────────────────────────────────');
    for (const l of report.perLine) {
      const status = l.active ? 'CANLI' : 'bekliyor';
      console.log(`  [${status}] ${l.name} (${l.line}) — kuyruk:${l.queue}`);
      console.log(`    → ${l.recommendation}`);
    }

    // Top leads
    console.log('\n── MONETİZASYON: İLK 5 LEAD ──────────────────────────');
    for (const lead of report.monetization.leads.slice(0, 5)) {
      console.log(`  ${lead.score.toFixed(2)} | ${lead.name} (${lead.category})`);
      console.log(`    ${lead.reason}`);
    }

    // TopActions
    console.log('\n── SIRADAKI AKSIYONLAR ────────────────────────────────');
    report.topActions.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));

    console.log('\nRapor yazıldı: data/agency/growth-report.json');
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
}
