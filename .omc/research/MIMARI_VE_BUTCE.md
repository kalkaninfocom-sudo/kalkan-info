# Kalkan Info — Agent Şirketi Mimari + Maliyet Modeli

**Tarih:** 2026-05-04
**Sahip:** Berkay Elmastaş (solo founder)
**Hedef:** Pre-seed yatırım — 24 ay runway, $150M acquisition exit ufku
**Doküman türü:** Mimari + finansal model + ROI vakası

---

## Yönetici Özeti (3 cümle)

Kalkan Info, **saha dışı tüm operasyonel işleri AI agent'larına devrederek** çalışan başına geliri klasik turizm acentelerine göre 8-12 kat artıran, Kalkan-merkezli vertical-AI turizm platformudur. Mevcut iskelet (18 HTML sayfa, Firebase + Cloud Functions + Claude API + 5 dil + KVKK + WhatsApp→sosyal otomasyon Mock fazı) canlıya hazırdır. Y2 sonu baz senaryoda **~$1.089M ARR / ~$420K EBITDA**, exit hedefi **$15-25M (3-5x ARR)** — 18-24 ay sonra acquihire/strategic acquisition.

---

## 1. Agent Şirketi Mimarisi

### 1.1 Komponent Görev Tablosu

| # | Agent | Görev | Tetik | Model |
|---|---|---|---|---|
| 1 | **Trend Watcher** | Twitter/X, Instagram hashtag, Google Trends, RSS — 15dk cron, konu listesi | Cloud Scheduler | Haiku 4.5 |
| 2 | **WhatsApp Ingest** | Berkay telefonu Kalkan grubu mesajları → allowlist filtre → newsItems | Meta WhatsApp Business webhook | filter |
| 3 | **Content Curator** | Ham metinden teyit + 5 dil çeviri + 3 başlık önerisi + güven skoru | Pub/Sub verify-news | Sonnet 4.6 |
| 4 | **Reels Generator** | 9:16 video: stok görseller + altyazı + ElevenLabs voiceover → Cloud Storage | Pub/Sub render-reel | Veo 3 / Runway / Puppeteer-Remotion |
| 5 | **Admin Approval UI** | admin/news-moderation.html — onay/red/edit, çoklu dil swap | UI | — |
| 6 | **Social Publisher** | IG/TikTok/X/FB/YT Shorts'a Publer API ile sıraya | Pub/Sub publish-news | orchestration |
| 7 | **Live Support** | Web chat + WA + Telegram + e-posta tek havuza, RAG (Pinecone) | HTTPS + webhooks | Sonnet 4.6 / Haiku 4.5 |
| 8 | **Check-in Concierge** | T-3 hatırlatma, T-1 PDF, T-0 canlı yönlendirme, T+2 feedback | Cloud Scheduler | Sonnet 4.6 |
| 9 | **Booking Funnel** | Tarih/bütçe/kişi → uygunluk → PayTR/iyzico | Callable Function | Haiku 4.5 |
| 10 | **Review & Sentiment** | GMaps + Tripadvisor + Booking yorumları + Telegram alert | Cloud Scheduler 6sa | Haiku 4.5 |
| 11 | **Job Board** | İlanları kategorize, başvuran-iş eşleştir | UI submit | Haiku 4.5 |

---

## 2. Teknik Stack & Aylık Servis Maliyetleri

| Servis | Plan | Y1 baz $/ay | Y2 ölçek $/ay |
|---|---|---:|---:|
| Anthropic Claude (Sonnet+Haiku, caching) | Pay-as-you-go | $75 | $300 |
| Firebase (Hosting+Auth+Firestore+Functions+Storage) | Blaze | $15 | $80 |
| ElevenLabs (TTS) | Creator | $22 | $99 (Pro) |
| Veo 3 (video) | Pro pay-as-you-go | $50 | $150 |
| WhatsApp Business API (Twilio) | Conversations | $25 | $80 |
| Publer (sosyal medya) | Business | $30 | $30 |
| Cloud Scheduler | GCP | $1 | $3 |
| Pinecone (RAG) | Starter / Standard | $0 | $70 |
| Sentry | Team / Business | $26 | $80 |
| Domain | yıllık $20 | $2 | $2 |
| Cloudflare R2 / S3 | Pay-as-you-go | $10 | $40 |
| Backup | GCS | $5 | $15 |
| Mailgun/SendGrid | Free→Pro | $0 | $35 |
| 360dialog (Y2 alt.) | — | $0 | $50 |
| Buffer (yedek) | — | $0 | $15 |
| **TOPLAM** | | **~$261/ay** | **~$1.067/ay** |

**Yıllık:** Y1 $3.130 / Y2 $12.800

---

## 3. İnsan Kadrosu — Saha (Kalkan ofis, 5 kişi)

### 3.1 Maaşlar (★TAHMİN★ 2026 Türkiye, ₺/USD ~38)

