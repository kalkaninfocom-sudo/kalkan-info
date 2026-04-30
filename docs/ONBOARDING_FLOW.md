# Kalkan Info — Hizmet Ekle Onboarding Akışı

**Tarih:** 2026-04-30 · **Faz:** 2 · **Sahip:** Berkay Elmastaş

---

## 1. Akış Diyagramı

```
Kullanıcı hizmet-ekle.html'i açar
          │
          ▼
  Auth kontrolü (requireAuth)
  ┌────────────────────────────┐
  │ Giriş yok?                 │──► login.html
  │ E-posta doğrulanmamış?     │──► login.html (3sn sonra)
  └────────────────────────────┘
          │ OK
          ▼
  Draft var mı? (localStorage)
  ┌────────────────────────────┐
  │ Evet → state'e yükle       │
  │ Hayır → boş form           │
  └────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    ADIM 1: Tip Seçimi                       │
  │  🍽️ Restoran  🏖️ Villa  👨‍🍳 Aşçı  🚐 Transfer  🚤 Tur  🛠️ Diğer │
  └─────────────────────────────────────────────────────────────┘
          │ İleri →
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 ADIM 2: Temel Bilgiler                      │
  │  İsim · Kategori · Kısa özet (280ch) · Açıklama · Fiyat   │
  └─────────────────────────────────────────────────────────────┘
          │ İleri →
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                ADIM 3: Konum & İletişim                     │
  │  Adres · Leaflet harita marker · Tel · WA · E-posta · URL  │
  └─────────────────────────────────────────────────────────────┘
          │ İleri →
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              ADIM 4: Görseller & Menü                       │
  │  Kapak (zorunlu) · Galeri (max 8) · Menü editörü (restoran)│
  └─────────────────────────────────────────────────────────────┘
          │ Kaydet ve İncele
          ▼
  Firebase Storage yükleme
  (cover.jpg · gallery/N.jpg · menu/N.jpg)
          │
          ▼
  Firestore profiles/{profileId}
  status: "pending"
          │
          ▼
  Başarı ekranı → profil.html redirect (4sn)
          │
          ▼
  Admin panelde onay kuyruğu
  ┌──────────────────────────┐
  │ Admin: status → "active" │──► Public görünür
  │ Admin: status → "rejected│──► Kullanıcıya bildirim (Faz 3)
  └──────────────────────────┘
```

---

## 2. Profil Tipine Göre Form Alan Farklılıkları

| Alan               | Restoran | Villa | Aşçı | Transfer | Tur | Hizmet |
|--------------------|:--------:|:-----:|:----:|:--------:|:---:|:------:|
| İsim               | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| Kategori dropdown  | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| Kısa özet          | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| Tam açıklama       | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| Fiyat aralığı ($–$$$$) | ✅   | ✅    | ✅   | ✅       | ✅  | ✅     |
| Harita marker      | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| WhatsApp           | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| Kapak fotosu       | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| Galeri (max 8)     | ✅       | ✅    | ✅   | ✅       | ✅  | ✅     |
| **Menü editörü**   | **✅**   | ❌    | ❌   | ❌       | ❌  | ❌     |

### Kategori seçenekleri tipe göre

| Tip      | Kategoriler |
|----------|-------------|
| restoran | Fine Dining · Türk Mutfağı · Deniz Ürünleri · Dünya Mutfağı · Kahvaltı & Brunch · Kafe |
| villa    | Lüks Villa · Standart Villa · Apart · Butik Otel |
| asci     | Türk Mutfağı · Akdeniz · Dünya Mutfağı · Vejetaryen / Vegan · Özel Diyet |
| transfer | Havalimanı Transfer · Şehir İçi · Günübirlik Tur · VIP |
| tur      | Tekne Turu · Jeep Safari · Trekking · Dalış · Kültür Turu |
| hizmet   | Temizlik · Tadilat · Çiçekçi · Çamaşırhane · Diğer |

---

## 3. State Machine

```
State: { step: 1-4, data: {...}, errors: {}, user, profileId }

Geçişler:
  next-step  → validate(step) → step++     | errors göster
  prev-step  → step--                      (validation yok)
  save       → validate(4) → upload → setDoc → success

Autosave: localStorage[kalkan_onboarding_draft_{uid}]
  - Her input/change event'inde tetiklenir
  - Blob URL'leri kaydetmez (sadece yüklenen kalıcı URL'ler)
  - Kayıt başarısı sonrası temizlenir
```

