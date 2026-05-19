# Per-Reels Landing Pages

Her IG Reels için kendi landing sayfası. Amaç: kullanıcı reels'ten gelir, ana
sayfa kalabalığına bakıp çıkmak yerine direkt o reels'in temasıyla ilgili
detaylı içeriği görür, 3 net CTA'dan birini seçer (deep link / WhatsApp /
Tatil Planlayıcı). Beklenen conversion uplift: 3-5x.

## URL şeması

```
https://kalkaninfo.com/p/{slug}.html?utm_source=ig&utm_medium=reel&utm_campaign={slug}
```

UTM parametreleri `js/utm-tracker.js` tarafından yakalanır ve sessionStorage'a
yazılır; daha sonra form submit, üyelik, rezervasyon gibi her event'te
"attribution chain" olarak Plausible'a iletilir.

## Mevcut 6 landing sayfası

| # | Reels                | URL                                                                |
|---|----------------------|--------------------------------------------------------------------|
| 1 | Patara Carousel      | https://kalkaninfo.com/p/patara-carousel.html                      |
| 2 | Patara Cinematic     | https://kalkaninfo.com/p/patara-cinematic.html                     |
| 3 | Patara Drone         | https://kalkaninfo.com/p/patara-drone.html                         |
| 4 | Patara Hybrid        | https://kalkaninfo.com/p/patara-hybrid.html                        |
| 5 | Patara Voiceover     | https://kalkaninfo.com/p/patara-voiceover.html                     |
| 6 | Site Intro (Sarah)   | https://kalkaninfo.com/p/site-intro.html                           |

## Sayfa içeriği

Her landing:

- Hero görseli (reels'in temasıyla aynı webp)
- Başlık + 100-150 kelime özgün metin (reels'i tamamlayıcı)
- 3 CTA stack
  1. **Tam Antik Kent Sayfası** → `/antik-kentler/{antik_slug}.html`
  2. **Concierge'le Planla** → WhatsApp share intent (mesaj önceden doldurulur)
  3. **Tatil Planlayıcı** → `/tatil-asistani.html?via=reels&slug={slug}`
- Bottom-right sabit Instagram mini-thumbnail (profile link)
- Mobile-first, sadeleştirilmiş top-nav
- Plausible event: `reels_landing_view` props `{ slug, campaign }`
- og:image 1200x630 — `assets/og/reels-{slug}.png` (generator var; antik kentler
  için varsayılan olarak `assets/og/antik-{slug}.png` da kullanılabilir)
- JSON-LD: WebPage + BreadcrumbList

## Berkay manuel iş — IG Bio yapıştır

Instagram bio'su tek link kabul ediyor. 6 reels için Linktree / Beacons / Bento
üzerinden mini dağıtım sayfası kullan:

### Linktree önerilen sıra (en üstten aşağıya)

```
Patara — Demokrasinin Doğduğu Yer (Carousel)
https://kalkaninfo.com/p/patara-carousel.html

Patara — Sinematik
https://kalkaninfo.com/p/patara-cinematic.html

Patara — Drone'dan
https://kalkaninfo.com/p/patara-drone.html

Patara — Hibrit Anlatım
https://kalkaninfo.com/p/patara-hybrid.html

Patara — Sesli Tur
https://kalkaninfo.com/p/patara-voiceover.html

Kalkan Info'ya Hoş Geldin
https://kalkaninfo.com/p/site-intro.html
```

### IG Caption template (yeni reels yayınlarken)

```
[Reels açıklaması...]

🔗 Detaylı rehber + günlük plan: link in bio veya
👉 kalkaninfo.com/p/{slug}

#kalkan #patara #lycia #kalkaninfo
```

### Story sticker template

Reels yayınladığında story'ye otomatik linkli sticker eklerken:

- Sticker text: "Tam rehber"
- Sticker URL: `https://kalkaninfo.com/p/{slug}.html`

## Build komutu

```bash
node scripts/build-reels-landing.mjs
node scripts/generate-og-reels.mjs   # opsiyonel — antik OG zaten yeterli
```

Yeni reels eklendikçe `content/reels.json` dosyasına satır eklenir, sonra
build script'i tekrar çalıştırılır.

## Çakışma / dikkat

- `/p/` dizini yeni — başka script bu yola yazmıyor.
- Sayfalar `js/utm-tracker.js`'i import eder (önceden eklenmişti).
- Plausible event name: `reels_landing_view` ve CTA başına
  `reels_cta_primary`, `reels_cta_whatsapp`, `reels_cta_tatil`.
- WhatsApp numarası `scripts/build-reels-landing.mjs` içinde
  `WHATSAPP_NUMBER` sabitinde — Berkay gerçek numarayla değiştirip rebuild eder.
