# Kalkan Info — WhatsApp → Sosyal Medya Otomasyon Pipeline

**Tarih:** 2026-04-30  
**Durum:** Faz-1 iskelet (MockAdapter aktif)  
**Sahip:** Berkay Elmastaş

---

## 1. End-to-End Akış Diyagramı

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INGEST — WhatsApp                               │
│                                                                     │
│  Berkay (telefon) ──WhatsApp──► Meta Business API                  │
│                                        │                            │
│                                        ▼                            │
│                          HTTPS Function: whatsappWebhook            │
│                          ├── GET  → hub.challenge response          │
│                          └── POST → allowlist check                 │
└────────────────────────────────────┬────────────────────────────────┘
                                     │ Firestore write
                                     ▼
                          newsItems/{newsId}
                          status: 'verifying'
                          source: 'whatsapp'
                          rawText: "..."
                                     │ Pub/Sub publish
                                     ▼ topic: verify-news
┌─────────────────────────────────────────────────────────────────────┐
│                     VERIFY — Claude AI                              │
│                                                                     │
│          Pub/Sub Function: verifyNewsItem                           │
│          ├── rawText → Claude API (claude-sonnet-4-6)              │
│          │   tool: verify_news                                      │
│          │   { is_valid, confidence, category,                      │
│          │     summary, summaryML(5 dil),                           │
│          │     suggested_publish, reason }                          │
│          │                                                          │
│          ├── confidence >= 0.8 && is_valid && suggested_publish     │
│          │   → status: 'verified'                                   │
│          ├── confidence < 0.5  || !is_valid                         │
│          │   → status: 'rejected'  (claudeReason yazılır)          │
│          └── arası → status: 'verifying' + manualReview: true      │
└────────────────────────────────────┬────────────────────────────────┘
                                     │ Firestore update
                                     ▼
                          newsItems/{newsId}
                          status: 'verified'
                          verifiedSummary, summaryML
                          claudeConfidence, category
                                     │
                                     ▼ (real-time listener)
┌─────────────────────────────────────────────────────────────────────┐
│                     REVIEW — Admin Paneli                           │
│                                                                     │
│  admin/news-moderation.html                                         │
│  ├── "Onay Bekleyen" sekmesi → kart listesi                        │
│  ├── Claude güven skoru görsel bar                                  │
│  ├── [Yayınla] → adminApproved: true + triggerPublish() callable   │
│  ├── [Reddet]  → status: 'rejected'                                 │
│  └── [Düzenle] → modal (5 dil özet + kategori + görsel)           │
└────────────────────────────────────┬────────────────────────────────┘
                                     │ Pub/Sub publish
                                     ▼ topic: publish-news
┌─────────────────────────────────────────────────────────────────────┐
│                     PUBLISH — 5 Platform                            │
│                                                                     │
│  Pub/Sub Function: publishToSocial                                  │
│  Guard: status=='verified' && adminApproved==true                   │
│                                                                     │
│  lib/social.js (SocialAdapter)                                      │
│  ├── youtube   → description text (TR özet)                        │
│  ├── instagram → post + caption (TR özet)                          │
│  ├── facebook  → post (TR özet)                                     │
│  ├── twitter   → 280-char EN özet                                   │
│  └── tiktok    → text (TR özet, TODO: manuel ilk fazda)            │
│                                                                     │
│  Sonuç:                                                             │
│  ├── >= 1 başarı → status: 'published', publishedAt set            │
│  └── 0 başarı   → status: 'failed'                                 │
└────────────────────────────────────┬────────────────────────────────┘
                                     │ Firestore update
                                     ▼
                          newsItems/{newsId}
                          status: 'published'
                          publishedTo: { youtube:{...}, instagram:{...}, ... }
                          publishedAt: Timestamp
```

---

## 2. Firestore Doküman Yaşam Döngüsü

```
draft → verifying → verified → published
                ↘           ↘
                 rejected    failed
                   ↕
              (admin geri alabilir → verified)
