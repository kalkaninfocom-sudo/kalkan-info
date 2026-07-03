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
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
    `Mümkünse Kalkan/Kaş/Patara/tatilci açısını öne çıkar. Türkçe. KISA VE ÖZ yaz (reels için):\n` +
    `- lead.headline: max 9 kelime, çekici.\n` +
    `- lead.deck: TEK kısa cümle (max 16 kelime).\n` +
    `- lead.body: 2 kısa paragraf.\n` +
    `- col1/col3.title: max 7 kelime.\n` +
    `- col1/col3.body: TEK kısa cümle özet (max 13 kelime) — başlığı tamamlasın, tekrar etmesin.\n` +
    `- magazine.headline: max 8 kelime; magazine.body: 1 cümle.\n\n` +
    `MANŞET KAYNAK:\n${brief(lead)}\n\nSÜTUN-1 KAYNAK:\n${brief(col1)}\n\nSÜTUN-3 KAYNAK:\n${brief(col3)}\n\nMAGAZİN KAYNAK:\n${brief(mag)}`;

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
