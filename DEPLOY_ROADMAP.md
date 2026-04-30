# Kalkan Info — Canlıya Çıkış Yol Haritası

**Son güncelleme:** 2026-04-30
**Sahip:** Berkay Elmastaş — info@kalkaninfo.com
**Repo:** `C:\Users\socie\kalkan-info` (git, branch: main)

> Bu doküman yeni oturumda Claude'un projeyi tam bağlamla devralabilmesi için yazılmıştır. ROADMAP.md genel ürün vizyonunu kapsar; bu dosya **deploy odaklı operasyonel rehberdir**.

---

## 1. Şu An Ne Yapıldı (TAMAM)

### Geliştirme (5 commit)
1. `1ac0212` — initial v1 platform (auth, i18n, onboarding, vacation planner, automation, real images)
2. `83a5e68` — tutarlı GİRİŞ YAP pill, telefon güncellemesi, sitemap + sw cache, SETUP.md
3. `3f514c9` — 17 antik kent + Likya Yolu + hizmet sağlayıcılar modal + carousel + tur görselleri
4. `fc2d2cd` — hizmet kartları tıklanabilir + 7 antik kent görseli kırık fix
5. (sıradaki) — A-J pre-deploy hardening (bu dokümana paralel)

### Kapsam
- **18 HTML sayfa:** index, plajlar, villalar, restoranlar, turlar, hizmetler, haberler, antik-kentler, aktiviteler, tatil-asistani, hizmet-ekle, login, register, profil, kvkk, privacy, terms, admin
- **40+ JS modül:** auth, i18n, lang-switcher, weather, map, directions, reviews, onboarding, providers-modal, vacation-planner, activities, auth-pill, render, pwa, profile, slug
- **15 JSON veri:** plajlar, villalar, turlar, restoranlar, hizmetler, hizmet-saglayicilari, haberler, antik-kentler, aktiviteler, likya-yolu, config + 5 lang dosyası
- **Firebase iskeleti:** firestore.rules, storage.rules, firestore.indexes.json, firebase.json
- **Cloud Functions:** vacationPlanner, whatsappWebhook, verifyNewsItem, publishToSocial, sendWelcomeEmail (+ lib/claude, lib/social)
- **PWA:** manifest, sw v1.0.9, icons
- **SEO:** sitemap.xml (17 URL), robots.txt, structured data
- **Yardımcı belgeler:** ROADMAP.md, SETUP.md, ARCHITECTURE.md, REVIEWS_INTEGRATION.md, ONBOARDING_FLOW.md, VACATION_PLANNER.md, AUTOMATION_PIPELINE.md

---

## 2. Berkay'in Yapacağı 9 Adım (ZORUNLU — yaklaşık 2 saat)

### Adım 1: Domain (5 dk, $10-15/yıl)
- IsimTescil/Namecheap'tan `kalkaninfo.com` al (zaten var olabilir, kontrol et)

### Adım 2: Firebase Projesi (10 dk)
1. https://console.firebase.google.com → "Add project"
2. İsim: `kalkan-info-prod`
3. **Google Analytics:** Aktif (sonra GA4 kullanırız)
4. **Region:** `europe-west3` (Frankfurt — KVKK için zorunlu) ⚠️ bir kez set ediliyor
5. **Plan:** Modify → **Blaze (pay-as-you-go)** — Cloud Functions için zorunlu
6. **Bütçe alarmı:** GCP Console → Billing → Budgets → $25 e-posta uyarı + $50 sert limit

### Adım 3: Authentication Aktivasyonu (15 dk)
Firebase Console → Authentication → Sign-in method:
- **Google** — Enable, support email seç
- **Email/Password** — Enable
- **Facebook** — Enable, App ID + Secret gir (bir sonraki adımda alacaksın)
- **Anonim** — KAPALI BIRAK (KVKK izlenebilirlik)

**Authorized domains:** `kalkaninfo.com`, `www.kalkaninfo.com`, `kalkan-info-prod.web.app`, `localhost`

### Adım 4: Facebook Developer App (15 dk)
1. https://developers.facebook.com → My Apps → Create App
2. Type: **Consumer**
3. Add Product → **Facebook Login**
4. Settings → Basic → App ID + App Secret kopyala
5. Firebase Console → Auth → Facebook → Yapıştır
6. OAuth redirect URI: `https://kalkan-info-prod.firebaseapp.com/__/auth/handler` (Facebook app ayarlarına ekle)

