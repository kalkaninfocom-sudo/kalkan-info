# Master Backlog — 2026-05-22 (Live Status)

5 audit raporundan (AESTHETIC + ARCHITECT + CONTENT + PERFORMANCE + TRUST) birleştirilmiş öncelikli iş listesi.

## İlerleme Özeti (Wave 1+2 in-flight)

**Tamamlanan commit'ler:** 12+ (Wave 1+2 paralel)
- ✅ `df49eb5` KVKK güncel (P0-1)
- ✅ `6374cde` Newsletter validation migration (P0-2)
- ✅ `32d5ebe` Cookie banner consent event (P0-3)
- ✅ `df9f836` Sentry PII strip (P0-4)
- ✅ `a3e4345` 6 rehber 1200-1700 kelime expand (P0-7)
- ✅ `33e9154` plajlar hero plaj-tema (P1-2)
- ✅ `d0a6f31` CTA + filter + b2b nav + FAB CLS (P1-3)
- ✅ `d791918` drawer 4 sayfa (P1-4)
- ✅ `b73fe9f` bottom-nav Menü + 320px (P1-7+8)
- ✅ `e952fae` antik kent 'yakın deneyim' section (P1-6)
- ✅ `0881a6b` iyzico stub + pricing tiers (P2-2)
- ✅ `f425d08` booking_inquiries migration (P2-3)
- ✅ `21929c2` plausible-stats partner filter (P2-4)

**In-flight:**
- 🟡 STABILITY Vitest+Playwright suite (P0-5+6)
- 🟡 PERFORMANCE webp+hreflang+JSON-LD inject (P1-11..13)
- 🟡 CONTENT 14 villa placeholder (P2-1)

**Atlanan:**
- ⏭ events/pricing LCP preload — sayfalarda hero image yok (CSS gradient)
- ⏭ Rehber↔antik kent cross-link — ayrı executor gerekli, CONTENT bittikten sonra

**Format:** Her görev: ID · Açıklama · Sahip agent · Wave · Bağımlılık · Verification · Commit tahmini

---

## P0 — YASAL / GÜVENLİK / REGRESYON KORUMASI (Wave 1, çoğu in-flight)

| ID | Görev | Sahip | Wave | Verification | Commit |
|---|---|---|---|---|---|
| P0-1 | KVKK aydınlatma metni güncelle (Firebase/GA → Supabase/Plausible/Clarity/Sentry/Resend/Anthropic/Vercel) | TRUST executor | 1 | `grep -i firebase kvkk.html` = 0 | 1 |
| P0-2 | Newsletter migration: anon insert email regex + length + source whitelist | TRUST executor | 1 | `ls supabase/migrations/20260522180000*` | 1 |
| P0-3 | Cookie banner `ki-consent-changed` event dispatch | TRUST executor | 1 | `grep ki-consent-changed js/cookie-banner.js` ≥ 1 | 1 |
| P0-4 | Sentry beforeSend PII URL+breadcrumb token strip | TRUST executor | 1 | `grep REDACTED js/sentry-init.js` ≥ 2 | 1 |
| P0-5 | Vitest unit suite (data integrity + render helpers + auth-gate) | STABILITY | 1 | `pnpm test` 0 fail ≥ 15 test | 1 |
| P0-6 | Playwright e2e suite (5 smoke: index/lang/concierge/auth/audio) | STABILITY | 1 | `pnpm test:e2e` 5 pass | 1 |
| P0-7 | 6 rehber stub → 1400-1800 kelime gerçek içerik (TR) | CONTENT writer | 1 | `wc -w rehber/*.html` her biri ≥ 1400 | 6 |
| P0-MANUEL | IG_CRON_SECRET rotate (git history secret) | Berkay | 5 | Yeni secret Vercel env'de | — |

**P0 toplam:** 12 commit (otonom) + 1 manuel

---

## P1 — KRİTİK UX / SEO / PERF (Wave 1 + Wave 2 başı)

