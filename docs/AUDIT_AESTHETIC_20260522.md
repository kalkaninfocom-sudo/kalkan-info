# Visual/UI Audit — 2026-05-22

## Özet

Kalkan Info'nun genel tasarım dili tutarlı ve kasıtlı: sea/sun renk sistemi, Montserrat display + Inter body ikilisi, katmanlı gölgeler ve glass-morphism hero iyi çalışıyor. Temel sorunlar üç alanda yoğunlaşıyor: (1) body text için line-height ve font-weight eksikliği okunabilirliği düşürüyor, (2) section padding tamamen tutarsız (py-5 ile py-12 arasında 5 farklı değer), (3) mobile buton yükseklikleri `py-2` ile sınırlı kalıyor (≈32px) — 44px thumb hedefinin altında. Bunlar P0 değil ama profesyonel sıçrama için çözülmeli.

---

## P0 — Marka algısı kıran (kritik)

### 1. Body line-height tanımsız — okunabilirlik düşük
- **Dosya:** index.html:17, villalar.html:15, tüm sayfalar
- `html,body{font-family:'Inter',...}` içinde `line-height` yok. Tarayıcı default 1.2 kullanıyor, 1.6+ olmalı.
- **Fix:** `html,body{font-family:'Inter',system-ui,sans-serif;color:#0a2e4c;background:#dce6ef;line-height:1.65;}`

### 2. Section body paragraflarında font-weight belirsiz
- **Dosya:** index.html içi `<p>` elemanları, restoranlar.html, plajlar.html
- Kart açıklama metinleri `text-xs text-sea-700/70` ile ezilmiş — kontrast ~2.8:1, WCAG AA için 4.5:1 gerekli.
- **Fix:** `text-sea-700/70` → `text-sea-700` (opacity kaldır). Küçük metin en az `text-sea-600` olmalı.

### 3. Rehber sayfası (rehber/index.html) hero'su zayıf
- **Dosya:** rehber/index.html — `min-height:320px` ve `hero-overlay` class var ama inline CSS yok, `.hero-overlay` tanımsız.
- Diğer sayfalardaki `radial-gradient` + `linear-gradient` katmanı burada eksik — hero düz siyah görünüyor.
- **Fix:** `<style>.hero-overlay{background:radial-gradient(ellipse 80% 60% at 60% 40%,rgba(26,94,147,0.45) 0%,transparent 70%),linear-gradient(180deg,rgba(7,33,54,0.55) 0%,rgba(7,33,54,0.92) 100%);}</style>`

---

## P1 — Profesyonel sıçrama için şart

### 4. Section padding tutarsızlığı — 5 farklı değer
- **Dosya:** index.html:231 `py-8 md:py-10`, :283 `py-10`, :344 `py-12`, :580 `py-12`, villalar.html:353 `py-5`
- Villalar filtre bar `py-5` iken hemen altındaki içerik bölümü `py-10` — geçişte görsel sıkışma.
- **Fix:** Standart token belirle: utility → `py-4`, section → `py-10 md:py-14`, hero-attached band → `py-6`.

### 5. Mobile buton yükseklikleri 44px altında
- **Dosya:** index.html:297,301,306 — `px-4 py-2` = ~32px yükseklik
- Nöbetçi eczane ve acil seksiyon linkleri `py-2` ile mobilde thumb-unfriendly.
- **Fix:** `py-2` → `py-2.5` (36px) veya `py-3` (44px). Minimum: `min-h-[44px] flex items-center`.

### 6. Tatil Asistanı sayfası: hero resmi opacity %30 — çok soluk
- **Dosya:** tatil-asistani.html — `opacity-30`
- Diğer sayfalarda `opacity-40` veya `opacity-50`. Bu sayfada hero neredeyse tamamen karanlık görünüyor.
- **Fix:** `opacity-30` → `opacity-45`

### 7. Antik-kentler/patara.html h1 leading tutarsız
- **Dosya:** antik-kentler/patara.html — `leading-[1.05]`
- Ana sayfalarda hero h1 `leading-[1.0]`, patara'da `[1.05]`. İki değer arasında görsel fark yok ama standart dışı.
- **Fix:** Tüm hero h1 elementlerini `leading-[1.0]` ile standartlaştır.

