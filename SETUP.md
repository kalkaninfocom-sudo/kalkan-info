# Kalkan Info — Kurulum & Deploy Rehberi

Bu doküman Berkay için **statik HTML + Firebase tam yığına geçiş** sürecini adım adım anlatır.

---

## 0. Önkoşullar

```bash
node --version    # >= 20
npm --version     # >= 10
git --version
```

Firebase için:
```bash
npm install -g firebase-tools
firebase --version    # >= 13
firebase login
```

---

## 1. Lokal Geliştirme (Firebase olmadan)

Statik sayfaları test etmek için:

```bash
cd C:\Users\socie\kalkan-info
node serve.mjs
```

Tarayıcıda: `http://localhost:3000`

**Çalışan kısımlar:** i18n dil değiştirici, harita, hava durumu, antik kentler, plajlar, restoranlar listesi, aktiviteler, ROADMAP üzerinden gezinme.

**Çalışmayan kısımlar (Firebase gerekli):** auth (login/register), yorum yazma, hizmet ekleme, tatil asistanı submit, admin moderasyon.

---

## 2. Firebase Projesi Oluşturma

### 2.1 Console'dan
1. https://console.firebase.google.com → **Add project**
2. İsim: `kalkan-info-prod`
3. Google Analytics: opsiyonel
4. **Blaze plan** zorunlu (Cloud Functions için) — Settings → Usage and billing → Modify plan
5. **Bütçe alarmı:** GCP Console → Billing → Budgets → $25 uyarı, $50 sert limit

### 2.2 Authentication
- Authentication → Sign-in method
- **Google** → enable, support email seç
- **Facebook** → enable, App ID + App Secret gir (Meta for Developers'tan al)
- **Email/Password** → enable, "Email link" opsiyonel

### 2.3 Firestore
- Firestore Database → Create database
- **Production mode** → Next
- **Region: `europe-west3`** (Frankfurt — KVKK için zorunlu) ⚠️ değiştirilemez
- Rules → kalkan-info/firestore.rules içeriğini yapıştır + Publish

### 2.4 Storage
- Storage → Get started
- Production rules → Next
- Region: `europe-west3` (Firestore ile aynı)
- Rules → kalkan-info/storage.rules içeriğini yapıştır + Publish

### 2.5 Hosting
- Hosting → Get started → Next, Next, Continue

### 2.6 Web App Config
- Project settings (⚙️) → General → "Your apps" → **Add web app**
- Nickname: `Kalkan Info Web`
- Hosting'e EKLE seçeneği işaretle
- Config'i kopyala (apiKey, authDomain, projectId, vb.)

---

## 3. Frontend Firebase Config'i

`js/auth.js` dosyasını aç, başındaki TODO config'i doldur:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "kalkan-info-prod.firebaseapp.com",
  projectId: "kalkan-info-prod",
  storageBucket: "kalkan-info-prod.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123...:web:abc..."
};
```

⚠️ Bu config'ler `apiKey` dahil PUBLIC olabilir (Firebase güvenlik kuralları seni korur). Ama yine de `.gitignore`'a `js/auth.js`'i eklemek istersen, `js/firebase-config.js` ayrı dosya yapabilirsin.

---

## 4. Cloud Functions Kurulumu

```bash
cd C:\Users\socie\kalkan-info\functions
npm install
```

### 4.1 Secrets (Cloud Secret Manager)
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
# Soracak: sk-ant-api03-xxxxx... (Anthropic Console'dan al)

firebase functions:secrets:set META_VERIFY_TOKEN
# Soracak: kendi seçtiğin random string (örn. kalkan_wh_42_x9y2)

# Sosyal medya (sonra eklenebilir):
# firebase functions:secrets:set BUFFER_API_KEY
# firebase functions:secrets:set PUBLER_API_KEY
```

### 4.2 Pub/Sub Topic'leri
```bash
gcloud config set project kalkan-info-prod
gcloud pubsub topics create verify-news
gcloud pubsub topics create publish-news
```

### 4.3 Trigger Email Extension
1. Firebase Console → Extensions → "Trigger Email" ara → Install
2. Kurulumda:
   - `MAIL_COLLECTION` = `mail`
   - `SMTP_CONNECTION_URI` = SendGrid veya Mailgun:
     - SendGrid: `smtps://apikey:<API_KEY>@smtp.sendgrid.net:465`
     - Mailgun (EU): `smtps://postmaster@kalkaninfo.com:<API_KEY>@smtp.eu.mailgun.org:465`
   - `DEFAULT_FROM` = `Kalkan Info <noreply@kalkaninfo.com>`

---

## 5. Lokal Emulator ile Test

```bash
cd C:\Users\socie\kalkan-info
firebase emulators:start
```

Bu komut açar:
- Auth: http://localhost:9099
- Firestore: http://localhost:8080
- Functions: http://localhost:5001
- Storage: http://localhost:9199
- Hosting: http://localhost:5000
- UI: http://localhost:4000

Tarayıcıda `http://localhost:5000` aç → tam sistem lokal çalışır.