| ID | Görev | Sahip | Wave | Bağımlılık | Verification | Commit |
|---|---|---|---|---|---|---|
| P1-1 | events.html + pricing.html LCP preload | AESTHETIC | 1 | — | `grep -c 'rel="preload" as="image"' events.html pricing.html` ≥ 1 her biri | 1 |
| P1-2 | plajlar.html hero duplicate fix (plaj-tema webp) | AESTHETIC | 1 | — | Hero src değişti, preload sync | 1 |
| P1-3 | villalar CTA sun-500 standardize + aktiviteler filter active state + b2b bottom-nav.js + concierge FAB CLS | AESTHETIC | 1 | — | `grep bg-sun-600 villalar.html` = 0 | 1 |
| P1-4 | Drawer'a 4 sayfa ekle (rehber/events/transfer/pricing) | ARCHITECT exec | 2 | — | `grep -c '/rehber\|/events\|/transfer\|/pricing' js/site-drawer.js` ≥ 4 | 1 |
| P1-5 | Rehber↔antik kent body cross-link (6 makale × 2-3 link) | ARCHITECT exec | 2 | P0-7 done | `grep -c 'antik-kentler/' rehber/*.html` ≥ 12 | 1 |
| P1-6 | Antik kent detay sayfaya "İlgili tur/villa" bölümü (10 sayfa) | ARCHITECT exec | 2 | — | 10 sayfada `<section data-related>` veya benzeri | 1 |
| P1-7 | bottom-nav "Hizmetler" → "Menü" label | ARCHITECT exec | 2 | — | `grep -i Menü js/bottom-nav.js` ≥ 1 | 1 |
| P1-8 | bottom-nav 320px overflow fix (etiket hide @ ≤360px) | ARCHITECT exec | 2 | — | CSS media query eklendi | 1 |
| P1-9 | Auth-gate Vercel Edge Middleware (admin/profil JWT check) | TRUST + BACKEND | 2 | — | `middleware.js` deploy, `/admin*` GET → 302 unauth | 1 |
| P1-10 | CSP nonce migration (unsafe-inline kaldır) | TRUST + BACKEND | 2 | P1-9 | `vercel.json` CSP nonce pattern | 1 |
| P1-11 | 46 JPG → webp batch + HTML src güncelle | PERFORMANCE exec | 1 | (PERFORMANCE audit bitince) | `ls assets/img/*.jpg \| wc -l` ≤ 5 | 2 |
| P1-12 | hreflang fix (query → subdirectory tek pattern) | PERFORMANCE exec | 1 | — | `grep 'rel="alternate"' index.html` 5 dil subdir | 1 |
| P1-13 | JSON-LD inject — Restaurant + LodgingBusiness + TouristAttraction (24+ restoran, 3 villa, 10 antik kent) | PERFORMANCE exec | 1 | — | `scripts/inject-schemas.mjs` idempotent, en az 37 sayfada yeni schema | 2 |
| P1-14 | Meta description 5 dile çevir (12 anahtar sayfa) | CONTENT writer | 2 | P0-7 | `<meta name="description" data-en="...">` 12 sayfa | 1 |

**P1 toplam:** 15 commit

---

## P2 — POLISH / BÜYÜME / MONETİZASYON (Wave 2)

| ID | Görev | Sahip | Wave | Verification | Commit |
|---|---|---|---|---|---|
| P2-1 | 14 villa placeholder template (data/villalar.json 3 → 17) | CONTENT writer | 2 | `jq '. \| length' data/villalar.json` = 17 | 1 |
| P2-2 | iyzico sandbox stub (api/iyzico-checkout.js + data/pricing-tiers.json) | BACKEND exec | 2 | Stub endpoint return 501 (production hazır değil) | 1 |
| P2-3 | Booking inquiry SQL migration (push edilmez, hazır bekler) | BACKEND exec | 2 | `ls supabase/migrations/*_bookings.sql` | 1 |
| P2-4 | Partner-specific Plausible filter (provider_id custom property) | BACKEND exec | 2 | b2b-dashboard query partner_id ile | 1 |
| P2-5 | Pricing tier'a `ilan-ver.html` secondary CTA | ARCHITECT exec | 2 | 3 tier card'da iki CTA | 1 |
| P2-6 | AI conversation 3+ turn sonra booking CTA inject | ARCHITECT exec | 2 | concierge-ai-modal.js turnCount ≥3 → CTA render | 1 |
| P2-7 | Hero image opacity standardize (index/hizmetler 40→50) | AESTHETIC pol | 2 | `grep opacity-40 index.html hizmetler.html` = 0 | 1 |
| P2-8 | Breaking badge renk: pricing sun-500 → coral-500 | AESTHETIC pol | 2 | `grep bg-sun-500/95 pricing.html` 0 | 1 |
| P2-9 | b2b-dashboard header dark tema (bg-sea-900 veya border-b) | AESTHETIC pol | 2 | Header bg değişti | 1 |
| P2-10 | shadow-glow token kullanım (stat card focus state) | AESTHETIC pol | 2 | `grep shadow-glow b2b-dashboard.html` ≥ 1 | 1 |
| P2-11 | index.html inline onmouseover/onmouseout → CSS hover | AESTHETIC pol | 2 | `grep onmouseover index.html` = 0 | 1 |
| P2-12 | Card class konsolidasyon (villa-card/.stat-card/.panel/.fact-card → card-base) | AESTHETIC pol | 2 | 4 → 1 shadow tanımı | 1 |
| P2-13 | transfer.html heading weight (font-bold → font-extrabold) | AESTHETIC pol | 2 | `grep font-bold transfer.html` (heading bağlamında) 0 | 1 |
| P2-14 | pricing/b2b-dashboard 5 dil mirror sayfa | CONTENT + BACKEND | 2 | `/en/pricing.html` 200 OK | 1 |
| P2-15 | Mesafeli Satış Sözleşmesi taslağı (terms.html ek bölüm) | TRUST + CONTENT | 2 | terms.html'de yeni bölüm | 1 |
| P2-16 | Reviews rate-limit (edge function veya pg trigger) | BACKEND exec | 2 | reviews INSERT rate-limited | 1 |
| P2-17 | index.html h1→h3 heading skip (WCAG AA) | TRUST + AESTHETIC | 2 | h1→h2→h3 hiyerarşi | 1 |
| P2-18 | RU + FR çevirileri (rehber + voiceover + meta) | CONTENT writer | 2 | data-ru / data-fr 12 anahtar sayfa | 2 |

