# Kalkan Info — Günlük Gazete Projesi

**Tarih:** 2026-06-06
**Sahibi:** Berkay
**Durum:** Konsept aşaması, şablon bekleniyor

---

## 1. Vizyon (Berkay'ın Tarifi)

> Gazete şablonu → günlük + mekan bazlı kişiselleştirilmiş gazete → A4 baskı → gece hayatı manşet/görsel reklam satışı.

**Tek cümle:** Kalkan'ın yerel günlük gazetesi, her mekana özel basılı (ve dijital) sürümlerle, reklamı tabletten değil **kahve fincanının yanından** satan bir medya ürünü.

---

## 2. Ürün Mimarisi

### 2.1 Edisyon Tipleri

| Edisyon | Hedef Kitle | Saat | Dağıtım Noktası |
|---|---|---|---|
| **Sabah** (`morning`) | Tatilci kahvaltıda | 07:00 | Otel resepsiyon, kahvaltı salonu, plaj kulübü |
| **Akşam** (`evening`) | Akşam yemeği + gece | 17:00 | Restoran masaları, gece kulübü girişi, bar |
| **Hafta sonu özel** (`weekend`) | Cumartesi/Pazar | Cuma akşam | Tüm noktalar, yüksek tiraj |
| **Mekan edisyonu** (`venue`) | Tek mekan müşterisi | Talep üzerine | Sadece o mekan |
| **Özel sayı** (`special`) | Festival, düğün, sezon açılış | Etkinliğe göre | Hedefli |

### 2.2 Sayfa Yapısı (A4, 4 sayfa standart)

**Sayfa 1 — Manşet:**
- Logo bandı (kalkaninfo.com)
- Hava durumu + deniz suyu + UV index (mini kutu)
- Ana manşet (premium reklam slotu **veya** günün haberi)
- 2 alt manşet
- "Bugün Kalkan'da" özet kutu (etkinlikler)

**Sayfa 2 — Mekan & Yaşam:**
- Günün restoranı (sponsorlu **veya** editöryal)
- Gece programı tablosu
- "Şefin Önerisi" reklam slotu (advertorial)

**Sayfa 3 — Rehber:**
- Plaj raporu (dalga, rüzgar, kalabalık)
- Antik kent / aktivite önerisi
- Transfer/turlar reklam slotu

**Sayfa 4 — Servis:**
- Nöbetçi eczane, acil numaralar, otobüs
- Sınıflandırılmış reklamlar (gece kulübü listesi, happy hour, DJ takvimi)
- QR: dijital sürüm + sonraki gün bildirimi

---

## 3. Önerilen İyileştirmeler (Mutlaka Bak)

### 3.1 Stratejik
1. **QR kod her reklamda zorunlu** — Tıklamayı say. "Bu manşeti gören 234 kişi linke girdi" → reklam fiyatı veriyle savunulur.
2. **Mekan abonelik modeli** (B2B SaaS mantığı) — Mekanlar aylık ₺2.000–₺8.000 öder, her gün gazetede sabit yer + kendi mekanına özel edisyon. Reklamdan tek seferlik değil, **MRR**.
3. **Hyperlocal veri** — Hava, deniz suyu, gel-git, UV, kalabalık tahmini → "neden okuyayım?" cevabı. Tek bir reklam dergisi olmasın.
4. **Editorial firewall** — Reklam = "İLAN" etiketli ve farklı font. Yoksa hem güvenilirlik gider hem KVKK/Basın Kanunu sorunu olur.
5. **AI içerik motoru (Claude Haiku)** — Hava + etkinlik + mekan veritabanından günlük 4 haber + 6 manşet üret, editör 10dk onaylasın. **İçeriği insan üretmesin, insan denetlesin.**

### 3.2 Operasyonel
6. **Print-on-demand partnership** — Kalkan/Kaş'taki yerel matbaa + 2 in-house lazer yazıcı yedek. İlk faz: günlük 200 kopya × 30 nokta = 6.000 baskı/gün — abartma, 500 kopya × 10 nokta ile başla.
7. **Mekan kendi basabilsin** — Otele/restorana PDF gönder, kendi yazıcısından basıp masaya koysun. Lojistik %80 düşer.
8. **Versiyonlama** — Her sayı `2026-06-06_evening_kalimerakitchen.pdf` formatında arşivlensin. Reklamveren "geçen Cuma sayısını gönder" diyebilsin.

### 3.3 Ticari
9. **Reklam paketleri (5 katman):**
   - **Manşet sponsoru** — Sayfa 1, ₺/gün, premium (1 mekan/gün)
   - **Çeyrek sayfa görsel** — orta katman
   - **Native advertorial** — "Şefin Önerisi" tarzı (etiketli haber)
   - **Sınıflandırılmış liste** — toplu, ucuz, gece programı/happy hour
   - **QR-only mikro reklam** — sayfa altı, sadece logo + QR