```

---

## 3. Setup Checklist

### 3.1 Meta / WhatsApp Business

- [ ] [Meta Business Suite](https://business.facebook.com/) → "Business Settings" → WhatsApp Accounts
- [ ] **WhatsApp Business Platform** (Cloud API) — ücretsiz tier: 1000 konuşma/ay ücretsiz
- [ ] Uygulama oluştur: Developers Console → "Create App" → Business → WhatsApp ürünü ekle
- [ ] Webhook URL kaydet: `https://europe-west3-kalkan-info-prod.cloudfunctions.net/whatsappWebhook`
- [ ] Webhook verify_token belirle → Secret Manager'a yaz (bkz. §4)
- [ ] Webhook events: `messages` subscribe et
- [ ] **Onay süreci: 1-2 hafta** — alternatif: Twilio Sandbox ile geliştirme

### 3.2 Allowlist Telefon Numaraları

Firestore Console → `automations/whatsapp-allowlist` dokümanı oluştur:

```json
{
  "phones": ["+905xxxxxxxxx", "+905yyyyyyyyy"]
}
```

Numaralar E.164 formatında (`+` ile başlayan uluslararası format).

### 3.3 Buffer vs Publer — Hangisini Seç?

| Kriter | Buffer | Publer |
|--------|--------|--------|
| Fiyat | $15/ay (Essentials) | $12/ay (Starter) |
| TikTok desteği | Evet (Business) | Evet |
| YouTube Shorts | Hayır | Evet |
| API erişimi | Evet (v1 REST) | Evet (REST) |
| Türkçe arayüz | Hayır | Hayır |
| Instagram Reels | Evet | Evet |

**Öneri: Publer** — YouTube Shorts desteği var, fiyat hafif düşük, API kalitesi yeterli.  
Karar sonra değiştirilebilir: `SOCIAL_PROVIDER` env var ile swap yapılır.

### 3.4 Pub/Sub Topic'leri

```bash
gcloud pubsub topics create verify-news  --project=kalkan-info-prod
gcloud pubsub topics create publish-news --project=kalkan-info-prod
```

### 3.5 triggerPublish Callable Function

`publishToSocial.js` Pub/Sub trigger olduğu için admin panelinden doğrudan çağrılamaz.  
Berkay `functions/index.js`'e şu callable wrapper'ı eklemeli:

```js
// functions/index.js — Berkay'ın ekleyeceği satırlar
const { onCall } = require('firebase-functions/v2/https');
const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

exports.triggerPublish = onCall({ region: 'europe-west3' }, async (req) => {
  const { newsId } = req.data;
  if (!req.auth?.token?.admin) throw new Error('Unauthorized');
  await pubsub.topic('publish-news').publishMessage({ json: { newsId, traceId: `admin_${Date.now()}` } });
  return { queued: true };
});
```

---

## 4. Secret Manager Komutları

```bash
# ANTHROPIC_API_KEY
echo -n "sk-ant-..." | \
  gcloud secrets create ANTHROPIC_API_KEY \
    --data-file=- --project=kalkan-info-prod

# META_VERIFY_TOKEN (güçlü rastgele string)
openssl rand -hex 32 | \
  gcloud secrets create META_VERIFY_TOKEN \
    --data-file=- --project=kalkan-info-prod

# BUFFER_API_KEY (Buffer kullanılırsa)
echo -n "1/..." | \
  gcloud secrets create BUFFER_API_KEY \
    --data-file=- --project=kalkan-info-prod

# PUBLER_API_KEY (Publer kullanılırsa)
echo -n "pub_..." | \
  gcloud secrets create PUBLER_API_KEY \
    --data-file=- --project=kalkan-info-prod

# Cloud Functions'a erişim ver
PROJECT_ID=kalkan-info-prod
SA="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com"

for SECRET in ANTHROPIC_API_KEY META_VERIFY_TOKEN BUFFER_API_KEY PUBLER_API_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
done
```

---

## 5. İlk E2E Test — Mock Provider ile

**Ön koşul:** `SOCIAL_PROVIDER=mock` (default, değiştirme)

