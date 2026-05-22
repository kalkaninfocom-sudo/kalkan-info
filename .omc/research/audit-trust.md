# TRUST Audit — 2026-05-22

**Scope:** kalkaninfo.com — Vercel MPA + Supabase + 13 tablo migration + JS client + API serverless. Read-only.

**Risk seviyesi: MEDIUM** (3 P0, 4 P1, 3 P2)

---

## 1. KVKK Consent Banner

**Status: AKTIF** — `js/cookie-banner.js` (347 satır, production-ready).
- 3 kategori: functional (zorunlu/disabled), analytics (toggle), marketing (toggle)
- `KalkanConsent.has('analytics')` global API
- 12 ay re-consent TTL (`CONSENT_TTL_MS`) — KVKK Kurulu 2024 uyumlu
- TR/EN i18n, `ki-lang-changed` event dinleniyor
- X butonu rıza VERMEZ, sadece gizler ✓

**Clarity gate:** `js/clarity-loader.js:67` `hasConsent()` → `KalkanConsent.has('analytics')` — pattern doğru. AMA satır 19'da `return;` ile **tamamen devre dışı** (SDK 0.8.64 bug). Fiili KVKK riski şu an yok.

**Gap:** `cookie-banner.js` `writeConsent()` sonrası `ki-consent-changed` custom event **dispatch etmiyor**. `clarity-loader.js:123` dinliyor ama event yok → Clarity yeniden aktif edildiğinde post-consent yükleme kırılır.

**KVKK aydınlatma metni** (`kvkk.html`): 6698 Madde 10 + Tebliğ referansı var, v1.0 30 Nis 2026. **AMA Tablo 5'te "Google Firebase / Firestore" ve "Google Analytics" hâlâ listeleniyor** — proje artık Supabase + Plausible kullanıyor. **Güncel değil.**

## 2. CSP Sertleştirme

**Konum:** `vercel.json:46`

| Direktif | Değer | Bulgu |
|---|---|---|
| `script-src` | `'self' 'unsafe-inline'` + 8 CDN | unsafe-inline XSS vektörü |
| `style-src` | `'self' 'unsafe-inline'` + 3 CDN | Tailwind CDN zorunlu |
| `connect-src` | 13 origin | `api.resend.com`, `api.anthropic.com` client-side gereksiz — sadece server-side kullanılıyor |
| `frame-ancestors` | `'none'` | ✓ clickjacking koruması |
| `base-uri` | `'self'` | ✓ |

**unsafe-inline:** Tailwind CDN runtime `<style>` inject (style-src zorunlu). Script-src için sadece `kvkk.html:97-109` inline script + SW killer — nonce ile değiştirilebilir (Vercel middleware).

## 3. Supabase RLS Gap Listesi

| Tablo | Anon Read | Anon Insert | Auth | Admin | Bulgu |
|---|---|---|---|---|---|
| `users` | ✗ | ✗ | Self | Full | OK — immutable trigger |
| `listings` | status=active | ✗ | Owner | Full | OK |
| `providers` | status=active | ✗ | Owner | Full | OK |
| `reviews` | status=approved | **EVET pending** | Own+approved | Full | **MEDIUM** — XSS body, rate-limit edge function yok |
| `partner_applications` | ✗ | EVET validated | Insert | Full | ✓ PII korunuyor, email regex+length |
| `events` | status=published | ✗ | Published | Full | OK |
| `newsletter_subscribers` | ✗ | **EVET `WITH CHECK (true)`** | ✗ | Service | **HIGH** — validation YOK, herkes random insert |
| `social_posts` | ✗ | ✗ | ✗ | Full | OK |
| `vacation_requests` | ✗ | owner_id IS NULL | Owner | Full | **MEDIUM** — anon draft sınırsız |
| `mail_queue` | ✗ | ✗ | ✗ | Admin | OK |
| `audit_log` | ✗ | ✗ | Self read | Admin | OK |
| `rate_limits` | ✗ | ✗ | ✗ | Service | OK — no policy = deny |

## 4. Auth-Gate Bypass — HIGH

**Severity:** HIGH | **Category:** A01 Broken Access Control | **Location:** `js/auth-gate.js:1-59`

Client-side JS enforcement. `admin.html` statik dosya. Saldırgan:
1. JS disable / curl
2. `admin.html` GET
3. HTML içerik DOM'da

`getUser()` JWT client-side check ✓, ama HTML önceden gönderiliyor. **Mitigation:** Supabase RLS gerçek veriyi koruyor. UI layout/endpoint sızıntısı.