### 8. Pricing sayfası h1 skala kırık — 3 boyut değeri
- **Dosya:** pricing.html — `text-3xl md:text-5xl lg:text-6xl`
- Diğer sayfalar `text-5xl md:text-7xl`. Pricing hero'su görsel olarak küçük kalıyor, hiyerarşi kopuyor.
- **Fix:** `text-4xl md:text-6xl lg:text-7xl` — diğer sayfalara yaklaştır ama pricing bağlamında biraz daha küçük tutmak kabul edilebilir; en az `md:text-6xl`.

### 9. Nav `hover:bg-white/8` — geçersiz Tailwind değeri
- **Dosya:** villalar.html:299, restoranlar.html — `hover:bg-white/8`
- Tailwind opacity scale'de `8` yok (5, 10, 15... var). Hover efekti görünmüyor.
- **Fix:** `hover:bg-white/8` → `hover:bg-white/10`

### 10. Section h2 → içerik boşluğu: `mt-1` yetersiz
- **Dosya:** index.html:334, villalar.html:402 — section label + h2 arasında `mt-1`
- `mt-1` = 4px. Label ile başlık arası görsel nefes yok.
- **Fix:** `mt-1` → `mt-2` (8px). Section başlık → içerik: `mt-4` → `mt-6`.

---

## P2 — İyileştirme

### 11. `Inter` body font — tasarım kılavuzuna aykırı
- **Dosya:** tüm sayfalar — `font-family:'Inter'`
- CLAUDE.md "Inter/Roboto kullanma" diyor. Mevcut yapı çalışıyor ama daha ayırt edici bir body font düşünülebilir.
- **Öneri:** `DM Sans` veya `Lato` — Inter'den farklı ama aynı nötr konforta sahip.
- Öncelik: düşük (tüm sayfaları etkiler, risk yüksek).

### 12. Card hover transform `translateY(-2px)` — fazla subtle
- **Dosya:** index.html:32 `.card-hover:hover{transform:translateY(-2px)}`
- 2px neredeyse görünmez. Pricing ve antik-kentler kartlarında `-3px` kullanılıyor.
- **Fix:** Tüm `.card-hover` → `translateY(-3px)` ile standartlaştır.

### 13. Rehber kartı `.gd-body` padding inline CSS ile tanımlı değil
- **Dosya:** rehber/index.html — `.gd-card`, `.gd-body` class'ları var ama sadece `<style>` bloğunda `.gd-card` + `.gd-img` tanımlı, `.gd-body` padding'i yok.
- Kart içi metin sol kenardan sıfır boşlukla başlıyor olabilir.
- **Fix:** `.gd-body{padding:14px 16px 16px;}` ekle.

### 14. `transition-all` kullanımı (CLAUDE.md yasağı)
- **Dosya:** index.html:156 — hero CTA butonunda `transition` (kısa hali, OK), ama bazı sayfalarda `transition` yetersiz tanımlanmış.
- `transition-all` tespit edilmedi — iyi. Mevcut `transition` shorthand ise transform+shadow dışındaki property'leri de kapsıyor olabilir.
- **Öneri:** CTA butonlarda `transition-[transform,box-shadow]` kullan.

### 15. Patara fact-card `text-[10px]` — çok küçük
- **Dosya:** antik-kentler/patara.html — `text-[10px] uppercase tracking-widest`
- 10px metin accessibility açısından sorunlu (WCAG minimum 12px önerir).
- **Fix:** `text-[10px]` → `text-[11px]`

---

## Quick-win commit listesi

Aşağıdakiler tek satır değişiklikle kapatılır:

1. `index.html:17` — `line-height:1.65` body'e ekle ← **en yüksek etki**
2. `villalar.html:299` + `restoranlar.html` — `hover:bg-white/8` → `hover:bg-white/10`
3. `antik-kentler/patara.html` — `text-[10px]` → `text-[11px]` (3 yer)
4. Tüm sayfalarda `text-sea-700/70` açıklama metni → `text-sea-700` (opacity kaldır)
5. `tatil-asistani.html` — hero img `opacity-30` → `opacity-45`
6. `.card-hover:hover` → `translateY(-3px)` (index.html:32)
7. `rehber/index.html` — `.hero-overlay` CSS'i ekle (3 satır)
