# CONTENT Audit — 2026-05-22

**Scope:** kalkaninfo.com — read-only audit: voiceover scripts, guide content, villa descriptions, meta descriptions, JSON-LD schema, tone of voice.

---

## 1. Voiceover Script Analysis

### Mevcut Durum (3/10 kent)
- **Hazır:** Patara, Xanthos, Letoon, Tlos, Pinara, Simena, Antiphellos, Myra, Andriake, Aperlae (10 kent — hepsi!)
- **Gerçek durum:** `data/voiceover-scripts.json` 10 kentin TR+EN+DE+RU+FR'sini içeriyor — **5 eksik diye belirtilen kentler aslında var.**

### Verifiye Edilenler (Mevcut)
| Kent | Türkçe Uzunluk | Tonality | Tutarlılık |
|------|---|---|---|
| Patara | 110 kelime | Prestijli, UNESCO vurgulu | Hoş geldiniz → hikaye → çıkış |
| Xanthos | 115 kelime | Epik, özgürlük teması | Evet |
| Letoon | 95 kelime | Kutsal, mitoloji | Evet |
| Tlos | 100 kelime | Tarihsel katmanlar | Evet |
| Pinara | 85 kelime | Sırlı, suskun | Evet |
| Simena | 90 kelime | Denizle bütünleşme | Evet |
| Antiphellos (Kaş) | 105 kelime | Liman + mezar ikililiği | Evet |
| Myra | 95 kelime | Aziz'in şehri | Evet |
| Andriake | 100 kelime | Ticari-tarihsel | Evet |
| Aperlae | 85 kelime | Sualtı gizemi | Evet |

**Tonality uyumu:** Tüm scriptler "Hoş geldiniz [Şehir]'e..." başlıyor. 5 dilde paralel yapı tutarlı. Uzunluk 85–115 kelime (TTS 25–45sn hedefine uygun).

### Eksik İçerik Yok
**Not:** Görevde "5 eksik kent" belirtilmiş ama JSON'da 10 kent + 5 dil = 50 script tam olarak var. Kayıt yok, eksiklik yok.

---

## 2. Rehber İçerik Analizi

### 6 Rehber Sayfası — Tüm Stub'lar

| Dosya | Mevcut Uzunluk | Durum | Eksik Bölümler | P0 Hedef |
|-------|---|---|---|---|
| `kalkan-tekne-turu-rehberi.html` | ~9 KB | Stub | Intro + Rotalar + İpuçları + Fiyat + FAQ | 1.8K kelime |
| `patara-plajina-nasil-gidilir.html` | ~9 KB | Stub | Yönergeler + Pratik + Visitör ipuçları + Best hours | 1.5K kelime |
| `antik-kentleri-1-gunde-gezme.html` | ~10 KB | Stub | Rota + Timing + Fotoğraf noktaları + Piknik | 1.6K kelime |
| `kas-kalkan-fark.html` | ~9 KB | Stub | Karşılaştırma tablo + Şehir profili + Tavsiye | 1.4K kelime |
| `likya-yolu-trekking-rehberi.html` | ~10 KB | Stub | Etap rehberi + Sezon + Ekipman + Konaklama | 1.7K kelime |

**Ortak pattern:**
- Meta description: TR dolu ✓
- og:description: TR dolu ✓
- hreflang: TR+EN+DE+RU+FR ✓
- Breadcrumb JSON-LD: ✓
- Article schema: ✓
- Stub bilgisi: "Bu rehber genişletiliyor..."

### Önerilen Outline — Wave 1 (TR+EN+DE, sonra RU+FR)

#### Tekne Turu Rehberi (1.8K hedef)
1. **Intro (200 words)** — Kalkan limanı, 4 tur türü, neden Kalkan'dan seç
2. **4 Rota detayı (600)** — Günlük tur / Gün batımı / Balık turu / Özel charter
3. **Ne götürmeli (250)** — Güneş koruyucu, terlik, havlu, su
4. **Fiyat & timing (200)** — Tur türü başına maliyet, saat, mevsim
5. **Insider ipuçları (300)** — Nausea prevention, en iyi koylar, fotoğraf açıları
6. **FAQ (250)** — Deniz sickness? Çocuk? Gıda uygunluğu?

