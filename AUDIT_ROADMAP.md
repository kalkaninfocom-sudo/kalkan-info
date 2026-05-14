# kalkan-info — C-Suite Audit Roadmap

**Date:** 2026-05-15
**Source:** 6 paralel C-suite eleştirisi (CTO/CEO/CMO/CDO/CPO/CFO)
**Status legend:** ✅ DONE · 🟡 IN PROGRESS · ⬜ TODO · ❌ DISMISSED (yanlış iddia/iş dışı)

> **Not:** $150M acquisition hedefi LOA projesine ait, Kalkan Info bu kapsama girmiyor. CFO ve CEO bulgularının çoğu o bağlamla geçersiz. Bu roadmap **teknik/UX/SEO/güvenlik** sertleştirmesine odaklanıyor.

---

## 🔥 Tier 0 — Acil (bu oturumda)

| # | Bulgu | Kaynak | Karar |
|---|---|---|---|
| T0.1 | `js/render.js:36` ve `lost-found.js:31` escape() XSS açık iddiası | CTO | ❌ DISMISSED — node testi: çalışıyor (`{...}[c]` syntax doğru) |
| T0.2 | CSP header yok → XSS özgürce çalışır | CTO | ⬜ TODO — `vercel.json` headers'a CSP ekle |
| T0.3 | `:focus-visible` yok (WCAG AA fail) | CDO | ⬜ TODO — global CSS rule |
| T0.4 | `prefers-reduced-motion` yok | CDO | ⬜ TODO — global CSS guard |
| T0.5 | Hiç analitik yok (GA4/Plausible/Pixel) | CMO | ⬜ TODO — Plausible kur (cookieless, GDPR safe) |
| T0.6 | Canonical `/index.html` → `/` olmalı | CMO | ⬜ TODO — sed batch |
| T0.7 | Sitemap login/register içeriyor, robots disallow ediyor (çelişki) | CMO | ⬜ TODO — sitemap.xml'den çıkar |
| T0.8 | "Claude AI destekli" yalan etiketi tatil-asistani'nde | CPO | ⬜ TODO — etiket kaldırılacak veya gerçek API'ye bağlanacak |
| T0.9 | GİRİŞ YAP floating pill (`z-index:99999`) bottom-nav ile çakışıyor | CDO | ⬜ TODO — kaldır |
| T0.10 | Bottom-nav emoji ikonlar (🏠🔍💬🔐) → SVG | CDO | 🟡 OPSİYONEL — sonra |

## 🔧 Tier 1 — Yüksek etki (bu hafta)

| # | Bulgu | Kaynak | Aksiyon |
|---|---|---|---|
| T1.1 | `Restaurant` / `LocalBusiness` JSON-LD yok → rich snippet kaybı | CMO | restoranlar.html'e schema ekle |
| T1.2 | `hreflang` tag yok (5 dil olduğu iddia ediliyor) | CMO | TR-only olarak doğru etiketle |
| T1.3 | OG image tüm sayfalarda generic Unsplash → marka belirsiz | CMO | Kendi logo+marka kompozit oluştur |
| T1.4 | Email capture yok → tüm trafik WhatsApp'a, retargeting imkansız | CMO | Newsletter modal + footer form |
| T1.5 | `emerald-600` palette leak (25+ yer) | CDO | Brand token olarak ekle veya azalt |
| T1.6 | Heading scale eksik (h1=48 → h2=24 arası boş) | CDO | Tailwind `text-xl` kademe ekle |
| T1.7 | Double hamburger menu (hero + sticky) — hero'nun JS'i yok | CDO | Hero'daki menüyü `site-drawer.js`'e bağla veya kaldır |
| T1.8 | Hizmetler placeholder telefonlar (`+90 532 000 00 00`) | CPO | data'da null bırak, kartta gizle |
| T1.9 | Vacation Assistant fake AI badge | CPO | Etiketi kaldır veya gerçek Edge Function'a bağla |
| T1.10 | i18n claim vs gerçek (sadece TR tam) | CMO | `data-i18n` attribute'larını eksik sayfalara ekle veya iddia kaldır |

## 🛠️ Tier 2 — Mimari / borç (önümüzdeki ay)

| # | Bulgu | Kaynak | Aksiyon |
|---|---|---|---|
| T2.1 | 21 HTML kopya-paste nav/style | CTO | Astro veya 11ty migration |
| T2.2 | Tailwind CDN 3MB unpurged | CTO | `tailwindcss -o dist/tw.css --minify` |
| T2.3 | 299 Unsplash hotlink (rate-limit riski) | CTO | İndir, webp, `/images/` |
| T2.4 | Build script `news-aggregator` sessizce başarısız oluyor | CTO | Hata fırlat veya webhook alert |
| T2.5 | Admin auth `sessionStorage==='ok'` | CTO | Supabase Auth + admin claim |
| T2.6 | `currentUser()` her zaman null (dead code) | CTO | Sil veya async getUser() |
| T2.7 | `supabase-config.js` repo'da | CTO | `.gitignore` + build script ile inject |
| T2.8 | Lost & Found localStorage-only (silme kodu devtools'tan görünür) | CTO/CPO | Supabase tablosu + RLS |
| T2.9 | Job board "pending" → admin onay UI yok, email yok | CPO | Onay flow + email bildirimi |
| T2.10 | Hizmet ekle 8 adım onboarding | CPO | Booking gibi tek formda topla |

## 📊 Tier 3 — İş geliştirme (LOA dışı, opsiyonel)

| # | Bulgu | Kaynak | Karar |
|---|---|---|---|
| T3.1 | Sıfır gelir altyapısı, sıfır komisyon flow | CEO | LOA dışı — Kalkan Info'nun kendi yol haritası |
| T3.2 | Pivot önerileri (B2B SaaS, Likya Yolu) | CEO | Stratejik karar — Berkay'a kalmış |
| T3.3 | Komisyon sözleşmesi yok | CEO | Saha işi — kod değil |

---

## 🚫 Dismiss edilen iddialar

- **CTO P0 #1: XSS escape() bozuk** — Yanlış. `node -e` testi `<script>` doğru kaçırıyor.
- **CFO TAM analizi** — Doğru ama Kalkan Info için değil; LOA hedefi karışmış.
- **CEO $150M değil** — Aynı sebep.
- **CPO "Tatil asistanı AI değil"** — Doğru ama "Claude AI destekli" etiketi kaldırılırsa (T0.8) tamamlanmış olur.

---

## Yararlanılan agent kayıtları

- Marcus Reeves (CTO) — `aa7ba9c0889a90fcc`
- Diana Kostas (CEO) — `aae0cb16a4ee850c6`
- Rafael Iglesias (CMO) — `ac6f9fda8353aa1b0`
- Aiko Tanaka (CDO) — `a608c8c4be22f3160`
- Sven Akermann (CPO) — `a359cca99aa3b884b`
- Esra Cinar (CFO) — `ad79ed41683e3c3f2`
