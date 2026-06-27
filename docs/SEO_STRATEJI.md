# kalkaninfo.com — SEO Stratejisi & Yol Haritası

> Sentez tarihi: 2026-06-27 · Kapsam: 8 denetim alanı → tek önceliklendirilmiş plan · Rol: Büyüme/SEO stratejisti

---

## 1. Yönetici Özeti

### Dürüst gerçeklik: "Kalkan'da #1" hedefi

Sitenin **teknik SEO sağlığı güçlü** (B+): 273 URL'lik sitemap, temiz robots.txt, AI crawler erişimi, optimize LCP, tam güvenlik header seti, tip-doğru zengin JSON-LD ve 170+ canlı işletme detay sayfası.

Ama "kalkan" tek kelimesinde #1 olmak **gerçekçi bir hedef değil**:
- **"kalkan" çok anlamlı** (kalkan balığı, savunma kalkanı, Kalkan beldesi) → intent belirsiz.
- **Jenerik turizm terimleri** SERP'inde Wikipedia, Booking, TripAdvisor, Etstur, Tatilbudur gibi **DA 80-90+ devler** oturuyor. Cepheden yarışmak israf.
- **Site bir dizindir** → kendi adına harita 3-pack'inde çıkamaz; harita paketi tek tek mekanların GBP işidir.

### Ulaşılabilir hedef: uzun-kuyruk hâkimiyeti
- **Marka/navigasyonel** ("kalkan info") → zaten #1 garanti. Koru.
- **Uzun-kuyruk niyet sorguları** ("kalkanda balık restoranı önerileri", "kalkan tekne turu fiyatları 2026", "kaputaş plajı nasıl gidilir") → OTA'ların sığ kaldığı alan. **1. sayfa GERÇEKÇİ.**
- **Çok dilli turist sorguları** (İngiliz pazarı büyük) → altyapı var, doğru kurgulanırsa ciddi trafik.

**Stratejik özet:** "kalkan" tek kelimesini KOVALAMA. 170+ sayfalık envanteri uzun-kuyruk niyete bağla, canonical/hreflang çakışmalarını şablon düzeyinde temizle, pillar içeriklerle backlink kazan.

### En kritik 3 yara
1. **Canonical ↔ redirect çakışması** (trailing-slash + .html) → 273 URL'in çoğu canonical olarak bir 308'i işaret ediyor. Crawl bütçesi yanıyor. Tek satır + şablon ile çözülür.
2. **Listeleme → detay statik iç link YOK** (kartlar JS ile basılıyor) → link equity akmıyor.
3. **Hreflang tamamen geçersiz** (`?lang=` URL'lerine işaret, canonical çıplak TR'ye gidiyor) → 5 dil sinyali yok sayılıyor; 270 detay TR-only iken sahte çok dilli sinyal.

---

## 2. Mimari İçgörü — "Tek sayfa değil, ŞABLON+VERİ düzeltilir"

**Detay sayfaları elle yazılmıyor:**
```
data JSON  →  build-all.mjs → build-*-pages.mjs + render.js → inject-seo.mjs  →  170+ statik sayfa
```

**Sonuç:** Bir sayfadaki bug (trailing-slash canonical, eksik `<a href>`, sahte `og:locale:alternate`, yanlış telefon) **170 sayfada birden** vardır. Tek sayfayı elle düzeltmek hem israf hem regresyon kaynağı.

**Altın kural — her düzeltme 3 katmandan birinde:**

| Katman | Ne düzeltilir | Örnek |
|---|---|---|
| **Şablon** (`build-*-pages.mjs`, `render.js`, `inject-seo.mjs`) | Ortak HTML/SEO yapısı | canonical biçimi, hreflang, breadcrumb, ItemList, JSON-LD |
| **Veri** (data JSON) | Sayfaya özgü değerler | telefon, adres, geo, kategori, çeviri |
| **Global config** (`vercel.json`, `robots.txt`, `build-sitemap.mjs`) | Site geneli davranış | trailingSlash, cleanUrls, sitemap üretimi |

> "Bir sayfayı düzelt, 169'unu kopyala" YASAK. Bug şablonda; düzeltme şablonda; build; 170 sayfa birden temizlenir. Paralel-agent ölçeklenmesinin tek yolu.

---

## 3. Önceliklendirilmiş Aksiyon Listesi

**Sahip:** Agent (otomatik kod) / Berkay (manuel, off-page, karar)

### 🔴 P0 — Bu hafta (yüksek etki, düşük efor, kökü şablonda)

| # | Aksiyon | Etki | Efor | Dosya/Katman | Sahip |
|---|---|---|---|---|---|
| P0-1 | **Trailing-slash çakışmasını kapat**: `vercel.json` → `trailingSlash:true` VEYA şablonda slash'ı kaldır. `curl -I` ile 200 doğrula | Yüksek | Düşük | `vercel.json` | Agent |
| P0-2 | **.html + /index.html temizle**: top-level canonical + sitemap loc uzantısız (`/restoranlar.html`→`/restoranlar`, `/index.html`→`/`) | Yüksek | Düşük | `inject-seo.mjs` | Agent |
| P0-3 | **Geçersiz telefon**: `+90-242-CONCIERGE` → gerçek E.164 veya kaldır | Yüksek | Düşük | `index.html:127` | Agent |
| P0-4 | **Self-serving aggregateRating kaldır**: 11 tur (TouristTrip yıldız desteklemez + manuel ceza riski) | Yüksek | Düşük | tur şablonu | Agent |
| P0-5 | **Çalışmayan SearchAction**: gerçek `?q=` arama bağla veya WebSite şemasından çıkar | Orta | Düşük | `index.html` | Agent |
| P0-6 | **i18n DEFAULT_LANG 'en'→'tr'**: html lang/og:locale/x-default ile hizala | Orta | Düşük | `js/i18n.js` | Agent |
| P0-7 | **Ana sayfa H1**: logo span'de kalsın, metin → *"Kalkan Gezi & Tatil Rehberi — Villa, Restoran, Plaj, Tur"* | Yüksek | Düşük | `index.html:176` | Agent |
| P0-8 | **GSC + Bing'e sitemap gönder**, "Page with redirect"/"Duplicate canonical" izle, impression çek | Yüksek | Düşük | panel | Berkay |

### 🟠 P1 — 2-4 hafta (yüksek etki, orta efor, ölçeklenir)

