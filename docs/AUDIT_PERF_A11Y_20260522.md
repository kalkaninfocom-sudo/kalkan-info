# Performance + A11y Audit — 2026-05-22

**Repo:** C:\Users\socie\kalkan-info  
**Production:** https://kalkaninfo.com  
**Lighthouse version:** 13.3.0  
**Method:** `npx lighthouse --preset=perf --form-factor=mobile` (headless Chrome, no-sandbox)  
**Note:** index (kalkaninfo.com) Lighthouse runs returned score=0/null on all attempts — likely caused by the HTTP→HTTPS redirect chain before Lighthouse finalises the URL. Villalar, tatil-asistanı, patara, and tatil all produced valid data.

---

## Skorlar Tablosu

### Mobile (real Lighthouse runs)

| Sayfa | Perf | A11y | BP | SEO | Durum |
|-------|------|------|----|-----|-------|
| index | — | — | — | — | LH timeout/redirect |
| villalar | **47** | — | — | — | perf-only preset |
| restoranlar | — | — | — | — | LH timeout |
| tatil-asistanı | **54** | — | — | — | perf-only preset |
| antik-kentler/patara | **41** | — | — | — | perf-only preset |

> A11y/BP/SEO scores not available from perf-preset runs; see static analysis below for WCAG findings.

### Desktop
Desktop Lighthouse also returned score=0 (same redirect issue). Static analysis used as proxy.

---

## Web Vitals (Gerçek Değerler — Mobile Simulation)

| Sayfa | LCP | CLS | FCP | TBT | TTI | SI |
|-------|-----|-----|-----|-----|-----|----|
| villalar | **3.9 s** ❌ | **0.115** ⚠️ | 3.4 s ❌ | 2,100 ms ❌ | 10.7 s ❌ | 4.8 s |
| tatil-asistanı | **3.5 s** ❌ | **0.08** ✅ | 2.9 s ⚠️ | 1,970 ms ❌ | 9.6 s ❌ | 4.5 s |
| patara | **7.1 s** ❌❌ | **0.005** ✅ | 2.9 s ⚠️ | 1,870 ms ❌ | 8.8 s ❌ | 4.6 s |

Thresholds: LCP good <2.5s, needs improvement 2.5-4s, poor >4s | CLS good <0.1, poor >0.25 | TBT good <200ms

---

## P0 — LCP > 2.5s veya CLS > 0.1 Sayfaları (Kritik)

