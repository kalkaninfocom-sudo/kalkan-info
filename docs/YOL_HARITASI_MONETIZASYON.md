# 🗺️ KALKAN INFO — MONETİZASYON YOL HARİTASI (canlı)

> **Tez:** Yeni özellik EKLEMİYORUZ. Canlı omurgayı **paraya + tekrarlanabilir satış sistemine** çeviriyoruz.
> **Bu dosya CANLI** — her oturumda güncellenir. Master operasyonel durum: `docs/PROJE_DURUMU.md`. Bu dosya = ileri plan.
> **Son güncelleme:** 2026-08-08
> **Kodlar:** ✅ bitti&canlı · 🔨 sürüyor · ⏳ sırada · ⛔ bloke (ne lazımı yazılı) · 🟢/🟡/🔴 kanıt seviyesi

---

## 🧭 COLD-START — YENİ OTURUM İLK BUNU OKU (nerede kaldık, 2026-08-07)

### 🆕 2026-08-07 (bu oturum, devam) — SATIŞ SAHAYA + DEMO SİTE REDESIGN

**A) Satış motoru sahaya taşındı — PR #22 ✅ MERGED + hatırlatıcı CANLI:**
- `docs/SATIS-ARAMA-LISTESI.md` — 23 demo-hazır işletme, "açıklık" skoruna sıralı (telefon + demo linki + teklif `?slug=` + hazır WhatsApp mesajı). Kaynak: `restoranlar.json` + `demo/` + `satis-demo/teklif-data.json`.
- `docs/SATIS-ARAMA-KARTI.md` — saha kartı: açılış scripti, "ne çalışması?" cevabı, bugünkü 5 lead (Zeugma→Adams→Rose→Mantıcı→Luna), **skorbord + görüşme logu** (Berkay tek satır yazar → Claude `satis-takip.json`'u günceller).
- `scripts/agency/build-satis-pdf.mjs` — mekana özel **"Dijital Durum Raporu" PDF** (teklif before/after + gerçek foto + QR, markalı A4). `--today`/`--all`/`<slug>` → `dist/satis-pdf/` (gitignore). 24 PDF üretildi, görsel doğrulandı.
- `scripts/agency/satis-reminder.mjs` + `.github/workflows/satis-reminder.yml` (09:00+16:00 TR) + `data/satis-takip.json` — **Telegram satış hatırlatıcı** (kimi ara/takip + skorbord). health-check deseni, Vercel'e DOKUNMAZ.
- ✅ **PR #22 MERGED (2026-08-08).** Workflow main'de aktif; manuel tetikleme UÇTAN UCA doğrulandı → Telegram'a gerçek mesaj gitti ("✅ Hatırlatıcı gönderildi", secret'lar mevcut). Cron **her gün 09:00 + 16:00 TR** otomatik. Döngü: Berkay arama sonucunu tek satır yazar → Claude `satis-takip.json`'u günceller → sonraki hatırlatıcı yansıtır.

**B) Demo site şablonu BAŞTAN yazıldı (`scripts/agency/build-venue-site.mjs`) — Berkay BEĞENDİ 🟢 → PR #23 AÇIK (Berkay merge edecek):**
- Koyu tema → **AÇIK golden-hour** (marka kuralı). Fraunces + Inter.
- **5 dil switcher** (TR/EN/DE/RU/FR): arayüz statik sözlük + mekan içeriği (tagline/hakkında) cheap-llm çevirisi (yerelde çalıştı). Menü öğe adları orijinal.
- **Mobil-öncelikli yapışkan dock** (Ara/WhatsApp/Yol tarifi).
- **3 hero modu** (`data/venue-hero.json`): `text` (marka renginde yazı) · `banner` (yemek fotosu + marka-rengi duotone) · `photo`. Zeugma → banner (g4 mangal fotosu + kırmızı `#9A2A22` duotone).
- **Zengin bölümler:** menü kartları (verisi olan mekanda foto+fiyat) / "Menüyü WhatsApp'tan iste" CTA (yoksa) · fotoğraflı çalışma saatleri · galeri · yorum · konum · rezervasyon.
- **22/24 demo yenilendi** (atlandı: `the-view-terrace` mükerrer, `villa-tur` restoran verisi yok).
- **DERS:** 24 demonun sadece 1'inde (Omar's) gerçek menü var → grounded-zengin uyarlama (referanstaki menü-daireleri/teslimat bölümü bizde boş çıkardı; teslimat→rezervasyon).
- **Bug fix (kök):** reveal görünürlük class'ı `in` ↔ hero içerik kutusu `.in` çakışması rozet padding'ini bozuyordu → `in`→`vis`.

