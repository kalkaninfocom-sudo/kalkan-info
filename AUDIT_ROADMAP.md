# kalkan-info — C-Suite Audit Roadmap

**Date:** 2026-05-15
**Source:** 6 paralel C-suite eleştirisi (CTO/CEO/CMO/CDO/CPO/CFO)
**Status legend:** ✅ DONE · 🟡 IN PROGRESS · ⬜ TODO · ❌ DISMISSED (yanlış iddia/iş dışı)

> **Not:** $150M acquisition hedefi LOA projesine ait, Kalkan Info bu kapsama girmiyor. CFO ve CEO bulgularının çoğu o bağlamla geçersiz. Bu roadmap **teknik/UX/SEO/güvenlik** sertleştirmesine odaklanıyor.

---

## 🔥 Tier 0 — Acil (commit `4a5f6d7` ile kapandı, 2026-05-15)

| # | Durum | Bulgu | Karar |
|---|---|---|---|
| T0.1 | ❌ DISMISSED | `js/render.js:36` ve `lost-found.js:31` escape() XSS iddiası | node testi: çalışıyor (`{...}[c]` syntax doğru) |
| T0.2 | ✅ DONE | CSP header yok | `vercel.json` headers'a CSP eklendi |
| T0.3 | ✅ DONE | `:focus-visible` yok | global CSS rule |
| T0.4 | ✅ DONE | `prefers-reduced-motion` yok | global CSS guard |
| T0.5 | ✅ DONE | Analitik yok | Plausible cookieless |
| T0.6 | ✅ DONE | Canonical `/index.html` | `/` formatına alındı |
| T0.7 | ✅ DONE | Sitemap login/register çelişki | sitemap.xml'den çıkarıldı |
| T0.8 | ✅ DONE (T1.9'da pekiştirildi) | "Claude AI destekli" yalan etiketi | etiket kaldırıldı |
| T0.9 | ✅ DONE | GİRİŞ YAP floating pill çakışması | kaldırıldı |
| T0.10 | 🟡 OPSİYONEL | Bottom-nav emoji → SVG | sonra |

## 🔧 Tier 1 — Yüksek etki (bu hafta)

| # | Durum | Bulgu | Kapanış |
|---|---|---|---|
| T1.1 | ✅ DONE | Restaurant/LocalBusiness JSON-LD yok | restoranlar.html'e 25 Restaurant ItemList JSON-LD eklendi |
| T1.2 | ✅ DONE | hreflang tag yok (5 dil iddia) | 18 sayfaya hreflang TR + x-default eklendi (admin/profil noindex) |
| T1.3 | ✅ DONE | OG image generic Unsplash | `assets/og-default.png` marka kompoziti üretildi (sharp), 18 sayfada og:image + twitter:image güncellendi |
| T1.4 | ✅ DONE | Email capture yok | Supabase tablo + Edge Function + api/newsletter-confirm + footer band (10 sayfa). Berkay deploy edecek: `supabase db push` + `supabase functions deploy newsletter-subscribe` |
| T1.5 | ✅ DONE | emerald-600 palette leak | 53 occurrence → sun-* paletine remap (HTML×39, JS×14). Tailwind sun palette tam (50–900) |
| T1.6 | ✅ DONE | Heading scale boş (h1=48 → h2=24) | 16 sayfa h2 `text-2xl md:text-3xl` → `text-3xl md:text-4xl` |
| T1.7 | ❌ DISMISSED | Double hamburger menu | `site-drawer.js:23–150` zaten idempotent + ID/text fallback ile hero menüyü bağlıyor. False positive |
| T1.8 | ✅ DONE | Placeholder telefonlar | data/hizmetler.json 13 placeholder → null; `hizmetCard` zaten phone göstermiyor → null güvenli |
| T1.9 | ✅ DONE | Vacation Assistant fake AI badge | tatil-asistani.html:798 "Claude planı düşünüyor..." → "Tatil planınız hazırlanıyor..." |
| T1.10 | ✅ DONE | i18n claim vs reality | TR-only commit: 4 sayfadan `data-i18n` temizlendi, js/i18n.js + js/lang-switcher.js + lang/*.json silindi, "5 dilde" iddiası ilanlar.html'den kaldırıldı |

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