| # | Aksiyon | Etki | Efor | Dosya/Katman | Sahip |
|---|---|---|---|---|---|
| P1-1 | **Listeleme→detay statik link**: ilk N kartı `<a href="/villa/[slug]/">` prerender + `<noscript>` fallback | Yüksek | Orta | `build-*-pages.mjs` | Agent |
| P1-2 | **Görünür breadcrumb** `<nav>` (Anasayfa › Villalar › X) → detay→listeleme link + UX | Orta | Düşük | detay şablonları | Agent |
| P1-3 | **Detay→detay cross-link**: "Yakındaki/Benzer/Diğer" (3-4 anchor). Lykia kümesi (xanthos↔letoon↔patara) öncelik | Yüksek | Orta | detay şablon+data | Agent |
| P1-4 | **build-sitemap.mjs sıfırdan**: FS'ten tara, lastmod=git/mtime, build-all'a bağla | Orta | Orta | yeni script | Agent |
| P1-5 | **Sahte og:locale:alternate kaldır**: TR-only 270 detaydan yanlış çok dilli sinyali sök | Yüksek | Orta | detay şablonları | Agent |
| P1-6 | **Listeleme ItemList**: restoranlar/oteller/plajlar/aktiviteler (villalar.html şablon) | Orta | Orta | listeleme şablonları | Agent |
| P1-7 | **Restoran FAQ + niyet metni**: "Kalkan'da Nerede Yenir" + FAQPage schema | Orta | Orta | `restoranlar.html` | Agent |
| P1-8 | **NewsArticle schema + /haber/[slug]/**: gazete generate script'e JSON-LD + yazar byline | Yüksek | Orta | gazete script | Agent |
| P1-9 | **NAP standardizasyonu**: GBP yazımıyla birebir address+telephone+geo, tek format | Yüksek | Orta | data JSON | Berkay+Agent |
| P1-10 | **Berber/hizmet konum**: best-barber geo Fethiye ama locality Kalkan → eşle veya kaldır | Orta | Orta | `hizmet/*` data | Agent |

### 🟡 P2 — 1-3 ay (orta etki / yüksek efor / off-page)

| # | Aksiyon | Etki | Efor | Dosya/Katman | Sahip |
|---|---|---|---|---|---|
| P2-1 | **Path-tabanlı çok dilli build** (`/en/`, `/de/`): self-canonical + geçerli hreflang + sitemap xhtml:link | Yüksek | Yüksek | build pipeline | Agent |
| P2-2 | **10 antik-kent data-de/ru/fr** (data-en pattern hazır; trgemma-t1 toplu çeviri) | Orta | Orta | antik-kent data | Agent (Ollama) |
| P2-3 | **2000+ kelime pillar rehberler** (5-6 küme): linklenebilir, OTA'nın zayıf derinliği | Yüksek | Yüksek | yeni `/kalkan-rehberi` | Agent+Berkay |
| P2-4 | **Backlink/citation kampanyası**: Kaş Belediyesi, GoTürkiye, Antalya turizm, TÜRSAB, İngiliz expat blogları | Yüksek | Yüksek | off-page | **Berkay** |
| P2-5 | **Places puan+yorum çek** → AggregateRating göster (sahte yorum YASAK) | Orta | Orta | detay şablon+API | Agent |
| P2-6 | **Entity disambiguation**: 4 kök varlığa `@id` + referans; TravelAgency+LocalBusiness birleştir; Place/TouristDestination | Orta | Düşük | `index.html` JSON-LD | Agent |
| P2-7 | **iletisim.html + ContactPage schema** (NAP, harita) — E-E-A-T | Düşük | Düşük | yeni sayfa | Agent |
| P2-8 | **Bar/club @type ayrıştır**: Restaurant → BarOrPub/NightClub/CafeOrCoffeeShop | Düşük | Orta | data+şablon | Agent |
| P2-9 | **Villa starRating:5 kaldır**, bozuk `<img>` self-closing `/` düzelt | Düşük | Düşük | şablonlar | Agent |
| P2-10 | **SiteNavigationElement** ana menü schema | Düşük | Düşük | `index.html` | Agent |

---

## 4. Hedef Anahtar Kelime Kümeleri (sayfa tipine göre)

> Formül: tek kelime "kalkan" DEĞİL → **{mekan tipi} + Kalkan + {modifier}** uzun-kuyruk.

### 🍽️ Restoran / Kafe / Bar
- **TR:** kalkanda nerede yenir · balık restoranı önerileri · eski şehir restoranları · kalkanda kahvaltı · gün batımı barları · deniz manzaralı restoran
- **EN:** best restaurants in Kalkan old town · where to eat in Kalkan · Kalkan seafood restaurants
- **DE:** beste Restaurants in Kalkan · **RU:** рестораны Калкан

### 🏨 Otel
- **TR:** kalkan otelleri eski kalkan · deniz manzaralı otel · kaş kalkan butik otel
- **EN:** boutique hotels in Kalkan · Kalkan vs Kaş where to stay · **DE:** Hotels in Kalkan · **RU:** отели Калкан

### 🏡 Villa
- **TR:** kalkan villa kiralama · deniz manzaralı kiralık villa · havuzlu villa kalkan · haftalık villa
- **EN:** Kalkan villas with pool · luxury villas Kalkan sea view · **DE:** Kalkan Villa mieten · **RU:** аренда виллы в Калкане

### 🏖️ Plaj
- **TR:** kalkan plajları hangileri · kaputaş plajı nasıl gidilir · kalkan beach club · en iyi plaj
- **EN:** Kalkan beaches Kaputas · best beach clubs Kalkan · **DE:** Strände Kalkan · **RU:** пляжи Калкан

### ⛵ Tur / Aktivite
- **TR:** kalkan tekne turu fiyatları 2026 · kalkanda yapılacaklar · günübirlik tekne · kalkan dalış
- **EN:** things to do in Kalkan Turkey · Kalkan boat trip prices · **DE:** Bootstour Kalkan · **RU:** морские прогулки Калкан

### 🛠️ Hizmet / Pratik
- **TR:** kalkan nöbetçi eczane · kalkan berber · nasıl gidilir antalya havalimanından · kalkan transfer
- **EN:** how to get to Kalkan from Antalya airport · Kalkan pharmacy

### 🏛️ Antik kent (Lykia cluster)
- **TR:** patara antik kenti · letoon · xanthos · kalkan çevresi antik kentler
- **EN:** Lycian ancient cities Xanthos Patara · ancient ruins near Kalkan

---

## 5. Off-Page / Yerel SEO — Berkay'in Yapması Gerekenler

### A. GBP gerçeği
- **Site kendi adına GBP'de sıralanamaz** (dizin). Harita 3-pack'i hedefleme.
- Detay sayfalarına **"Bu mekanın sahibi misin? GBP'ni doğrula"** CTA + partner mekanlara GBP optimizasyon rehberi (birincil kategori, NAP, foto, yorum).

### B. Yorum sinyali (yerel sıralamanın ~%17-26'sı)
- **3 hafta yorum gelmezse sıralama düşer.** Partner mekanlara **ayda 4-8 foto'lu taze yorum** akışı kur.
- Places API ile puan+sayı göster (sahte yorum YASAK — manuel ceza).

### C. Backlink/Citation (en yüksek ROI) — ilk 5 hedef
1. Kaş Belediyesi turizm sayfası
2. GoTürkiye (resmi portal)
3. Antalya İl Kültür ve Turizm
4. TÜRSAB üye/acente sayfaları
5. İngiliz Kalkan expat blogları + yerel haber + villa acenteleri

Yöntem: 2000+ kelime linklenebilir pillar rehber (P2-3) → guest post + kaynak sayfa stratejisi.

### D. NAP tutarlılığı
- 170 mekanın Yelp/TripAdvisor/Foursquare/GBP yazımıyla birebir aynı mı denetle. Tek format zorla (+90, açık adres), çelişkileri temizle.

### E. Search Console disiplini
- 273 URL doğrula, "kalkan ..." uzun-kuyruk sorgularda **pozisyon 5-15 düşük asılı meyveleri** (impression var, CTR düşük) bul → title/meta optimize et. En hızlı trafik kazancı.

---

## 6. Önerilen Uygulama Fazları (paralel-agent)

> Her faz `build-all.mjs` + `curl -I` doğrulaması olmadan kapanmaz. Kural: **şablon düzelt → build → doğrula.**

### Faz 1 — "Hijyen" (1-2 gün, tek agent, BLOKE EDEN)
P0-1…P0-7: vercel.json → inject-seo.mjs canonical → telefon → tur rating → SearchAction → i18n → H1. **Çıktı:** canonical↔redirect 0, geçersiz schema 0. Berkay paralelde GSC/Bing sitemap (P0-8).

### Faz 2 — "İç Linkleme & Crawl" (3-5 gün, 2 agent)
- **A:** statik kart prerender + noscript (P1-1), breadcrumb (P1-2), cross-link (P1-3).
- **B:** build-sitemap.mjs (P1-4), listeleme ItemList (P1-6).
- **Çıktı:** link equity akar, crawl güvenilir, sitemap senkron.

### Faz 3 — "Schema & İçerik" (3-5 gün, 2 agent)
- **A:** sahte og:locale temizliği (P1-5), entity @id (P2-6), @type ayrıştırma (P2-8), starRating/img fix (P2-9), SiteNav (P2-10).
- **B (içerik):** NewsArticle + /haber/ + byline (P1-8), restoran FAQ (P1-7), iletisim.html (P2-7).
- Berkay: NAP veri girişi (P1-9) + hizmet konum onayı (P1-10).

### Faz 4 — "Çok Dilli Statik Build" (1-2 hafta, 1 mimar + Ollama)
- Path-tabanlı `/en/ /de/ /ru/ /fr/`, self-canonical, geçerli hreflang, sitemap xhtml:link (P2-1).
- Antik-kent data-de/ru/fr toplu çeviri (P2-2, Ollama trgemma-t1).
- **Çıktı:** hreflang ilk kez GEÇERLİ; İngiliz/Alman/Rus trafiği açılır.

### Faz 5 — "Otorite & Off-Page" (sürekli, ağırlık Berkay'da)
- Pillar rehberler (P2-3), Places yorum entegrasyonu (P2-5).
- Backlink/citation + GBP partner teşviki + yorum velositesi (Bölüm 5).
- **Çıktı:** prominence yükselir, uzun-kuyruk sorgularda kalıcı 1. sayfa.

---

### Kapanış
Teknik temel hazır; asıl değer **şablon+veri düzeltmelerinin ölçeklenmesinde** ve **doğru hedefte** (uzun-kuyruk + çok dilli + off-page otorite), tek kelime "kalkan" hayalinde değil. Faz 1 bu hafta biterse, ay sonunda GSC'de "Duplicate canonical"/"Page with redirect" uyarıları sıfırlanır ve uzun-kuyruk impression'lar tırmanır.

---

## EK: Ham Denetim Bulguları (5/8 alan — 3 sayfa-tipi denetimi geçici API hatasıyla düştü)

### Teknik SEO Altyapısı (sitemap, robots, vercel.json, build, CWV)

**Durum:** Site teknik temeli sağlam: 273 URL'lik geniş kapsamlı sitemap, AI crawler'lara açık robots.txt, güçlü güvenlik header'ları ve preload+fetchpriority ile optimize edilmiş LCP. Ancak vercel.json (trailingSlash:false + cleanUrls:true) ile sitemap/canonical URL biçimleri çakışıyor: 244 trailing-slash ve 29 .html URL canonical olarak ilan edilip aynı anda 308 redirect'e uğruyor. Bu, crawl bütçesi israfı ve canonical zayıflaması yaratıyor.

**Güçlü yönler:**
- robots.txt temiz ve eksiksiz: admin/profil/login disallow, GPTBot/ClaudeBot/PerplexityBot/Google-Extended dahil AI crawler'lara açık, sitemap + Host direktifi mevcut
- X-Robots-Tag ile *.vercel.app preview domain'leri noindex/nofollow — duplicate indexleme engellenmiş
- LCP optimizasyonu güçlü: hero görseli rel=preload as=image fetchpriority=high + loading=eager, alt görseller loading=lazy, tüm img'lerde width/height set (CLS önler), webp format
- Güvenlik header seti tam (HSTS preload, CSP, X-Frame-Options DENY, nosniff, COOP/CORP) — E-E-A-T/güven sinyali
- Doğru cache stratejisi: statik asset'ler max-age=31536000 immutable, HTML 3600 must-revalidate, sw.js no-cache
- sw.js zararsız kill-switch'e indirgenmiş (eski sonsuz reload döngüsü çözülmüş) — Core Web Vitals'a olumsuz etki yok
- Sitemap kapsamı geniş: 270+ sayfa (restoran/hizmet/otel/villa/antik kent/tur detayları dahil)
- Homepage'de 5 dilli hreflang + x-default mevcut

**Boşluklar:**
- [high/medium] Trailing-slash çakışması: vercel.json trailingSlash:false iken sitemap'teki 244 URL ve detay sayfa canonical'ları trailing-slash'lı (örn. /restoran/aubergine/). Vercel bunları 308 ile slash'sız sürüme yönlendiriyor → canonical bir redirect URL'ini işaret ediyor, crawl bütçesi boşa gidiyor.
  - *Düzeltme:* Karar ver: ya vercel.json'da trailingSlash:true yap (mevcut canonical/sitemap ile uyumlu, en hızlı), ya da build-restoran-pages.mjs/build-*-pages.mjs + inject-seo.mjs içindeki canonical ve sitemap üretiminden trailing slash'ı kaldır (b.slug}/ -> b.slug). Sonra canlıda curl -I ile 200 mü 308 mi doğrula.
- [high/low] cleanUrls:true ile .html çakışması: sitemap'te 29 .html URL (restoranlar.html, oteller.html vb.) listeli ve canonical'lar da .html'li; cleanUrls .html'i 308 ile uzantısız sürüme yönlendiriyor. Ayrıca homepage canonical / iken sitemap /index.html listeliyor (redirect mismatch).
  - *Düzeltme:* Tüm top-level sayfaların canonical etiketlerini ve sitemap loc'larını uzantısız (clean) biçime çevir: /restoranlar.html -> /restoranlar, /index.html -> /. inject-seo.mjs içindeki key->URL eşlemesini düzelt.
- [medium/high] hreflang tutarsız: yalnızca homepage'de hreflang var, o da ?lang=en query-param tabanlı (Google ayrı sayfa saymaz, içerik JS ile değişiyor). 250+ detay sayfasında hiç hreflang yok.
  - *Düzeltme:* i18n client-side query-param olduğu için ya tüm sayfalardan query-param hreflang'i kaldır (TR tek dil olarak indexlensin, kafa karışıklığını önle) ya da gerçek path-tabanlı çok dilli sürümler (/en/...) üret. Kısa vadede detay sayfalarına self-referencing canonical yeterli.
- [medium/medium] Sitemap üretimi append-only ve kırılgan: script sitemap.replace('</urlset>', entry) ile string ekliyor, includes() ile dedup yapıyor ama silinen sayfaları temizlemiyor → zamanla ölü/orphan URL birikir. lastmod toplu damgalanmış (yalnızca 4 farklı tarih; 55 URL 2026-06-02'de donmuş), gerçek değişiklik tarihini yansıtmıyor.
  - *Düzeltme:* Sitemap'i her build'de sıfırdan üreten tek bir scripts/build-sitemap.mjs yaz; URL listesini dosya sisteminden (restoran/*/index.html, hizmet/*/ vb.) tara, lastmod'u dosya mtime veya git log'dan al. build-all.mjs'e ekle.
- [low/low] Bozuk self-closing img etiketleri: index.html'de img'ler style="..." / data-de-alt="..." biçiminde — '/' attribute'lardan önce yanlış konumda, parser data-de-alt/ru-alt/fr-alt'ı yok sayabilir, çok dilli alt-text swap'i bozulur.
  - *Düzeltme:* Tüm <img> etiketlerinde kapanış '/'sini sona taşı veya kaldır: <img ... style="..." data-de-alt="..." ...>. Şablon dosyalarında düzelt, yeniden build et.

**Hedef kelimeler:** kalkan rehberi · kalkan gezilecek yerler · kalkan restoranları · kalkan villa kiralama · kalkan plajları · kaş kalkan oteller · patara antik kenti · kalkan nöbetçi eczane · kalkan things to do · kalkan travel guide

**Hızlı kazanımlar:**
- vercel.json'da trailingSlash:true yap — tek satır değişiklikle 244 URL'lik canonical/redirect çakışmasını anında kapatır (canlıda curl -I ile doğrula)
- Sitemap ve top-level canonical'lardan .html uzantısını ve /index.html'i temizle, / kullan — cleanUrls redirect zincirini kırar
- Google Search Console'a sitemap.xml + sitemap-jobs.xml gönder ve Coverage raporunda 'Page with redirect' / 'Duplicate canonical' uyarılarını izle
- index.html'deki bozuk img '/' konumlarını düzelt — çok dilli alt-text ve geçerli HTML için
- Sitemap'i build'de sıfırdan üreten script yazıp build-all.mjs'e ekle (stale URL ve donmuş lastmod sorununu kökten çözer)

### Çok Dillilik & Hreflang (TR/EN/DE/RU/FR)

**Durum:** Site, çeviriyi sunucu tarafında değil tamamen istemci tarafında (js/i18n.js, data-* attribute swap + ?lang= query param) yapıyor. 5 dil switcher ve hreflang blokları yalnızca ~34 ana sayfada var; ~270 detay sayfası (otel/villa/tur/plaj/restoran/etkinlik) tek dilli (TR) olmasına rağmen 5 dilde içerik varmış gibi og:locale:alternate sinyali veriyor. Hreflang alternatifleri kanonik olmayan ?lang= URL'lerine işaret ettiği için Google tarafından büyük olasılıkla yok sayılıyor.

**Güçlü yönler:**
- js/i18n.js olgun bir istemci-tarafı i18n motoru: hedef→en→tr fallback zinciri, text/html/placeholder/title/alt/aria kapsamı, dinamik kartlar için MutationObserver, sonsuz döngü koruması (silent apply), ?lang= query param ve Plausible lang_switch takibi
- Ana sayfalarda (index, villalar, oteller, restoranlar, turlar, plajlar, aktiviteler, antik-kentler, haberler, hakkimizda vb.) eksiksiz hreflang bloğu: tr/en/de/ru/fr + x-default ve rel=canonical mevcut
- DE/RU/FR çevirileri 24 ana sayfada birebir paralel eklenmiş (data-de/data-ru/data-fr sayıları tam eşit: her biri 1469) — bu sayfalarda 5 dil gerçekten dolu
- og:locale=tr_TR + 4 og:locale:alternate ve x-default etiketi tüm ana sayfalarda tutarlı şekilde var

**Boşluklar:**
- [high/high] KRİTİK: hreflang alternatifleri ?lang=en/de/ru/fr query URL'lerine işaret ediyor, ama her ?lang= varyantının canonical'ı çıplak TR URL'ine gidiyor. Google, kanonik-olmayan URL'lere verilen hreflang anotasyonlarını yok sayar → tüm hreflang kümesi geçersiz, yalnızca TR sürümü indekslenir. Ayrıca içerik istemci-tarafı render edildiği için ?lang=en sunucudan birebir aynı HTML'i döndürür; arama motoru için ayrı indekslenebilir bir dil sürümü hiç oluşmaz.
  - *Düzeltme:* Aşama 3 statik build'i devreye al: dil başına gerçek URL (/en/villalar.html, /de/...) üret, her dil sayfasının canonical'ı KENDİSİNE işaret etsin, hreflang'ler bu self-kanonik URL'leri göstersin. Kısa vadede en azından ?lang= URL'lerinin canonical'ını kendi ?lang= URL'ine çevir.
- [high/high] ~270 detay sayfası (otel/*, villa/*, tur/*, plaj/*, restoranlar/*, etkinlikler/*, instagram/*) i18n.js yüklemiyor ve hiç data-en/de/ru/fr çevirisi içermiyor; tamamen TR. Buna rağmen hepsi og:locale:alternate ile en_US/de_DE/ru_RU/fr_FR sahte sinyali veriyor.
  - *Düzeltme:* Detay sayfa şablonlarına (otel/_template, villa/_template, tur/_template, plaj/_template) i18n.js'i ekleyip en azından başlık/açıklama/CTA için data-en/de/ru/fr çevirisi koy. Çeviri yoksa og:locale:alternate satırlarını şablonlardan kaldır (yanlış sinyali durdur).
- [medium/medium] 10 antik-kentler alt sayfası (xanthos, patara, myra, letoon, tlos, pinara, simena, andriake, antiphellos, aperlae) data-en içeriyor ama data-de/ru/fr İÇERMİYOR — Almanca/Rusça/Fransızca ziyaretçi İngilizce fallback görür. Yine de hreflang de/ru/fr sürümü varmış gibi bildiriyor.
  - *Düzeltme:* Bu 10 sayfaya mevcut data-en pattern'ini örnek alarak data-de/data-ru/data-fr ekle (Ollama trgemma-t1 ile toplu çevirilebilir). Eklenene kadar hreflang de/ru/fr satırları içerik vaadini karşılamıyor.
- [medium/low] Varsayılan dil tutarsızlığı: <html lang="tr">, og:locale=tr_TR ve x-default → çıplak TR URL iken i18n.js DEFAULT_LANG='en'. localStorage boş yeni ziyaretçide JS, sayfayı İngilizce'ye çevirir; sunucu sinyali TR der. Crawler ile kullanıcı deneyimi ve x-default çelişiyor.
  - *Düzeltme:* js/i18n.js içinde DEFAULT_LANG'ı 'tr' yap (html lang, og:locale ve x-default ile hizalansın). Alternatif: navigator.language tabanlı yumuşak tespit ama x-default TR kalmalı.
- [medium/medium] sitemap.xml hreflang/xhtml:link alternatif anotasyonları içermiyor. Google çok dilli kümeleri sitemap üzerinden de doğrular; eksikliği hreflang keşfini zayıflatıyor.
  - *Düzeltme:* sitemap.xml'i xmlns:xhtml ile yeniden üret; her URL bloğuna 5 dil + x-default için <xhtml:link rel="alternate" hreflang=...> ekle. Statik dil URL'leri devreye girince self-kanonik URL'lerle eşleştir.

**Hedef kelimeler:** Kalkan tatil rehberi · Kalkan holiday guide · things to do in Kalkan · Kalkan villas / Kalkan villa kiralama · Kalkan Reiseführer / Kalkan Urlaub · Калкан путеводитель / отдых в Калкане · guide de voyage Kalkan · Kalkan restaurants / Kalkan restoranları · Kalkan beaches Kaputas · Lycian ancient cities Xanthos Patara

**Hızlı kazanımlar:**
- js/i18n.js DEFAULT_LANG'ı 'en' → 'tr' yap: html lang/og:locale/x-default ile anında hizalanır (tek satır, low effort)
- TR-only detay sayfa şablonlarından (otel/villa/tur/plaj _template) sahte og:locale:alternate satırlarını kaldır ya da gerçek çeviri ekle — yanlış çok dilli sinyali durdurur
- 10 antik-kentler alt sayfasına data-de/data-ru/data-fr çevirisi ekle (data-en pattern'i hazır; trgemma-t1 ile toplu çeviri)
- sitemap.xml'e xhtml:link hreflang alternatifleri ekle (xmlns:xhtml + her URL için 5 dil + x-default)
- Kısa vade: ?lang= alternatif URL'lerinin canonical'ını çıplak TR yerine kendi ?lang= URL'ine çevirerek hreflang kümesini en azından geçerli hale getir

### Yapılandırılmış Veri (JSON-LD / Schema.org) — Google Rich Results

**Durum:** Detay sayfalarında güçlü ve tip-doğru JSON-LD var: restoran=Restaurant (176 sayfa, gömülü gerçek Google review'ları), otel=Hotel, villa detay=LodgingBusiness+FAQPage, plaj=TouristAttraction, tur=TouristTrip, antik kent=TouristAttraction, berber=LocalBusiness; tüm detaylarda BreadcrumbList mevcut. Ana sayfa Organization+WebSite(SearchAction)+TravelAgency+LocalBusiness içeriyor. Ancak haberlerde Article şeması hiç yok, listeleme sayfalarının çoğunda ItemList yok, SiteNavigationElement hiçbir yerde yok ve birkaç ciddi geçerlilik/sahte-veri riski mevcut.

**Güçlü yönler:**
- 176 restoran + 16 otel sayfasında aggregateRating + gerçek Google review metinleri JSON-LD'ye gömülü (ratingValue/reviewCount/bestRating/worstRating tam)
- Her detay sayfası tipinde BreadcrumbList şeması doğru ve tutarlı (3 seviye, item URL'leri tam)
- Tip eşlemesi doğru: Restaurant, Hotel, LodgingBusiness, TouristAttraction, TouristTrip, LocalBusiness — Google rich result tiplerine uygun
- Villa detayında FAQPage şeması (8 soru) — FAQ rich result için güçlü; LodgingBusiness'ta amenityFeature, checkin/checkout, paymentAccepted gibi zengin alanlar dolu
- Ana sayfada Organization + WebSite + SearchAction + alternateName (marka varyantları) tanımlı; brand sitelinks için iyi temel
- villalar.html ve antik-kentler.html'de ItemList carousel şeması mevcut (LodgingBusiness item'larıyla)
- geo, PostalAddress, sameAs (Instagram/Google Maps) alanları detaylarda tutarlı dolduruluyor

**Boşluklar:**
- [high/medium] Haberler/gazete içeriğinde Article/NewsArticle/BlogPosting şeması HİÇ YOK. haberler.html sadece BreadcrumbList içeriyor, bireysel haber detay sayfası da yok (haber/** boş). Google Haberler ve makale rich result'larına uygunluk imkansız.
  - *Düzeltme:* Her haber için NewsArticle şeması ekle (headline, datePublished, dateModified, author, image, publisher=Organization). Gazete MVP pipeline'ında (generate script) JSON-LD template'i ekle; haberleri ayrı /haber/[slug]/ sayfalarına çıkar.
- [high/low] Sahte/geçersiz telefon: Ana sayfa LocalBusiness şemasında telephone:'+90-242-CONCIERGE' (harf içeren geçersiz numara). Google bunu geçersiz veri olarak işaretleyebilir.
  - *Düzeltme:* index.html satır 127'deki LocalBusiness telephone değerini gerçek E.164 numarayla değiştir (ör. +905306650794) veya alanı tamamen kaldır.
- [medium/medium] SearchAction (sitelinks searchbox) hedefi çalışmıyor: target 'index.html?q={search_term_string}' ama ana sayfada q parametresini işleyen arama input'u/JS yok. Google çalışmayan potentialAction'ı yok sayar, geçersiz işaretler.
  - *Düzeltme:* index.html'e gerçek bir arama kutusu + ?q= parametresini okuyup filtreleyen JS ekle, ya da searchbox işlevi yoksa SearchAction'ı WebSite şemasından çıkar.
- [high/low] TouristTrip sayfalarında (11 tur) aggregateRating var (ör. 4.9/25) ama: (a) Google TouristTrip için yıldız rich result DESTEKLEMEZ, (b) provider 'Kalkan Info Concierge' kendi turunu puanlıyor = self-serving review riski, (c) gömülü review yok. Sahte aggregateRating manuel ceza riski yüksek.
  - *Düzeltme:* Tur sayfalarından aggregateRating'i kaldır VEYA gerçek doğrulanabilir müşteri review'larıyla destekle. Yıldız isteniyorsa tipi Product/Service'e çevirmek yerine rating'i tamamen çıkarmak en güvenlisi.
- [medium/medium] berber/hizmet sayfalarında adres-konum tutarsızlığı: best-barber LocalBusiness streetAddress 'Ölüdeniz...Fethiye/Muğla' + geo 36.571/29.141 (Fethiye) ama addressLocality 'Kalkan'/addressRegion 'Antalya'. Yanlış konum verisi local pack'te güveni düşürür.
  - *Düzeltme:* hizmet/* sayfalarında geo koordinatları ve addressLocality'yi gerçek işletme konumuyla eşleştir; Kalkan dışı işletmeleri ya doğru şehirle işaretle ya da kaldır.
- [medium/medium] Listeleme sayfalarının çoğunda ItemList yok: restoranlar.html, oteller.html, plajlar.html, aktiviteler.html yalnızca Organization+WebSite+BreadcrumbList içeriyor. Sadece villalar ve antik-kentler'de ItemList var. Carousel/liste rich result fırsatı kaçıyor.
  - *Düzeltme:* Her listeleme sayfasına ItemList ekle (ListItem + position + ilgili Restaurant/Hotel/Beach item özetleri). Mevcut villalar.html ItemList'ini şablon olarak kullan; generate script'e dahil et.
- [medium/low] Ana sayfada 4 ayrı kök varlık (Organization, WebSite, TravelAgency, LocalBusiness) @id ile birbirine bağlanmamış → Google için varlık (entity) karmaşası. TravelAgency ve LocalBusiness büyük ölçüde çakışıyor.
  - *Düzeltme:* Her varlığa @id ver (ör. #organization, #website, #localbusiness) ve publisher/about/mainEntityOfPage ile birbirine referansla; TravelAgency'yi LocalBusiness ile birleştirip tek tutarlı varlık kullan.
- [low/low] SiteNavigationElement hiçbir sayfada yok. Google sitelinks ve AI gezinme anlama için faydalı navigasyon şeması eksik.
  - *Düzeltme:* Ana sayfaya SiteNavigationElement (ItemList biçiminde ana menü: Restoranlar, Oteller, Villalar, Plajlar, Turlar, Antik Kentler, Haberler) ekle.
- [low/low] Villa LodgingBusiness ve villalar ItemList'inde starRating ratingValue:'5' kendi kendine atanmış. starRating resmi otel sınıflandırması içindir; villa için self-serving 5-yıldız riski.
  - *Düzeltme:* Villa sayfalarından starRating'i kaldır (resmi yıldız sınıfı yoksa); kalite vurgusu için amenityFeature yeterli.
- [low/medium] Restaurant tip eşleme gevşekliği: bar/gece kulübü mekanları (nokta-bar, mojito-lounge-club, vibes-lounge-club vb.) 'Restaurant' olarak işaretli. BarOrPub/NightClub daha doğru olurdu.
  - *Düzeltme:* Mekan kategorisine göre @type'ı BarOrPub / NightClub / CafeOrCoffeeShop olarak ayrıştır; generate/template script'inde kategori alanından türet.

**Hedef kelimeler:** Kalkan restoranları · Kalkan otelleri · Kalkan kiralık villa · Kalkan plajları · Kalkan tekne turu · Kalkan gezilecek yerler · Kalkan antik kentler · best restaurants in Kalkan · Kalkan villas with pool · things to do in Kalkan

**Hızlı kazanımlar:**
- index.html LocalBusiness'taki geçersiz '+90-242-CONCIERGE' telefonunu gerçek numarayla değiştir veya kaldır (satır 127) — geçersiz veri uyarısını anında temizler
- 11 tur (TouristTrip) sayfasından desteklenmeyen + self-serving aggregateRating'i kaldır — manuel ceza riskini düşürür
- Çalışmayan SearchAction'ı kaldır ya da gerçek ?q= aramasını bağla
- Ana sayfadaki 4 varlığa @id ekleyip birbirine referansla (varlık karmaşasını çözer, ~15 dk)
- Villa sayfalarındaki self-assigned starRating:5'i kaldır
- Mevcut villalar.html ItemList'ini şablon alıp restoranlar/oteller/plajlar listeleme sayfalarına ItemList ekle

### İçerik, Anahtar Kelime & İç Linkleme

**Durum:** kalkaninfo.com teknik SEO temeli güçlü (canonical, hreflang 5 dil, zengin schema: Organization/WebSite/TravelAgency/LocalBusiness, geo meta, sitemap 44+ detay URL). Ancak ana sayfa H1'i marka-odaklı "Kalkan Info" ile sınırlı, bölüm başlıkları (H2) soyut ve anahtar kelime taşımıyor; en kritik sorun listeleme sayfalarının detay sayfalarına statik iç link vermemesi — kartlar JS ile render ediliyor, HTML'de crawl edilebilir link yok.

**Güçlü yönler:**
- Marka/navigasyonel 'kalkan info' araması çok güçlü: alternateName dizileri (kalkaninfo, Kalkan Bilgi vb.), sameAs, Organization+WebSite+SearchAction sitelinks schema, tutarlı NAP — bu sorgu için #1 garanti
- E-E-A-T sinyali iyi: hakkimizda.html'de Person schema (Berkay Elmastaş, founder, jobTitle, knowsLanguage 5 dil), AboutPage, founder ilişkisi, 'Kalkan'da yaşıyoruz, Kalkan'ı tanıyoruz' birinci-el deneyim ifadesi
- Title tag dengeli ve markalı: 'Kalkan Info — Yerel Bilgi, Seçili Tavsiyeler, Kurumsal Hizmet'
- Listeleme sayfası H1'leri anahtar kelime içeriyor (villalar.html → 'Kalkan Villaları')
- Coğrafi hedefleme net: geo.region TR-07, LocalBusiness/TravelAgency areaServed [Kalkan, Kaş, Patara, Antalya], lat/long
- Sitemap detay sayfalarını (44 villa/plaj/tur/otel) içeriyor → JS linki olmasa da keşfedilebilir
- Çok dilli içerik altyapısı (data-en/de/ru/fr) tüm sayfalarda mevcut

**Boşluklar:**
- [high/low] Ana sayfa H1 sadece marka adı 'Kalkan Info' — jenerik 'kalkan' / 'kalkan tatil' / 'kalkan gezilecek yerler' sorguları için tanımlayıcı anahtar kelime taşımıyor
  - *Düzeltme:* index.html satır 176'daki H1'i markayı koruyup açıklayıcı yap: 'Kalkan Info' görsel kalsın ama H1 metnini 'Kalkan Gezi & Tatil Rehberi — Villa, Restoran, Plaj, Tur' gibi anahtar-kelime zengini hale getir (marka logoyu ayrı span'de tut)
- [high/medium] Listeleme sayfaları (villalar/plajlar/turlar/oteller/restoranlar) detay sayfalarına STATİK iç link VERMİYOR — kartlar boş <div id="card-grid"> içine JS ile basılıyor, HTML'de <a href> yok
  - *Düzeltme:* Build aşamasında (veya server-side) en az ilk N kartı statik <a href="/villa/[slug]/"> olarak prerender et; ya da JS render sonrası <noscript> fallback link listesi ekle. Link equity akışı ve crawl güvenilirliği için kritik
- [high/medium] Detay sayfaları arası (detay→detay) iç link yok: villa/plaj/tur ve antik-kentler alt sayfaları 'benzer/yakındaki/diğer' cross-link içermiyor — topikal kümeleme (topical cluster) oluşmuyor
  - *Düzeltme:* Her detay sayfasının altına 'Yakındaki Plajlar' / 'Benzer Villalar' / 'Diğer Antik Kentler' bölümü ekle (3-4 statik anchor). antik-kentler/xanthos.html bile letoon/patara'ya link vermiyor — Lykia kümesi için ideal fırsat
- [medium/high] Ana sayfada 'kalkan' için uzun-form bilgilendirici içerik (pillar content) yok — sayfa saf dizin/hub; 'Kalkan nerede, nasıl gidilir, ne zaman gidilir, gezilecek yerler' evergreen metni eksik
  - *Düzeltme:* Ana sayfaya veya yeni /kalkan-rehberi sayfasına 600-1000 kelime özgün rehber metni ekle (konum, ulaşım, sezon, öne çıkanlar) + iç linklerle villalar/plajlar/turlar'a bağla
- [medium/medium] 'kalkanda yemek / kalkanda nerede yenir' niyeti explicit hedeflenmiyor — restoranlar.html marka/kategori odaklı, soru-tipi sorgu için içerik yok
  - *Düzeltme:* restoranlar.html H1/intro'ya 'Kalkan'da Nerede Yenir' niyetli metin + mutfak türü/manzara/fiyat filtre açıklamaları ekle; SSS bloğu (FAQPage schema) ile 'Kalkan'da en iyi balık restoranı' tipi sorgular yakala
- [medium/low] Haber (haberler.html) ve rehber içeriklerinde yazar bylinesı / yayın tarihi görünür değil — E-E-A-T author sinyali sadece hakkimizda'da
  - *Düzeltme:* Haber/rehber sayfalarına görünür 'Yazar: Berkay Elmastaş · tarih' byline + Article/NewsArticle schema author alanı (hakkimizda.html'ye link) ekle
- [medium/low] Statik görünür breadcrumb navigasyonu yok — BreadcrumbList JSON-LD var ama detay sayfasında tıklanabilir HTML breadcrumb (Anasayfa › Villalar › X) bulunamadı
  - *Düzeltme:* Detay sayfalarının üstüne görünür breadcrumb <nav> ekle (listeleme sayfasına ve ana sayfaya statik anchor) — hem UX hem detay→listeleme link equity
- [low/low] Adanmış iletişim sayfası (iletisim.html) yok; iletişim sadece mailto + concierge WhatsApp — NAP/iletişim E-E-A-T sayfası eksik
  - *Düzeltme:* Açık adres, harita, telefon, e-posta ve ContactPage schema içeren iletisim.html oluştur, footer ve hakkimizda'dan link ver

**Hedef kelimeler:** kalkan · kalkan info · kalkan tatil · kalkan gezilecek yerler · kalkan rehberi · kalkan villa · kalkan villaları kiralık · kalkanda yemek · kalkanda nerede yenir · kalkan restoranları · kalkan plajları · kalkan tekne turu · kalkan otelleri · kalkan nöbetçi eczane · kaputaş plajı · patara antik kenti · kalkan kaş patara · kalkan nasıl gidilir

**Hızlı kazanımlar:**
- Ana sayfa H1'ini marka-only 'Kalkan Info'dan açıklayıcı + anahtar kelimeli versiyona çevir (index.html:176) — düşük efor, yüksek etki
- Soyut H2'leri anahtar kelimeyle değiştir: 'Aradığını Bul'→'Kalkan'da Ne Arıyorsun', 'Bölgeyi Tanı'→'Kalkan ve Çevresi Gezi Rehberi', 'Hayatı Kolaylaştıranlar'→'Kalkan Hizmetleri'
- Detay sayfalarına görünür breadcrumb (Anasayfa › Villalar › Villa Adı) ekleyerek detay→listeleme statik link oluştur
- Listeleme sayfalarına JS render'a ek <noscript> statik detay link listesi ekle — crawl güvencesi
- Her detay sayfasının altına 3-4 'benzer/yakındaki' statik cross-link bloğu ekle (topical cluster)
- Haber sayfalarına görünür yazar byline + Article schema author alanı ekle
- iletisim.html sayfası oluştur (ContactPage schema + NAP) ve footer'a ekle

### Yerel SEO & Off-Page (kalkaninfo.com)

**Durum:** Rekabet gerçeği dürüstçe: "kalkan" tek kelimesi Türkçede çok anlamlı (kalkan balığı/turbot, savunma kalkanı, Kaş'a bağlı Kalkan beldesi) ve jenerik turizm terimlerinde (kalkan tatil, kalkan otel) SERP'i Wikipedia, TripAdvisor, Booking.com, Etstur, Tatilbudur, Jolly gibi yüksek otoriteli devler işgal ediyor; bütçe/backlink açısından bunlarla doğrudan yarışmak gerçekçi değil. kalkaninfo.com bir yerel dizin/rehber sitesi olarak Google Business Profile'a (GBP) sahip değil ve bir dizin sitesi GBP'de tek bir "işletme" gibi sıralanamaz; harita 3-pack'i tek tek mekanların (restoran, otel, tekne) işidir. Gerçekçi yol: tek kelime "kalkan" yerine düşük-rekabetli uzun-kuyruk terimlerde (örn. "kalkanda balık restoranı önerileri", "kalkan tekne turu fiyatları 2026") içerik+yerel sinyallerle nokta atışı sıralanmak.

**Güçlü yönler:**
- Coğrafi olarak ultra-niş tek bir belde (Kalkan) odaklı içerik var — büyük OTA'ların derinlemesine kapsamadığı uzun-kuyruk sorgular için doğal avantaj
- 170+ işletme detay sayfası (restoran/kafe/bar/beach + berber + oteller + villalar) zaten canlı; bu, dizin-tipi uzun-kuyruk içerik envanteri için güçlü temel
- LocalBusiness JSON-LD, hreflang ve 5 dil altyapısı mevcut (uluslararası Kalkan turistlerine — İngiliz pazarı büyük — hitap potansiyeli)
- Sitemap 270 URL'e çıkmış; tarama/indeksleme genişliği iyi
- Domain birebir niş eşleşmeli (kalkaninfo.com) ve marka olarak hatırlanabilir

**Boşluklar:**
- [high/medium] Site bir dizin olduğu için kendi adına GBP/harita sıralaması beklenemez; ancak listelenen işletmeler için GBP entegrasyonu/teşviki yok. Yerel pakette görünürlük sadece tek tek mekanların GBP'lerinden gelir (relevance+distance+prominence).
  - *Düzeltme:* İşletme detay sayfalarına 'Bu mekanın sahibi misin? Google Business Profile'ını doğrula/güncelle' CTA'sı ekle; partner mekanlara GBP optimizasyon mini-rehberi sun (doğru birincil kategori, NAP, foto, yorum). Sitenin kendisi için ise organik/rehber içerik SEO'suna odaklan, harita pack'i hedefleme.
- [high/medium] NAP (ad-adres-telefon) tutarlılığı denetlenmemiş; 170 mekanın bilgisi GBP/Yelp/TripAdvisor/Foursquare ile birebir aynı mı bilinmiyor. Tutarsız NAP yerel güven sinyalini düşürür.
  - *Düzeltme:* Her detay sayfasında mekanın resmi NAP'ını (GBP'deki yazımıyla birebir) standardize et ve schema.org/LocalBusiness içine address+telephone+geo koy. Site genelinde tek format (telefon +90, açık adres) zorla; veri kaynağını GBP'yi referans alarak hizala.
- [high/high] Off-page/backlink profili zayıf; turizm ve yerel otoriteli sitelerden atıf (citation) ve link kazanımı için aktif strateji yok. 'Prominence' sinyali backlink ve web genelindeki bahislerle güçlenir.
  - *Düzeltme:* Kaş Belediyesi, Antalya İl Kültür Turizm, GoTürkiye, TÜRSAB üye sayfaları, yerel/İngiliz Kalkan blogları (ör. 'kalkan turkey' expat blogları), villa kiralama acenteleri ve yerel haber sitelerinden link/atıf hedefle. 2000+ kelimelik 'Kalkan Ultimate Guide' türü linklenebilir rehber içerikler üret (guest post + kaynak sayfa stratejisi).
- [medium/medium] Yorum (review) sinyali ve yorum velositesi sitede toplanmıyor/gösterilmiyor; yorumlar yerel sıralamanın ~%17-26'sını oluşturuyor ve 3 hafta yorum gelmezse sıralama düşebiliyor.
  - *Düzeltme:* Mekan sayfalarına Google yorum sayısı/puanı çek (Places API) ve agregat göster; partner mekanlara 'düzenli, foto'lu, taze yorum toplama' (ayda 4-8) teşvik akışı kur. Kendi reviews tablosu varsa AggregateRating schema ekle ama sahte yorumdan kaçın.
- [medium/low] Jenerik 'kalkan' hedeflemesi kaynak israfı; tek kelime intent belirsiz (balık/belde) ve OTA/Wikipedia ile yarışılmaz.
  - *Düzeltme:* Anahtar kelime stratejisini niyet+modifier'lı uzun-kuyruğa kaydır: '{aktivite/mekan tipi} + Kalkan + {2026/fiyat/öneri/nasıl gidilir}'. Her uzun-kuyruk küme için tek bir derin sayfa (pillar+cluster) kur ve iç linkle.
- [low/low] Anlam belirsizliği (disambiguation) yönetilmiyor; 'kalkan' arayan kullanıcı balık/savunma içeriğiyle karışabilir, bu da CTR ve relevansı zedeler.
  - *Düzeltme:* Title/H1/meta'da daima 'Kalkan, Kaş / Antalya' coğrafi netleştirici kullan; sayfa içi içeriği ve schema 'Place/TouristDestination' tiplemesiyle beldeyi açıkça işaretle.

**Hedef kelimeler:** kalkan kaş gezilecek yerler · kalkanda balık restoranı önerileri · kalkan tekne turu fiyatları 2026 · kalkan villa kiralama deniz manzaralı · kalkan plajları hangileri / kalkan beach club · kalkan nasıl gidilir antalya havalimanından · kalkan otelleri eski kalkan · things to do in Kalkan Turkey · best restaurants in Kalkan old town · Kalkan vs Kas where to stay · kalkanda kahvaltı / gün batımı barları · kalkan antik kentler patara letoon

**Hızlı kazanımlar:**
- Tek kelime 'kalkan' yerine title/H1/meta'lara 'Kalkan, Kaş (Antalya)' coğrafi netleştirici ekle — anlam belirsizliğini çöz, doğru intent'i yakala (low effort, hızlı CTR/relevans kazancı)
- Her mekan sayfasında LocalBusiness JSON-LD'ye address+telephone+geo+openingHours ekle ve NAP'ı GBP yazımıyla birebir hizala
- En güçlü 5-6 uzun-kuyruk küme için 2000+ kelimelik 'Kalkan rehberi' pillar sayfaları yaz (linklenebilir, OTA'ların zayıf olduğu derinlik)
- Kaş Belediyesi, GoTürkiye, Antalya turizm portalları ve İngiliz Kalkan expat bloglarından atıf/backlink için ulaşım listesi çıkar ve 5 ilk temasta bulun
- Mekan sayfalarına Google Places puan+yorum sayısı çek ve AggregateRating ile göster; partner mekanlara düzenli yorum toplama teşviki kur
- Google Search Console + Bing Webmaster'da sitemap'i (270 URL) doğrula, 'kalkan ...' uzun-kuyruk sorgularda mevcut impression/CTR verisini çekip düşük asılı meyveleri (poz 5-15) optimize et
- Site genelinde tutarlı tek NAP formatı (telefon +90, açık tam adres) zorla; Yelp/TripAdvisor/Foursquare'daki mevcut kayıtlarla tutarsızlıkları temizle