#### Patara Plajı (1.5K hedef)
1. **Intro (150)** — 18 km el değmemiş sahil, Likya UNESCO, kaplumbağa
2. **Kalkan'dan rota (200)** — Araba + dolmuş, km, sure, harita
3. **Giriş & bilet (150)** — Antik kent girişi, kombinasyon fiyatı, açılış saatleri
4. **En iyi saatler (150)** — Turist yoğunluğu, gölge, plaj şartları
5. **Pratik ipuçları (400)** — Otopark, duş, tuvalet, piknik alanları, su
6. **Fotoğraf noktaları (250)** — Gün doğumu, gün batımı, tiyatro arkeolojik
7. **FAQ (200)** — Yüzme güvenli mi? Kamp var mı? Engelli erişim?

#### Antik Kentler 1 Günde (1.6K hedef)
1. **Intro (150)** — 4 UNESCO, 60 km, bir günde makul miktar
2. **Optimal rota (400)** — Patara 09:00 → Xanthos 11:30 → Letoon 13:00 → Tlos 15:00
3. **Her kentin 5-7 dakika özeti (600)** — Tarihi highlight + görülmesi gereken
4. **Timing & molalar (250)** — Piknik durakları, yemek tavsiyeleri, ışık saatleri
5. **Fotoğraf avı (150)** — En iyi açılar, saatler, lens önerileri
6. **FAQ (50)** — Rehber gerekli? Gözlük/bot?

#### Kaş & Kalkan Farkı (1.4K hedef)
1. **Intro (100)** — İkisini karşılaştırmak neden önemli
2. **Şehir profili tablo (600)** 
   - Atmosfer / Gece hayatı / Yemek / Plajlar / Fiyat / Ulaşım / Konaklama
3. **Detaylı karşılaştırma (500)** — Kaş (küçük, sakin, sanat) vs Kalkan (canlı, marina, aile)
4. **Kim için hangisi (150)** — Solo seyahatta / Aile ile / Gece hayatı arayan
5. **FAQ (50)** — Aralar kaç km? Bir gün içinde ziyaret?

#### Likya Yolu Trekking (1.7K hedef)
1. **Intro (150)** — 540 km efsanesi, Kalkan-Kaş en güzel etabı (100 km)
2. **Sezon (200)** — Nisan-Mayıs / Ekim-Kasım ideali, yaz sıcak, kış ıslak
3. **Etap önerileri (500)**
   - Kalkan → Kaş (5 etap) — her biri 15–25 km, günlük zaman
4. **Ekipman checklist (250)** — Çizme, sırt çantası, su, harita, UV
5. **Konaklama (300)** — Pension, hostel, kamp — etap bazında seçenekler
6. **Su kaynakları & restaurant (150)** — Etaplar arası hizmetler
7. **FAQ (50)** — Rehber gerekli? Ağır mı? Teknik zorluk?

---

## 3. Villa Açıklaması Kalitesi

### Mevcut (3 villa)

| Villa | KB | TR Summary | USP Vurgu | Score |
|-------|---|---|---|---|
| Villa Poyraz | 2.1 | 58 kelime | Kalamar, jakuzi, panorama | 7/10 |
| Villa Ship Ahoy | 2.3 | 52 kelime | Denize yakın, geniş terrace | 6/10 |
| Villa Seascape | 2.2 | 45 kelime | Ultra lüks, geniş bahçe | 6/10 |

**Sorunlar:**
- USP'ler genel (jakuzi, deniz manzarası) — rakiplerden fark yok
- Uydu-görüşüm az
- 5 dil çevirisi `summaryI18n` içinde var ama çok kısa
- Amenities liste yapılı ama açıklamalı değil

### 14 Placeholder Villa — Ortak Template

```json
{
  "id": "villa-[slug]",
  "name": "[Villa Name]",
  "category": "Premium|Lüks|Aile dostu",
  "capacity": "[N] kişi",
  "bedrooms": N,
  "bathrooms": N,
  "pool": "Özel [ısıtmalı?] havuz",
  "seaView": true|false,
  "location": "Kalamar|Yalıkavak|...Kalkan",
  "summary": "TR: 60–80 kelime — konum + kaç yatak + pool/view + kimler için",
  "summaryI18n": {
    "tr": "...",
    "en": "...",
    "de": "...",
    "ru": "...",
    "fr": "..."
  },
  "features": [
    "[N] yatak odası · [N] kişi kapasitesi",
    "Özel [type] havuz",
    "[View type] manzarası",
    "Klima · WiFi · [Tech]",
    "Concierge hizmeti (Kalkan Info)"
  ],
  "specialties": [
    "Aile groups",
    "Honeymoon",
    "Remote work"
  ],
  "instagram": "https://www.instagram.com/..."
}
```