### Adım 5: Firebase Web Config → js/auth.js (5 dk)
1. Firebase Console → ⚙️ Project Settings → "Your apps" → **Add web app**
2. Nickname: `Kalkan Info Web`, "Also set up Firebase Hosting" işaretle
3. Çıkan config bloğunu (apiKey, authDomain, projectId, vb.) kopyala
4. `js/auth.js:32-39` arasındaki yorum satırlarını kaldır + değerleri yaz
5. Aynı config'i `js/vacation-planner.js`'e de gerekirse uygula (ama orada Functions Admin SDK kullanılıyor — gerekli değil)

### Adım 6: Firestore + Storage Aktivasyon (5 dk)
- **Firestore:** Create database → Production mode → `europe-west3`
- **Storage:** Get started → Production rules → `europe-west3`
- Rules zaten repo'da yazılı, deploy adımında push edilecek

### Adım 7: Secrets (Cloud Secret Manager) (10 dk)
```bash
# Lokal terminalden:
firebase login
firebase use kalkan-info-prod
cd C:\Users\socie\kalkan-info
firebase functions:secrets:set ANTHROPIC_API_KEY
# Anthropic Console → API Keys → Create Key → kopyala/yapıştır
firebase functions:secrets:set META_VERIFY_TOKEN
# Kendi belirleyeceğin random string (örn. kalkan_wh_42_xy7q)
```

