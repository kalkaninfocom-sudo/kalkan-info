/**
 * scripts/agency/ig-news-harvest.mjs — İZLENEN IG HESAPLARINDAN HABER HASADI → GAZETE + "KALKAN İNFO HABER"
 *
 * AKIŞ:
 *   1. ig-venue-watch.mjs küratörlü public hesapları izler → data/ig-venue-news.json (ham sinyaller).
 *   2. Bu script her sinyale 3-KARARLI KAPI uygular (cheapLLM): (a) is_news — gerçek haber mi yoksa reklam mı?
 *      (b) usable — kalkaninfo.com'da yayınlamaya uygun mu? (c) scope — coğrafi SEPET: kalkan | kas | bolge | alakasiz.
 *   3. Geçenleri KENDİ CÜMLEMİZLE (olgusal, kısa) yeniden yazar + kaynak atfı ekler → SEPETE koyar (status:pending):
 *      data/agency/sepet/{kalkan,kas,bolge}.json. (haberler.json'a DOĞRUDAN yazmaz — insan seçimi/onayı beklenir.)
 *   4. basket-publish.mjs sepetten seçileni haberler.json'a taşır → gazete-editorial.mjs + ig-news-post.mjs okur
 *      → GAZETE + "Kalkan İnfo Haber" IG kartı. Böylece "çok sepetten bize uygun içeriği seç → yayınla" akışı.
 *
 * HUKUKİ/EDİTÖRYAL GÜVENLİK (önemli):
 *   - Başkasının FOTOĞRAF/VİDEOSU yeniden yayınlanmaz. Görsel alanı boş/nötr bırakılır; IG kartı ig-news-card.mjs
 *     ile KENDİ tasarımımızdan üretilir. (Olgular telife tabi değildir; ifade/görsel tabidir.)
 *   - Caption ve içerik başkasının metninden kopyalanmaz; olgu alınıp KENDİ sözcüklerimizle yazılır.
 *   - Her habere kaynak atfı: "Kaynak: @hesap".
 *   - Uydurma YOK: sadece gönderide GERÇEKTEN yazan olguyu işler; emin değilse eler.
 *
 * Kullanım:
 *   node scripts/agency/ig-news-harvest.mjs            # ig-venue-news.json'ı işle → haberler.json'a ekle
 *   node scripts/agency/ig-news-harvest.mjs --watch    # önce ig-venue-watch çalıştır (taze sinyal), sonra hasat et
 *   node scripts/agency/ig-news-harvest.mjs --dry       # sadece göster, haberler.json'a yazma
 *   node scripts/agency/ig-news-harvest.mjs --min 0.6   # haber-değeri eşiği (varsayılan 0.55)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkImagePermission } from '../../lib/image-permission-guard.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry');
const RUN_WATCH = ARGS.includes('--watch');
const MIN = (() => { const i = ARGS.indexOf('--min'); return i >= 0 ? parseFloat(ARGS[i + 1]) : 0.55; })();

// .env.local yükle (secret loglanmaz)
const env = { ...process.env };
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const slug = (s) => String(s || '').toLowerCase()
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

async function readJson(rel, fallback) { try { return JSON.parse(await readFile(join(ROOT, rel), 'utf8')); } catch { return fallback; } }

// ── PII / hassas içerik ön-süzgeci (LLM'siz, sert kural) — trajedi/kişisel veri → insan onayı zorunlu ──
const SENSITIVE_RE = /(?:^|[^\p{L}])(öl(?:dü|üm|en|müş|dürül)|(?:hayat|yaşam)[ıi]n[ıi]?\s*(?:kaybet|yitir)|can\s*(?:verdi|kayb|ver)|vefat|cenaze|ceset|kazada|kazası|kazasında|trafik\s*kaza|iş\s*kaza|boğul|boğdu|boğularak|yaralan|intihar|cinayet|gözalt|tutukland|mağdur|taciz|istismar|darp)/iu;
const PII_RE = /(T\.?C\.?\s?\d{6,})|(\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b)/; // TC kimlik no / plaka (kaba)
function looksSensitive(...texts) { return texts.some(t => { const s = String(t || ''); return SENSITIVE_RE.test(s) || PII_RE.test(s); }); }

const GATE_SCHEMA = '{"is_news":true|false,"usable":true|false,"scope":"kalkan|kas|bolge|alakasiz","category":"Gündem|Etkinlik|İşletme|Kültür|Uyarı","news_value":0.0-1.0,"editorial_score":0.0-1.0,"emotion":"bilgi|moral|pratik|uyari|olumsuz","sensitive":true|false,"placement":"haberler|etkinlikler|mekan|pazar|magazin|ig-only","our_headline":"kendi sözcüklerimizle kısa haber başlığı","our_summary":"2-3 cümle olgusal özet, kendi sözcüklerimizle, uydurma yok"}';

async function gate(cheapLLM, item) {
  const prompt =
    `Aşağıda bir Kalkan/Kaş bölgesi sosyal medya hesabından alınan içerik sinyali var. Kalkan İnfo Haber Merkezi editörü olarak şu KARARLARI ver:\n` +
    `1) is_news — GERÇEK haber mi? HABER = açılış/kapanış, etkinlik/konser/festival, önemli duyuru, olay/kaza, sezon/hava/deniz uyarısı, rekor, yeni hizmet. HABER DEĞİL = indirim/kampanya/"happy hour"/rezervasyon çağrısı/genel reklam/rutin paylaşım/sadece estetik manzara.\n` +
    `2) usable — kalkaninfo.com'da (turiste ve yerel halka hitap eden yerel rehber/haber sitesi) yayınlamaya UYGUN mu? UYGUN = turizm, yerel yaşam, etkinlik, işletme, gastronomi, ulaşım, kültür/tarih, hava/deniz uyarısı, belediye hizmet duyurusu. UYGUN DEĞİL = particık/siyasi kavga, kişisel/magazinsel çekişme, doğrulanamayan iddia, rahatsız edici/graphic içerik, bölgeyle alakasız ulusal haber, saf reklam.\n` +
    `3) scope — coğrafi SEPET: "kalkan" = doğrudan Kalkan · "kas" = Kaş merkez/ilçe · "bolge" = çevre (Patara, Kınık, köyler, Antalya bölgesel) · "alakasiz" = bölgeyle ilgisiz.\n` +
    `4) editorial_score (0-1) + emotion — KİTLE-PSİKOLOJİSİ lensi: içerik okuyucuya değer/duygu katıyor mu? emotion = bilgi (nötr bilgilendirme) | moral (olumlu/moral yükseltici) | pratik (işe yarar/yönlendirici) | uyari (dikkat/güvenlik) | olumsuz (üzücü/olumsuz). DİKKAT: öfke/clickbait/sansasyon ödüllendirme — editorial_score bunu YÜKSELTMEZ; sakin, gerçek, faydalı içerik yüksek skor alır.\n` +
    `5) sensitive (true/false) — MARKA/ETİK bayrağı: ölüm/kaza/trajedi, özel kişinin adı/kimliği/mağdur bilgisi, doğrulanamayan iddia, hassas/graphic konu → true (insan onayı ZORUNLU, sansasyon YOK). Emin değilsen true.\n` +
    `6) placement — bu içerik sitede NEREYE ait? "haberler" (genel haber) | "etkinlikler" (tarihli etkinlik/festival) | "mekan" (belirli restoran/otel/işletme) | "pazar" (pazar/market) | "magazin" (gazete arka yüz hafif içerik) | "ig-only" (sadece IG kartı, siteye değil).\n` +
    `Haber VE uygun ise: olguyu KENDİ SÖZCÜKLERİMİZLE (kopyalamadan) kısa başlık + 2-3 cümle özete çevir. UYDURMA YOK — sadece sinyalde geçen olgu. Emin değilsen is_news=false veya usable=false.\n\n` +
    `Hesap: ${item.venueName} (@${item.username})\nKategori: ${item.category}\nSinyal: "${item.headline}"\n\n` +
    `SADECE şu JSON: ${GATE_SCHEMA}`;
  try {
    const res = await cheapLLM(prompt, {
      system: 'Sen Kalkan Info Haber Merkezi editörüsün. Titiz, olgusal, sakin; reklamı haberden ve sansasyonu değerden ayıran, etik gözeten bir muhabirsin. Türkçe.',
      json: true, maxTokens: 420, temperature: 0.2,
      order: (env.CHEAP_LLM_ORDER || 'groq,cerebras,nvidia,gemini,claude').split(','), timeoutMs: 45000,
    });
    let t = String(res.text || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0];
    const j = JSON.parse(t); j._provider = res.provider; return j;
  } catch (e) { return null; }
}

async function main() {
  console.log('\n════ IG HABER HASADI ════');

  if (RUN_WATCH) {
    console.log('→ ig-venue-watch çalıştırılıyor (taze IG sinyali)...');
    try { execFileSync('node', [join(ROOT, 'scripts', 'ig-venue-watch.mjs')], { stdio: 'inherit', env }); }
    catch { console.warn('⚠ ig-venue-watch atlandı (non-fatal)'); }
    console.log('→ fb-page-harvest çalıştırılıyor (taze FB sinyali)...');
    try { execFileSync('node', [join(ROOT, 'scripts', 'agency', 'fb-page-harvest.mjs')], { stdio: 'inherit', env }); }
    catch { console.warn('⚠ fb-page-harvest atlandı (non-fatal)'); }
  }

  const venue = await readJson('data/ig-venue-news.json', { items: [] });
  const signals = venue.items || [];
  if (!signals.length) { console.log('İşlenecek mekan sinyali yok (ig-venue-news.json boş).'); return; }

  // Sepetler (staging/kuyruk): kalkan / kas / bolge. Yayınlanmış haberler.json + sepetler = "görüldü".
  const SCOPES = ['kalkan', 'kas', 'bolge'];
  const SEPET_DIR = join(ROOT, 'data', 'agency', 'sepet');
  const baskets = {};
  for (const sc of SCOPES) baskets[sc] = await readJson(`data/agency/sepet/${sc}.json`, { items: [] });

  const haberler = await readJson('data/haberler.json', []);
  const published = Array.isArray(haberler) ? haberler : (haberler.items || []);
  const seenUrls = new Set([
    ...published.map(h => h.sourceUrl).filter(Boolean),
    ...SCOPES.flatMap(sc => (baskets[sc].items || []).map(i => i.sourceUrl).filter(Boolean)),
  ]);

  const { cheapLLM } = await import(pathToFileURL(join(ROOT, 'lib', 'cheap-llm.mjs')).href);
  const today = new Date().toISOString().slice(0, 10);
  const accepted = [], rejected = [];

  for (const s of signals) {
    if (seenUrls.has(s.permalink)) continue; // zaten işlendi (yayında veya sepette)
    const g = await gate(cheapLLM, s);
    if (!g) { console.log(`  ? ${s.venueName} — kapı çalışmadı (atlandı)`); continue; }
    const val = g.news_value ?? 0;
    const scope = SCOPES.includes(g.scope) ? g.scope : 'alakasiz';
    if (!g.is_news || g.usable === false || scope === 'alakasiz' || val < MIN) {
      const why = !g.is_news ? 'haber değil'
        : g.usable === false ? "kalkaninfo'ya uygun değil"
        : scope === 'alakasiz' ? 'bölge dışı'
        : 'haber-değeri düşük';
      rejected.push({ venue: s.venueName, val, why });
      console.log(`  ✗ ${s.venueName} (${val.toFixed(2)}) — ${why}, elendi`);
      continue;
    }
    const PLACEMENTS = ['haberler', 'etkinlikler', 'mekan', 'pazar', 'magazin', 'ig-only'];
    const placement = PLACEMENTS.includes(g.placement) ? g.placement : 'haberler';
    const sensitive = g.sensitive === true || looksSensitive(s.headline, g.our_summary, g.our_headline);
    // Görsel İzni Bekçisi (Düzeltme A): kaynak hesabın görseli kullanılabilir mi?
    // Not: Bu script zaten kendi kartımızı üretir (image:''), başkasının görselini
    // asla doğrudan koymaz. Yine de izin bilgisini item'e taşıyoruz ki ileride kart
    // üreten katman (ig-news-card) kredi satırını kullanabilsin ve izin denetlenebilsin.
    const izin = checkImagePermission(s.username, 'dijital');
    if (!izin.allowed) {
      console.log(`    ↳ görsel izni: @${s.username} — ${izin.reason} (kendi kartımız üretilecek)`);
    }
    const item = {
      id: `${slug(g.our_headline)}-${today}`,
      title: g.our_headline,
      category: g.category || 'İşletme',
      scope,                                       // coğrafi sepet: kalkan | kas | bolge
      placement,                                   // siteye yerleşim: haberler|etkinlikler|mekan|pazar|magazin|ig-only
      editorial_score: typeof g.editorial_score === 'number' ? g.editorial_score : val,
      emotion: g.emotion || 'bilgi',               // kitle-psikolojisi tonu
      sensitive,                                   // trajedi/PII/doğrulanamaz → insan onayı zorunlu
      date: today,
      image: '',                                   // KENDİ kartımız üretilir; başkasının görseli KULLANILMAZ
      imageCredit: izin.allowed ? izin.creditLine : null, // izin varsa kart üzerinde gösterilecek kredi satırı
      summary: g.our_summary,
      content: g.our_summary,
      tags: ['Kalkan İnfo Haber', scope === 'kalkan' ? 'Kalkan' : scope === 'kas' ? 'Kaş' : 'Bölge'],
      source: `Kalkan İnfo Haber — Kaynak: @${s.username}`,
      sourceUrl: s.permalink,
      status: sensitive ? 'hold' : 'pending',      // hold = hassas, açık insan onayı şart; pending = seçime hazır
      _origin: s._origin || 'ig-curated',
      _provider: g._provider,
    };
    accepted.push(item);
    seenUrls.add(s.permalink);
    const flag = sensitive ? ' ⚠HASSAS(hold)' : '';
    console.log(`  ✓ [${scope}→${placement}] ${s.venueName} (skor ${item.editorial_score.toFixed(2)}·${item.emotion}) → "${g.our_headline}"${flag}`);
    await new Promise(r => setTimeout(r, 600)); // kota-dostu
  }

  const byScope = accepted.reduce((m, i) => ((m[i.scope] = (m[i.scope] || 0) + 1), m), {});
  const scopeStr = Object.entries(byScope).map(([k, v]) => `${k}:${v}`).join(' ') || '-';
  console.log(`\nÖzet: ${accepted.length} içerik sepete geçti (${scopeStr}) · ${rejected.length} elendi · ${signals.length} sinyal tarandı`);

  if (DRY) { console.log('\n[dry] sepetlere yazılmadı. Geçenler:\n', JSON.stringify(accepted, null, 2)); return; }
  if (!accepted.length) { console.log('Yeni içerik yok — sepetler değişmedi.'); return; }

  await mkdir(SEPET_DIR, { recursive: true });
  for (const sc of SCOPES) {
    const add = accepted.filter(i => i.scope === sc);
    if (!add.length) continue;
    baskets[sc].items = [...add, ...(baskets[sc].items || [])];
    baskets[sc].updated = today;
    await writeFile(join(SEPET_DIR, `${sc}.json`), JSON.stringify(baskets[sc], null, 2));
    console.log(`✓ ${add.length} içerik → data/agency/sepet/${sc}.json (status:pending)`);
  }
  console.log(`\nSonraki adım: node scripts/agency/basket-publish.mjs --list  → seç → gazete + "Kalkan İnfo Haber" IG akışına gönder.`);
}

main().catch(e => { console.error('[ig-news-harvest]', e.message); process.exit(1); });
