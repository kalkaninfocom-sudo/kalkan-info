# PERFORMANCE Audit -- 2026-05-22

## Lighthouse Skorlari (5 Sayfa Mobile)

Lighthouse headless NO_FCP hatasi: Chrome bu ortamda sayfa boyayamadi.
Tahminler statik kod analizine dayanmaktadir. JSON: .omc/research/lh-index.json

| Sayfa | Perf est | SEO est | A11y est | BP est | LCP risk | CLS risk |
|---|---|---|---|---|---|---|
| / | 40-50 | 82 | 72 | 68 | HIGH | MED |
| /villalar.html | 48-58 | 85 | 74 | 70 | MED | LOW |
| /restoranlar.html | 48-58 | 72 | 74 | 70 | MED | LOW |
| /antik-kentler/patara.html | 58-68 | 80 | 76 | 73 | LOW | LOW |
| /pricing.html | 62-72 | 83 | 78 | 76 | LOW | LOW |

Temel sorunlar: 3 render-blocking script (supabase-window.js, sentry-config.js, render.js); Google Fonts 2 CSS istegi render-blocking; 11.2 MB JPG yuku.

---

## 46 JPG Envanteri (LCP Impact Oncelik Sirasi)

Toplam: 11,218 KB (46 dosya). Tum dosyalarin WebP karsiligi uretilmeli.

| Dosya | KB | LCP Risk | Not |
|---|---|---|---|
| kaputas-wm.jpg | 3125 | HIGH | En buyuk tek dosya WebP acil |
| salonika-outside.jpg | 1573 | HIGH | Restoran hero |
| tas-ocak-real.jpg | 1075 | HIGH | Hizmet sayfasi |
| chic-hairdresser-services.jpg | 967 | HIGH | Hizmet karti hero boyutunda |
| likya-beach-real.jpg | 573 | HIGH | Plaj hero |
| kalimera-hero.jpg | 199 | HIGH | WebP var ama jpg referans kontrolu gerek |
| gusto.jpg | 418 | MED | Restoran karti |
| limanagzi-real.jpg | 414 | MED | Plaj karti |
| kucuk-cakil-real.jpg | 406 | MED | Plaj karti |
| aura-restaurant.jpg | 358 | MED | Restoran karti |
| seaport-kalkan.jpg | 329 | MED | Genel gorsel |
| panorama-kalkan.jpg | 309 | MED | Hero banner adayi |
| kalamaki-overview.jpg | 288 | MED | Bar karti |
| club-chocolate.jpg | 270 | MED | Gece kulubu karti |
| kalamaki-cocktail.jpg | 268 | MED | Bar karti |
| ata-kebab.jpg | 260 | MED | Restoran karti |
| club-mojito.jpg | 247 | MED | Bar karti |
| shade-lounge.jpg | 240 | MED | Bar karti |
| mey-terrace.jpg | 239 | MED | Restoran karti |
| noema.jpg | 200 | MED | Restoran karti |
| kalamar-real.jpg | 188 | LOW | Plaj karti |
| hidayet-koyu-real.jpg | 184 | LOW | Plaj karti |
| akcagerme-real.jpg | 183 | LOW | Plaj karti |
| ziizi-pizza.jpg | 168 | LOW | Restoran karti |
| kleo-cafe-bar.jpg | 157 | LOW | Bar karti |
| the-fountain.jpg | 146 | LOW | Mekan karti |
| marina-restaurant.jpg | 146 | LOW | Restoran karti |
| rallzees-pub.jpg | 146 | LOW | Bar karti |
| salt-pepper.jpg | 138 | LOW | Restoran karti |
| sherlock-holmes.jpg | 134 | LOW | Bar karti |
| salonika-1881.jpg | 134 | LOW | Restoran karti |
| mezzanine-bar.jpg | 132 | LOW | Bar karti |
| yali-beach-real.jpg | 129 | LOW | Plaj karti |
| patara-wm.jpg | 114 | LOW | Antik kent watermark |
| ala-restaurant.jpg | 112 | LOW | Restoran karti |
| harbor-lights-hero.jpg | 95 | LOW | Hero kucuk boyut |
| kalamaki.jpg | 82 | LOW | Bar karti |
| haciogli-kasap.jpg | 73 | LOW | Hizmet karti |
| blue-marlin.jpg | 72 | LOW | Bar karti |
| buyuk-cakil-real.jpg | 65 | LOW | Plaj karti |
| indigo-beach-real.jpg | 60 | LOW | Plaj karti |
| chic-hairdresser-card.jpg | 43 | LOW | Kart gorseli |
| incirli-real.jpg | 36 | LOW | Plaj karti |
| kalamar-beach-club-real.jpg | 10 | LOW | Kucuk kart |
| lures-beach-real.jpg | 9 | LOW | Kucuk kart |
| harbor-lights-profile.jpg | 3 | LOW | Thumbnail |

