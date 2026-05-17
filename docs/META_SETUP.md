# Kalkan Info — Meta / Instagram Otomasyon Kurulumu

> **Hedef:** `#kalkan.info` etiketli Instagram postlarını sitede otomatik göster.
> **Backend:** `api/instagram-hashtag.js` + Vercel cron (saatte 1)
> **Frontend:** `js/instagram-feed.js` + `index.html#instagram-tagged`
> **Veri kaynağı:** `data/instagram-feed.json` (cron tarafından yenilenir)

---

## 1. Meta App durumu (2026-05-17)

| Alan | Değer |
|---|---|
| **App ID** | `2258853858192830` |
| **App Secret** | ⚠️ Chat'te göründü — **Reset zorunlu** |
| **App icon** | ✅ `https://kalkaninfo.com/icons/icon-1024.png` |
| **Privacy policy** | ✅ `https://www.kalkaninfo.com/privacy` |
| **Terms of Service** | ✅ `https://www.kalkaninfo.com/terms` |
| **User data deletion** | ✅ `https://www.kalkaninfo.com/data-deletion` |
| **Category** | Business and pages (✅ seçili) |
| **App Page** | ⏳ Facebook Page oluştur + bağla |
| **Domain manager** | ⏳ `kalkaninfo.com` + `www.kalkaninfo.com` ekle |

---

## 2. Sıralı kurulum (Berkay)

### 2.1 Acil — App Secret Reset
1. Dashboard → **App settings → Temel**
2. **App secret** → **Reset**
3. Yeni secret'ı kopyala → **doğrudan Vercel env var'a yapıştır** (aşağıdaki adım 2.5)

### 2.2 Facebook Page oluştur (yoksa)
1. https://facebook.com/pages/create → **"İşletme veya Marka"**
2. Sayfa adı: `Kalkan Info`
3. Kategori: `Travel Agency`
4. Instagram'da: Ayarlar → Hesap → Mevcut hesapları bağla → bu Page'i seç
5. Meta Dashboard → App settings → Temel → **App Page** dropdown → bu Page'i seç

### 2.3 Domain manager
Dashboard → App settings → Gelişmiş → **Domain manager** → **"Add a domain"**:
- `kalkaninfo.com`
- `www.kalkaninfo.com`

### 2.4 Use case izinleri
Dashboard → Pano → **Add use cases** → seç:
- **Manage messaging & content on Instagram** (tıkla → Customize)
  - `Instagram Public Content Access` → **+ Add** ⭐ (hashtag için kritik)
  - `Business Asset User Profile Access` → **+ Add**
  - `instagram_basic` → Add
  - `pages_show_list` → Add
  - `pages_read_engagement` → Add

### 2.5 Token üret
1. **Tools → Graph API Explorer**
2. **Meta App** dropdown → `Kalkan info`
3. **Permissions** sekmesinde 5 izni ekle (yukarıdaki listeden)
4. **User or Page** → **Get User Access Token** → @kalkan.info bağlı FB hesabı
5. **Generate Access Token** → kopyala (short-lived, 1 saat)
6. Long-lived'e çevir — URL'i yapıştır + Submit:
   ```
   oauth/access_token?grant_type=fb_exchange_token&client_id=2258853858192830&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN
   ```
   Dönen `access_token` → **IG_LONG_LIVED_TOKEN** (60 gün)
7. Business ID öğren — URL: `me/accounts?fields=instagram_business_account{id,name,username}`
   Dönen `instagram_business_account.id` → **IG_BUSINESS_ID**

### 2.6 Vercel env vars ekle
Vercel Dashboard → kalkan-info → **Settings → Environment Variables** → her birini Production + Preview + Development olarak ekle:

| Name | Value |
|---|---|
| `META_APP_ID` | `2258853858192830` |
| `META_APP_SECRET` | (Reset edilen yeni secret) |
| `IG_BUSINESS_ID` | (Adım 2.5 çıktısı) |
| `IG_LONG_LIVED_TOKEN` | (Adım 2.5 çıktısı) |
| `IG_HASHTAG` | `kalkan.info` |
| `IG_CRON_SECRET` | `kalkan-ig-cron-7f3e9a8b2c5d4e6f` |

Save → **Deployments → en son → "Redeploy"** (env vars sadece yeni deploy'da yüklenir)

### 2.7 App Review (production için zorunlu — şart değil dev modda)
Dashboard → Review → **Uygulama İncelemesi** → "Submit for Review"
Her izin için use-case açıklaması + 2 dakikalık screencast yükle.

**Bekleme:** 3-7 iş günü.

Onay sonrası **yayına al** (Pano üst kısmı → Live).

---

## 3. Supabase Facebook OAuth (opsiyonel — site'ye FB ile giriş)

1. Supabase Dashboard → Authentication → Providers → **Facebook**
2. Enable → **App ID** ve **App Secret** yapıştır
3. **Redirect URL**'i kopyala — Meta Dashboard'a yapıştır:
   - Meta App → Facebook Login for Business → Configurations → Valid OAuth Redirect URIs
   - Supabase'in verdiği URL'i ekle (`https://dgichfealzdpfhdgryym.supabase.co/auth/v1/callback`)
4. Supabase'de Save

---

## 4. Doğrulama (token Vercel'de aktif olduktan sonra)

```bash
# Endpoint canlı mı?
curl https://www.kalkaninfo.com/api/instagram-hashtag?secret=kalkan-ig-cron-7f3e9a8b2c5d4e6f

# Beklenen: JSON { hashtag, count, posts: [...] }
# Cron her saat başı (Vercel) bunu çağırır, data/instagram-feed.json yazılır
```

Site açılınca index.html'deki "@kalkan.info'da Etiketlenenler" bölümü gerçek IG postlarıyla dolar. "Yakında" rozeti otomatik kaybolur.

---

## 5. Token yenileme (50 gün sonra)

Long-lived token 60 gün geçerli. 50 gün civarında bana hatırlat, refresh endpoint çağıracağım:

```
GET https://graph.facebook.com/v21.0/refresh_access_token?grant_type=ig_refresh_token&access_token=ESKİ_TOKEN
```

İleride `api/refresh-ig-token.js` Vercel cron ile otomatik yenileme (haftalık) eklenebilir.

---

## 6. Faz B — Lokal hesap takibi (sonraki sprint)

Faz A (#kalkan.info hashtag) live olduktan sonra:
- 10 lokal Kalkan IG hesabını takip et (kalkan.bld, kalkan.kaymakamlik, vb.)
- Her post'u Claude Haiku ile sınıflandır (event/news/tourism)
- Admin panelinden onay/red
- Onaylananları `data/haberler.json` veya `data/etkinlikler.json`'a yazıver

Bu mimari `docs/INSTAGRAM_AUTOMATION.md`'de detaylı.

---

**Son güncelleme:** 2026-05-17
**Sahip:** Berkay Elmastaş
**Otomasyon sahibi:** Claude (kalkan-info repo)
