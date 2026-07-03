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
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const PLACE_RX = [/\bkalkan\b/i, /\bkaş\b/i, /\bpatara\b/i, /\bkaputaş\b/i, /\bletoon\b/i,
  /\bksanthos\b/i, /\bxanthos\b/i, /\bantalya\b/i, /\blik[iy]a\b/i, /\bsaklıkent\b/i,
  /\bislamlar\b/i, /\bbezirgan\b/i, /\bçukurbağ\b/i, /\bkalamar\b/i];
const CATS = { Turizm: 2, Plaj: 2, Etkinlik: 2, Kültür: 2, Belediye: 0, Gündem: 0, Hava: 1, Asayiş: -3 };
function score(it) {
  const txt = `${it.title || ''} ${it.summary || ''}`;
  let s = 0;
  for (const rx of PLACE_RX) if (rx.test(txt)) { s += 2; break; }
  if (/\bkalkan\b/i.test(txt)) s += 2;
  const src = it.source || '';
  if (/kalkan/i.test(src)) s += 3; else if (/körfez|antalya/i.test(src)) s += 1; else s -= 4;
  s += CATS[it.category] ?? 0;
  return s;
}

async function main() {
  console.log(`\n════ GAZETE EDİTÖRYAL — ${date} ════`);
  let data;
  try { data = JSON.parse(await readFile(join(ROOT, 'data', 'haberler.json'), 'utf8')); }
  catch { console.warn('⚠ haberler.json okunamadı — editöryal atlandı (build RSS ile devam).'); return; }
  const items = (data.items || []).filter(it => it.title);
  if (!items.length) { console.warn('⚠ Haber yok — editöryal atlandı.'); return; }

  const ranked = items.map(it => ({ it, s: score(it) }))
    .sort((a, b) => b.s - a.s || (b.it.date || '').localeCompare(a.it.date || ''))
    .map(r => r.it);

  const lead = ranked[0];
  const col1 = ranked.find(it => it !== lead && ['Etkinlik', 'Kültür', 'Belediye', 'Gündem'].includes(it.category)) || ranked[1];
  const col3 = ranked.find(it => it !== lead && it !== col1 && ['Plaj', 'Turizm', 'Hava'].includes(it.category)) || ranked[2] || ranked[1];
  const mag  = ranked.find(it => it !== lead && it !== col1 && it !== col3) || ranked[1];

  const brief = (it, n = 320) => it ? `[${it.category || '-'}] ${it.title}\n${(it.summary || it.content || '').slice(0, n)}` : '';
  const prompt =
    `Kalkan (Antalya) için günlük tatilci gazetesi editörüsün. Aşağıda ham haber kaynakları var. ` +
    `Bunları OLGUSAL, abartısız, haber-ajansı tonunda EDİTÖRYAL metne dönüştür. ` +
    `SADECE verilen bilgiyi yeniden yaz/özetle — YENİ olgu, isim, tarih veya rakam UYDURMA. ` +
    `Türkçe. Manşet başlığı kısa ve çekici (max 12 kelime), deck 1-2 cümle, body 2 kısa paragraf. ` +
    `Sütun başlıkları max 8 kelime, body 2-3 cümle. Magazin arka yüz için hafif, davetkâr ton.\n\n` +
    `MANŞET KAYNAK:\n${brief(lead)}\n\nSÜTUN-1 KAYNAK:\n${brief(col1)}\n\nSÜTUN-3 KAYNAK:\n${brief(col3)}\n\nMAGAZİN KAYNAK:\n${brief(mag)}`;

  const schemaHint = `Yanıtı SADECE şu JSON şemasıyla ver: ` +
    `{"lead":{"headline":"","deck":"","body":""},"col1":{"title":"","body":""},"col3":{"title":"","body":""},"magazine":{"headline":"","body":""}}`;

  let ed, provider;
  try {
    const { cheapJSON } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
    const res = await cheapJSON(prompt, { system: schemaHint });
    ed = res.data; provider = res.provider;
  } catch (e) {
    console.warn('⚠ cheap-llm başarısız — editöryal atlandı (build RSS ile devam):', String(e.message || e).slice(0, 120));
    return;
  }
  if (!ed || !ed.lead || !ed.lead.headline) { console.warn('⚠ LLM geçerli JSON vermedi — editöryal atlandı.'); return; }

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
    ...(lead.image ? { lead_image: lead.image } : {}),
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
}

main().catch(e => { console.error('[gazete-editorial]', e); process.exit(0); }); // bozma: hata olsa da build devam