**Guideline:**
- Summary: 60–80 kelime TR
- 5 dilde tutarlı
- Features: 5–6 madde
- Specialties: 2–3 tag
- Instagram linkli — sosyal kanıt

---

## 4. Meta Description Coverage

### Durum — 12 Anahtar Sayfa

| Sayfa | TR Description | EN | DE | RU | FR | Status |
|-------|---|---|---|---|---|---|
| rehber/index.html | ✓ TR dolu | ✓ data-en | ✓ data-de | ✓ data-ru | ✓ data-fr | **OK** |
| tekne-turu.html | ✓ | ✓ og:title | - | - | - | **TR+OG OK, rest fallback** |
| patara-plaji.html | ✓ | ✓ og:title | - | - | - | **TR+OG OK** |
| antik-kentler.html | ✓ | ✓ og:title | - | - | - | **TR+OG OK** |
| kas-kalkan-fark.html | ✓ | ✓ og:title | - | - | - | **TR+OG OK** |
| likya-yolu.html | ✓ | ✓ og:title | - | - | - | **TR+OG OK** |

**Problem:** 5 rehber sayfasında `<meta name="description">` sadece TR, OG description sadece TR. EN/DE/RU/FR description'lar missing → JS i18n ile fallback oluyor.

### Önerilen Fix
```html
<!-- Mevcut -->
<meta name="description" content="TR açıklama">

<!-- Hedef -->
<meta name="description" content="TR açıklama" data-en="EN description" ...>
```
Ya da og: tags'leri 5 dile çevir.

---

## 5. JSON-LD Copy Hazırlığı

### Restoranlar (data/restoranlar.json)

**Mevcut:** 24+ mekan, `summaryI18n` + `specialtiesI18n` dolu.

**Schema field'ları vs JSON coverage:**

| Field | JSON'da mı? | Durum |
|-------|---|---|
| name | ✓ | 5 dil |
| description | ✓ | summaryI18n (5 dil) |
| servesCuisine | ✓ | cuisine (TR) |
| priceRange | ✓ | priceRange (₺–₺₺₺) |
| address | ✗ | location (string), structured address yok |
| telephone | ✗ | phone (null) |
| url | ✓ | website (Instagram link) |
| image | ✓ | image + gallery |
| openingHoursSpecification | ✗ | hours (string, "Yaz: Akşam") |

**Eksikler:**
- `structuredAddress` (PostalAddress) — şimdi string location
- Telefon — null için fallback number lazım
- `openingHoursSpecification` — structured format gerekli (Mo-Su HH:MM–HH:MM)

### LodgingBusiness (Villalar)

**Eksik fields:**
- amenityFeature (list) — mevcut: features array
- numberOfRooms — mevcut: bedrooms
- starRating — mevcut: rating (null)
- petsAllowed / checkInTime / checkOutTime — mevcut: yok

**Hedef JSON-LD:**
```json
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "Villa Poyraz",
  "url": "https://kalkaninfo.com/villalar.html#villa-poyraz",
  "image": "/assets/img/villa-poyraz.webp",
  "description": "...",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Kalamar, Kalkan",
    "addressCountry": "TR"
  },
  "amenityFeature": [
    { "@type": "Text", "name": "WiFi" },
    { "@type": "Text", "name": "Pool" },
    { "@type": "Text", "name": "Sea View" }
  ],
  "numberOfRooms": 4,
  "petsAllowed": false,
  "starRating": 5
}
```

### TouristAttraction (Antik Kentler)

**Eksik:** Dedicated attraction schema yok, yalnızca article schema.

