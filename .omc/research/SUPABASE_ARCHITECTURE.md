# Kalkan Info — Supabase + Vercel Mimari Kararları

**Tarih:** 2026-05-13
**Hazırlayan:** Architect agent (opus)
**Durum:** Faz 1 (Vercel statik deploy) hazır, Faz 2 (Supabase backend migration) bu doküman referans

## Yönetici Özeti

Kalkan Info'nun Firebase'den çıkışı **3 ana eksende** çözülüyor:

1. Mevcut `js/auth.js` CDN ESM pattern'i Supabase JS v2'ye `esm.sh` üzerinden taşınır — Vite/Webpack pipeline gerekmez, statik HTML mimarisi tamamen korunur.
2. Yedi Cloud Function'dan beşi **Supabase Edge Functions** (Deno, 150s limit), biri **Vercel API Route** (whatsappWebhook — markaya bağlı sabit URL ve Meta callback için), biri **Supabase Auth Hook** (sendWelcomeEmail) gider. `vacationPlanner` 30 sn Claude çağrısı **zorunlu Edge** — Vercel Hobby 10 sn ve hatta Pro 60 sn risklidir.
3. Scheduled işler Vercel Cron'un 2 limitini atlamak için tamamen **Supabase pg_cron**'a alınır; eczane sync saf SQL UPDATE'e indirgenir, Instagram harvester saatlik tetiklenir.

**Riskler:** Vercel Hobby ticari kullanım gri alanı (Pro $20 gerekebilir), Meta webhook URL stability için custom domain önce bağlanmalı, KVKK için Supabase `eu-central-1` (Frankfurt) ve Anonymous Auth kapalı zorunlu.

**Migration süresi:** 8 faz × 20-26 saat — 2 günde tek kişi bitirir.
**Manuel adımlar:** Supabase project + Vercel domain + OAuth credentials transfer + Resend domain doğrulama.
**Maliyet:** Hiçbir kredi kartı gerekmiyor, free tier sınırları ilk yıl trafiği için 10x rahat.

---

## Karar 1 — Auth Migration

**Karar:** SDK CDN (ESM via `esm.sh`), npm bundle YOK.

Gerekçe:
- `js/auth.js:9-27` zaten `https://www.gstatic.com/firebasejs/10.12.2/...` pattern'ini kullanıyor. `https://esm.sh/@supabase/supabase-js@2` ile birebir aynı dynamic import şekli korunur.
- Berkay'ın `serve.mjs` static server'ı çalışmaya devam eder, Vite/Webpack pipeline'ı yok.
- Trade-off: Tree-shaking yok (full bundle ~70KB gzip), ama Tailwind CDN zaten ~80KB — homojen yaklaşım.

### Provider Eşleştirme

| Firebase | Supabase | Notlar |
|---|---|---|
| `GoogleAuthProvider` + `signInWithPopup` | `supabase.auth.signInWithOAuth({ provider: 'google' })` | Redirect flow (popup desteklenmez). Login sayfası redirect URL'i `https://kalkaninfo.com/profil.html` set edilmeli |
| `FacebookAuthProvider` | `supabase.auth.signInWithOAuth({ provider: 'facebook' })` | Aynı redirect davranışı |
| `createUserWithEmailAndPassword` | `supabase.auth.signUp({ email, password })` | Mail confirm zorunlu (KVKK email_verified eşdeğeri) |
| `signInWithEmailAndPassword` | `supabase.auth.signInWithPassword` | 1:1 |
| `onAuthStateChanged` | `supabase.auth.onAuthStateChange` | Aynı callback signature |
| `sendPasswordResetEmail` | `supabase.auth.resetPasswordForEmail` | Email template Supabase Dashboard'dan |
| `auth.currentUser` | `(await supabase.auth.getUser()).data.user` | Async fark — `js/auth.js:165` güncellenmeli |
| Custom claim `admin: true` | Postgres `app_metadata.role = 'admin'` veya `user_roles` tablosu + RLS function | Service Role key ile SQL update |

### Authorized Domains

Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:

```
https://kalkaninfo.com/**
https://www.kalkaninfo.com/**
http://localhost:3010/**
https://*.vercel.app/**
```

### Session Management