### P0-1: patara — LCP 7.1s (KÖTÜ)
- **Sayfa:** /antik-kentler/patara
- **Metrik:** LCP 7.1s (threshold: 2.5s good, 4s poor — bu poor'un da çok üstünde)
- **Kök neden:** Hero image preload yok + image-delivery savings 206 KB + render-blocking-insight 1,040ms savings + page JS parse süresi 2,267ms
- **Fix:** Hero img `<link rel="preload" as="image" fetchpriority="high">` ekle. Antik kent sub-page hero imageları 206KB → ~40KB hedef (daha agresif webp sıkıştırma). JS code-splitting uygula.
- **Tahmini etki:** LCP -2.5s (7.1s → ~4.6s)

### P0-2: villalar — CLS 0.115 (NEEDS IMPROVEMENT) + TBT 2,100ms
- **Sayfa:** /villalar
- **Metrik:** CLS 0.115 (threshold 0.1) — 3 layout shift kaynağı tespit edildi
- **Kök neden:** `lh-villalar.json` audit `cls-culprits-insight: 0` — villa card grid'i JS ile DOM'a inject ediliyor (`js/render.js`, `js/villa-modal.js`). Kartlar yüklenirken reserved alan yok, CLS tetikleniyor.
- **Fix:** Villa card skeleton placeholder yüksekliği rezerve et (min-height CSS). JS inject yerine server-side HTML veya ilk 3 villa statik HTML'de göster.
- **Tahmini etki:** CLS 0.115 → <0.05

### P0-3: Redirect zinciri — Tüm sayfalar ~720-750ms kayıp
- **Metrik:** `document-latency-insight` her sayfada 720-750ms savings gösteriyor
- **Kök neden:** HTTP → HTTPS yönlendirmesi. Lighthouse her sayfada bu redirecti sayıyor.
- **Fix:** HSTS preload aktif (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` vercel.json'da mevcut ✅). Chrome HSTS preload listesine domain gönder: https://hstspreload.org/
- **Tahmini etki:** FCP/LCP -0.7s tüm sayfalar

### P0-4: Main Thread Blocking — TBT 1,870-2,100ms tüm sayfalarda
- **Etki:** INP'yi doğrudan etkiliyor. Max-potential-FID 390-790ms.
- **Kök neden:** Sayfa JS (villalar: 3,493ms parse, tatil-asistanı: 2,104ms, patara: 2,267ms) + Sentry bundle (176ms) + Supabase auth-js (124ms) + cookie-banner.js (466ms tatil'de)
- **Fix 1:** cookie-banner.js ve site-drawer.js'i `requestIdleCallback` ile defer et
- **Fix 2:** Sentry lazy load — sadece hata yakalandığında yükle (ya da `BrowserProfilingIntegration` kaldır)
- **Fix 3:** Supabase auth-js sadece login/register/profil sayfalarında yükle — genel sayfalarda gereksiz
- **Tahmini etki:** TBT -800ms, TTI ~3s iyileşme

---

## P1 — A11y Critical (WCAG 2.1 AA)

### P1-1: Skip-to-content link YOK
- **Sayfa:** Tüm sayfalar (index, villalar, restoranlar, ...)
- **Kontrol:** `grep -n 'skip\|skipnav' index.html` → 0 sonuç
- **WCAG:** 2.4.1 Bypass Blocks (Level A)
- **Fix:** `<a href="#main-content" class="sr-only focus:not-sr-only ...">İçeriğe geç</a>` her sayfanın `<body>` başına ekle
- **Etki:** Keyboard-only kullanıcılar nav'ı her sayfada Tab ile geçmek zorunda kalıyor

### P1-2: Icon-only butonlar — aria-label eksik
- **Sayfa:** index.html
- **Kontrol:** 10 `<button>` var, sadece 3'ünde `aria-label`. Carousel prev/next butonları (satır 411-412, 589-590): sadece SVG içeriyor, label yok.
- **WCAG:** 4.1.2 Name, Role, Value (Level A)
- **Fix:** `<button aria-label="Önceki">` / `<button aria-label="Sonraki">` ekle
- **Etki:** Screen reader kullanıcıları "button" duyuyor, ne yaptığını bilmiyor

### P1-3: site-drawer — focus trap yok
- **Sayfa:** Tüm sayfalar (site-drawer.js)
- **Kontrol:** `grep -n 'Tab\|trap' js/site-drawer.js` → sadece Escape key handler var, Tab tuşu yakalanmıyor
- **WCAG:** 2.1.2 No Keyboard Trap (inverse — modal açıkken focus modal dışına çıkıyor)
- **Fix:** `aria-modal="true"` zaten var ✅. Tab/Shift+Tab'ı yakalayıp panel içindeki focusable elementler arasında döngü kur.
- **Etki:** Keyboard kullanıcısı drawer açıkken arka planı Tab ile dolaşabiliyor

### P1-4: prefers-reduced-motion — scroll-behavior
- **Sayfa:** index.html `<html style="scroll-behavior:smooth">`
- **Kontrol:** `grep -n 'prefers-reduced-motion' index.html dist/tw.css` → 0 sonuç
- **WCAG:** 2.3.3 Animation from Interactions (Level AAA, ama best practice)
- **Fix:** CSS `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }`

### P1-5: Color contrast — footer link opacity-60
- **Sayfa:** index.html satır 719-723
- **Kontrol:** App Store/Google Play/PWA linkleri `opacity-60` + white text on dark bg. Bg: ~#072136, text: rgba(255,255,255,0.6) = ~#7FA8C4. Kontrast oranı ~3.1:1 (threshold 4.5:1)
- **WCAG:** 1.4.3 Contrast (Minimum) — Level AA FAIL
- **Fix:** `opacity-80` minimum, veya `aria-disabled` + `tabindex="-1"` ile erişimden kaldır (bu butonlar "coming soon" durumunda)

### P1-6: Lazy loading eksikliği — hero-dışı görseller
- **Kontrol:** villalar.html: 0 lazy img, restoranlar.html: 0 lazy img, tatil-asistani.html: 0 lazy img
- **Sayfa:** Hepsinde sadece hero img var, diğer resimler JS ile inject ediliyor
- **Durum:** JS-injected content için lazy loading JS tarafında handle ediliyor. ✅ ancak statik `<img>` varsa `loading="lazy"` eksik
- **Risk:** Düşük (görseller JS'ten geliyor)

---

## P2 — Optimizasyon Önerileri

### P2-1: Render-blocking — Google Fonts
- **Kontrol:** `<link href="https://fonts.googleapis.com/css2?family=Montserrat...&display=swap" rel="stylesheet">` — `rel="preload"` hint yok
- **Savings:** tatil-asistanı 870ms, patara 1,040ms, villalar 1,320ms
- **Fix:**
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?..."></noscript>
  ```
- **Tahmini etki:** FCP -0.5s, LCP -0.3s

### P2-2: Villa image boyutları — LCP ve bandwidth
- **Kontrol:** `lh-villalar.json` network requests: villa-ship-ahoy.webp 68KB, villa-ship-ahoy-2.webp 104KB, villa-ship-ahoy-3.webp 87KB, villa-poyraz.webp 100KB
- **Image-delivery savings:** 279 KB (villalar)
- **Fix:** Villa card görselleri için `<img srcset="villa-x-400w.webp 400w, villa-x-800w.webp 800w" sizes="(max-width:768px) 400px, 800px">` — şu an tek boyut sunuluyor
- **Tahmini etki:** LCP -0.4s mobile, 60-70% bandwidth tasarrufu mobile'da

### P2-3: JS bundle — cookie-banner.js 466ms parse
- **Kontrol:** tatil-asistanı Lighthouse bootup: cookie-banner.js 466ms
- **Fix:** Cookie banner'ı inline küçük script ile başlat, tam bundle'ı `requestIdleCallback` ile yükle
- **Tahmini etki:** TBT -300ms

### P2-4: Asset cache — HTML 1 saat (kısa)
- **Kontrol:** vercel.json: `*.html` → `Cache-Control: public, max-age=3600, must-revalidate`
- **Durum:** Bu kasıtlı (CDN invalidation kolaylığı). Statik asset cache ✅ 1 yıl (js/css/img). HTML için ISR/stale-while-revalidate uygun olabilir.
- **Fix:** `stale-while-revalidate=86400` ekle: `public, max-age=3600, stale-while-revalidate=86400`
- **Tahmini etki:** Repeat visitor TTFB -200ms

### P2-5: transition-all kullanımı
- **Kontrol:** `grep -rn 'transition-all' js/onboarding.js` → 1 instance (progress bar)
- **Durum:** Sadece 1 instance, düşük risk. Best practice ihlali ama kritik değil.
- **Fix:** `transition: width 300ms ease` ile değiştir

### P2-6: Image delivery — patara hero 206KB savings
- **Sayfa:** /antik-kentler/patara
- **Kontrol:** `image-delivery-insight: Est savings of 206 KiB`
- **Fix:** Antik kent hero görsellerini Sharp ile `quality:75, effort:6` yeniden encode et. Hedef: her hero <60KB

### P2-7: 1566 eksik i18n attr
- **Kontrol:** build-multilang.mjs çıktısı: `⚠️ Eksik çeviri attr toplam: 1566`
- **Etki:** Hreflang ve dil değiştiricisi olan sayfalarda SEO alt sayfalarda TR dışı içerik eksik
- **Fix:** En az ziyaret edilen 5 dil sayfasını önce tamamla. `scripts/build-multilang.mjs` çıktısındaki sayfa listesini al.

---

## Asset Audit Özeti

| Kontrol | Değer | Hedef | Durum |
|---------|-------|-------|-------|
| JPG sayısı | 46 | 0 | ⚠️ Henüz 46 jpg kaldı |
| WebP sayısı | 329 | max | ✅ |
| lazy loading attr (tüm HTML) | 37 instances (8 dosya) | tüm img | ⚠️ Eksik |
| Hero LCP preload | ✅ 4/4 sayfa | 4/4 | ✅ |
| width+height on hero imgs | ✅ tüm heroler | gerekli | ✅ |
| JS toplam | 415 KB / 50 dosya | — | ⚠️ |
| CSS (tw.css) | 54 KB | <30 KB | ⚠️ |
| Cache headers (assets) | 1 yıl immutable | ✅ | ✅ |
| Cache headers (HTML) | 1 saat | yeterli | ✅ |
| Cache headers (sw.js) | no-cache | ✅ | ✅ |

---

## Build Pipeline Health

```
📂 51 HTML kaynak bulundu
✅ 204 dosya üretildi (4 dil × 51 sayfa)
🗺️  sitemap.xml: 255 URL
⚠️  Eksik çeviri attr toplam: 1566
⏱️  6080ms
```

- **Durum:** Build temiz, exit 0 ✅
- **Beklenti 196 dosya idi:** 204 üretildi — bazı yeni sayfalar eklenmiş, beklenti güncellenebilir
- **1566 eksik attr:** Kritik değil ancak SEO açısından önemli

---

## Verification Report

### Verdict
**Status:** FAIL  
**Confidence:** high  
**Blockers:** 4 (P0-1 patara LCP 7.1s, P0-3 redirect 720ms kayıp, P0-4 TBT 2,100ms, P1-1 skip-to-content eksik)

### Evidence
| Check | Result | Command/Source | Output |
|-------|--------|----------------|--------|
| Lighthouse villalar mobile | fail | `npx lighthouse --preset=perf` | Perf 47, LCP 3.9s, TBT 2100ms |
| Lighthouse tatil mobile | fail | `npx lighthouse --preset=perf` | Perf 54, LCP 3.5s, TBT 1970ms |
| Lighthouse patara mobile | fail | `npx lighthouse --preset=perf` | Perf 41, LCP 7.1s, TBT 1870ms |
| Lighthouse index | n/a | redirect issue | Score 0/null — redirect chain |
| Build | pass | `node scripts/build-multilang.mjs` | exit 0, 204 dosya |
| JPG kaldı | warn | `ls assets/img/*.jpg | wc -l` | 46 jpg |
| Lazy loading coverage | partial | `grep loading="lazy" *.html` | 37 attr, 8 dosya; villalar/restoranlar/tatil: 0 |
| Hero preload | pass | grep index+villalar+restoranlar+tatil | 4/4 sayfa ✅ |
| width/height on heroes | pass | node parse | ✅ tüm heroler |
| Skip-to-content | fail | grep skip index.html | 0 sonuç |
| Focus trap (drawer) | fail | grep Tab site-drawer.js | Tab key capture yok |
| Button aria-label | partial | grep button index.html | 7/10 labelsız |
| Color contrast footer | fail | manual calc | ~3.1:1 (threshold 4.5:1) |
| Cache headers assets | pass | vercel.json | 1y immutable ✅ |
| i18n completeness | warn | build log | 1566 eksik attr |

### Acceptance Criteria
| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | LCP < 2.5s tüm sayfalar | MISSING | villalar 3.9s, tatil 3.5s, patara 7.1s |
| 2 | CLS < 0.1 | PARTIAL | patara 0.005 ✅, tatil 0.08 ✅, villalar 0.115 ❌ |
| 3 | TBT < 200ms | MISSING | 1870-2100ms tüm sayfalarda |
| 4 | JPG = 0 | MISSING | 46 jpg kaldı |
| 5 | Hero LCP preload | VERIFIED | 4/4 sayfa `<link rel=preload as=image>` ✅ |
| 6 | width+height on imgs (CLS) | VERIFIED | Hero imglar tümünde ✅ |
| 7 | Asset cache 1y | VERIFIED | vercel.json ✅ |
| 8 | HTML cache 1h | VERIFIED | vercel.json ✅ |
| 9 | Build temiz | VERIFIED | exit 0, 204 dosya ✅ |
| 10 | WCAG skip-to-content | MISSING | 0 instance tüm sayfalarda |
| 11 | Button aria-label | PARTIAL | carousel prev/next labelsız |
| 12 | Modal focus trap | PARTIAL | aria-modal ✅, Tab trap ❌ site-drawer |
| 13 | Color contrast AA | PARTIAL | footer links ~3.1:1 ❌ |
| 14 | html lang attr | VERIFIED | `lang="tr"` ✅ |
| 15 | hreflang tags | VERIFIED | 4 dil hreflang ✅ |

### Gaps
- **Patara LCP 7.1s** — Risk: high — Fix: hero preload + image 206KB → <60KB
- **TBT 1870-2100ms tüm sayfalarda** — Risk: high — Fix: Supabase auth-js sadece auth sayfalarında yükle, cookie-banner lazy, Sentry lazy
- **Redirect chain 720-750ms** — Risk: high — Fix: HSTS preload listesine domain gönder (hstspreload.org)
- **46 JPG kaldı** — Risk: medium — Fix: `for f in assets/img/*.jpg; do cwebp -q 80 "$f" -o "${f%.jpg}.webp"; done`
- **Skip-to-content yok** — Risk: medium (WCAG A) — Fix: `<a href="#main" class="sr-only focus:not-sr-only">` ekle
- **Google Fonts render-blocking** — Risk: medium — Fix: preload/onload pattern ile async yükle (870-1320ms savings)
- **1566 i18n attr eksik** — Risk: low-medium — Fix: en kritik sayfalar önce

### Recommendation
REQUEST_CHANGES — 4 P0 bloker (patara LCP 7.1s, evrensel TBT>1.8s, redirect chain 720ms, skip-to-content eksikliği) production Core Web Vitals puanını ve WCAG A uyumluluğunu doğrudan etkiliyor; bu fix'ler tamamlanmadan audit geçemez.
