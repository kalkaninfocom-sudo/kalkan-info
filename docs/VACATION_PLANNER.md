# Tatil Asistanı — Teknik Dokümantasyon

**Tarih:** 2026-04-30  
**Durum:** Faz 6 — İlk sürüm  
**Sahip:** Berkay Elmastaş

---

## 1. Akış Diyagramı

```
Kullanıcı (tarayıcı)
  │
  ├─ tatil-asistani.html  (5-adım multi-step form)
  │       Adım 1: Tarih / Grup / Bütçe
  │       Adım 2: Kalkış havalimanı / Havayolu
  │       Adım 3: Konaklama tercihleri
  │       Adım 4: Yemek & Mutfak
  │       Adım 5: Aktiviteler & Özel istekler
  │
  ├─ js/vacation-planner.js  (Firebase SDK istemci)
  │       ┌─ Client-side rate limit (localStorage, 1/gün)
  │       ├─ Form verisi topla (collectFormData)
  │       └─ httpsCallable('vacationPlanner') çağır
  │
  ▼
Firebase Cloud Function — vacationPlanner
  (europe-west3, timeout 540s, memory 1GiB)
  │
  ├─ 1. Input validation
  │       tarih geçerliliği, gün sayısı (max 30)
  │       grup büyüklüğü (max 12 kişi)
  │       bütçe pozitif sayı
  │
  ├─ 2. Server-side rate limit
  │       Firestore _rate_limits koleksiyonu
  │       Anonim: 1 plan/gün/IP
  │       Auth kullanıcı: 5 plan/gün/UID
  │
  ├─ 3. Katalog özeti oluştur
  │       CATALOG_VILLAS: filtrele (kapasite, deniz manzarası, havuz)
  │       CATALOG_TOURS: aktivite tercihine göre filtrele
  │       Token verimli özet (tam JSON değil)
  │
  ├─ 4. Claude API — tool_use: create_plan
  │       Model: claude-sonnet-4-6
  │       System: Kalkan uzmanı, JSON zorunlu kural seti
  │       Tool: create_plan (structured output schema)
  │       tool_choice: auto (Claude aracı MUTLAKA kullanır)
  │
  ├─ 5. Firestore kayıt (sadece auth kullanıcı)
  │       vacations/{planId} dokümanı
  │       ownerUid, dateRange, groupSize, budget, items[], status
  │
  └─ 6. Yanıt → istemci
          { days[], totalPrice, rationale, requestId, meta }

İstemci tarafı render:
  ├─ Zaman çizgisi (her gün: items[] → timeline-item kartları)
  ├─ Toplam fiyat gösterimi
  ├─ PDF (jsPDF) / Kaydet (Firestore) / E-posta (stub) butonları
  └─ "Yeniden Oluştur" → aynı form verisiyle yeniden çağır
```

---

## 2. Maliyet Tahmini

**Model:** `claude-sonnet-4-6`

| Bileşen        | Token tahmini | Maliyet (USD) |
|----------------|--------------|---------------|
| Sistem promptu | ~400 token   | —             |
| Katalog özeti  | ~600 token   | —             |
| Form verisi    | ~300 token   | —             |
| **Toplam input**| ~1.300 token | $0.0039       |
| **Output**     | ~2.000 token | $0.030        |
| **Plan başına**| —            | **~$0.034**   |

> Gerçek kullanımda katalog filtresi ve özel istekler tokeni artırabilir.  
> Maksimum senaryo (uzun özel istek + büyük grup + 30 gece): **~$0.15/plan**

**Aylık maliyet tahmini:**
- 100 plan/ay → ~$3.4
- 1.000 plan/ay → ~$34
- 10.000 plan/ay → ~$340 (rate limit + caching ile azaltılabilir)

---

## 3. Rate Limit Stratejisi

### İstemci tarafı (localStorage)
```js
const RATE_KEY   = 'kalkan_plan_last';
const RATE_LIMIT = 24 * 60 * 60 * 1000; // 24 saat
```
- Browser bazlı, kolayca atlatılabilir → sadece iyi niyetli kullanıcı deneyimi
- Sunucu tarafı asıl koruma sağlar

### Sunucu tarafı (Firestore `_rate_limits`)
| Kullanıcı tipi | Limit       | Anahtar              |
|----------------|-------------|----------------------|
| Anonim         | 1 plan/gün  | `ip_{IP_adresi}`     |
| Auth kullanıcı | 5 plan/gün  | `uid_{kullanıcı_uid}`|