| # | Pozisyon | Brüt ₺ | İşveren maliyeti × 1.40 | USD/ay |
|---|---|---:|---:|---:|
| 1 | Operasyon müdürü | 75.000 | 105.000 | $2.760 |
| 2 | CX vardiya 1 (TR/EN) | 38.000 | 53.200 | $1.400 |
| 3 | CX vardiya 2 (TR/RU veya TR/DE) | 42.000 | 58.800 | $1.547 |
| 4 | Saha koordinatörü | 45.000 | 63.000 | $1.658 |
| 5 | Pazarlama editörü | 50.000 | 70.000 | $1.842 |
| | **TOPLAM** | **250.000** | **350.000** | **$9.207/ay** |

### 3.2 Yan Maliyetler

| Kalem | $/ay |
|---|---:|
| Konaklama (2 paylaşımlı ev × $650) | $1.300 |
| Yemek/günlük ödenek (5 × $250) | $1.250 |
| Hizmet aracı (leasing + benzin) | $700 |
| Telefon/data (5 hat × $25) | $125 |
| Eğitim | $150 |
| Ofis kirası (Kalkan merkez 50m²) | $700 |
| Ofis sarf (internet/elektrik/su/temizlik) | $350 |
| Sigorta | $200 |
| **TOPLAM yan** | **$4.775/ay** |

**Saha aylık toplam:** $13.982/ay = **$167.800/yıl**

---

## 4. Pre-Seed Yatırım Talebi

### 4.1 Hedef: **$650.000** (24 ay runway)

| Kalem | 24 ay $ | % |
|---|---:|---:|
| Saha personeli (5 × 24) | $220.968 | 34.0 |
| Saha yan giderler | $114.600 | 17.6 |
| Agent şirketi servis | $15.900 | 2.4 |
| Pazarlama (organik+influencer+ads) | $90.000 | 13.8 |
| Hukuki + KVKK + VERBİS | $18.000 | 2.8 |
| Berkay maaşı ($3K × 24) | $72.000 | 11.1 |
| Donanım/yazılım kuruluş | $12.000 | 1.8 |
| KOSGEB/Ar-Ge danışman | $8.000 | 1.2 |
| Buffer/contingency %15 | $97.500 | 15.0 |
| **TOPLAM** | **$649.000** | 100 |

### 4.2 Cash-Burn

- Ay 1-6 (kuruluş): ~$22K/ay
- Ay 7-12 (Y1 sezon): ~$28K/ay
- Ay 13-24 (Y2): ~$32K/ay gross, net azalır

---

## 5. Gelir Modeli & 24 Ay Projeksiyon

### 5.1 Varsayımlar

- Kalkan villa stoku: ★TAHMİN★ 600-800 (doğrulama gerekli)
- Mevcut platform: 16 villa kayıtlı (data/villalar.json)
- Hedef: Y1 sonu 50 villa, Y2 sonu 200 villa
- Sezon: 6 ay aktif (Mayıs-Ekim) + 2 ay shoulder
- Ortalama haftalık fiyat: €1.800
- Doluluk: Y1 10 hafta/villa, Y2 14 hafta/villa
- Komisyon: %18 ortalama (ilk 50 villa %12 erken-adopter, kalan %20)

### 5.2 Üç Senaryo

| Metrik | Pesimist | **Baz** | İyimser |
|---|---:|---:|---:|
| Y1 villa | 30 | 50 | 80 |
| Y1 booking/villa | 8 hafta | 10 | 12 |
| Y1 villa booking geliri (€) | 432K | 900K | 1.728K |
| Y1 komisyon @ %15 | 65K | 135K | 259K |
| Y1 yan gelir | 8K | 25K | 60K |
| **Y1 TOPLAM (€)** | **73K** | **160K** | **319K** |
| Y1 USD karşılığı | $77K | $168K | $335K |
| Y2 villa | 80 | 200 | 350 |
| Y2 booking/villa | 10 | 14 | 16 |
| Y2 villa booking geliri (€) | 1.440K | 5.040K | 10.080K |
| Y2 komisyon @ %18 | 259K | 907K | 1.814K |
| Y2 yan gelir | 25K | 130K | 350K |
| **Y2 TOPLAM (€)** | **284K** | **1.037K** | **2.164K** |
| Y2 USD | $298K | $1.089K | $2.272K |
| Y2 brüt kar marjı | %78 | %82 | %85 |
| Y2 EBITDA | -$10K | **$420K** | **$1.380K** |

### 5.3 Ek Gelir Kaynakları (Y2 baz)

| Kaynak | Komisyon/fiyat | Y2 baz $ |
|---|---|---:|
| Restoran rezervasyon | %5 | $25K |
| Aktivite/tekne turu | %15 | $35K |
| Premium villa listing | $99/yıl × 80 | $7.9K |
| B2B içerik üretim | $400 × 10 müşteri | $48K |
| İş ilanı premium | $30 × 30 | $11K |
| **Toplam yan Y2** | | **~$127K** |

---

