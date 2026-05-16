# Kalkan Info — Instagram Otomasyon (Yol 2: Hibrit)

**Tarih:** 2026-05-15
**Durum:** Faz 0 — kurulum aşaması
**Sahip:** Berkay Elmastaş
**Strateji seçimi:** Yol 2 (resmi hashtag API + AI-parse'lı lokal hesap takibi + admin onay)

---

## 1. Mimari — End-to-End

```
┌────────────────────────────────────────────────────────────────────┐
│ FAZ A — #kalkaninfo Hashtag Widget (resmi API)                     │
│                                                                    │
│  Instagram Graph API ──hashtag_id──► /tags/hashtag-search          │
│           │                                                        │
│           ▼                                                        │
│  api/instagram-hashtag.js  (Vercel cron, saatte 1)                 │
│           │                                                        │
│           ▼                                                        │
│  data/instagram-feed.json  (cache, 30 post max, 7gün rolling)      │
│           │                                                        │
│           ▼                                                        │
│  index.html → haberler grid ALTI → 6'lı carousel/grid              │
│           │                                                        │
│           ▼                                                        │
│  Instagram oEmbed ile embed → kullanıcı tıkladığında IG'a yönlenir │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ FAZ B — Lokal Hesap Takibi (yarı-otomatik, AI-parse)               │
│                                                                    │
│  10 lokal IG hesabı (research/instagram-accounts.json)             │
│           │                                                        │
│           ▼                                                        │
│  Source köprüsü (her hesap için farklı):                           │
│   ├─ Business/Creator → Graph API mention/tag                      │
│   ├─ Personal (public) → RSS bridge (RSSHub self-host veya         │
│   │                       Telegram channel mirror)                 │
│   └─ Belediye/Resmi → genelde web scraping mümkün (TOS açık)       │
│           │                                                        │
│           ▼                                                        │
│  api/instagram-ingest.js (Vercel cron, saatte 1)                   │
│           │ rawPost = {handle, mediaUrl, caption, timestamp}       │
│           ▼                                                        │
│  Supabase: instagram_posts (status: 'pending')                     │
│           │                                                        │
│           ▼                                                        │
│  Claude API parse (claude-haiku-4-5 — ucuz)                        │
│  tool: classify_post                                               │
│  { is_relevant, category: event|news|tourism|other,                │
│    title, summary_tr, event_date?, location?, confidence }         │
│           │                                                        │
│           ▼                                                        │
│  status: 'awaiting_admin'  (confidence > 0.7 ise)                  │
│  status: 'rejected'         (is_relevant = false)                  │
│           │                                                        │
│           ▼                                                        │
│  /admin/instagram (yeni sayfa) → Berkay 1 tık onayla/reddet        │
│           │                                                        │
│           ▼                                                        │
│  Onaylı post → data/haberler.json'a (event ise) veya               │
│                yeni data/etkinlikler.json'a INSERT                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. SENIN YAPACAKLARIN — Manuel Setup (ben yapamam)

> Bu 6 adım manuel tıklama. Tahmini süre: **2-3 saat aktif + 3-7 gün bekleme** (App Review).

### Adım 1 — Instagram hesabını Business'a çevir (5 dk)

1. Telefonda Instagram aç → `@kalkaninfo` hesabı
2. **Profil → Menü (≡) → Ayarlar ve gizlilik → Hesap türü ve araçlar**
3. **"Profesyonel hesaba geç"** → Kategori: `Travel & Tourism`
4. **"İşletme"** seç (Creator değil — Graph API erişimi için)
5. E-posta/telefon doğrulama

### Adım 2 — Facebook Page oluştur + bağla (10 dk)

> Instagram Business API **Facebook Page zorunluluğu** var — atlatamazsın.

1. https://www.facebook.com/pages/create → **"İşletme veya Marka"**
2. Sayfa adı: `Kalkan Info`
3. Kategori: `Travel Agency` (veya `Local Business`)
4. Sayfayı kaydet
5. Instagram'a dön → **Ayarlar → Hesap → Mevcut hesapları bağla → Facebook**
6. Az önce oluşturduğun Page'i seç

### Adım 3 — Meta for Developers App oluştur (15 dk)

1. https://developers.facebook.com/ → **Get Started** (giriş yap)
2. **My Apps → Create App**
3. **Use case**: `Other` → **Type**: `Business`
4. App name: `Kalkan Info Hashtag`
5. App contact email: `kalkaninfo.com@gmail.com`
6. **Business Portfolio**: yoksa "Create new" → adı `Kalkan Info`

### Adım 4 — Instagram Graph API'yi aktive et (10 dk)

1. App dashboard → **Add Product** → **Instagram Graph API → Set Up**
2. **Settings → Basic** → "App Secret" yanındaki **Show** → kopyala (sonra .env'e yazacaksın)
3. **App ID**'yi de kopyala
4. **Settings → Advanced → App Mode**: şimdilik `Development` kalsın
5. **Instagram → Basic Display → Create New App** (optional, ileride lazım)

### Adım 5 — App Review başvurusu (1 saat doldur, 3-7 gün bekle)

> Bu adım **kritik**. Olmadan production'da çalışmaz, sadece test users görür.

1. **App Review → Permissions and Features**
2. Şu izinlere "Request Advanced Access" tıkla:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
3. Her biri için **Submit for Review** doldur:
   - **How will you use this?** (Türkçe taslak — kopyala/yapıştır)
     ```
     We aggregate posts using #kalkaninfo hashtag to display
     user-generated content related to Kalkan/Kaş tourism on our
     informational website (https://www.kalkaninfo.com). Only public
     Business/Creator posts are fetched, embedded via Instagram oEmbed
     widget, with proper attribution and click-through to original post.
     ```
   - **Screencast video**: 60sn ekran kaydı — login + hashtag widget gösterimi (App Review onayı sonrası çekilir, şimdilik placeholder)
   - **Test users**: 1-2 test account ekle (kendin)
4. Submit → 3-7 gün beklenir

### Adım 6 — Long-lived Access Token al (App Review onayı sonrası, 5 dk)

1. **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
2. App seç → User token al (kısa ömürlü, 1 saat)
3. **Long-lived token endpoint**'e çevir (curl):
   ```
   curl "https://graph.facebook.com/v18.0/oauth/access_token?\
   grant_type=fb_exchange_token&\
   client_id={APP_ID}&\
   client_secret={APP_SECRET}&\
   fb_exchange_token={SHORT_TOKEN}"
   ```
4. Dönen `access_token`'ı `.env.local`'e yaz: `IG_LONG_LIVED_TOKEN`
5. **60 gün ömrü var**, otomatik yenileme için cron yazılacak (ben hallederim)

---

## 3. BENİM YAPACAKLARIM — Kod Altyapısı

> Berkay manuel adımları yaparken paralel hazırlanır. Token gelmeden test edilemez ama iskelet kurulur.

### 3.1 Backend
- [ ] `api/instagram-hashtag.js` — Graph API hashtag-search wrapper
- [ ] `api/instagram-ingest.js` — lokal hesap polling + Claude parse
- [ ] `api/instagram-admin-decision.js` — admin onay/red endpoint
- [ ] `scripts/refresh-ig-token.mjs` — 60 günlük token auto-renew cron
- [ ] Vercel `cron`: saatte 1 hashtag fetch, günde 1 token refresh check

### 3.2 Data
- [ ] `data/instagram-feed.json` — public hashtag cache (anasayfada gözükür)
- [ ] Supabase migration: `instagram_posts` tablosu (pending/approved/rejected)
- [ ] Supabase migration: `instagram_sources` tablosu (10 lokal hesap kayıtları)

### 3.3 Frontend
- [ ] `index.html` — haberler altı `<section id="instagram-feed">` 6'lı grid
- [ ] `js/instagram-feed.js` — render + IG oEmbed iframe inject
- [ ] `admin/instagram.html` — moderation paneli (pending posts liste, onay/red butonları)
- [ ] `admin/instagram.js` — admin auth + decision flow

### 3.4 Güvenlik
- [ ] CSP `script-src` + `frame-src`: `*.instagram.com`, `*.cdninstagram.com`
- [ ] CSP `img-src`: `*.cdninstagram.com`
- [ ] Token Vercel env (sunucu-side), asla client'a sızmaz
- [ ] Rate limit: Graph API saatte 200 call (cron 1/saat → güvenli)

---

## 4. Lokal Hesap Araştırması (paralel agent)

**Durum:** Agent araştırıyor, sonuç gelince `research/instagram-accounts.json`'a yazılır.

**Kriterler:**
- Kalkan / Kaş / Patara / Demre bölgesi
- En çok takipçili 10 hesap
- Account type kritik — **Personal hesaplar Graph API'den okunamaz**, bunlar için ayrı strateji (RSS bridge / web scraping / partnerlik)

---

## 5. Maliyet Tahmini

| Kalem | Maliyet | Not |
|---|---|---|
| Meta Graph API | $0 | Hashtag search ücretsiz |
| Vercel Cron | $0 | Hobby plan dahil |
| Claude API (Haiku) | ~$1-3/ay | Günlük 50 post parse @ haiku |
| Supabase | $0 | Free tier yeter |
| **Toplam** | **<$5/ay** | |

---

## 6. Test Stratejisi

**Faz A (hashtag widget):**
1. Test post: kendi hesabınla `#kalkaninfo` etiketli post at
2. 1 saat bekle (cron) veya manuel trigger
3. `data/instagram-feed.json` post'u içeriyor mu?
4. Anasayfada widget gözüküyor mu?
5. Embed iframe çalışıyor mu? (CSP doğru mu?)

**Faz B (lokal hesap takibi):**
1. Belediye hesabı son post'u manuel ingest et
2. Claude parse çıktısı doğru mu? (haber/etkinlik sınıflandırma)
3. Admin paneli pending listte görüyor mu?
4. Onay sonrası `data/haberler.json`'a düşüyor mu?

---

## 7. Roadmap

| Hafta | İş |
|---|---|
| **W1** | Berkay: Business convert + FB Page + App submit; Ben: backend iskelet + admin UI mockup |
| **W2** | App Review bekleme; Ben: data schema + Supabase migrations + frontend widget UI |
| **W3** | Token alındı → Faz A çalışır hale gelir → ilk hashtag fetch testi |
| **W4** | Faz B başlar — lokal hesap entegrasyonu (en az 3 hesap), AI parse pipeline |
| **W5** | Admin moderation paneli canlı, ilk onaylar |
| **W6** | Tüm 10 hesap entegre, production ready |

---

## 8. Bilinen Riskler

1. **Personal hesap Graph API engeli** — 10 hesabın yarısı Personal olabilir. Backup: belediye için web scraping, influencer'lar için partnerlik (mention/tag), magazine için RSS bridge.
2. **App Review red** — taslak metni reddederse revize edilir. %80 ilk seferde geçer.
3. **60 gün token expiry** — auto-renew cron kritik, atlanırsa widget durur.
4. **Telif** — sadece embed (orijinal hesabın widget'ı), parse edilen metni siteye yazarken kaynağı her zaman belirt.
5. **Spam hashtag** — `#kalkaninfo` ile alakasız post atan olursa filter gerekir (Claude relevance check).

---

## İlerleme — Berkay & Claude

**Berkay:**
- [ ] Adım 1: Business convert
- [ ] Adım 2: FB Page
- [ ] Adım 3: Meta App
- [ ] Adım 4: Graph API aktive
- [ ] Adım 5: App Review submit
- [ ] Adım 6: Long-lived token (review onayı sonrası)

**Claude (paralel):**
- [ ] research: 10 hesap listesi (running)
- [ ] backend iskelet
- [ ] data schema
- [ ] admin UI mockup
- [ ] frontend widget