Firebase `IdToken` localStorage'da, otomatik refresh. Supabase aynı şekilde `localStorage` (default `supabase.auth.token`) + auto-refresh — Berkay tarafında değişiklik yok. **Önemli:** Supabase JWT'sini RLS için her request'te taşıyor, bu yüzden Vercel API Route'larda token forward zorunlu.

### KVKK Uyum

Supabase'de **anonim erişim project setting** ile kapatılır (Auth → Providers → Anonymous = OFF). `js/auth.js:124-150` register fonksiyonundaki `kvkkConsent` field'ı `profiles` tablosuna (Postgres, `auth.users` mutate edilemez) yazılır.

---

## Karar 2 — Functions × Platform Tablosu

| Fonksiyon | Mevcut Trigger | Yeni Platform | Süre | Neden |
|---|---|---|---|---|
| `vacationPlanner` | Callable, 540s | **Supabase Edge Function** | ~30s gerçek | Vercel Hobby 10s sınırı. Edge wall-clock 150s, CPU 2dk free tier'da yeter. |
| `whatsappWebhook` | HTTPS onRequest | **Vercel API Route** `/api/whatsapp` | <5s | Sabit, paylaşılabilir URL gerekli (Meta webhook). `https://kalkaninfo.com/api/whatsapp` kalıcı domain verir. |
| `verifyNewsItem` | Pub/Sub `verify-news`, 120s | **Supabase Edge Function** (queue tetikli) | ~10s | Claude tool_use call — Edge'in 150s payı rahat. |
| `publishToSocial` | Pub/Sub `publish-news`, 120s | **Supabase Edge Function** (admin onay sonrası HTTP invoke) | ~10s | Mock şu an; Buffer/Publer entegre olunca da Edge Deno fetch yeter. |
| `instagramHarvester` | Scheduled `every 60 min`, 540s | **Supabase pg_cron + Edge Function** | ~60-180s | Vercel Cron Hobby max 2/proje + günde 1 çalıştırma (saatlik değil). pg_cron her saat çağrı. |
| `scheduledNobetciEczaneSync` | Scheduled `0 6 * * *`, 60s | **Supabase pg_cron + SQL only** | <2s | Sadece bir doc'taki alanı bir başkasına kopyalıyor — saf Postgres UPDATE. |
| `sendWelcomeEmail` | Firestore `onCreate users/{uid}` | **Supabase Auth Hook** → Edge Function | <3s | 5 dil template Edge Function içinde, **Resend** SMTP. |

