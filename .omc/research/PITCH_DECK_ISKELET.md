# Kalkan Info — Pre-Seed Pitch Deck İskelet

**Doküman tipi:** 16 slide içerik iskeleti, 22 dakika sunum + Q&A
**Dil:** Türkçe (EN appendix opsiyonel)
**Renk:** #0a2e4c sea-deep, #f4b53d sun, white/cream
**Font:** Montserrat heading, Inter body

---

## SLIDE SIRASI

### 1. Cover (30s)
- Logo + "Kalkan Info"
- Tagline: "Akdeniz'in Butik Tatil Ajanı, AI-Native Operations"
- Sunucu: Berkay Elmastaş, Founder
- Tarih, "CONFIDENTIAL"
- **Görsel:** Kalkan'dan dramatik bir günbatımı + logo overlay

### 2. Problem (2m)
- **Ana mesaj:** Kalkan'da tatil planlamak hâlâ dağınık, çok dilli, manuel.
- **Bullets:**
  - Bilgi 10 farklı kanalda: Booking, Tripadvisor, Instagram, WhatsApp grupları, Google Maps
  - 5 dilden hizmet veren tek panel yok (Türk/İngiliz/Alman/Rus/Arap turist)
  - Villa kiralama pazarı parçalı, kompetitörler arası ~%50 listing örtüşmesi
  - Yerel rehber + restoran + aktivite + villa birleşik bir oyuncu yok
- **Görsel:** 4 panel — dağınık ekran (Booking + IG + WA + Maps) → soru işaretli turist
- **Konuşma notu:** "Kalkan, dünyanın 8. en çok ziyaret edilen şehri Antalya'nın butik segmenti. Ama platform yok. İnsanlar 6 ayrı uygulama kullanıyor."

### 3. Solution (1.5m)
- **Ana mesaj:** Tek platform: rehber + AI tatil asistanı + villa kiralama + canlı destek (5 dil).
- **3 katman:**
  1. Yerel rehber + Claude AI tatil asistanı (kullanıcı kazanım)
  2. Villa kiralama platformu — %20 komisyon (ana gelir)
  3. Sosyal medya + içerik agent ajansı (B2B yan gelir)
- **Görsel:** 3 ekran mockup — index hero, tatil-asistani, villa detay
- **Konuşma notu:** "Saha dışı tüm operasyon AI agent'larıyla. 5 kişi sahada müşteri yüzü. 30 kişilik rakipten %70 daha düşük OPEX."

### 4. Why Now (1m)
- **Ana mesaj:** AI maliyetleri 2024→2026 düştü, Türkiye turizm rekor, Kalkan butik segment büyüyor.
- **Bullets:**
  - Claude/GPT API maliyetleri 2024-2026 ~%80-95 düştü
  - Türkiye 2025 turizm geliri rekor: $65,2B
  - Antalya 2025: 17,5M turist (dünyada 8.)
  - 2026 Q1: gecelik harcama $119/turist (rekor)
- **Görsel:** 4-panel çubuk grafik (Claude cost down, Türkiye turist up, Kalkan villa up, OPEX comparison)