KRITIK: kaputas-wm.jpg 3.1 MB tek dosya. Ilk 6 HIGH dosya toplam 7.5 MB. WebP ile LCP 30-50pct iyilesir.

---

## hreflang Mismatch Fix Plani

Mevcut durum (CAKISMA):
- seo-quickwins.mjs: query param pattern (villalar.html?lang=en)
- build-multilang.mjs: subdirectory pattern (/en/villalar.html) -- 200 OK dogrulandi
- Sitemap: subdirectory pattern (/en/404.html, /de/villalar.html)
- index.html aktif hreflang: ?lang=en -- sitemap ile uyumsuz

Google iki URL formatini farkli sayfa gorur: duplicate content sinyali + hreflang gecersiz.

Fix -- Subdirectory patterne gec:
- seo-quickwins.mjs buildHreflangBlock: ?lang=xx -> /lang/relPath
- vercel.json: has-query redirect ?lang=en -> /en/:path* (permanent: true) her dil icin
- build-multilang.mjs: degisiklik gerekmez, zaten /lang/ subdirectory uretiyor

vercel.json redirect ornegi:


---

## JSON-LD Coverage Matrix

| Sayfa | Org | WS | LB | TravelAgency | BreadcrumbList | Restaurant | Lodging | TouristAttr | AggRating |
|---|---|---|---|---|---|---|---|---|---|
| index.html | OK | OK | OK | OK | NO | NO | NO | NO | NO |
| villalar.html | OK | OK | NO | NO | OK | NO | OK-3x | NO | NO |
| restoranlar.html | OK | OK | NO | NO | OK | NO | NO | NO | NO |
| antik-kentler/patara.html | NO | NO | NO | NO | OK | NO | NO | OK | NO |
| pricing.html | NO | NO | NO | NO | OK | NO | NO | NO | NO |
| hakkimizda.html | OK | OK | NO | NO | OK | NO | NO | NO | NO |
| plajlar.html | OK | OK | NO | NO | OK | NO | NO | NO | NO |
| aktiviteler.html | OK | NO | NO | NO | OK | NO | NO | NO | NO |
| antik-kentler.html | NO | NO | NO | NO | OK | NO | NO | OK | NO |
| turlar.html | OK | OK | NO | NO | OK | NO | NO | NO | NO |
| events.html | NO | NO | NO | NO | OK | NO | NO | NO | NO |
| b2b-dashboard.html | NO | NO | NO | NO | NO | NO | NO | NO | NO |

Kritik eksikler: restoranlar.html Restaurant schema yok (15+ restoran). plajlar.html TouristAttraction yok. events.html Event schema yok. Sifir sayfada AggregateRating -- rich snippet yok.

---

## Render-Blocking Analiz

index.html -- 19 script. Defer ratio: 15/19 = 79pct. Blocking toplam 30 KB senkron yukleme.

| Script | Durum | Boyut est |
|---|---|---|
| supabase-window.js | BLOCKING | 8 KB |
| sentry-config.js | BLOCKING | 2 KB |
| render.js | BLOCKING | 20 KB |
| map.js | type=module parser-defer | 8 KB |
| site-drawer.js | defer OK | 8 KB |
| i18n.js | defer OK | 8 KB |
| cookie-banner.js | defer OK | 4 KB |
| concierge-modal.js | defer OK | 16 KB |
| sentry-init.js | defer OK | 4 KB |
| lost-found.js | defer OK | 12 KB |
| 9 other scripts | defer OK | 40 KB |

villalar.html: 13/16 = 81pct. Same 3 blocking scripts.

CDN Library Weight Estimate:

| Library | Source | Weight est |
|---|---|---|
| dist/tw.css | self-hosted | 20 KB JIT |
| Google Fonts Montserrat+Inter | fonts.googleapis.com | 60 KB render-blocking |
| Plausible | plausible.io | 1 KB async |
| Microsoft Clarity | clarity.ms | 35 KB |
| Sentry | cdn.jsdelivr.net | 80 KB |
| Supabase esm.sh | esm.sh | 150 KB |
| 3rd party total | | 326 KB |

