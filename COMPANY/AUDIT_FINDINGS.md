# Audit Bulguları — 2026-05-17

**Denetçi:** AuditAgent (code-reviewer, Sonnet)
**Kapsam:** Tam tarama — 60+ dosya (HTML, JS, API, SQL migrations, Edge Functions, config)
**Toplam bulgu:** 34

## Özet

| Şiddet | Adet |
|---|---|
| **Kritik** | 4 |
| **Yüksek** | 8 |
| **Orta** | 13 |
| **Düşük** | 9 |

### Kategori bazlı dağılım

| Kategori | Bulgu |
|---|---|
| A — Kod Kalitesi | 5 |
| B — KVKK / Hukuk | 6 |
| C — SEO | 7 |
| D — Performans | 3 |
| E — Erişilebilirlik | 2 |
| F — Güvenlik | 5 |
| G — i18n | 2 |

---

## A — Kod Kalitesi

| ID | Açıklama | Şiddet | Konum | Önerilen fix |
|---|---|---|---|---|
| A1 | `emerald-*` palette artığı kaldı | Düşük | `index.html:256` | `text-emerald-700 bg-emerald-50 border-emerald-200` → `sun-*` paletine çevir (T1.5'te %99 temizlendi, 1 kaldı) |
| A2 | Yaygın `innerHTML` kullanım XSS riski | Orta | `js/render.js`, `js/page-index.js:78`, `js/activities.js:193`, `js/villa-modal.js:240`, `js/map.js:96` (50+ kullanım) | Kullanıcı kaynaklı veri içeren `innerHTML`'leri `textContent` + DOM API ile değiştir. Özellikle `page-index.js:78` `verifiedBadge.innerHTML` kullanıcı metni içerir |
| A3 | CSP `style-src 'unsafe-inline'` zorunluluğu | Orta | `vercel.json:26` | Tüm sayfalar inline style kullanıyor — kaçınılmaz. Tailwind CDN build'e geçince (T2.2) CSP sıkıştırılabilir |
| A4 | `js/supabase-config.js` repo'da anon key ile commit'li | Yüksek | `js/supabase-config.js:1-2` | `git rm --cached js/supabase-config.js`. Anon key public'tir ama repo temizliği önemli |
| A5 | Tailwind CDN 3MB unpurged (her sayfa yüklemesinde) | Orta | Tüm HTML'lerin `cdn.tailwindcss.com` script | `tailwindcss -o dist/tw.css --minify` build-time purge (T2.2) |

## B — KVKK / Hukuk

| ID | Açıklama | Şiddet | Konum | Önerilen fix |
|---|---|---|---|---|
| **B1** | **Cookie / localStorage banner YOK** | **Kritik** | Tüm sayfalar | KVKK + ePrivacy: Plausible cookieless olsa da localStorage (i18n, PWA, admin cache, IG feed cache) cookie-benzeri iz. Global banner component zorunlu |
| **B2** | `hizmet-ekle.html` formunda KVKK aydınlatma linki + onay checkbox YOK | **Kritik** | `hizmet-ekle.html` form alanı | PII toplayan form (ad, telefon, email, adres). `register.html` pattern'ini kopyala |
| **B3** | `ilan-ver.html` formunda KVKK onay checkbox YOK | **Kritik** | `ilan-ver.html` form (sadece bilgilendirme satır 307) | Zorunlu checkbox ekle |
| B4 | `register.html` pazarlama izni (marketing_opt_in) için ayrı checkbox YOK | Yüksek | `register.html:166-172` | 6563 sayılı kanun: pazarlama iletisi için AYRI açık rıza şart. DB'de alan hazır, frontend'de sorulmuyor |
| B5 | Lost & Found Edge Function public API'den telefon + isim döner | Yüksek | `supabase/functions/lost-found/index.ts:59` | `handleList` `phone` ve `contact_name` doğrudan SELECT + public response. PII auth'suz okunabilir → masking veya auth guard |
| B6 | `audit_log` tablosunda `actor_email` (PII) ve `ip` saklı | Orta | `supabase/migrations/20260513200000_initial_schema.sql:456-460` | Retention policy (90 gün purge cron) ekle |

## C — SEO

| ID | Açıklama | Şiddet | Konum | Önerilen fix |
|---|---|---|---|---|
| **C4** | **`sitemap.xml` kırık XML — `</url>` kapanmamış** | **Yüksek** (kritik etkili) | `sitemap.xml:78-79` | Satır 78'de `<url>` açılıp kapanmamış, 79'da yeni `<url>` başlamış. Google Search Console reddeder — indexleme durur. Acil fix |
| C1 | `antik-kentler.html` — TouristAttraction JSON-LD YOK | Orta | `antik-kentler.html` | 10 antik kent için ItemList + TouristAttraction (restoranlar pattern) |
| C2 | `villalar.html` — LodgingBusiness JSON-LD YOK | Orta | `villalar.html` | Villa listesi schema.org LodgingBusiness |
| C3 | `tatil-asistani.html` JSON-LD YOK | Düşük | `tatil-asistani.html` | WebApplication veya TravelAgency schema |
| C5 | sitemap'te `ilanlar.html` eksik | Düşük | `sitemap.xml` | Public sayfa, eklenmeli |
| C6 | sitemap'te `aktiviteler.html` eksik | Düşük | `sitemap.xml` | Eklenmeli |
| C7 | sitemap lastmod statik `2026-05-15` | Düşük | `sitemap.xml` | Build script ile otomatik (git log / mtime) |

## D — Performans

| ID | Açıklama | Şiddet | Konum | Önerilen fix |
|---|---|---|---|---|
| D1 | 299 Unsplash hotlink (rate-limit + CORS riski) | Orta | Tüm HTML | İndir, webp çevir, `/images/` altına (T2.3) |
| D2 | `loading="lazy"` sadece 46 img'de var | Düşük | Tüm HTML | Inline `background-image` lazy değil — CSS background-image lazy alternatif |
| D3 | IG hashtag cron Hobby 10s sınırına yakın | Orta | `api/instagram-hashtag.js:44,101` | Tek hashtag optimizasyonu yapıldı; fallback için önceki JSON koruyor (build command'de) |

## E — Erişilebilirlik

| ID | Açıklama | Şiddet | Konum | Önerilen fix |
|---|---|---|---|---|
| E1 | `aria-label` sadece 12/25 sayfada (60 occurrence). 10 sayfada SIFIR | Orta | login, register, profil, kvkk, privacy, terms, 404, data-deletion, hizmet-ekle, ilan-ver | Tüm interactive button/link'lere aria-label |
| E2 | `<label for>` sadece 4 sayfada (22 occurrence) | Orta | `hizmet-ekle.html` (8-step wizard), `profil.html` | Form input'lar `<label for="id">` ile eşle |

## F — Güvenlik

| ID | Açıklama | Şiddet | Konum | Önerilen fix |
|---|---|---|---|---|
| **F1** | **HSTS header eksik** | **Yüksek** | `vercel.json` headers | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| F2 | IG cron secret query string'den kabul (URL'de görünür) | Yüksek | `api/instagram-hashtag.js:87-88` | Sadece `Authorization: Bearer` header — query param kaldır |
| F3 | Lost & Found Edge Function auth'suz INSERT kabul | Orta | `supabase/functions/lost-found/index.ts:74-128` | Rate limit (3/h/IP) var ama auth yok. Captcha veya anonymous Supabase session |
| F4 | `supabase-config.js` git history'de (anon key, public) | Yüksek | `js/supabase-config.js:1-2` | BFG / `git filter-branch` ile history temizle; build script zaten mevcut (`scripts/build-supabase-config.mjs`) |
| F5 | Vacation planner kullanıcı `specialRequests`'i Claude API'ye düz gönderiyor — prompt injection | Orta | `supabase/functions/vacation-planner/index.ts:218,438-440` | Sanitize / truncate + system prompt isolation |

## G — i18n

| ID | Açıklama | Şiddet | Konum | Önerilen fix |
|---|---|---|---|---|
| G1 | 11 sayfada `data-en` SIFIR | Yüksek | login, register, profil, kvkk, privacy, terms, hizmet-ekle, admin, 404, data-deletion, haberler (kısmi) | Öncelik: `hizmet-ekle.html` > `login`+`register` > diğer |
| G2 | `data-en-placeholder`, `data-en-alt`, `data-en-aria` eksik formlar | Düşük | Proje geneli | Form placeholder + aria çevirileri |

---

## 🚨 Önerilen Aksiyon Sırası

1. **[Kritik] C4** — `sitemap.xml` kırık XML düzelt (Google indexleme duruyor) — **5 dk fix**
2. **[Kritik] B1** — Cookie/localStorage banner ekle (KVKK + ePrivacy zorunlu) — **2 saat**
3. **[Kritik] B2+B3** — hizmet-ekle + ilan-ver KVKK onay checkbox — **1 saat**
4. **[Yüksek] F1** — HSTS header ekle (`vercel.json` tek satır) — **5 dk fix**
5. **[Yüksek] F2** — IG cron secret query string kaldır (header-only) — **15 dk**
6. **[Yüksek] B4** — register.html pazarlama izni ayrı checkbox — **30 dk**
7. **[Yüksek] B5** — Lost&Found PII masking veya auth guard — **1 saat**
8. **[Yüksek] G1** — 11 sayfa i18n (öncelikle hizmet-ekle + login + register) — **3-4 saat (Ollama veya paralel agent)**

## ✅ Pozitif Bulgular

- **RLS kapsamlı**: 13 tablonun tamamı `ENABLE ROW LEVEL SECURITY` ile korunuyor
- **Admin auth doğru**: `app_metadata` kontrolü (user_metadata değil). Eski `sessionStorage='ok'` kaldırılmış
- **WhatsApp PII masking**: `whatsapp.js:111` telefon mask edip audit_log'a yazıyor — iyi KVKK uygulaması
- **JWT doğrulama**: `welcome-email.js`, `job-decision.js` JWT + role kontrolü yapıyor
- **Rate limiting yaygın**: vacation-planner, newsletter-subscribe, lost-found — hepsinde IP-based
- **CSP kapsamlı**: domain bazlı beyaz liste, `frame-ancestors 'none'` clickjacking koruması
- **OG + meta description unique**: 25 sayfa unique title + description + OG
- **hreflang 18 sayfada**: TR + x-default doğru uygulanmış

## ❌ Dismissed (önceki audit'lerden, tekrar açma)

- T0.1 — XSS escape() iddiası (test geçti, çalışıyor)
- T1.7 — Double hamburger menu (false positive, idempotent)
- CTO P0 #1 — XSS escape bozuk (yanlış)
- CFO TAM analizi — LOA projesi ile karıştırılmış

## Verdict

**REQUEST CHANGES** — 4 Kritik + 8 Yüksek bulgu mevcut. Cookie banner yokluğu, form KVKK onayları, kırık sitemap ve HSTS eksikliği öncelikli düzeltme gerektiriyor.

## Versiyon

| Versiyon | Tarih | Notlar |
|---|---|---|
| 1.0 | 2026-05-17 | İlk audit — 34 bulgu, AuditAgent persona ilk kapsamlı koşusu |