**C) Kaldığımız yer — sıradaki (öncelik):**
- **(A)** Banner'ı satış hedef mekanlarına yay (Adams/Rose/Luna/Mantıcı — her mekana iyi yemek fotosu seç). Zengin his asıl bundan. `data/venue-hero.json`'a ekle → `build-venue-site.mjs <slug>`.
- **(B)** ✅ PR #23 AÇILDI (venue-site redesign, 22 demo). **Berkay merge edecek** → Vercel deploy → `kalkaninfo.com/demo/<slug>/` canlı. Komut: `gh pr merge 23 --repo kalkaninfocom-sudo/kalkan-info --squash`.
- **(C)** Menü verisi olan mekanları zenginleştir (menü girişi = satılan pakete dahil veri işi).
- **Ana hedef değişmedi:** 255 lead **outreach** (satış motorunu ateşle) — Berkay Zeugma'dan başlayacak; sonuçları tek satır bildir → skorbord.

**Not (localhost):** benim başlattığım arka-plan sunucusu turlar arası ortamca öldürülüyor → kalıcı bakmak için masaüstü **`Kalkan-Demo-Baslat.bat`** (çift-tık; siyah pencere açık kaldıkça yaşar).

---

### 📌 Daha önce (Faz 0 / Lyra) — açık thread'ler
Önceki oturumda yapılanlar ve açık thread'ler (kimse kaybetmesin):

