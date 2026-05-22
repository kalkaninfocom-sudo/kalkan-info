# AESTHETIC Audit — 2026-05-22

## Brand Sistem Envanteri

### Renkler (tailwind.config.js)
| Token | Hex | Kullanım amacı |
|---|---|---|
| sea-500 | #1a5e93 | Ana marka rengi, nav active, link |
| sea-600 | #134c79 | Hover state nav |
| sea-700 | #0d3a5f | Hover bg nav items |
| sea-800 | #0a2e4c | Body text, heading |
| sun-400 | #f4b53d | Hero badge, accent dot |
| sun-500 | #e89812 | Primary CTA gradient base |
| sun-600 | #c97c08 | Concierge FAB, hover CTA |
| coral-500 | #e74c3c | Breaking/notice badge |
| ink-900 | #061d33 | Deepest background |

### Fontlar
- **Display (headings):** Montserrat 500/600/700/800/900 — letter-spacing: -0.02em global, -0.03em hero h1
- **Body:** Inter 400/500/600/700
- Google Fonts CDN ile yükleniyor (her sayfada `<link>` preconnect + stylesheet)

### Shadow Sistemi (tailwind.config.js)
- `card`: `0 1px 2px rgba(13,58,95,0.06), 0 8px 24px -8px rgba(13,58,95,0.18)`
- `deep`: `0 8px 32px -8px rgba(13,58,95,0.35)`
- `glow`: `0 0 0 4px rgba(232,152,18,0.18)` — hiçbir sayfada aktif kullanım tespit edilmedi

### Animasyonlar (inline CSS)
- `marquee`: 35s linear infinite
- `tile-icon` hover: `translateY(-4px)`, cubic-bezier(.34,1.56,.64,1)
- `underline-grow`: scaleX, 0.25s ease
- `target-ring`: 2s fade, sun-400/25 outline
- `card-hover`: translateY(-2px), 0.22s ease — tutarlı tüm listeleme sayfalarında

---

## Sayfa-bazlı Bulgular