**P2 toplam:** 19 commit

---

## Berkay'a Kalan Manuel (Faz 5)

| ID | Görev | Süre |
|---|---|---|
| M-1 | IG_CRON_SECRET rotate + Vercel env güncelle | 5 dk |
| M-2 | Twilio/Resend/Supabase PAT/admin parola rotate | 30 dk |
| M-3 | `supabase db push` (newsletter validation + bookings stub) | 5 dk |
| M-4 | ELEVENLABS_API_KEY karar + Vercel env ($5/$22) | 5 dk |
| M-5 | iyzico merchant başvuru (vergi levhası + IBAN) | 1 saat + 3-7 gün |
| M-6 | 14 villa foto + kapasite + fiyat (data/villalar.json doldur) | ~2 saat |
| M-7 | Plausible Goals 11 event manuel ekle | 3 dk |
| M-8 | KVKK VERBİS başvuru + Mesafeli Satış avukat onayı | 1-3 hafta |
| M-9 | Meta WhatsApp Business onay | 1-3 gün |
| M-10 | IG bio link güncelle (utm_campaign=brand) | 1 dk |

---

## Toplam Commit Tahmini

| Faz | Otomasyon Commit | Manuel İş |
|---|---|---|
| Wave 1 (in-flight) | 12 (P0) + 6 (P1: 1-3, 11-13) = 18 | — |
| Wave 2 | 8 (P1: 4-10, 14) + 19 (P2) = 27 | 10 Berkay task |
| **TOPLAM** | **~45 commit** | 10 manuel |

---

## Sıralama (Bağımlılık DAG)

```
P0-1..4 (TRUST) ─┐
P0-5..6 (STAB)  ─┤── Wave 1 (paralel, ~3 saat)
P0-7 (CONTENT)  ─┤
P1-1..3 (AESTH) ─┤
P1-11..13 (PERF)┘ (PERFORMANCE audit bitince başlat)
                  ↓
P1-4..8 (ARCH)  ─┐
P1-9..10 (TRUST)│── Wave 2 (paralel, ~2 saat)
P1-14 (CONTENT) │
P2-1..18        ┘
                  ↓
              Faz E doğrulama
```

---

## Risk Yönetimi

| Risk | Etki | Önlem |
|---|---|---|
| AESTHETIC executor early-exit | Wave 1 kısmi | Restart edildi (acc3e545) |
| Bottom-nav.js 320px ARCHITECT ↔ AESTHETIC çakışma | Conflict | ARCHITECT'e tek elden bırak (P1-7 + P1-8) |
| Rehber dosyaları CONTENT ↔ ARCHITECT cross-link | Conflict | P1-5 P0-7 bittikten sonra başlar (DAG bağımlılık) |
| supabase db push manuel | Wave 1 sonrası bloklu | Migration sadece dosya, push Berkay |
| iyzico merchant onay 3-7 gün | P2-2 prod blok | Stub deploy, prod onay sonra |