**Webhook receiver (whatsappWebhook): Vercel API Route** çünkü:
1. Sabit URL: `https://kalkaninfo.com/api/whatsapp` (custom domain Vercel'de ücretsiz).
2. Meta webhook GET handshake — Vercel Node runtime cold start ~300ms, kabul edilir.
3. Edge Functions URL'i `https://<project>.supabase.co/functions/v1/...` — markaya değil Supabase domain'ine bağlı.
4. POST verification (X-Hub-Signature-256) Vercel'de Node `crypto` ile native.

---

## Karar 3 — Storage Migration

**Supabase Storage Buckets (5 adet):**

| Bucket | Public/Private | RLS Policy (özet) | Eski Firebase Path |
|---|---|---|---|
| `avatars` | Public read | INSERT/UPDATE/DELETE: `auth.uid()::text = (storage.foldername(name))[1]` + image MIME + max 2MB | `users/{uid}/avatar.*` |
| `user-exports` | Private | SELECT: aynı owner check; INSERT only service_role | `users/{uid}/exports/**` |
| `profiles` | Public read | INSERT/UPDATE: ownership check via `profiles` tablosuna join + email_verified + image + max 5MB; folder whitelist (`gallery\|menu\|documents`) | `profiles/{profileId}/{folder}/` |
| `reviews` | Public read | INSERT: email_verified + image + max 3MB | `reviews/{reviewId}/` |
| `news` | Public read | INSERT/UPDATE/DELETE: admin role only, image + max 8MB | `news/{newsId}/` |

### RLS Policy Örneği (avatars)

```sql
create policy "avatar_owner_write" on storage.objects
for insert with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (metadata->>'mimetype') like 'image/%'
  and (metadata->>'size')::bigint < 2 * 1024 * 1024
);
```

### Path Convention

Firebase `users/{uid}/avatar.jpg` → Supabase `avatars/{uid}/avatar.jpg` (bucket adıyla başlamaz, bucket parametre olarak verilir). Client kodda `js/reviews.js:27-31` `storageRef(s, 'reviews/...')` → `supabase.storage.from('reviews').upload(...)`.

**Free tier:** Supabase 1GB toplam, 5GB egress/ay. Kalkan Info ilk yıl: ~500 villa fotoğrafı × 300KB = 150MB → güvenli.

---

## Karar 4 — Vercel Hosting + Build Pipeline

**Build step gerekli mi? HAYIR.** Tailwind CDN script, tüm HTML pure static — `vercel.json` ile direkt serve.

### `vercel.json` (öneri)

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*\\.html)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, must-revalidate" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(self), camera=(), microphone=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh https://www.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;" }
      ]
    },
    {
      "source": "/(.*\\.(js|css))",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    }
  ],
  "rewrites": [
    { "source": "/api/whatsapp", "destination": "/api/whatsapp" }
  ]
}
```

### Otomatik Deploy

GitHub repo bağlanır → `main` push otomatik production, branch push otomatik preview.

### Environment Variables

| Variable | Public (browser) | Server only | Kullanım |
|---|---|---|---|
| `SUPABASE_URL` | ✓ | | Client init (browser config endpoint veya inline) |
| `SUPABASE_ANON_KEY` | ✓ | | Client init |
| `SUPABASE_SERVICE_ROLE_KEY` | | ✓ | Vercel API routes (admin işlemler), Edge Functions secret |
| `ANTHROPIC_API_KEY` | | ✓ | Edge Functions only |
| `META_VERIFY_TOKEN` | | ✓ | `/api/whatsapp` verification |
| `META_APP_SECRET` | | ✓ | Webhook signature verification |
| `WHATSAPP_ALLOWLIST` | | ✓ | Comma-separated phone list |
| `IG_ACCESS_TOKEN` | | ✓ | Edge `instagramHarvester` |
| `RESEND_API_KEY` | | ✓ | Welcome email Edge |
| `BUFFER_API_KEY` / `PUBLER_API_KEY` | | ✓ | publishToSocial (mock'tan sonra) |

**Public env injection:** Üç yol:
1. Build-time replacement (Vercel build step yok diyoruz) — uymaz.
2. **`/api/config` route — Vercel API route public env'leri JSON döner, `js/auth.js` `fetch('/api/config')` ile alır. Öneri.**
3. Veya Supabase anon key zaten public — `index.html` `<script>` tag'ine hardcode (en basit, anon key kamuya açık olabilir, RLS koruması yeterlidir).

---

## Karar 5 — Local Dev Workflow

**Karar:** `node serve.mjs` (port 3010) + `vercel dev` opsiyonel, Supabase local Docker İSTEĞE BAĞLI.

Gerekçe:
- Berkay tek kişi, Docker yükü gereksiz. Supabase'in **free tier'da 2 organization × ayrı project** opsiyonu var → `kalkan-dev` ve `kalkan-prod` ayrı projeler, ayrı URL/key.
- `vercel dev` Node API routes ve cron'u local'de çalıştırır — webhook test için yeterli.
- Supabase CLI sadece **migration deploy** için kurulur (`supabase db push`), `supabase start` (Docker) zorunlu değil.

### Local Stack

```
Terminal 1: node serve.mjs                  # port 3010 static
Terminal 2: vercel dev --listen 3011        # API routes
Terminal 3: supabase functions serve        # edge fn local (Deno, Docker'sız)
```

**Webhook test:** `ngrok http 3011` ile `whatsappWebhook` Meta'ya geçici URL.

---

## Migration Sırası (8 Faz)

| # | Faz | Bağımlılık | Süre | Risk |
|---|---|---|---|---|
| 1 | Supabase proje kurulumu (dev + prod), schema migration | Yok | 2-3 saat | DDL hata riski yüksek — review zorunlu |
| 2 | RLS policies (Firestore rules'tan port) | Faz 1 | 2 saat | Field-immutability translation kritik |
| 3 | `js/auth.js` Supabase ile değiştir; login/register/profil HTML test | Faz 1, 2 | 3 saat | Popup → redirect değişikliği UX etkiler |
| 4 | Firestore client kodları (`reviews/jobs/profile/vacation-planner/onboarding`) → Supabase query | Faz 3 | 4-6 saat | Real-time pattern'leri (varsa) farklı |
| 5 | Storage buckets + RLS policies + path migration | Faz 2 | 2 saat | Görseller yok henüz, bakir başlangıç avantajı |
| 6 | Edge Functions deploy (vacationPlanner, verifyNewsItem, publishToSocial, instagramHarvester, sendWelcomeEmail) | Faz 1 | 4-6 saat | `claude.js` lib'i Deno'ya port — Anthropic SDK Deno destekli |
| 7 | Vercel deploy (`vercel.json` + `/api/whatsapp` + `/api/config`) | Faz 3 | 2 saat | CSP headers ilk denemede tıkayabilir |
| 8 | pg_cron schedule, Auth Hook (sendWelcomeEmail) | Faz 6 | 1 saat | Cron'un gerçekten tetiklendiğini Supabase logs'tan doğrula |

**Toplam: 20-26 saat — 2 günde tek kişi bitirir.**

---

## Risk Listesi

1. **Vacation Planner timeout:** Claude `claude-sonnet-4-6` çağrısı 25-40 sn. **Edge Function tek seçenek.** Trade-off: Edge cold start 300-800ms ek gecikme.

2. **Free tier sınırları:**
   - Supabase: 500MB Postgres, 1GB Storage, 5GB egress, 50k MAU, 500k Edge Function invocation/ay
   - Vercel Hobby: 100GB bandwidth, 100k function invocation, 6000 build dakikası
   - Vercel Cron Hobby: max 2 cron/proje. **Çözüm: Cron'ları Supabase pg_cron'a taşıdık.**

3. **Webhook URL stability:** Vercel domain `kalkaninfo.com`'a CNAME — Meta webhook URL'i sabit kalır. **Aksiyon: Berkay önce domain bağlamalı.**

4. **KVKK & europe-west:** Supabase project bölgesi **`eu-central-1` (Frankfurt) zorunlu**. Vercel default global edge.

5. **Pub/Sub eşleniği yok:** `whatsappWebhook` → `verifyNewsItem` chain için **webhook handler kendi içinde `supabase.functions.invoke()` çağırır**, fire-and-forget.

6. **Storage immutability:** `supabase.storage.from(...).upload(path, file, { upsert: true })` çevrimi unutulursa duplicate dosya.

7. **Auth provider config:** Google/Facebook OAuth client ID'leri Firebase Console'dan **Supabase Dashboard → Auth → Providers**'a yeniden girilir. Redirect URI Google Console'da da güncellenmeli (`https://<project>.supabase.co/auth/v1/callback`).