1. **Lyra `lyra-live` → 🟢 CANLI.** Kaynağı repoda YOKTU, yeniden yazıldı + Supabase'e deploy edildi + production doğrulandı (eczane+etkinlik HTTP 200). Branch'ten bağımsız çalışıyor. ⏳ Tek kalan: **Berkay ElevenLabs canlı çağrı testi** (araç sesli akışta tetikleniyor mu).
2. **`fix/faz0-otomasyon` branch'i (MERGE EDİLMEDİ) — artık 3 grup iş içeriyor:**
   - **(a) Faz 0 otomasyon:** çift-post fix, ölü scheduler görevi silme, etkinlik-kartı dedup, doküman düzeltme.
   - **(b) Deniz→Lyra rebrand (2026-08-07):** `rehber.html`+`rehber-hd.html` UI Lyra; backend "Deniz Ops"→"Lyra Ops" (`git mv`: `lyra-ops-report/call.mjs`, `lyra-autonomous.yml`, `lyra-knowledge-base.md`, `REHBER_LYRA_DURUM.md`). Sea/mekan "Deniz"lerine dokunulmadı. Bayat ref 0 (doğrulandı).
   - **(c) Sesli-başlatma hızı:** `rehber.html` ses+mic Simli video ile PARALEL → ~1-2 sn'de konuşma (yüz arkadan). Sözdizimi ✓, WebRTC gerçek-cihaz testi Berkay'da.
   - ⏳ **Merge `fix/faz0-otomasyon` → `main-deploy` = Vercel canlı deploy** (Berkay onayı). Merge edilene kadar (a)(b)(c) canlı DEĞİL. `PROJE_DURUMU.md`'de Berkay'ın önceki commit'siz değişiklikleri de var — commit ederken karışmasın.
   - **Kalan insan aksiyonları:** Berkay sesli-akış gerçek-cihaz testi · ElevenLabs panelinde "Deniz Ops" ajan adını Lyra Ops'a çevir (geçerli EL key lazım, `.env.local` 401).
   - **NOT (perf):** Ana sayfa yükü ÖLÇÜLDÜ → zaten optimize (defer'li + edge-cache + brotli + preconnect). Yeniden "yavaş" diye kurcalama; asıl gecikme sesli-başlatmaydı (çözüldü).
3. **Faz 1 fiyat KİLİTLİ:** Dijital-kimlik SaaS · **3-4k TL/ay · 6 ücretli/6 ücretsiz.** (Kesin rakam 3.000/3.500/4.000 hâlâ netleşmedi — teklife gömerken sor.)
4. **Faz 1.2 tahsilat → ⛔ iyzico onayı bekleniyor.** Berkay iyzico'ya **bireysel Link** başvurdu. **Onay + API anahtarları gelince** → iyzico Edge Fn tahsilat hattını kur (aşağıda 1.2). Şirket şart değil (doğrulandı); düzenli gelirde şahıs şirketi + fatura.
5. **İlk hedef müşteri:** Zeugma (4.7★/729 yorum, IG/web yok, demosu hazır). Referans: lamorakalkan.com.

**→ Bir sonraki insan aksiyonu:** iyzico onayı gelince Berkay API anahtarlarını verir → Faz 1.2 başlar.

---

## 0. BASELINE — 2026-08-07 disk-doğrulamalı gerçek durum (bunu baz al)

**Kanıt seviyeleri (dokümana değil DİSKE göre):**
- 🟢 **LIVE/VERIFIED:** kalkaninfo.com (Vercel+Cloudflare, non-www, 270+ URL), `lyra-chat` (Groq, text konsiyerj), `lyra-live` (eczane+etkinlik, 2026-08-07 deploy+doğrulandı), AI Concierge (Haiku), Marketplace, SEO Faz 1+2, satış-demo motoru (259 işletme boşluk analizi), Çiku demo, La Mora (ayrı repo/CF Worker), gazete/reels/briefing otomasyonları (dedup'lı).
- 🟡 **BUILT-NOT-VERIFIED:** ElevenLabs/Twilio Lyra sesli çağrı (E2E test yok), etkinlik reel v2, venue-site jeneratörü.
- 🔴 **PLANNED/MISSING:** ödeme/tahsilat, rezervasyon/işletme-arama (Lyra Faz 2), komisyon, Concierge OS.

**Sabit mimari kısıt:** Vercel Hobby **12/12 api DOLU + 2/2 cron DOLU** → yeni iş **Supabase Edge Fn** veya **GitHub Actions**. `main-deploy`'a commit = otomatik canlı deploy.

**Kaldıraç:** 259-işletme gerçek boşluk-analizi motoru + 5 sıcak lead + La Mora (kapanmış tek gerçek vaka, canlı referans).

---

## FAZ 0 — Otomasyon temizliği ✅ BİTTİ (2026-08-07)

Amaç: paraya geçmeden önce sistemin yalan söylemesi/çift-post/tekrar-içerik durdurulsun. (Detay: `PROJE_DURUMU.md` 2026-08-07 bloğu.)
- ✅ **`lyra-live` yeniden yazıldı + deploy + production doğrulandı** (Lyra araçları gerçekten canlı). Branch'ten bağımsız CANLI.
- ✅ Çift-post kapatıldı (tek yayıncı `publish-approved.mjs`) · ✅ ölü scheduler görevi silindi · ✅ etkinlik kartı dedup · ✅ doküman gerçeğe çekildi.
- **Nerede kaldık:** kalem 2-5 `fix/faz0-otomasyon` branch'inde, working-tree'de. ⏳ **KALAN:** (a) Berkay Lyra canlı çağrı testi, (b) `fix/faz0-otomasyon` → `main-deploy` merge (kalem 2-5 canlıya çıkar).

---

## FAZ 1 — Satış makinesini kilitle 🔨 SIRADAKİ (en yüksek değer)

Tekrarlanabilir satış = **1 teklif + 1 fiyat + 1 tahsilat + kanıtlanmış huni.**

- ✅ **1.1 Fiyat KİLİTLENDİ (2026-08-07):** Resmi ilk teklif = **Dijital-kimlik SaaS · 3-4k TL/ay, 6 ay ücretli / 6 ay ücretsiz, sürekli güncelleme.** Hacim modeli (259 işletme envanterine uygun). Diğer modeller (10-15k retainer, La Mora kurulum+aylık, $ SaaS) rafta.
- 🔨 **1.2 Tahsilat mekanizması kur** — TL için şu an **HİÇ YOK**. Öneri: **iyzico ödeme-linki** (TL, Türk işletme, tekrarlayan abonelik derdi yok → 6-aylık paketi tek ödeme-linkiyle tahsil et). Mimari: **Supabase Edge Fn** (Vercel dolu).
  - ⛔ **BLOKE (2026-08-07):** Berkay **iyzico'ya BİREYSEL Link başvurdu → ONAY BEKLENİYOR.** Onaylanınca API anahtarlarını (iyzico API key + secret) verecek → Edge Fn'i kurup bağlarım. *(Doğrulandı: iyzico Link için şirket şart değil, bireysel yeter. Detay: `basvuru` yardım merkezi.)*
  - ⚠️ **Fatura/vergi notu:** Bireysel = ilk 1-2 müşteriyi test için yeter, ama işletmeler **fatura** ister → düzenli gelire dönünce **şahıs şirketi** aç (muhasebeciyle 1 gün, e-Fatura yükümlülüğü). Mali müşavire teyit ettir.
  - **Anahtar gelene kadar kurulabilecekler (anahtarsız):** Edge Fn iskeleti + teklif→ödeme akışı + fiyatın (3-4k TL, 6+6) `satis-demo`/teklif motoruna gömülmesi.
- ⏳ **1.3 Huniyi KANITLA** — 5 sıcak lead'den (Zeugma 4.7★/729 yorum, IG/web yok, demosu hazır) **ilk ödeyen 1 müşteri**. Her aramada referans: lamorakalkan.com. İlk "evet" → `deploy-venue-site.mjs`.
- **Çıktı ölçütü:** 1 ödeyen müşteri + çalışan tahsilat = huni artık "kanıtlanmış kaldıraç".

---

## FAZ 2 — Teslimatı ürünleştir ⏳ (La Mora'yı tekrarlanabilir yap)

La Mora bir maraton sürdü; tekrarlanabilir değil. Amaç: **tek komutla teslim.**
- ⏳ `venue-site generator` + `scripts/agency/deploy-venue-site.mjs` → grounded veri + admin + domain paketini tek akışta üret/deploy et. **Yeni build değil, mevcut aracı ürünleştirmek.**
- **Çıktı ölçütü:** yeni müşteri sitesi < yarım gün, elle maraton yok.

---

## FAZ 3 — Outreach'i sistematikleştir ⏳

Motor var, **süreç** yok.
- ⏳ 259-işletme boşluk analizi → haftalık otomatik outreach + kişisel demo-link + takip (GitHub Actions cron). Mevcut: `data/satis-takip.json`, `satis-reminder.mjs`, `SATIS-ARAMA-LISTESI.md` (working-tree'de untracked — değerlendir).
- **Çıktı ölçütü:** haftada sabit N aranmış lead + dönüşüm ölçümü (cookieless Plausible zaten var).

---

## 🔒 Bilinçli ERTELENENLER (bugün değil — risk/karar)
- İkiz scriptler (`fb-page*`/`basket-publish*`) tekleme — çağrı-haritası gerekli.
- `scheduler.mjs:43` hardcoded publishable key (public tier, düşük öncelik).
- Lyra Faz 2 (telefonla işletme arama/rezervasyon) — +90 Twilio + tahsilat sonrası.

---

## ▶️ SIRADAKİ NET ADIM
**⛔ iyzico onayı bekleniyor** (Berkay bireysel Link başvurdu). Top Berkay'da: onay + API anahtarları gelince haber verecek.
- **Onay gelince (Berkay):** iyzico API key + secret'ı ver → ben Faz 1.2'yi (Edge Fn tahsilat + teklif→ödeme akışı) kurarım.
- **Paralelde yapılabilir (bekleme gerektirmez):** (a) `fix/faz0-otomasyon` merge (kalem 2-5 canlıya), (b) Lyra canlı çağrı testi, (c) kesin aylık rakam kararı (3.000/3.500/4.000).
- **Sonra 1.3:** Zeugma'dan ilk ödeyen müşteri.