---

## 4. Firebase Storage Path Düzeni

```
profiles/{profileId}/cover.jpg          ← kapak fotosu
profiles/{profileId}/gallery/0.jpg      ← galeri (index bazlı)
profiles/{profileId}/gallery/1.jpg
...
profiles/{profileId}/gallery/7.jpg      ← max 8
profiles/{profileId}/menu/0.jpg         ← menü görselleri (opsiyonel, Faz 4)
```

---

## 5. Firestore Doküman Şeması (profiles/{profileId})

```json
{
  "ownerUid": "uid_string",
  "type":     "restoran",
  "status":   "pending",
  "name":     "Aubergine",
  "slug":     "aubergine-a4b2",
  "category": "Fine Dining",
  "summary":  "Yat limanı manzaralı şık fine dining.",
  "descriptionML": { "tr": "..." },
  "priceRange": "$$$$",
  "coverImage": "https://storage.googleapis.com/...",
  "images":   ["https://...", "https://..."],
  "menu": [
    { "category": "Başlangıç", "name": "Meze Tabağı", "description": "...", "price": "₺180" }
  ],
  "contact": { "phone": "+90 242 844 33 32", "whatsapp": "", "email": "", "website": "" },
  "location": { "address": "Yat Limanı, Kalkan", "lat": 36.2658, "lng": 29.4118 },
  "ratingAvg": 0,
  "ratingCount": 0,
  "createdAt": "<ServerTimestamp>",
  "updatedAt": "<ServerTimestamp>"
}
```

---

## 6. Admin Onay Süreci

Bu akış **admin agent** tarafından ayrı olarak geliştirilecek (`admin.html` sekmesi).

```
Admin paneli → "Bekleyen Profiller" sekmesi
  │
  ├─ Profili önizle (profil kartı + tüm görseller)
  ├─ "Yayınla" → status: "active"   → kullanıcıya bildirim (Faz 3)
  ├─ "Reddet"  → status: "rejected" → kullanıcıya bildirim (Faz 3)
  └─ "Askıya Al" → status: "suspended"

Firestore rule:
  Admin dışı kimse status alanını değiştiremez
  (fieldsUnchanged(['status', ...]) kuralı)
```

---

## 7. Berkay Test Checklist

```
[ ] 1. Kayıt ol (register.html) → e-posta doğrulama linkini tıkla
[ ] 2. hizmet-ekle.html'i aç → 4 adımı tamamla (Restoran seç, menü ekle)
[ ] 3. "Kaydet ve İncele" → "Profilin admin onayında" mesajını gör
[ ] 4. Firebase Console → profiles koleksiyonu → yeni doc status: "pending"
[ ] 5. Firestore'da status'u "active" yap → public görünürlük doğrula
[ ] 6. Draft testi: Adım 2'yi doldur, sayfayı yenile → form dolu gelmeli
[ ] 7. Görseller: Storage Console → profiles/{id}/cover.jpg var mı kontrol et
[ ] 8. Mobil: iPhone görünümü, tek sütun, önizleme panel gizli → OK
```

---

## 8. Bağımlılık Notları

| Dosya          | Durum        | Not |
|----------------|--------------|-----|
| `js/auth.js`   | Var (paralel agent) | `requireAuth`, `onAuthStateChanged`, `auth`, `db` export ediyor |
| `js/i18n.js`   | Var (paralel agent) | `t()` fonksiyonu — yoksa key döner |
| `js/map.js`    | Var (paralel agent) | Kullanılmıyor (onboarding kendi Leaflet init ediyor) |
| `js/slug.js`   | **Bu agent** | `slugify`, `randomSuffix`, `uniqueSlug` |
| `js/onboarding.js` | **Bu agent** | ES module, top-level await |
| `hizmet-ekle.html` | **Bu agent** | Auth + onboarding init |
| `profil.html`  | Auth agent   | İşletmelerim sekmesi — dokunulmadı |
| `admin.html`   | Admin agent  | Onay kuyruğu — dokunulmadı |