10. **Affiliate katmanı** — Rezervasyon QR'ı tıklanır → kalkaninfo.com üzerinden rezervasyon → komisyon. Reklamveren ödemese bile gelir gelir.
11. **Sezon dışı strateji** — Kasım–Mart: haftalık edisyon + sadece dijital + "Kış Kalkan" niş içerik. Aboneliği kesme, **azalt**.

### 3.4 Tasarım & Marka
12. **Estetik:** Eski broadsheet hissi (serif başlık, ince çizgi grid, beyaz/krem kağıt görünümü) **+** modern okunaklılık. Generic dergi şablonu değil.
13. **Tipografi:** Başlık = serif (Playfair Display / Tiempos), gövde = sans (Inter / IBM Plex Sans).
14. **Marka adı önerisi:** "Kalkan Today" / "Kalkan Günlük" / "The Kalkan Post" — Berkay seçer.
15. **Çok dilli:** TR + EN minimum. Rus/Alman opsiyonel (otel talebine göre).

---

## 4. Teknik Mimari

### 4.1 Stack
- **Şablon motoru:** HTML/CSS → PDF (Puppeteer headless + `print` media query) **veya** React-PDF. Puppeteer önerilir — mevcut stack'le uyumlu.
- **Veri kaynağı:** Supabase tabloları
  - `newspaper_editions` (tarih, tip, dil, mekan_id, pdf_url)
  - `ads` (mekan_id, slot, başlangıç, bitiş, fiyat, qr_id, tıklama_sayısı)
  - `articles` (manşet, gövde, yazar=ai|editor, onaylı_mı)
  - `qr_events` (qr_id, tıklama_zamanı, ip_hash, edition_id)
- **İçerik üretimi:** Claude Haiku API (mevcut concierge ile aynı key)
- **QR:** `qrcode` npm paketi, her reklam için unique slug → `kalkaninfo.com/q/{slug}` redirect + tıklama say
- **Dağıtım:** `/api/generate-edition?date=2026-06-06&type=morning&venue=kalimerakitchen` → PDF döner
- **Arşiv:** Supabase Storage (`newspapers/` bucket) + CDN

### 4.2 Klasör Önerisi
```
kalkan-info/
  newspaper/
    templates/
      base.html              # Ortak grid + tipografi
      morning.html           # Sabah edisyonu
      evening.html           # Akşam edisyonu
      venue.html             # Mekan özel
    components/
      masthead.html          # Logo + tarih + hava
      weather-box.html
      ad-slot.html           # Reklam yerleştirme component'i
      qr-block.html
    generator/
      build.js               # Puppeteer ile PDF üret
      content-ai.js          # Claude Haiku içerik motoru
      ad-placer.js           # Reklam veritabanından slot'a yerleştir
    archive/
      2026/06/06/            # Tarihe göre PDF arşivi
  api/
    newspaper-generate.js    # Cron + on-demand endpoint
    newspaper-track.js       # QR tıklama tracker
  admin/
    newspaper.html           # Editör paneli: önizleme, onay, basım
```

### 4.3 Üretim Akışı (Günlük)
1. **06:00** — Cron: hava + etkinlik + plaj verisi çek
2. **06:15** — Claude Haiku 4 haber + 6 manşet üretir → `articles` (onaylı=false)
3. **06:30** — Editör (Berkay veya partner) admin panelinden 10dk onay
4. **06:45** — `ad-placer.js` aktif reklamları slot'lara yerleştirir
5. **07:00** — Puppeteer her edisyon × her mekan için PDF üretir → Storage
6. **07:05** — Mekanlara WhatsApp/Email link gönderilir, kendi basar
7. **17:00** — Akşam edisyonu için aynı döngü tekrar

---

## 5. Gelir Modeli & Fiyatlandırma (Başlangıç Tahmini)

| Kalem | Fiyat | Hedef | Aylık potansiyel |
|---|---|---|---|
| Manşet sponsoru | ₺500/gün | 30 gün × 1 | ₺15.000 |
| Çeyrek sayfa | ₺200/gün | 4 slot × 30 | ₺24.000 |
| Native advertorial | ₺300/edisyon | 60 (2/gün) | ₺18.000 |
| Sınıflandırılmış | ₺50/satır | 200/ay | ₺10.000 |
| Mekan abonelik | ₺3.000/ay | 10 mekan | ₺30.000 |
| Affiliate komisyon | %10 ortalama | rezervasyon hacmine bağlı | ₺5.000–₺20.000 |
| **TOPLAM TAHMİN** |  |  | **₺102.000–₺117.000/ay** |

**Maliyet tarafı (aylık):**
- Baskı: ₺15.000 (kendi yazıcı + matbaa karışım)
- AI API: ₺2.000 (Claude Haiku ucuz)
- Editör (yarı zaman): ₺15.000
- Dağıtım/lojistik: ₺5.000
- **Net hedef:** ~₺65.000/ay başlangıç, sezon zirvesinde 2–3x.