**Test akışı:**
1. `register.html` → e-posta ile kayıt → Firestore Emulator UI'de `users/{uid}` doc kontrol
2. `mail/{id}` koleksiyonunda hoşgeldin email'i (production'da gerçek mail gider, emulator'de sadece doc oluşur)
3. `hizmet-ekle.html` → 4 adımı doldur → `profiles/{id}` doc `status:pending` ile oluşur
4. `tatil-asistani.html` → form gönder → emulator console'da Claude API çağrısı log'lanır

---

## 6. Production Deploy

### 6.1 İlk deploy (her şey)
```bash
cd C:\Users\socie\kalkan-info
firebase use kalkan-info-prod
firebase deploy
```

Bu deploy eder:
- Hosting (HTML/CSS/JS)
- Functions (5 fonksiyon)
- Firestore rules + indexes
- Storage rules

### 6.2 Sonraki deploy'lar (kısmi)
```bash
# Sadece HTML değişikliği
firebase deploy --only hosting

# Sadece bir fonksiyon
firebase deploy --only functions:vacationPlanner

# Sadece kurallar
firebase deploy --only firestore:rules,storage:rules
```

### 6.3 Custom Domain
- Hosting → Add custom domain → `kalkaninfo.com`
- DNS sağlayıcında verilen `A` ve `TXT` kayıtlarını ekle
- 24 saat içinde SSL otomatik kurulur

---

## 7. İlk Admin Yetkisini Alma

Custom claim `admin: true` Cloud Function üzerinden set edilir. İlk admin'i manuel set etmen gerekir:

```bash
# Firebase Console → Authentication → kullanıcılar listesinde Berkay'in UID'sini kopyala

# Cloud Shell veya local'de:
firebase functions:shell

# Shell içinde:
> setAdminClaim({ uid: 'BERKAY_UID', isAdmin: true })
```

VEYA hızlı yol — geçici bir Node script:
```js
// scripts/make-admin.js
const admin = require('firebase-admin');
admin.initializeApp();
admin.auth().setCustomUserClaims('BERKAY_UID', { admin: true })
  .then(() => console.log('OK'))
  .catch(console.error);
```

```bash
node scripts/make-admin.js
```

Sonra Berkay logout/login yapar, claim aktif olur.

---

## 8. WhatsApp Business Webhook (Faz 8)

1. Meta Developers → Create App → Business → WhatsApp ürünü ekle
2. Webhook URL: `https://europe-west3-kalkan-info-prod.cloudfunctions.net/whatsappWebhook`
3. Verify Token: yukarıda set ettiğin `META_VERIFY_TOKEN`
4. Subscribe: `messages`
5. Allowlist: Firestore → `automations/whatsapp-allowlist` doc → `{ phones: ["+9053..."] }`

İlk fazda Twilio Sandbox ile test et (Meta onayı 1-2 hafta).

---

## 9. P0 Güvenlik Temizliği (Faz 2 sonu)

`data/config.json:28-30` ve `admin/admin.js:10` plaintext parolası **SİL**:

```bash
# Önce admin.html artık Firebase Auth + custom claim kullansın
# Sonra:
git rm admin/admin.js
# (yeni admin/admin-v2.js Firebase Auth ile yazılacak — Faz 2 görevi)

# config.json'dan admin alanını çıkar:
# "admin": { ... } → tamamen sil
```

`firebase.json` zaten `admin/` klasörünü Hosting'den hariç tutuyor — şu an dış erişim yok, ama sabitleri yine de temizle.

---

## 10. Maliyet Tahmini (Aylık)

| Hizmet | Tahmin |
|---|---|
| Firebase Hosting | $0 (10GB ücretsiz) |
| Firestore | $0 (1GB + 50K read/gün ücretsiz) |
| Auth | $0 |
| Cloud Functions | $0-5 (2M çağrı ücretsiz) |
| Storage | $0 (5GB ücretsiz) |
| Trigger Email (SendGrid/Mailgun) | $0 (100/gün ücretsiz) |
| Anthropic Claude API | ~$5-15 (50 tatil planı + 50 haber teyiti) |
| WhatsApp Business | $0 (1000 konuşma/ay ücretsiz) |
| Publer / Buffer | $12-15 |
| **Toplam** | **~$17-35** |

İlk 1000 kullanıcıya kadar bu sınırlar yeterli.

---

## 11. Yedekleme

Günlük cron Cloud Function `dailyBackup` Firestore'u GCS bucket'a export eder (7 gün retention). Manuel yedek:

```bash
gcloud firestore export gs://kalkan-info-prod-backups/$(date +%Y%m%d) --project=kalkan-info-prod
```

---

## Sorun Giderme

| Sorun | Çözüm |
|---|---|
| `firebase: command not found` | `npm install -g firebase-tools` |
| Functions deploy "permission denied" | `firebase use kalkan-info-prod` ile doğru projede misin kontrol et |
| Auth "popup blocked" | tarayıcı pop-up engellemesi kapat |
| Firestore "permission denied" | rules deploy edildi mi? `firebase deploy --only firestore:rules` |
| Cloud Function timeout | logs'a bak: `firebase functions:log --only vacationPlanner` |
| Welcome email gelmiyor | Trigger Email extension yüklü mü + SMTP config doğru mu |
| Admin paneli login olmuyor | custom claim set edildi mi? Yeniden login |

---

**Son güncelleme:** 2026-04-30
**Sorumlu:** Berkay Elmastaş — info@kalkaninfo.com