8. **Soğuk başlangıç:** Edge Functions (Deno) ~50-200ms, Vercel Functions (Node) ~300-800ms.

---

## Berkay'ın Manuel Adımları

### Supabase Console
1. Yeni org → `kalkan-info` (kart yok, free tier)
2. New project → `kalkan-prod`, region **`eu-central-1` (Frankfurt)**, strong password
3. (Opsiyonel) İkinci project `kalkan-dev` aynı region
4. Authentication → Providers → Google (Client ID, Secret), Facebook (App ID, Secret)
5. Authentication → URL Configuration → Site URL: `https://kalkaninfo.com`
6. Authentication → Providers → **Anonymous: OFF** (KVKK)
7. Authentication → Email Templates → 5 dil welcome email template (TR/EN/RU/JA/AR)
8. Settings → API → URL, anon key, service_role key kopyala
9. Storage → 5 bucket oluştur (avatars, user-exports, profiles, reviews, news)

### Vercel Dashboard
1. GitHub repo'yu import (`kalkan-info` repo)
2. Framework Preset: **Other** (build command boş, output dir kök)
3. Environment Variables ekle (yukarıdaki tablo)
4. Settings → Domains → `kalkaninfo.com` ekle, DNS CNAME `cname.vercel-dns.com`
5. İlk deploy otomatik tetiklenir