| Sayfa | Bulgu | Önem | Önerilen Düzeltme |
|---|---|---|---|
| `transfer.html` | Hero `min-height:380px` sabit px — diğer tüm listeleme sayfaları `h-[56vh]` veya benzeri viewport birimli | P1 | `min-h-[50vh]` ile tutarlaştır |
| `events.html` | Hero preload yok (`preloads=0`) — LCP gecikir | P1 | `<link rel="preload" as="image" fetchpriority="high">` ekle |
| `pricing.html` | Hero preload yok (`preloads=0`) | P1 | `<link rel="preload" as="image" fetchpriority="high">` ekle |
| `b2b-dashboard.html` | Hero preload yok, hero image da yok — beyaz `bg-white` header, tüm sitenin koyu navy tonundan kopuyor | P1 | Header'a `bg-sea-900` + beyaz logo veya en azından `border-b border-sea-200` derinlik |
| `index.html` | Hero image `opacity-40`, restoranlar/plajlar/turlar `opacity-50` — aynı karanlık overlay üstünde tutarsız | P2 | Tüm listeleme sayfalarını `opacity-50` olarak standartlaştır |
| `hizmetler.html` | Hero image `opacity-40`, diğer kategori sayfaları `opacity-50` — yukarıdaki sorunun bir parçası | P2 | `opacity-50` ile hizala |
| `pricing.html` | Breaking badge rengi `bg-sun-500/95` (sarı), diğer tüm sayfalar `bg-coral-500/90` (kırmızı) | P2 | `bg-coral-500/90` olarak standartlaştır veya pricing için kasıtlıysa belge |
| `b2b-dashboard.html` | Özel `.stat-card` ve `.panel` class'ları `border-radius:14px` hardcoded — `tailwind.config.js`'deki `card` shadow tokenını kullanmıyor | P2 | `shadow-card` token ile değiştir, radius `rounded-2xl` Tailwind class kullan |
| `villalar.html` | CTA primary `bg-sun-600` (2 kez) — `index.html`'de `bg-sun-500` (23 kez dominant) — primary ton tutarsız | P1 | Tüm primary CTA'ları `bg-sun-500` → gradient (`#e89812→#c97b09`) olarak standartlaştır |
| `restoranlar.html` | Primary CTA yok — sadece `bg-sun-600` (1) ve `bg-sun-700` (1) — sun-500 kullanımı sıfır | P2 | Restoran kartlarına `bg-sun-500` primary CTA ekle |
| `transfer.html` | `h3` başlıkları `font-bold` (listeleme sayfalarında `font-extrabold`) — heading weight tutarsız | P2 | `font-extrabold` ile hizala |
| `antik-kentler/patara.html` | `.fact-card` inline class — `tailwind.config.js` token değil, hardcoded `border:1px solid #e3edf6;border-radius:14px` | P2 | `card-base` class veya Tailwind token ile standartlaştır |
| `aktiviteler.html` | Season filtre butonları `bg-white text-sea-700` aktif state yok — seçili durum görsel olarak belirsiz | P1 | Aktif button için `bg-sea-700 text-white` ya da `ring-2 ring-sun-400` state ekle |
| `events.html` | `hero-overlay` CSS class kullanıyor (transfer ile aynı) ama hero section'ı `min-height:380px` yerine `py-10` padding bazlı — oran tutarsız | P2 | Explicit `min-h-[50vh]` ekle |
| `b2b-dashboard.html` | `shadow-glow` token (`tailwind.config.js`'de tanımlı) hiçbir sayfada kullanılmıyor | P2 | Stat card focus/active state'i için `shadow-glow` uygula — token boşa gidiyor |
| `index.html` | `onmouseover/onmouseout` inline JS ile hover efekti — diğer tüm CTA'lar CSS transition kullanıyor | P2 | Inline handler'ı kaldır, CSS `hover:` ve `transition` class ile değiştir |
| `bottom-nav.js` | 5 kolonlu grid (`grid-template-columns: repeat(5, 1fr)`) — 320px ekranlarda ikon+etiket sığmıyor (etiket 9px altına düşüyor) | P1 | 320px breakpoint için `font-size:9px` veya etiket gizle |

---

## Card System Tutarsızlıkları

- **Villalar:** Kartlar JS ile dinamik render, `villa-card` class — shadow inline style ile (`box-shadow:...`), `card-base` class kullanılmıyor.
- **Restoranlar/Plajlar/Turlar:** Kartlar JS ile dinamik render, `card-base card-hover` class pair kullanılıyor — doğru pattern.
- **B2B:** `.stat-card` ve `.panel` — ayrı custom class, token sistemi dışında. `border-radius:14px` ≈ `rounded-2xl` ama Tailwind class değil.
- **Antik kentler (patara):** `.fact-card` — üçüncü bir custom class. `border:1px solid #e3edf6` hardcoded renk — `border-sea-200` olmalı.
- **Özet:** 4 farklı card pattern var (`villa-card`, `card-base`, `.stat-card/.panel`, `.fact-card`). Semantic olarak farklı ama shadow/radius değerleri birbirine çok yakın — tek token altında birleştirilebilir.

---

## Mobile Overflow Noktaları

- **Bottom nav 5 kolon @ 320px:** `grid-template-columns: repeat(5, 1fr)` → her kolon 64px — 11px font etiket 320px'de kırpılıyor. `bottom-nav.js` satır ~42.
- **Sticky nav + hero:** `nav.sticky.top-0.z-40` hero üstüne gelince doğru, ancak `transfer.html` ve `events.html`'de `pt-6` hero padding kullanıyor — nav yüksekliği (≈48px) hesaba katılmamış, başlık nav'ın altında kalabilir.
- **Concierge FAB gizleme:** `bottom-nav.js` `#concierge { display:none !important; }` inject ediyor — bu JS yüklenmeden önce `fixed bottom-5 right-5` FAB görünür, CLS yaratıyor.
- **Safe-area padding:** `body.ki-bn-active { padding-bottom: calc(68px + env(safe-area-inset-bottom)) }` — doğru yaklaşım. Ancak `b2b-dashboard.html`'de `bottom-nav.js` import edilmemiş, iOS home indicator içerik üstüne gelebilir.

---

## 5 Dil Layout Farkları

- **Yapısal tutarlılık:** `en/index.html` ve `de/villalar.html` incelendi — HTML yapısı, nav, hero, card grid tamamen aynı. Layout shift yok.
- **hreflang:** Her sayfada 6 `hreflang` tag var (tr/en/de/ru/fr/x-default) — doğru.
- **`en/index.html` nav:** `data-en/de/ru/fr` attribute'larla dinamik çeviri — JS ile swap ediliyor. Render anında TR gösterilip sonra EN'e geçiş olabilir (FOUC riski).
- **`de/villalar.html`:** `nav-active` class doğru sayfada (`/de/villalar.html`). Dil bazlı aktif state çalışıyor.
- **Eksik:** `pricing.html` ve `b2b-dashboard.html` için `/en/`, `/de/` vb. dil klasörleri yok — bu sayfalar tek dil (TR) sunuluyor.

---

## Hero LCP Gap'leri

| Sayfa | Preload var mı? | Durum |
|---|---|---|
| `index.html` | Evet (`da72f67377f7.webp`) | Doğru |
| `villalar.html` | Evet (`7ccdf7ddf840.webp`) | Doğru |
| `restoranlar.html` | Evet (`37cacbd7429e.webp`) | Doğru |
| `plajlar.html` | Evet (`da72f67377f7.webp`) | Doğru — ama index ile aynı resim |
| `turlar.html` | Evet (`1939e5065d83.webp`) | Doğru |
| `hizmetler.html` | Evet (`b7549bd5771f.webp`) | Doğru |
| `aktiviteler.html` | Evet (`19c73f523505.webp`) | Doğru |
| `antik-kentler.html` | Evet | Doğru |
| `antik-kentler/patara.html` | Evet | Doğru |
| `transfer.html` | Hayır — hero CSS gradient, resim yok | N/A — gradient hero, preload gerekmez |
| `events.html` | **Hayır** | P1 — hero image var ama preload yok |
| `pricing.html` | **Hayır** | P1 — hero image var ama preload yok |
| `b2b-dashboard.html` | Hayır — hero resim yok | N/A |

`plajlar.html` ve `index.html` aynı hero resmini (`da72f67377f7.webp`) kullanıyor — biri büyük ihtimalle yanlış resim.

---

## P1 Fix Önerileri (Wave 1'e Hazır)

1. **`events.html` + `pricing.html` LCP preload eksik** — Her birine `<link rel="preload" as="image" href="[hero-img]" fetchpriority="high">` ekle.
2. **`aktiviteler.html` aktif filtre state yok** — Seçili season butonuna `bg-sea-700 text-white` class'ı toggle et.
3. **Primary CTA renk tutarsızlığı** — `villalar.html` CTA'larını `bg-sun-500` → `background:linear-gradient(135deg,#e89812,#c97b09)` ile hizala (index.html pattern).
4. **Bottom nav 320px overflow** — `bottom-nav.js` CSS'ine `@media(max-width:360px){ .ki-bn-label { display:none } }` ekle.
5. **`b2b-dashboard.html` bottom-nav.js eksik** — iOS safe-area padding için `<script src="js/bottom-nav.js" defer>` ekle.
6. **`plajlar.html` hero resim duplicate** — `index.html` ile aynı `da72f67377f7.webp` kullanıyor — plaj temalı farklı bir hero resmi seç.

## P2 Polish Önerileri (Wave 2)

7. **Hero image opacity standardizasyonu** — `index.html` + `hizmetler.html` `opacity-40` → `opacity-50` (restoranlar/plajlar/turlar ile hizala).
8. **Breaking badge rengi** — `pricing.html`'deki `bg-sun-500/95` → `bg-coral-500/90` (tüm sayfalarla tutarlı).
9. **`b2b-dashboard.html` header koyu tema** — `bg-white` → `bg-sea-900 text-white` veya en azından `border-b-2 border-sea-300` — sitenin genel dark-navy tonuna uyum sağla.
10. **`shadow-glow` token kullanılmıyor** — `tailwind.config.js`'de tanımlı ama hiçbir yerde aktif değil — stat card veya CTA focus state'inde uygula.
11. **Inline `onmouseover/onmouseout` JS** — `index.html` hero CTA'da — CSS `hover:` ile değiştir, bakımı kolaydır.
12. **`.fact-card` / `.stat-card` / `.panel` custom class'larını** `card-base` + Tailwind token sistemi ile birleştir — 4 shadow tanımı → 1'e indir.
13. **`transfer.html` heading weight** — `h3 font-bold` → `font-extrabold` (site geneli heading standardı).
14. **Concierge FAB CLS** — `bottom-nav.js` yüklenmeden önce FAB görünüyor — `<style>#concierge{display:none}</style>` ile inline gizle, JS'i bekletme.
15. **`pricing.html` + `b2b-dashboard.html` dil desteği** — Bu 2 sayfa için `/en/`, `/de/` mirror sayfaları eksik — uluslararası kullanıcılar TR içerik görüyor.