**Fix:** Vercel Edge Middleware JWT check (`/admin*`, `/profil*` → 401/302).

## 5. Secret Leak Retrospective — CRITICAL

**Category:** A02 Cryptographic Failures

Git history'de:
- `IG_CRON_SECRET=kalkan-ig-cron-7f3e9a8b2c5d4e6f` — **GERÇEK DEĞER commit'lenmiş**
- `SUPABASE_ANON_KEY=eyJhbGc...` — truncated, key pattern
- `ANTHROPIC_API_KEY=sk-ant-...` — placeholder
- `RESEND_API_KEY=re_...` — placeholder

**IG_CRON_SECRET açık metin. ROTATE şart.**

`.env.example`: Firebase/GA referansları hâlâ var, güncellenmeli.

## 6. Yasal Metin Coverage

| Metin | Mevcut | 2026 Uyumlu | Bulgu |
|---|---|---|---|
| KVKK Aydınlatma | ✓ 5 dil | **Kısmen** | Firebase/GA güncel değil |
| Kullanım Şartları | ✓ 5 dil | ✓ | OK |
| Mesafeli Satış | **YOK** | — | iyzico öncesi 6502 zorunlu |
| Çerez Politikası | Banner içi | ✓ | OK |

## 7. WCAG AA (3 sayfa)

| Sayfa | Kontrast | Focus | ARIA | Heading | Semantic |
|---|---|---|---|---|---|
| index | OK | `.tile-icon` focus-visible eksik | dialog OK | **FAIL** h1→h3 (satır 292, h2 atlanıyor) | OK |
| villalar | OK | — | — | OK | OK |
| pricing | OK | — | — | OK | OK |

Cookie banner toggle focus-visible ✓ (`cookie-banner.js:166`).

## 8. Sentry Filter

**Location:** `js/sentry-init.js:18-22`

`beforeSend`: ResizeObserver loop ✓, script error ✓.

**PII riski:** URL query (`?email=xxx&token=yyy`) varsayılan yakalanıyor. Newsletter confirm/unsubscribe token'ları sızabilir. `beforeSend`'de URL strip + `beforeBreadcrumb` PII filter YOK.

---

## P0 Acil (Wave 1)

1. **[CRITICAL] IG_CRON_SECRET rotate** — Berkay manuel (git history secret)
2. **[HIGH] Newsletter validation** — `WITH CHECK (true)` → email regex + length, rate-limit pg_cron
3. **[HIGH] KVKK aydınlatma güncelle** — Firebase/GA → Supabase/Plausible/Clarity/Sentry

## P1 Sertleştirme (Wave 1)

1. **[HIGH] Auth-gate Edge Middleware** — `/admin*`, `/profil*` JWT check
2. **[HIGH] Sentry PII filter** — beforeSend URL query strip
3. **[MEDIUM] CSP nonce** — unsafe-inline → nonce (middleware)
4. **[MEDIUM] `ki-consent-changed` event** — cookie-banner.js dispatch

## P2 (Wave 2)

1. **[MEDIUM] Mesafeli Satış taslağı** — iyzico öncesi
2. **[MEDIUM] Reviews rate-limit** — edge function veya pg trigger
3. **[LOW] index h1→h3 heading skip** — WCAG semantik

---

## Security Checklist

- [x] No hardcoded secrets in client JS
- [ ] **FAIL** IG_CRON_SECRET in git history
- [x] Service role server-side only
- [x] User inputs escaped (`_esc()` HTML entity)
- [x] No raw SQL in client (Supabase SDK parameterized)
- [x] RLS enabled on 13 tables
- [ ] **FAIL** Newsletter anon_insert `WITH CHECK (true)`
- [x] Auth `getUser()` server-validated JWT
- [ ] **FAIL** Auth-gate client-only
- [x] HSTS / X-Frame-Options DENY / nosniff / Referrer-Policy
- [ ] **PARTIAL** CSP unsafe-inline script-src

---

**Critical files:**
- `js/cookie-banner.js` (347 satır, active)
- `js/clarity-loader.js:19` (disabled)
- `js/auth-gate.js:1-59` (client-only)
- `js/sentry-init.js:18-22` (PII gap)
- `vercel.json:46` (CSP)
- `kvkk.html` (Firebase/GA outdated)
- `supabase/migrations/20260515040000_newsletter.sql` (anon insert)
- `supabase/migrations/20260522120000_consolidate_reviews.sql` (no rate-limit)
- `supabase/migrations/20260513200000_initial_schema.sql` (13 tablo)