### Meta Business (whatsappWebhook için)
1. WhatsApp Business API uygulaması → Webhook configuration
2. Callback URL: `https://kalkaninfo.com/api/whatsapp`
3. Verify token: env'deki `META_VERIFY_TOKEN` ile aynı string
4. Subscribe: `messages` field

### Google Cloud Console (OAuth için)
1. Firebase project OAuth client'ını Supabase'in callback URL'iyle güncelle: `https://<supabase-project>.supabase.co/auth/v1/callback`

### Facebook Developers (OAuth için)
1. Facebook app OAuth redirect URI'sini Supabase callback'i olarak ekle

### Anthropic Console
1. Aynı `ANTHROPIC_API_KEY` re-use (Firebase Secret Manager'dan kopyalanır)

### Resend (yeni — welcome email için)
1. https://resend.com → Sign up (free, 3000 mail/ay, 100/gün)
2. Domain doğrula (`kalkaninfo.com`) → DNS SPF + DKIM ekle
3. API key oluştur → `RESEND_API_KEY` env'e

---

## Environment Variables — Tam Liste

```bash
# Public (browser-side via /api/config endpoint)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# Server-side only (Vercel + Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   # ASLA client'a sızdırma
ANTHROPIC_API_KEY=sk-ant-...
META_VERIFY_TOKEN=<random-32-char>
META_APP_SECRET=<from-meta-console>
WHATSAPP_ALLOWLIST=+905xxxxxxxxx,+905yyyyyyyyy
IG_ACCESS_TOKEN=<long-lived-token>
RESEND_API_KEY=re_xxx
BUFFER_API_KEY=<optional>
PUBLER_API_KEY=<optional>
```

---

## Trade-offs

| Karar | Avantaj | Dezavantaj |
|---|---|---|
| SDK CDN (esm.sh) vs npm bundle | Build step yok, mevcut pattern korunur | Tree-shaking yok, full SDK 70KB |
| Supabase Edge (Deno) vs Vercel API (Node) | Edge 150s vs Vercel Hobby 10s — `vacationPlanner` zorunlu Edge | Deno ecosystem daha az olgun, debugging zor |
| pg_cron vs Vercel Cron | Saniye-seviyesi cron, sınırsız job, Postgres native | `pg_net` extension gerek; Vercel UI'da görünmez |
| Vercel Hobby vs Pro | $0 vs $20/ay | Hobby commercial use serbestiyeti gri — ticari işletme listesi alıyorsa Pro'ya geçmek gerekebilir |
| Auth popup vs redirect | Redirect zorunlu | Mobil tarayıcılarda popup zaten çalışmaz, redirect daha güvenli |
| Single Supabase project vs dev/prod ayrı | Tek proje basitlik | Dev'de schema bozulunca prod etkilenir → **ayrı proje öneririm** |

---

## References

- `js/auth.js:9-27` — Firebase ESM CDN import pattern (Supabase'e 1:1 port)
- `js/auth.js:124-150` — KVKK consent kayıt akışı
- `js/auth.js:165-184` — `requireAuth` ve `onAuthStateChanged` — async fark var
- `js/vacation-planner.js:14-26` — Cloud Functions + Firestore + Auth multi-import pattern
- `js/reviews.js:11-31` — Firestore query + Storage upload pattern
- `functions/vacationPlanner.js:289-296` — 540s timeout (Edge Function zorunlu kanıt)
- `functions/whatsappWebhook.js:61-67` — HTTPS onRequest (Vercel API Route adayı)
- `functions/verifyNewsItem.js:91-97` — Pub/Sub trigger (Supabase pgmq veya direct invoke)
- `functions/instagramHarvester.js:52-60` — every 60 min schedule (pg_cron adayı)
- `functions/scheduledNobetciEczaneSync.js:41-47` — günlük cron (saf SQL'e indirgenebilir)
- `functions/src/sendWelcomeEmail.js:239-243` — Firestore onCreate (Supabase Auth Hook adayı)
- `functions/lib/claude.js:24-29` — Anthropic SDK init (Deno'ya port)
- `firestore.rules:7-249` — RLS pattern kaynak
- `storage.rules:48-103` — Storage bucket pattern kaynak
- `firebase.json:24-65` — Hosting headers + rewrites (vercel.json'a port)
- `functions/package.json:17-19` — Node 20, firebase-admin, anthropic SDK bağımlılıkları