Doküman: `_rate_limits/plan_{YYYY-MM-DD}_{limitId}`  
Alan: `count` (Firestore `FieldValue.increment(1)` ile atomik artış)

### Gelecek geliştirme (Faz 8+)
- App Check (reCAPTCHA Enterprise) aktifleştirildiğinde bot koruması eklenir
- Firebase Remote Config ile limit değerleri runtime'da ayarlanabilir

---

## 4. Katalog Filtreleme Mekanizması

`data/*.json` dosyalarının tamamı prompta eklenmez — token maliyetini düşürmek için `vacationPlanner.js` içindeki sabit listeler kullanılır:

### Villa filtresi
1. `capacity >= adults + children` — yetersiz kapasiteli villalar elenir
2. `seaView: true` kullanıcı istediyse filtre uygulanır
3. `pool: true` kullanıcı istediyse filtre uygulanır
4. En fazla 4 villa prompta eklenir

### Tur filtresi
1. Kullanıcının seçtiği aktivite kategorileriyle eşleştirme
2. `featured: true` olanlar her zaman dahil edilir
3. En fazla 5 tur prompta eklenir

### Faz 4+ göç sonrası
`data/*.json` → Firestore `profiles` koleksiyonuna göç edildiğinde:
- Cloud Function Firestore'u sorgulayacak
- `type=='villa' && status=='active' && capacity>=N` gibi gerçek veri sorguları
- Statik katalog sabitleri kaldırılacak

---

## 5. Secret Yönetimi

### API Key kurulumu
```bash
# Bir kez çalıştırılır — Berkay lokal terminalde
firebase functions:secrets:set ANTHROPIC_API_KEY
# Prompt: Anthropic dashboard'dan alınan sk-ant-... anahtarını yapıştır
```

### Doğrulama
```bash
firebase functions:secrets:access ANTHROPIC_API_KEY
```

### Kod içinde erişim
```js
const { defineSecret } = require('firebase-functions/params');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Fonksiyon config'inde:
exports.vacationPlanner = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (req) => {
  const key = ANTHROPIC_API_KEY.value(); // sadece invocation içinde erişilebilir
});
```

Key **asla** kaynak koduna, `firebase.json`'a veya environment variable olarak açık yazılmaz.

---

## 6. Claude Tool Kullanımı

`create_plan` tool'u zorunlu structured output sağlar:

```js
tool_choice: { type: 'auto' }
// Claude, tool'u MUTLAKA kullanmak zorunda (sistem promptunda da zorunlu kılındı)
```

Tool şeması `days[]` → `items[]` hiyerarşisi döndürür:
```json
{
  "days": [
    {
      "date": "2026-07-01",
      "dayLabel": "Varış Günü",
      "items": [
        { "type": "flight",        "title": "IST→DLM", "time": "08:45", "price": 3200 },
        { "type": "transfer",      "title": "Dalaman → Villa", "refId": "transfer-havalimani", "price": 2500 },
        { "type": "accommodation", "title": "Villa Mira check-in", "refId": "villa-mira", "price": 18000 }
      ]
    }
  ],
  "totalPrice": 125000,
  "rationale": "Villa Mira, 2 yetişkin için ideal kapasite..."
}
```

---

## 7. Dosya Sahipliği

| Dosya | Açıklama |
|-------|----------|
| `tatil-asistani.html` | 5-adım form + sonuç ekranı |
| `js/vacation-planner.js` | Firebase SDK istemci, form state, PDF, Firestore kayıt |
| `functions/vacationPlanner.js` | Cloud Function — validation, Claude API, rate limit |
| `functions/package.json` | Node 20 bağımlılıkları |
| `functions/index.js` | Tüm fonksiyonların merkezi export noktası |
| `docs/VACATION_PLANNER.md` | Bu doküman |

**Dokunulmayan dosyalar:** `index.html`, `villalar.html`, `restoranlar.html` ve diğer mevcut HTML sayfaları.

---

## 8. Deploy & Test Rehberi

```bash
# 1. Secret'ı kur (ilk kez)
firebase functions:secrets:set ANTHROPIC_API_KEY

# 2. Lokal emülatörde test et
cd functions && npm install
firebase emulators:start --only functions,firestore

# 3. tatil-asistani.html'i aç, formu doldur, planı oluştur
#    (emülatör localhost:5001 fonksiyonları yakalar)

# 4. Deploy
firebase deploy --only hosting,functions:vacationPlanner,firestore:rules

# 5. Canlı test
#    https://kalkaninfo.com/tatil-asistani.html
#    Formu doldur → "Planı Oluştur" → ~30 saniye → zaman çizgisi
```
