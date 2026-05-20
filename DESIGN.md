---
$schema: https://design.md/v0.1
name: Kalkan Info Design System
version: 0.1.0
description: Kalkan turizm portali için yerel deniz mavisi + altın aksanlı, kurumsal turizm markası tasarım dili
tokens:
  color:
    brand:
      navy-base: "#0a2e4c"
      navy-darker: "#072136"
      navy-mid: "#0c3858"
      navy-accent: "#1a5e93"
      navy-ribbon: "#0d3a5f"
      gold-primary: "#e89812"
      gold-light: "#f4b53d"
    surface:
      base: "#dce6ef"
      alt: "#eef4f9"
      white: "#ffffff"
      border: "#cfdfee"
      border-soft: "#dce8f0"
    text:
      primary: "#0a2e4c"
      muted: "#5d97c4"
      inverse: "#ffffff"
      link-hover: "#1a5e93"
    state:
      lost: "#b91c1c"
      lost-bg: "#fee2e2"
      found: "#15803d"
      found-bg: "#dcfce7"
      instagram: "#e1306c"
  typography:
    font:
      body: "'Inter', system-ui, sans-serif"
      display: "'Montserrat', system-ui, sans-serif"
    tracking:
      display: "-0.02em"
      label-upper: "0.18em"
    line-height:
      body: 1.7
      heading: 1.15
  space:
    grid-base: "4px"
    section-y: "5rem"
    card-padding: "1.25rem"
    hero-y: "6rem"
  radius:
    pill: "9999px"
    card: "12px"
    btn: "10px"
  shadow:
    card-base: "0 1px 3px rgba(7,33,54,0.07), 0 6px 20px -6px rgba(7,33,54,0.14)"
    card-hover: "0 4px 14px rgba(7,33,54,0.12), 0 18px 40px -12px rgba(7,33,54,0.22)"
    nav: "0 4px 24px -4px rgba(7,33,54,0.55)"
    premium: "0 20px 60px -20px rgba(10,46,76,0.25)"
  gradient:
    nav-primary: "linear-gradient(180deg, {color.brand.navy-mid} 0%, {color.brand.navy-base} 100%)"
    ribbon: "repeating-linear-gradient(90deg, {color.brand.navy-darker} 0 12px, {color.brand.navy-ribbon} 12px 24px)"
    photo-treatment: "linear-gradient(160deg, rgba(13,58,95,0.3) 0%, transparent 60%)"
  motion:
    duration:
      micro: "150ms"
      base: "250ms"
      slow: "400ms"
    easing:
      standard: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
---

# Kalkan Info Design System

## Marka Sesi
Akdeniz turizmi premium ama erişilebilir. Lacivert (deniz) + altın (Likya antik) ikilisi — Tailwind default indigo/blue **ASLA** kullanılmaz, sadece bu palet.

## Renk Kullanımı

### Lacivert Hiyerarşisi
- `brand.navy-darker` (#072136) — derin arka plan, header, ribbon
- `brand.navy-base` (#0a2e4c) — primary text, nav, dark sections
- `brand.navy-mid` (#0c3858) — gradient üst, hover background
- `brand.navy-accent` (#1a5e93) — link hover, focus ring, secondary accent
- `brand.navy-ribbon` (#0d3a5f) — repeating ribbon pattern

### Altın Aksan
- `brand.gold-primary` (#e89812) — CTA underline-grow, "nav-active"
- `brand.gold-light` (#f4b53d) — target ring animation, hover gold

### Surface Katmanlama
Tüm yüzeyler 3 katmanda: `base` (#dce6ef) → `alt` (#eef4f9) → `white`. Aynı z-plane'de oturmasın, kart shadow ile katmanları ayır.

## Tipografi
- Heading her zaman `Montserrat`, tracking `-0.02em`. Asla aynı font body için.
- Body `Inter`, line-height 1.7 generous.
- Label/eyebrow upper-case, tracking 0.18em, ::before küçük çizgi (`section-label` pattern).

## Shadow Katmanlama
- `card-base` durağan
- `card-hover` etkileşim üzerinde
- `nav` sticky header için derin
- `premium` pricing/highlight kartları için (Premium tier visual elevate)

Asla `shadow-md` veya Tailwind default shadow. Hepsi `rgba(7,33,54,...)` tinted.

## Gradient & Görsel İşlem
- Hero/section dark: `nav-primary` gradient
- Ribbon decoration: `ribbon` repeating pattern (haberler, CTA bandı)
- Görsel üstüne her zaman `photo-treatment` katmanı (mix-blend-multiply) — Kalkan estetiği kontrastlı

## Hareket
- Sadece `transform` ve `opacity` anime — `transition-all` **YASAK**
- Micro UI: 150ms standard easing
- CTA hover underline-grow: 250ms transform scaleX
- Spring (modal, drawer): cubic-bezier(0.34, 1.56, 0.64, 1)

## Etkileşim State'leri
Her clickable element için **dört** state zorunlu:
1. Default
2. Hover (transform veya color shift, shadow uplift)
3. Focus-visible (gold ring, outline-offset 3px)
4. Active (scale 0.98 veya darker shade)

`outline:none` yok — focus accessibility için `gold-light` ring şart.

## i18n Pattern
TR baseline content. `data-en` / `data-de` / `data-ru` / `data-fr` attr'ları element üzerinde. Build script `/{lang}/page.html` statik render'lar.

## Yasaklar (Anti-Generic)
- Tailwind indigo/blue/sky default — yok
- `shadow-md` flat shadow — yok
- `transition-all` — yok
- Aynı font body + heading — yok
- Tek z-plane "flat" layout — yok
- AI-stock generic gradient — yok