> **Uyarı:** Bu kafamdan rakam — Berkay'ın Kalkan'daki gerçek mekan sayısı, sezon trafiği ve mevcut reklam pazarı üzerinden 2 hafta içinde **gerçek fiyat keşfi** lazım. 5 mekan ziyaret et, "ayda kaça yer alırsınız" diye sor.

---

## 6. Yasal & Risk Notları

1. **Süreli yayın kaydı** — Basılı dağıtım yapacaksan **Cumhuriyet Başsavcılığı'na süreli yayın beyannamesi** ver (Basın Kanunu m.7). Editör + sorumlu yazı işleri müdürü ata. Berkay olabilir.
2. **KVKK** — Reklamveren mekan verileri = işleme amacı "ticari reklam" olarak aydınlatma metninde. QR'dan toplanan tıklama IP'leri hash'le.
3. **Tüketici Kanunu** — Advertorial'lar açıkça "İLAN" etiketli olmalı. Reklam Kurulu cezası var.
4. **Telif** — AI üretilen görseller için lisans temiz olsun (Stable Diffusion / Pexels / lisanslı). Mekan logoları → mekandan yazılı izin.
5. **Gıda/alkol reklamı** — Alkollü içecek reklamı **basın yayın**da yasak (Tütün ve Alkol Piyasası Düzenleme Kurumu). Gece kulübü reklamı = mekan adı/adresi/etkinlik OK, "viski %50 indirim" YASAK.
6. **Sigorta** — İçerik yanlışlığı / iftira riski için mesleki sorumluluk sigortası (yıllık ~₺3.000) düşün.

---

## 7. Aşamalı Yol Haritası

### Aşama 0 — Şablon (Berkay atacak)
- [ ] Berkay gazete şablonunu atar
- [ ] Şablon HTML/CSS'e çevrilir (1 gün)
- [ ] Puppeteer ile PDF render test edilir
- [ ] 1 örnek edisyon üretilir, A4'e basılır, fiziken görülür

### Aşama 1 — MVP (2 hafta)
- [ ] Supabase tabloları kurulur (`newspaper_editions`, `ads`, `articles`, `qr_events`)
- [ ] Claude Haiku içerik motoru (manşet + 4 haber)
- [ ] Admin panel: önizleme + onay (basit, `admin/newspaper.html`)
- [ ] QR tıklama tracker (`/api/newspaper-track`)
- [ ] 1 sabah + 1 akşam edisyonu canlı, 3 pilot mekan dağıtım

### Aşama 2 — Ticari (1 ay)
- [ ] 5 mekanla satış görüşmesi → 3 abonelik hedef
- [ ] Reklam fiyat listesi (medya kit PDF)
- [ ] Mekan edisyonu (`venue` tipi) otomatik üretim
- [ ] Affiliate link entegrasyonu (rezervasyon QR'ı)
- [ ] Basın Kanunu beyannamesi verilmiş

### Aşama 3 — Ölçek (3 ay)
- [ ] 10+ mekan abonelik
- [ ] Hafta sonu özel edisyon
- [ ] Çok dilli (TR+EN minimum)
- [ ] Plausible event tracking → reklam veriye dayalı satılır
- [ ] Sezon dışı dijital-only haftalık plan

### Aşama 4 — Yan ürün (6 ay)
- [ ] Düğün/etkinlik özel sayı paketi (one-off ₺3.000–₺8.000)
- [ ] "Yıl Sonu Kalkan" yıllık özel sayı
- [ ] Kaş, Patara, Üzümlü için kardeş edisyon

---

## 8. Hemen Yapılacaklar (Şablon Geldiğinde İlk 48 saat)

1. Şablon görsel olarak değerlendir → font/grid/renk çıkar
2. `newspaper/templates/base.html` iskeletini kur, Tailwind veya inline CSS kullan
3. 1 statik örnek PDF üret (sahte içerikle), A4'e basıp fiziken bak
4. Berkay'a "evet bu his" / "şu değişsin" feedback'i için göster
5. Supabase tablo migration yaz (Aşama 1 başlasın)

---

## 9. Açık Sorular (Berkay cevaplamalı)

1. **Marka adı?** "Kalkan Today" mı, "Kalkan Günlük" mü, başka mı?
2. **Baskı kim yapacak?** Yerel matbaa partnership mi, mekanın kendi yazıcısı mı, ikisi karışım mı?
3. **Editör kim?** Berkay mı (10dk onay), part-time biri mi tutulacak?
4. **İlk hedef mekan sayısı?** 3 pilot mu, 10 hedef mi?
5. **Fiyat tabanı?** Yukarıdaki tahminler tutuyor mu, yoksa Kalkan'da reklam pazarı daha küçük/büyük mü?
6. **Dijital sürüm?** PDF link mi, kalkaninfo.com altında okuma sayfası mı, ikisi de mi?
7. **Sezon dışı?** Kış aylarında ne olacak — askıya alma mı, haftalık mı, dijital-only mi?

---

**Not:** Bu doküman canlı. Şablon geldiğinde Aşama 0 başlar, her aşamada bu dosya güncellenir.