---

## Sitemap URL Health (10 Sample)

| URL | HTTP |
|---|---|
| https://kalkaninfo.com/ | 200 OK |
| https://kalkaninfo.com/en/index.html | 200 OK |
| https://kalkaninfo.com/villalar.html | 200 OK |
| https://kalkaninfo.com/en/villalar.html | 200 OK |
| https://kalkaninfo.com/restoranlar.html | 200 OK |
| https://kalkaninfo.com/antik-kentler/patara.html | 200 OK |
| https://kalkaninfo.com/en/antik-kentler/patara.html | 200 OK |
| https://kalkaninfo.com/plajlar.html | 200 OK |
| https://kalkaninfo.com/pricing.html | 200 OK |
| https://kalkaninfo.com/hakkimizda.html | 200 OK |

10/10 URL 200 OK. Sitemap saglikli. Uyari: admin/* ve 404.html sitemap icinde -- crawl budget israfi.

---

## Font Subsetting

Mevcut: Montserrat wght 500;600;700;800;900 + Inter wght 400;500;600;700. display=swap var. Subset BELIRTILMEMIS. 9 font dosyasi toplamda.
Oneri: Montserrat 5->3 weight (600/700/900), Inter 4->2 (400/600), subset=latin. Tasarruf: 20-30 KB, 1-2 RTT azalmasi.
Uzun vade: Fontsource self-host -- render-blocking tamamen kalkar.

---

## P1 Perf Fix (Wave 1) -- Yuksek Etki

1. 46 JPG WebP Batch -- Etki: LCP 30-50pct iyilesme. 11.2MB -> 2-3MB. cwebp -q 82 batch.
   Oncelik: kaputas-wm -> salonika-outside -> tas-ocak-real -> chic-hairdresser-services -> likya-beach-real

2. hreflang Fix -- seo-quickwins.mjs subdirectory patterne gec + vercel.json has-query redirect.
   Uluslararasi dizinleme duzeltilir. Duplicate content sinyali kalkar.

3. Render-Blocking Fix -- supabase-window.js + sentry-config.js + render.js -> defer ekle.
   TBT 200-400ms azalir.

4. JSON-LD Inject -- restoranlar.html Restaurant schema + plajlar.html TouristAttraction + events.html Event.
   Rich snippet -> CTR +15-25pct.

---

## P2 Perf (Wave 2) -- Orta Etki

1. Google Fonts: Montserrat 5->3 weight, Inter 4->2, subset=latin. Tasarruf 20-30 KB.
2. Sentry+Clarity gec yukleme: requestIdleCallback. TBT 100-200ms iyilesme.
3. Sitemap temizlik: admin/* ve 404.html kaldir. robots.txt Disallow: /admin/ ekle.
4. Lazy loading audit: Hero loading=lazy olmamali (LCP engeller). Card lazy olmali. fetchpriority=high sadece ilk gorsel.

---

## Ozet -- 11 Bulgu

| No | Kategori | Bulgu | Onem |
|---|---|---|---|
| 1 | JPG boyutu | 11.2 MB toplam; kaputas-wm.jpg 3.1 MB tek dosya | KRITIK |
| 2 | hreflang | ?lang= vs /en/ mismatch 245 URL etkileniyor | YUKSEK |
| 3 | Render-blocking | 3 script defer eksik: supabase+sentry-config+render.js 30 KB | YUKSEK |
| 4 | JSON-LD eksik | restoranlar/plajlar/events Restaurant/TouristAttr/Event schema yok | YUKSEK |
| 5 | AggregateRating | Sifir sayfada rating schema -- rich snippet yok | YUKSEK |
| 6 | Font weight | Montserrat 5 weight subset belirtilmemis 30 KB fazla | ORTA |
| 7 | Sitemap kirlilik | admin/* ve 404.html crawl budget israfi | ORTA |
| 8 | 3rd party weight | Sentry+Supabase 230 KB dominant | ORTA |
| 9 | Sitemap health | 10/10 URL 200 OK | TAMAM |
| 10 | Defer ratio | 79pct (15/19 script) | TAMAM |
| 11 | Tailwind | 20 KB JIT self-hosted | TAMAM |
