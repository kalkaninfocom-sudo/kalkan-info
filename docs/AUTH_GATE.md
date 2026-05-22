# Auth Gate — Server-side (Vercel Edge Middleware)

**Dosya:** `middleware.js` (repo kökü)
**Ticket:** P1-9 / audit-backend H1 (HIGH)
**Tarih:** 2026-05-22

## Sorun

`js/auth-gate.js` yalnızca **client-side** çalışıyordu. JavaScript devre dışıyken (NoScript, eski tarayıcı) veya `curl` / scraper ile direkt istek atıldığında `admin.html`, `profil.html`, `b2b-dashboard.html` sayfalarının HTML/DOM içeriği saldırgana açıktı.

Veriler Supabase RLS ile korunduğu için **veri sızıntısı yok**, fakat **UI sızıntısı** (admin paneli yapısı, dashboard layout, form alanları) bilgi-toplama (recon) açısından risk.

## Çözüm: Defense-in-Depth

Üç katman:

| Katman | Dosya | Sorumluluk |
|---|---|---|
| 1. Veri | Supabase RLS politikaları | Gerçek yetki — DB satır seviyesi |
| 2. UI HTML | `middleware.js` (bu PR) | Cookie yoksa `/login.html` redirect, HTML hiç gönderilmez |
| 3. UX | `js/auth-gate.js` | Client-side role kontrolü + forbidden UI |

## Nasıl Çalışır

`middleware.js` Vercel Edge Runtime'da koşar. Her istekte:

1. `cookie` header'ı okunur.
2. Regex ile Supabase auth cookie aranır:
   - `sb-access-token=` (legacy client)
   - `sb-<project-ref>-auth-token=` (PKCE / `@supabase/ssr`)
3. Cookie varsa: pass-through (sayfa normal serve edilir).
4. Cookie yoksa: `Response.redirect('/login.html?next=<original-path>', 302)`.

### Korunan Path'ler (matcher)

- `/admin/:path*`, `/admin.html`
- `/profil`, `/profil.html`
- `/b2b-dashboard`, `/b2b-dashboard.html`
- 5 dil mirror'ları (`/en/...`, `/de/...`, `/ru/...`, `/fr/...`)

## Önemli Sınırlamalar

- **JWT signature DOĞRULANMIYOR.** Sadece cookie varlığı kontrol ediliyor.
  - Saldırgan rastgele bir `sb-access-token=XXX` cookie set ederek middleware'i bypass edebilir.
  - Bu **kabul edilebilir** çünkü 2. katman (Supabase RLS) gerçek yetkiyi yapıyor: geçersiz JWT ile API çağrısı reddedilir, veri dönmez.
  - Verify eklemek için `jose` paketi + project public key + Edge bundle size artışı gerekir. ROI düşük.
- **Public sayfalar etkilenmez.** Matcher sadece auth-gated path'leri içerir.
- **Static assets etkilenmez** (matcher path-spesifik).

## Test

```bash
# Local
node -c middleware.js                         # syntax
node --input-type=module -e "import('./middleware.js').then(m => console.log(typeof m.default, m.config))"

# Production (deploy sonrası)
curl -I https://kalkaninfo.com/admin.html
# Beklenen: HTTP/2 302 + location: /login.html?next=%2Fadmin.html

curl -I https://kalkaninfo.com/en/b2b-dashboard.html
# Beklenen: HTTP/2 302 + location: /login.html?next=%2Fen%2Fb2b-dashboard.html

curl -I -H "Cookie: sb-access-token=fakebutpresent" https://kalkaninfo.com/admin.html
# Beklenen: HTTP/2 200 (middleware geçer, sonra RLS reddeder API çağrılarında)
```

## Etkilenmeyen Şeyler

- `js/auth-gate.js` aynen kalıyor (client UX katmanı).
- `vercel.json` değişikliği yok — Vercel `middleware.js`'i otomatik tanır.
- Supabase login akışı değişmiyor.
