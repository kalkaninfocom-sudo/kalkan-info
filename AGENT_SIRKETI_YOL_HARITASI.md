# Kalkan Info Agent Şirketi — Kurulum Yol Haritası

> ⚠️ **ARŞİV / ESKİ PLAN** — Mayıs 2026 iş planı. Teknik `- [ ]` kutular **Firebase-devri** (proje Supabase+Vercel'e geçti → çoğu yapıldı/geçersiz). Kalan gerçek işlerin çoğu **kod değil, offline iş/hukuk**: Ltd/A.Ş. kuruluşu, TÜRSAB, VERBİS, mali müşavir, avukat, sosyal medya hesapları. **Yazılım açık-iş listesi olarak KULLANMA.** Güncel canlı durum: **`docs/PROJE_DURUMU.md`**.

**Tarih:** 2026-05-04
**Durum:** Pre-seed sunumu hazır, sıra Berkay'ın deploy + agent şirketi kuruluşunda
**Süre:** 0 → Y2 sonu = 24 ay
**Hedef:** Y2 sonu $1.089M ARR, $420K EBITDA (baz senaryo)

> Bu doküman **operasyonel kurulum** rehberidir. Mimari/finansal model için → `.omc/research/MIMARI_VE_BUTCE.md`. Pazar verisi için → `.omc/research/PAZAR_ARASTIRMASI.md`. Yatırımcı sunumu → `investor-deck/kalkan-info-pre-seed-deck.pdf`.

---

## Faz 0 · Kuruluş (Hafta 0-3)

> **Kural:** Yatırımcı parası gelmeden Faz 0 bitmemeli. İlk taranma yokken bile hazır olmak şart.

### 0.1 Yasal & Mali (Berkay manuel)
- [ ] Limited Şirket kuruluşu: **"Kalkan Info Bilişim ve Turizm A.Ş."** veya Ltd Şti
  - Vergi mükellefiyeti, MERSİS başvuru
  - Anonim seçilirse SAFE/equity için daha esnek
  - Lokasyon: Antalya/Kaş veya İstanbul (turizm + teknoloji teşvikleri)
- [ ] Banka hesabı (TR Lirası + USD/EUR doviz)
- [ ] Mali müşavir tutma (aylık ~₺3.500)
- [ ] **TÜRSAB üyelik başvuru** (acentelik için zorunlu)
- [ ] **VERBİS kayıt** (KVKK Kurumu — 6 ay süre)
- [ ] Avukat retainer (KVKK + ticaret + sözleşme şablonları, aylık ~₺7.500)

### 0.2 Site Canlı (DEPLOY_ROADMAP.md'deki 9 adım — ~2 saat)
- [ ] `kalkaninfo.com` domain satın al (zaten varsa kontrol)
- [ ] Firebase projesi `kalkan-info-prod`, region **europe-west3** (KVKK)
- [ ] Authentication: Google + Email/Password aktif (Facebook opsiyonel Faz 2)
- [ ] Authorized domains ekle
- [ ] `js/auth.js:32-39` Firebase web config doldur
- [ ] Firestore + Storage `europe-west3` aktif
- [ ] Secrets: `ANTHROPIC_API_KEY`, `META_VERIFY_TOKEN`, `SENDGRID_API_KEY`
- [ ] Trigger Email Extension + SendGrid hesap
- [ ] DNS A + TXT kaydı, SSL otomatik
- [ ] `firebase deploy` ilk kez çalıştır
- [ ] **Smoke test:** index, login, ilanlar, tatil-asistani 5 dk gözden geçir

### 0.3 Berkay'ın Bayrağı (Deploy sonrası tek seferlik)
- [ ] Register → kendi hesabını aç
- [ ] Cloud Shell'den `setCustomUserClaims(uid, { admin: true })`
- [ ] Logout/login → `/admin` erişimi açıldı, kontrol

### 0.4 İlk Marka Görünümü
- [ ] Logo finalize (mevcut "◆ KALKAN INFO" yeterli olabilir)
- [ ] Sosyal medya hesapları aç (IG, TikTok, X, FB, YT, LinkedIn)
- [ ] LinkedIn şirket sayfası
- [ ] Kalkan WhatsApp gruplarına Berkay üye olur (allowlist verisi için)

**Faz 0 Çıktısı:** Site canlı, şirket kuruldu, Berkay sahaya hazır. **Hâlâ tek başına.**

---

## Faz 1 · İlk Agent Kanadı — WhatsApp → Sosyal Medya (Hafta 4-8)

> **Bu faz mevcut Mock adapter'da %60 kodlu.** En kolay, en hızlı kazanım.

### 1.1 Trend Watcher Agent
- [ ] `functions/scheduled/trendWatcher.js` — Cloud Scheduler 15dk cron
- [ ] X/Twitter API v2 (Basic tier, $100/ay) — Kalkan/Antalya/Likya keyword
- [ ] Instagram Graph API + Hashtag Search (#kalkan, #kasturkey, #patarabeach, #kaputas)
- [ ] Google Trends (pytrends benzeri unofficial — dikkat, oran limit)
- [ ] RSS: AA, Hürriyet Antalya, sabah.com.tr/yasam
- [ ] Çıktı: `trendingTopics/{topicId}` Firestore — score, source, snippet

### 1.2 WhatsApp Ingest Agent
- [ ] **Twilio Conversations sandbox** ile başla (Meta Business onayı 1-2 hafta)
- [ ] `functions/whatsappWebhook.js` mevcut iskeleti tamamla
- [ ] Allowlist (Berkay kontrolünde) — sadece Kalkan grubu numaralarından mesaj kabul
- [ ] Mesaj → `newsItems/{newsId}` (status: `pending`, rawText)
- [ ] PII otomatik temizleme (telefon, isim regex)
- [ ] **Meta Business Manager** başvurusu paralel başlat

### 1.3 Content Curator Agent (Claude)
- [ ] `functions/verifyNewsItem.js` mevcut iskelet — Sonnet 4.6 prompt finalize
- [ ] Çoklu kaynak çapraz doğrulama (X + Google news + RSS)
- [ ] Güven skoru (≥0.8 admin'e gider, <0.8 otomatik red)
- [ ] 5 dil çeviri (TR ana, EN/DE/RU/AR yan)
- [ ] 3 başlık önerisi (kısa/uzun/tıklama-bait)
- [ ] Kategori (haber/uyarı/etkinlik/promosyon)

### 1.4 Admin Approval UI
- [ ] `admin/news-moderation.html` (yeni dosya)
- [ ] Pending haberler listesi, Berkay onaylar/reddeder/edit
- [ ] Görsel ekleme (Unsplash arama integrasyonu veya manuel upload)
- [ ] 5 dilde önizleme

### 1.5 Social Publisher Agent
- [ ] **Publer Business** hesap aç ($30/ay) — IG/TT/X/FB/YT Shorts
- [ ] `functions/publishToSocial.js` mevcut iskelet → Publer API
- [ ] OAuth token Secret Manager
- [ ] Yayın sonuçları `publishedTo` field'a geri yaz
- [ ] Hata retry (3 deneme, exponential backoff)

### 1.6 İlk Reels Yayını
- [ ] Faz 1 sonu: ilk gerçek WhatsApp haberi → Berkay onayı → 3 kanala yayın
- [ ] Hedef: haftada 5-10 paylaşım
- [ ] KPI: takipçi 0 → 500 (8 hafta)

**Faz 1 Çıktısı:** Sosyal medya ayağı çalışıyor. Berkay tek tıkla onaylıyor, 5 kanala yayılıyor.
**Süre:** 4 hafta. **Maliyet:** ~$200/ay (Twilio + Publer + X API).

---

## Faz 2 · Canlı Destek + Booking Funnel (Hafta 9-14)

### 2.1 Live Support Agent
- [ ] **Tek havuz inbox:** Web chat widget + WhatsApp Business + Telegram + e-posta
- [ ] `functions/liveSupportRouter.js` — gelen mesaj kategorize → uygun yanıt
- [ ] **Pinecone Starter ($0)** — villa/restoran/aktivite katalog vektör DB (RAG)
- [ ] Claude Haiku 4.5 ile intent classify, Sonnet 4.6 ile resmi yanıt
- [ ] Düşük güvende (<0.7) **escalation** insan operatöre (saha kadrosu)
- [ ] KVKK: 90 gün retention, otomatik silme

### 2.2 Web Chat Widget
- [ ] Custom Tailwind chat widget (3rd party Crisp/Tawk yerine — marka tutarlılık)
- [ ] Tüm sayfalarda sağ alt
- [ ] Auth opsiyonel (anonim destek var)
- [ ] Konuşma geçmişi `supportConversations/{convId}` Firestore

### 2.3 Booking Funnel Agent
- [ ] `villalar.html` filtre genişlet: tarih + kişi + bütçe + özellikler (havuzlu, denize sıfır)
- [ ] Uygunluk takvimi (her villa için iCal sync ile Booking/Airbnb dış stok import)
- [ ] **PayTR veya iyzico** entegrasyonu (3D secure, KVKK uyumlu)
- [ ] Rezervasyon → `bookings/{bookingId}` Firestore
- [ ] Otomatik ödeme onayı maili
- [ ] Hata: ödeme başarısız → retry + recovery email

### 2.4 KPI
- [ ] Live support: ortalama yanıt süresi <2 dk, çözüm oranı %75
- [ ] Booking funnel: ilk 10 booking, $5K çeyrek geliri

**Faz 2 Çıktısı:** Sezon başlamadan canlı destek aktif. İlk villa rezervasyonları geliyor.
**Süre:** 6 hafta. **Maliyet ek:** Pinecone $0, PayTR komisyon (%2.69), Cloud Functions usage.

---

## Faz 3 · Reels Generator + Trend Çıktısı (Hafta 15-20)

### 3.1 Reels Generator Agent (en pahalı, en gösterişli)
- [ ] **Veo 3 / Runway Gen-3 / Pika** API entegrasyonu (~$50-150/ay)
- [ ] **Fallback:** Puppeteer + Remotion ile site-screen-record → mp4
- [ ] **ElevenLabs Creator ($22/ay)** — TR/EN voiceover (Burcu sesi default)
- [ ] `functions/generateReel.js` — onaylanmış haberden 9:16 video
- [ ] Cloud Storage `reels/{newsId}.mp4` (R2 fallback ucuz)
- [ ] Otomatik altyazı (Whisper API veya manuel)

### 3.2 Pixel Agents Entegrasyonu (mevcut)
- [ ] Pixel-agents (LOA projesinden) Kalkan brand palette mapping
- [ ] Sosyal medya görsel template'leri otomatik üret
- [ ] Reels thumb generation

### 3.3 Trend → Reels Pipeline
- [ ] Trend Watcher → Curator → Reels Generator → Admin Approval → Publisher (otomatik flow)
- [ ] Berkay sadece "yayınla" tıklar, gerisi otomatik
- [ ] Hedef: günde 1-2 reels, haftada 7-14

**Faz 3 Çıktısı:** Sosyal medya kanalları otomatik beslenir. Berkay sadece onay verir.
**Süre:** 6 hafta. **Maliyet ek:** ~$70/ay (Veo + ElevenLabs).

---

## Faz 4 · Check-in Concierge + Review Sentiment (Hafta 21-26)

### 4.1 Check-in Concierge Agent
- [ ] Booking ile tetiklenen Cloud Scheduler trigger'ları
- [ ] **T-3 gün:** hatırlatma + check-in form (uçuş bilgisi, transfer talebi)
- [ ] **T-1 gün:** detaylı PDF (yol tarifi, anahtar talimat, kontak listesi, restoran önerileri)
- [ ] **T-0 gün:** WhatsApp ile canlı yönlendirme (Berkay/saha karşılar)
- [ ] **T+2 gün:** feedback formu, NPS, Google Maps yorum çağrısı
- [ ] Multi-dil (misafir profil dilinde)

### 4.2 Review & Sentiment Agent
- [ ] Google Maps + Tripadvisor + Booking yorumlarını izle (scraper veya API)
- [ ] Claude Haiku 4.5 ile duyarlılık analizi
- [ ] **Anomali alert:** 24 saatte 3+ negatif yorum → Telegram Berkay'a alert
- [ ] Yorum → otomatik response taslağı (admin onayı ile yayınlanır)
- [ ] Aylık sentiment raporu (`functions/scheduled/monthlySentiment.js`)

### 4.3 KPI
- [ ] Check-in: misafir NPS ≥ 8/10
- [ ] Review: anomali tepki süresi <2 saat

**Faz 4 Çıktısı:** Misafir yaşam döngüsü full-otomatik. Sadece insan dokunuşu Berkay'ın saha karşılaması.
**Süre:** 6 hafta.

---

## Faz 5 · Job Board Agent + B2B SaaS (Hafta 27-36)

### 5.1 Job Board Agent
- [ ] `js/jobs.js` mevcut, agent layer ekle
- [ ] İlan kategorize, başvuru-iş matching skoru
- [ ] Mülakat sorusu önerisi (işveren için)
- [ ] CV otomatik özet (başvuran için)
- [ ] İlan kalite skorlaması (eksik bilgiler işverene öneri)

### 5.2 B2B Agent SaaS Pivot Hazırlık
- [ ] White-label kalkan-info agent stack → "Tatil Bölgesi Agent" SaaS
- [ ] Hedef müşteri: butik otel/villa firması (Bodrum, Çeşme, Dalyan)
- [ ] Aylık $400 paket: trend watcher + content curator + social publisher + admin UI
- [ ] **İlk 3 müşteri Y2 Q3:** Bodrum/Dalyan butik otel pilotu

### 5.3 Recurring Operations
- [ ] Aylık DAU/MAU dashboard
- [ ] Aylık Claude API maliyet alarmı (>$300 hard limit)
- [ ] Çeyreklik investor update (yatırımcılara raporlama)
- [ ] Yıllık KVKK denetimi simülasyonu

**Faz 5 Çıktısı:** Kalkan dışı genişleme + B2B yan gelir. Y2 ARR'ın %5-10'u B2B.

---

## Risk Yönetimi (Sürekli)

| Risk | Tetik | Aksiyon |
|---|---|---|
| WhatsApp API onay gecikmesi | 2 hafta üstü | Twilio sandbox sürdür, 360dialog yedek |
| Sezonluk gelir düşüşü | Kasım-Mart | B2B içerik üretim ($48K Y2 hedefi) |
| Villa sahibi ikna fail | Y1 villa <30 | Komisyonsuz ilk 3 ay teklif et |
| Claude maliyet patlama | $300/ay üstü | Haiku downgrade + caching aktif |
| Saha personel turnover | sezon ortası | Booking başına %0.5 bonus + housing |
| Booking/Airbnb misilleme | Villa sahipleri kaçar | Hibrit: Booking + Kalkan exclusive %3 indirim |
| Berkay SPOF | Yatırımcı endişesi | M12'de COO/CTO işe alma plan |

---

## Önemli Tarihler & Milestones

| Tarih | Hedef |
|---|---|
| 2026-05 (şimdi) | Pre-seed sunumu hazır, deploy hazır |
| 2026-06 | Yasal kuruluş + ilk yatırımcı görüşmeleri |
| 2026-07 | Site live + Faz 1 başlangıç |
| 2026-09 | İlk sezon, agent şirketi MVP |
| 2026-12 | Y1 kapanış: 50 villa, $168K |
| 2027-04 | Y2 sezon başı, 100 villa hazır |
| 2027-12 | Y2 sonu: 200 villa, $1.089M ARR, $420K EBITDA, exit görüşmeleri |

---

## Bir Sonraki Oturum İçin Hızlı Bağlam

> **Bu oturumda (2026-05-04) ne yapıldı:**
> - 4 paralel agent çalıştı (pazar araştırması + mimari + sunum iskeleti + iş ilanı)
> - Pre-seed sunumu PDF üretildi (`investor-deck/kalkan-info-pre-seed-deck.pdf`, 16 slide, 2.4MB)
> - İş İlanı sekmesi entegre edildi (`ilanlar.html` + `ilan-ver.html` + `js/jobs.js` + `firestore.rules`)
> - Bu yol haritası yazıldı

> **Bir sonraki oturum nereden başlamalı:**
> 1. Berkay yatırımcı sunumunu açıp gözden geçirir → düzeltme/ek slide notları
> 2. Faz 0.1 yasal kuruluş → şirket türü kararı (LTD vs A.Ş.)
> 3. Faz 0.2 deploy → 9 adımdan hangileri Berkay tarafından bitti, hangisi sıradaki sprint
> 4. Faz 1.1 Trend Watcher mı, Faz 0 önceliği mi? (önerim: Faz 0 bitmeden Faz 1'e geçilmesin)

> **Açık sorular:**
> - Pre-seed yatırımcı listesi (kim hedef? Anthemis, Revo Capital, 500 İstanbul, melek gruplar?)
> - LTD vs A.Ş. — yatırımcı tercihi ne?
> - Kalkan ofis lokasyonu (Yalı Sokak vs ana cadde)
> - İlk işe alımlar için aday havuzu nereden? (LinkedIn TR, kalkan-info'nun kendi iş ilanı sekmesi)