```bash
# 1. Firebase emulator başlat
cd kalkan-info/functions
npm install
firebase emulators:start --only functions,firestore,pubsub

# 2. Allowlist ekle (emulator Firestore UI — localhost:4000)
# automations/whatsapp-allowlist → { phones: ["+905xxxxxxxxx"] }

# 3. Webhook simülasyonu — gerçek Meta'yı beklemeden:
curl -X POST http://localhost:5001/kalkan-info-prod/europe-west3/whatsappWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "wamid.test123",
            "from": "905xxxxxxxxx",
            "type": "text",
            "text": { "body": "Kalkan Belediyesi duyurdu: 3 Mayıs akşamı saat 20:00da yat limanında konser var. Ücretsiz." }
          }]
        }
      }]
    }]
  }'

# 4. Emulator loglarında gör:
#   [whatsappWebhook] newsItem created { newsId: "abc123" }
#   [verifyNewsItem] Start { newsId: "abc123" }
#   [verifyNewsItem] Done { status: "verified", confidence: 0.92 }

# 5. Admin panel aç:
#   file:///C:/Users/socie/kalkan-info/admin/news-moderation.html
#   (emulator mod için firebase.json'a emulator config gerekir)

# 6. "Yayınla" → publishToSocial çalışır → mock log görünür:
#   [social:mock] publish { platform: "youtube", fakeId: "mock_youtube_..." }
```

---

## 6. Production'a Geçiş Checklist

- [ ] Meta Business doğrulaması tamamlandı
- [ ] `META_VERIFY_TOKEN` Secret Manager'da, webhook Meta'ya kayıtlı
- [ ] `ANTHROPIC_API_KEY` Secret Manager'da
- [ ] Buffer veya Publer hesabı açıldı, API key Secret Manager'a eklendi
- [ ] Sosyal medya hesapları (YT, IG, FB, X, TikTok) Buffer/Publer'a bağlandı
- [ ] `SOCIAL_PROVIDER` env var `buffer` veya `publer` olarak set edildi
- [ ] `publishToSocial.js` içindeki secrets satırı uncomment edildi
- [ ] Pub/Sub topic'leri production'da oluşturuldu
- [ ] `triggerPublish` callable function `index.js`'e eklendi
- [ ] Admin panelinde `window.FIREBASE_CONFIG` doğru değerler
- [ ] `news-moderation.html`'e admin yetkisi olan kullanıcıyla giriş test edildi
- [ ] 1 gerçek WhatsApp mesajı gönderildi, tüm adımlar logdan doğrulandı

---

## 7. Maliyet Tahmini (Aylık)

| Kalem | Detay | Maliyet |
|-------|-------|---------|
| WhatsApp Business API | İlk 1000 konuşma/ay ücretsiz (Meta) | $0 |
| Claude API (Sonnet 4.6) | ~50 haber/ay × ~$0.01/haber | ~$0.50 |
| Buffer / Publer | Starter plan | $12-15 |
| Firebase Functions | ~100 invocation/ay, ücretsiz tier yeterli | $0 |
| Firestore | Düşük hacim, ücretsiz tier yeterli | $0 |
| **Toplam** | | **~$13-16/ay** |

> Aylık 500+ haber durumunda Claude maliyeti ~$5'a çıkar. Haiku modeline geçilerek
> `DEFAULT_MODEL = 'claude-haiku-4-5'` ile düşürülebilir (lib/claude.js:L12).

---

## 8. Risk & Sınırlamalar

| Risk | Açıklama | Önlem |
|------|----------|-------|
| Meta onay gecikmesi | WhatsApp Business onayı 1-2 hafta sürebilir | Twilio Sandbox ile geliştirme devam eder |
| Instagram API kısıtı | IG posting API Business hesap gerektirir | Buffer/Publer aracılık eder |
| TikTok API | Creator API kısıtlı, Business gerektirir | Faz-1'de manuel; Publer üzerinden otomasyona geçiş |
| YouTube Shorts | Video yükleme gerektirir; metin-only ilk fazda | Summary description olarak gönderilir |
| Claude rate limit | Anthropic tier-1: 50 req/min | Faz-1'de sorun olmaz; Tier-2 başvurusu gerekirse yapılır |
| Allowlist aşımı | Yanlış numara eklenir | Firestore allowlist admin-only write, rules mevcut |
| Duplikat mesaj | WhatsApp aynı mesajı tekrar gönderebilir | `sourceRef` (messageId) unique check eklenebilir |