## 6. ROI

> **"$650K yatırırsan, 24 ay sonu Y2 EBITDA $420K (baz). 4-5x ARR çarpanı ile $4.5M-5.5M değerlemede stratejik exit veya Series-A bridge. İyimser senaryoda $15-25M strategic acquisition. Yatırımcı equity önerisi: %18 SAFE post-money cap $4.5M, MFN clause, %10 ROFR."**

| Senaryo | Y2 ARR | Çarpan | Exit değeri | Yatırımcı %18 | ROI |
|---|---:|---:|---:|---:|---:|
| Pesimist | $298K | 3x | $894K | $161K | -75% |
| Baz | $1.089M | 4x | $4.36M | $784K | +21% |
| İyimser | $2.272M | 5x | $11.36M | $2.04M | +214% |
| Asimetrik | — | — | $20-25M | $3.6-4.5M | +450-590% |

---

## 7. Riskler & Azaltma

| Risk | Etki | Olasılık | Azaltma |
|---|---|---|---|
| WhatsApp API Meta onay gecikmesi | Otomasyon Faz 2'ye sarkar | Orta | Twilio Sandbox geçici, 360dialog yedek |
| Sezonluk gelir (6 ay) | Kasım-Mart nakit baskı | Yüksek | B2B içerik kış geliri, kış kampanyası |
| Villa sahibi ikna (%18 yüksek) | Y1 villa hedefi tutmaz | Orta | İlk 50 villa %12 + ilk 6 ay komisyon yok |
| Claude API maliyet patlama | Marj erozyonu | Düşük | Haiku downgrade + caching + tier rate limit |
| Kalkan turizm krizi | Y2 -%50 | Düşük-Orta | Kaş, Patara, Çıralı genişleme; aynı stack 30 günde portatif |
| KVKK denetimi cezası | Operasyon durur | Düşük | Aydınlatma/consent/silme yazılı, VERBİS Faz 1 |
| Reels kalitesi düşük | Marka zararı | Orta | İnsan editör onayı + kalite eşiği |
| Saha personel turnover | Hizmet düşer | Yüksek | Booking başına %0.5 bonus + konaklama paketle |
| Berkay tek kişi (SPOF) | Yatırımcı endişesi | Yüksek | 24 ay sonu CTO; tüm playbook agent prompt'larında |
| Booking/Airbnb misilleme | Villa sahipleri çekilir | Orta | Hibrit: Booking listingi + Kalkan exclusive %3 indirim |

---

## 8. 24 Ay Yol Haritası

| Çeyrek | Milestone | KPI |
|---|---|---|
| Q1 (1-3) | Deploy + 9 adım + 10 villa | 5K MAU, 10 villa, 0 booking |
| Q2 (4-6) | İlk sezon + agent live support + ilk reels | 25 villa, 100 booking, $40K |
| Q3 (7-9) | Sezon zirve + B2B pilot | 50 villa, 350 booking, $120K |
| Q4 (10-12) | Sezon kapanış + kış stratejisi | 50 villa, $168K Y1 |
| Q5 (13-15) | Y2 ön-rezervasyon + 100 villa kampanya | 100 villa, $250K backlog |
| Q6 (16-18) | Y2 başlar + Kaş/Patara pilot | 150 villa, $450K çeyrek |
| Q7 (19-21) | Y2 zirve, EBITDA pozitif | 200 villa, $700K çeyrek |
| Q8 (22-24) | Exit görüşmeleri / Series A bridge | $1.089M ARR, $420K EBITDA |

---

## Değerlendirme Notları

**Güçlü yanlar:** Mevcut iskelet deploy-ready (18 sayfa, KVKK, i18n, auth, Cloud Functions). Agent mimarisinin %60'ı zaten kodlu (Mock adapter). KVKK + 5 dil + Firebase europe-west3 kurumsal seviye.

**Zayıf noktalar (yatırımcıya açık):**
- Villa stok 600-800 ★TAHMİN★ — doğrulanmadı, %30 düşükse Y2 baz $700K'a iner
- Berkay tek kişi SPOF — yatırımcı CTO/COO şart koşabilir
- 6 aylık sezon doğal sınır — B2B Y1 öngörüsü iddialı
- WhatsApp API gecikmesi 60 gün go-live takvimini riske eder

**Steelman antithesis:** "Booking partner program + agency model %5 komisyon × 2x volume" argümanı vs. "marka + müşteri sahipliği = 2x exit multiple". Synthesis: Y1 hibrit, Y2 exclusive katmanı kalınlaştır.

**STABILITE > YENI OZELLIK:** Plan Y1'de live support + reels + sentiment + check-in paralel açıyor — agresif. Önerim: Y1 Q1-Q2 sadece Trend Watcher + WhatsApp Ingest + Curator + Approval + Publisher (zaten %60 kodlu). Live support, reels, sentiment Y1 Q3'e ertelenmeli. Yatırımcıya "MVP-then-stack" sun.