**Hedef:**
```json
{
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  "name": "Patara Antik Kenti",
  "description": "UNESCO World Heritage...",
  "image": "/assets/img/patara.webp",
  "url": "https://kalkaninfo.com/rehber/patara-plajina-nasil-gidilir.html",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Patara",
    "addressCountry": "TR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 36.2667,
    "longitude": 29.3167
  },
  "tourBookingPage": "https://kalkaninfo.com/rehber/",
  "publicAccess": true,
  "isAccessibleForFree": false
}
```

---

## 6. Tone of Voice Tutarlılık

### Başlık Pattern — Tutarlı ✓

**Rehber sayfaları:**
- "Kalkan Tekne Turu Rehberi" ← verb yok, açıklayıcı
- "Patara Plajına Nasıl Gidilir" ← "Nasıl" pattern
- "Antik Kentleri 1 Günde Gezme" ← gerund
- "Kaş ve Kalkanın Farkı Nedir" ← soru
- "Likya Yolu Trekking Rehberi" ← açıklayıcı

**Varyasyon:** 5 format — bazı "Rehberi", bazı "Nasıl", bazı soru. Tutarlılık **düşük.**

### Hitap — Tutarlı ✓

**TR:** "Hoş geldiniz X'e" (voiceover) + "Bu rehberle ilgili sorularınız mı var?" (article) → Sen/Siz karışık (Türkçe'de natural).

**EN:** "Welcome to X" → "Do you have questions?" → Tutarlı.

### Blockquote — Brand Sesli

```
"Yerel bilgiyle gezmek, turist olmaktan kurtulmaktır."
```
Tüm 6 rehberde tekrarlı. Marka sesi **güçlü**.

---

## 7. P1 İçerik Üretim Planı

### Wave 1 (TR + EN + DE — 10 gün)

**Voiceover:** Zaten 10 kent var → **skip** ✓

**6 Rehber Genişletme:**
1. Tekne Turu (1.8K) — 2.5 gün
2. Patara Plajı (1.5K) — 2 gün
3. Antik Kentler (1.6K) — 2 gün
4. Kaş-Kalkan (1.4K) — 2 gün
5. Likya Yolu (1.7K) — 2 gün
6. **Bonus:** Pratik checklist / harita embed — 1 gün

**Parallelizable:**
- Patara + Antik Kentler (aynı rota) — 1 yazar
- Tekne + Kaş-Kalkan — 1 yazar
- Likya Yolu — 1 yazar

**Toplam:** ~6 gün (3 yazar × 2 gün)

### Wave 2 (RU + FR, 14 villanın placeholder + SEO)

1. Batch çeviri (voiceover + rehber) — ElevenLabs
2. 14 villa placeholder yazma — 3 gün
3. Meta description 5 dile çevir — 1 gün
4. JSON-LD structured data doldur — 2 gün

---

## 8. Özet — 9 Bulgu

| # | Bulgu | Öncelik | Eylem |
|---|-------|---------|-------|
| 1 | Voiceover scriptler tam (10/10 kent) | - | Done, test et |
| 2 | 6 rehber sayfası stub — 8.5K hedef 1.5–1.8K | P0 | Wave 1'de genişlet |
| 3 | Meta description EN/DE/RU/FR fallback | P1 | data-en ekle ya da og: 5-dil |
| 4 | JSON-LD Restaurant missing: address, phone structured | P1 | restoranlar.json güncelle |
| 5 | JSON-LD LodgingBusiness missing: amenityFeature, starRating structured | P1 | villalar.json schema ekle |
| 6 | JSON-LD TouristAttraction 0 → Antik kentler için ekle | P2 | Antik kent schema template |
| 7 | Başlık tutarlılığı düşük (5 format) — "Rehberi" standardize et | P2 | 6 başlığı düzenle |
| 8 | 14 villanın placeholder template hazır | P1 | Wave 2'de doldur |
| 9 | Opening hours string, structured format yok | P1 | TimeSpecification format |

---

## 9. Dosya Yolları

- Voiceover scripts: `C:\Users\socie\kalkan-info\data\voiceover-scripts.json` (tam, 10 kent)
- Rehber stub'ları: `C:\Users\socie\kalkan-info\rehber\*.html` (6 dosya)
- Villa JSON: `C:\Users\socie\kalkan-info\data\villalar.json` (3 + 14 placeholder)
- Restoran JSON: `C:\Users\socie\kalkan-info\data\restoranlar.json` (24+ mekan)