### 5. Market Size (1.5m)
- **TAM:** Türkiye vacation rentals 2027: **$1,28B** (Statista)
- **SAM:** Antalya turizm geliri 2025: **$17B** (Türkiye toplamının %26'sı)
- **SOM:** Kalkan villa komisyon havuzu: **~$10M/yıl** (1.500 villa × $51M envanter × %20)
- **Görsel:** TAM/SAM/SOM piramidi + Türkiye turizm $65,2B referans
- **Konuşma notu:** "Sadece villada $10M addressable. Restoran + aktivite + B2B ekleyince Y2 hedefimiz $1,1M ARR."

### 6. Product (2m)
- **Ana mesaj:** Mevcut iskelet canlıya hazır.
- **4 ekran şot:**
  - index.html (hero + hızlı erişim + eczane + haberler)
  - tatil-asistani.html (Claude AI step form)
  - antik-kentler.html (Likya haritası + 17 antik kent)
  - admin/news-moderation (gelecek — onay paneli)
- **Konuşma notu:** "18 sayfa, 40 JS modülü, 5 dil, KVKK, Firebase. Demo localhost'ta canlı."

### 7. AI Agent Şirketi Mimarisi (skip → Appendix)
- **Tek slide özet:** 11 Claude agent + cron + insan onay
- **Liste:** Trend Watcher, WhatsApp Ingest, Content Curator, Reels Generator, Admin Approval, Social Publisher, Live Support, Check-in Concierge, Booking Funnel, Review/Sentiment, Job Board
- **Görsel:** Sirküler diyagram (merkez = platform, halkalar = trend → ingest → curate → reels → publish)

### 8. Business Model (1.5m)
- **Komisyon yapısı:**
  - Villa: %18 ortalama (ilk 50 villa %12 erken-adopter, sonra %20)
  - Restoran rezervasyon: %5
  - Aktivite/tekne turu: %15
  - Premium villa listing: $99/yıl
  - B2B içerik üretim: $400/ay × 10 müşteri Y2
  - İş ilanı premium: $30/ay
- **Görsel:** Pasta grafik Y2 baz: villa %78, restoran %3, aktivite %3, B2B %4, ilan %1, premium %1, yan %10
- **Komisyon benchmark tablosu:** Airbnb %15,5 / Booking %10-25 / VRBO %13-20 → bizim %18-20 üst bant ama haklı (5 dil + AI + agent + saha)

### 9. Go-to-Market (1.5m)
- **Faz 1 (Ay 1-3):** İlk 10 villa onboard, organik sosyal + influencer barter
- **Faz 2 (Ay 4-9):** İlk sezon, 50 villa hedef, agent live support full, paid ads start
- **Faz 3 (Ay 10-12):** B2B içerik pilot, kış stratejisi
- **Faz 4 (Y2):** 200 villa, Kaş/Patara genişleme
- **Görsel:** Timeline + KPI growth curve

### 10. Traction & Milestones (1m)
- **Şu an:**
  - Site canlı (lokal, Firebase deploy hazır)
  - 5 commit, 18 sayfa, 16 villa kayıtlı
  - KVKK + 5 dil + auth + Cloud Functions iskelet
  - Marka kimliği hazır
- **Milestone:**
  - Ay 6: 25 villa, 100 booking, $40K
  - Ay 12: 50 villa, $168K Y1
  - Ay 18: 150 villa, $450K çeyrek
  - Ay 24: 200 villa, $1.089M ARR, $420K EBITDA
- **Görsel:** Timeline çubuğu

### 11. Competitive Edge (1m)
- **Karşılaştırma tablosu (5 satır):**

| | Kalkan Info | Booking | Airbnb | TatildeKirala | Holiday Lettings |
|---|:-:|:-:|:-:|:-:|:-:|
| Yerel + Türkçe destek | ✅ | ⚠️ | ⚠️ | ✅ | ❌ |
| 5 dil premium UX | ✅ | ✅ | ✅ | ❌ | ✅ |
| AI tatil asistanı | ✅ | ❌ | ❌ | ❌ | ❌ |
| Restoran + aktivite + villa tek panel | ✅ | ❌ | ❌ | ❌ | ❌ |
| Saha varlığı (insan misafir karşılama) | ✅ | ❌ | ❌ | ❌ | ❌ |
| OPEX (rakip 30 kişi vs bizim 5) | %70 ↓ | — | — | — | — |

### 12. Team (1.5m)
- **Berkay Elmastaş** — Founder, Full-Stack AI Builder
  - Solo founder, AI-first DNA
  - Önceki projeler: LOA (Land of Airdrop, $150M acq hedefli), AdnanICT, canICT-B
  - Kalkan'da yerleşik, saha bilgisi
- **5 kişi saha (Y1 başında işe alınacak)** — Operasyon müdürü, 2 CX, saha koordinatörü, pazarlama editörü
- **11 AI agent** kadro: Trend Watcher, WhatsApp Ingest, ... (yukarıda)
- **Açık danışman slotu:** Turizm sektör veteranı (CTO/COO Y2'de)

### 13. Financials — 24 Ay Projeksiyon (2m)
**3 senaryo:**

| | Pesimist | **Baz** | İyimser |
|---|---:|---:|---:|
| Y1 villa | 30 | **50** | 80 |
| Y1 gelir | $77K | **$168K** | $335K |
| Y2 villa | 80 | **200** | 350 |
| Y2 ARR | $298K | **$1.089M** | $2.272M |
| Y2 EBITDA | -$10K | **+$420K** | +$1.380K |
| Brüt kar marjı | %78 | **%82** | %85 |

- **Görsel:** Çift çizgi grafik (gelir + EBITDA), baz vurgulu

### 14. Use of Funds — $650K (1m)
- **Saha personeli (5 × 24 ay):** %34 ($221K)
- **Saha yan giderler (konaklama/ofis):** %18 ($115K)
- **Pazarlama (organik+influencer+ads):** %14 ($90K)
- **Berkay maaşı ($3K/ay × 24):** %11 ($72K)
- **Hukuki + KVKK + VERBİS:** %3 ($18K)
- **Agent şirketi servis:** %2 ($16K)
- **Donanım/yazılım kuruluş:** %2 ($12K)
- **KOSGEB/Ar-Ge danışman:** %1 ($8K)
- **Buffer/contingency %15:** %15 ($98K)
- **Görsel:** Pasta grafik

### 15. The Ask (30s)
- **$650.000 pre-seed**
- **%18 SAFE** post-money cap **$4.5M**, MFN clause, %10 ROFR
- **Kullanım:** 24 ay runway → Y2 sonu $1.089M ARR (baz) → Series A bridge veya stratejik exit
- **ROI matrisi:**
  - Baz: 4x ARR → $4.36M exit → yatırımcı $784K (1.21x)
  - İyimser: 5x ARR → $11.36M → yatırımcı $2.04M (3.14x)
  - Asimetrik (Aeternum mythos × Kalkan brand): $20-25M → yatırımcı $3.6-4.5M (5.5-6.9x)

### 16. Vision / Closing (1m)
- **5 yıl sonra:** Akdeniz'in tek butik tatil agent şirketi.
- **Coğrafi genişleme:** Kalkan → Kaş → Patara → Çıralı → Adrasan → Bodrum → Çeşme.
- **Exit veya kâr:** $20-25M acquihire (TripAdvisor TR / Booking lokal partner / Jolly Tur / GetYourGuide regional play) **veya** $10M+ GMV ile bağımsız büyüme.
- **Görsel:** Türkiye Akdeniz haritası, Kalkan vurgulu, genişleme okları
- **Kapanış:** "Kalkan'da tatil, artık çok kolay. Sıra yatırımcıda."

---

## APPENDIX (yatırımcı sorarsa açılır)

### A1. Detaylı agent şirketi mimarisi (sequence diagram)
### A2. Detaylı maliyet kalemleri tablosu (24 ay aylık cash-flow)
### A3. Risk matrisi (10 risk + azaltma)
### A4. KVKK/yasal durum (aydınlatma + VERBİS + sub-işleyici envanteri)
### A5. Tech stack (Firebase, Anthropic, Twilio, ElevenLabs, Veo, Pinecone, Sentry)
### A6. Cap table (mevcut + post-investment)
### A7. Kompetitör derin analizi

---

## Q&A COUNTER-PUNCHES (sık sorulan)

| Soru | Yanıt |
|---|---|
| "Neden şu an?" | AI maliyeti %95 düştü + Türkiye turizm rekor + Kalkan butik segment + Berkay yerleşik |
| "Booking sizi ezmez mi?" | Hız (2 ay vs 18 ay), 5 dil, AI OPEX, yerel pazarlama, saha varlığı, Türkçe destek |
| "Turist sayısı az, ölçek?" | Y1 organik + influence, Y2 Bodrum/Dalyan B2B model, Y3 SaaS pivot opsiyonu |
| "Yalnız founder riski?" | 5 kişi saha committed, 11 AI agent system relief, M12 COO işe alma planı, tüm playbook agent prompt'larında |
| "Komisyon %20 yüksek değil mi?" | Booking üst bant %25, Airbnb efektif %17. Bizimki 5 dil + AI + agent + saha ile haklı; ilk 50 villa %12 erken-adopter |
| "Sezonluk gelir?" | Kasım-Mart B2B içerik üretim ($48K Y2), kış kampanya, yurtdışı yıl boyu turist |

---

## SUNUM PROTOKOLÜ
- **Süre:** 22 dakika sunum + 10-15 dakika Q&A
- **Format:** Google Slides veya Figma → PDF eksport
- **Sırası:** 1→2→3→4→5→6→8→9→10→11→12→13→14→15→16 (Slide 7 mimari sadece sorulursa A1)