### Adım 8: Trigger Email Extension (10 dk)
1. Firebase Console → Extensions → "Trigger Email" → Install
2. SendGrid hesabı aç (https://sendgrid.com — 100 mail/gün ücretsiz)
3. SendGrid API Key oluştur (Mail Send permission)
4. Extension config:
   - `MAIL_COLLECTION` = `mail`
   - `SMTP_CONNECTION_URI` = `smtps://apikey:<SENDGRID_API_KEY>@smtp.sendgrid.net:465`
   - `DEFAULT_FROM` = `Kalkan Info <noreply@kalkaninfo.com>`

### Adım 9: DNS — Custom Domain (5 dk + 2-24 saat bekleme)
1. Firebase Console → Hosting → Add custom domain → `kalkaninfo.com`
2. Verilen `A` ve `TXT` kayıtlarını domain sağlayıcının DNS panelinden ekle
3. SSL otomatik kurulur (24 saat içinde)

---

## 3. Deploy Komutları (yukarıdaki 9 adım bittikten sonra)

### İlk Deploy
```bash
cd C:\Users\socie\kalkan-info
cd functions && npm install && cd ..
firebase init hosting          # interactive: existing project = kalkan-info-prod, public dir = ., NO single-page rewrites
firebase deploy                # tüm: hosting + functions + rules + storage
```

Çıktıda göreceğin URL'ler:
- `https://kalkan-info-prod.web.app` (geçici, hemen aktif)
- `https://kalkaninfo.com` (DNS yayıldıktan sonra)

### Sonraki Deploy'lar (parça parça)
```bash
firebase deploy --only hosting                     # Sadece HTML/CSS/JS
firebase deploy --only functions:vacationPlanner   # Tek fonksiyon
firebase deploy --only firestore:rules             # Sadece kurallar
```

### İlk Admin Yetkilendirme (deploy sonrası tek seferlik)
```bash
# 1. Berkay önce register.html'den Google ile kayıt olur
# 2. Firebase Console → Authentication → kullanıcılar → UID kopyala
# 3. Cloud Shell veya local Node.js'te:
node -e "
const admin = require('firebase-admin');
admin.initializeApp({credential: admin.credential.applicationDefault(), projectId: 'kalkan-info-prod'});
admin.auth().setCustomUserClaims('UID_BURAYA', { admin: true }).then(() => console.log('OK'));
"
# 4. Berkay logout/login → admin.html erişimi açılır
```

---

## 4. P0 Sonrası Yapılacaklar (Faz 2)

| Öncelik | İş | Tahmini |
|---|---|---|
| 🟠 | WhatsApp Business API onayı (Meta) | 1-2 hafta süreç |
| 🟠 | Twilio Sandbox ile WhatsApp test (geçici) | 1 saat |
| 🟠 | Buffer/Publer hesabı + sosyal medya bağla | 30 dk + $12/ay |
| 🟠 | Google Analytics 4 + Search Console + sitemap submit | 30 dk |
| 🟠 | Skyscanner Partner / Amadeus Self-Service onayı (tatil asistanı uçak) | 1-2 hafta |
| 🟡 | KVKK aydınlatma metni hukuki gözden geçirme (avukat) | 1 hafta |
| 🟡 | VERBİS kaydı (KVKK Kurumu) | 1 hafta |
| 🟡 | Lighthouse 95+ optimizasyonu | 1-2 gün |
| 🟡 | Sentry error tracking entegrasyonu | 2 saat |
| 🟢 | Vite + Tailwind v4 migrasyonu (production CSS) | 3-4 saat |

---

## 5. Aylık Maliyet Tahmini

| Hizmet | Tahmin |
|---|---|
| Firebase Hosting + Auth + Firestore + Storage | $0-5 (free tier yeterli ilk 10K kullanıcı) |
| Cloud Functions | $0-3 (2M çağrı ücretsiz) |
| Anthropic Claude API | ~$5-15 (50 tatil planı + 50 haber teyiti/ay) |
| SendGrid | $0 (100 mail/gün) |
| WhatsApp Business | $0 (1000 konuşma/ay ücretsiz) |
| Publer (sosyal medya) | $12 |
| Domain (kalkaninfo.com) | $1 (~$10-15/yıl ÷ 12) |
| **TOPLAM** | **~$18-36/ay** |

İlk 1000 aktif kullanıcıya kadar bu sınırlar yeterli. 10K+ olunca Firestore okuma maliyeti devreye girer (1K read = $0.06).

---

## 6. Risk Listesi

| Risk | Etki | Azaltma |
|---|---|---|
| Meta WhatsApp Business onayı uzar | Otomasyon ertelenir | Twilio sandbox ile test, ardından geçiş |
| KVKK denetimi (deploy sonrası) | Para cezası | Aydınlatma + consent + silme akışı yazılı, audit log var |
| Anthropic API maliyeti patlar | Hesap kapanır | Rate limit (anonim 1/gün, auth 5/gün) + bütçe alarmı |
| Firebase Blaze maliyeti patlar | Faturalandırma şoku | Bütçe alarmı $25/$50 set edildi |
| Custom domain DNS | Site açılmaz | Default `.web.app` URL her zaman çalışır |
| Tailwind CDN production'da yavaş | Lighthouse skoru düşer | Vite migrasyonu Faz 2 |
| Telif (görseller) | Kaldırma talebi | Wikimedia + Unsplash kullanılıyor; restoran/villa fotoları gerçek değil → onboarding ile değiştirilecek |

---

## 7. Bilinen Eksikler (Nice-to-have)

Audit raporundan (P2):
- 6 sayfada SEO meta eksik (login, register, kvkk, privacy, terms, hizmet-ekle) — **Bu commit'te düzeltiliyor**
- `profil.html` sitemap'te yok — **Bu commit'te düzeltiliyor**
- vacation-planner.js Firebase v10.12.0 vs diğerleri v10.12.2 — **Bu commit'te düzeltiliyor**
- Site-drawer sadece index.html'de — **Bu commit'te ekleniyor**
- `hizmet-saglayicilari.json` placeholder telefonlar — **Bu commit'te gizleniyor**
- `data/config.json:28` plaintext parolası — **Bu commit'te SİLİNDİ (P0)**
- `admin/admin.js:10` hardcoded sabit — **Bu commit'te SİLİNDİ (P0)**
- 3 görselde alt text eksik — **Bu commit'te düzeltiliyor**
- Lazy loading tutarsız — **Bu commit'te düzeltiliyor**
- `data/config.json` whatsapp placeholder → gerçek numara — **Bu commit'te düzeltiliyor**

---

## 8. Yeni Oturum İçin Hızlı Bağlam (Claude'a)

```
Sen Kalkan Info projesinde çalışıyorsun. Önce DEPLOY_ROADMAP.md'yi oku.

Stack: Statik HTML + Tailwind CDN + Firebase (Auth/Firestore/Functions/Storage/Hosting)
Branch: main (5 commit)
Status: Deploy hazır — Berkay'in 9 adımı bekleniyor (Section 2)

Acil görevler (Berkay söyleyene kadar dokunma):
- WhatsApp Business onayı bekleniyor → otomasyon Mock adapter'da
- Firebase config Berkay tarafından doldurulacak (auth.js boş)
- Custom domain DNS Berkay tarafından

İletişim: Berkay Türkçe konuşur, dürüst ve direkt yanıt ister, agentleri paralel kullan.
Maliyet bilinci yüksek (Ollama'yı basit işlerde kullan).
Brand: sea #1a5e93, sun #f4b53d, Montserrat heading + Inter body.
WhatsApp Concierge: +90 530 665 07 94
```

---

**Sonraki adım:** Section 2'deki 9 maddeyi tamamla → `firebase deploy` → site canlı.
