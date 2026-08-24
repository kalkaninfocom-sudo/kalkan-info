# 🗺️ YOL HARİTASI — Denetim + Ürün-Net-Çalışma Turu (2026-08-24)
### Sonraki oturum: ÖNCE BUNU OKU

> Bağlam: Bu oturumda (a) gazete güvenilirliği çözüldü, (b) kalkaninfo.com 5-agent A-Z denetimi yapıldı, (c) "ürün net çalışsın" turu ile en kritik bulgular canlıya alındı. **8 PR merge edildi (#57-65).**

---

## ✅ BU OTURUMDA BİTEN (canlı, main'de)

### Gazete güvenilirliği (bayrak gemisi 3 gün sessizce düşüktü → çözüldü)
- **Kök neden 1:** reel adımı 20dk job-timeout'a takılıp job'ı cancel edince Commit&push SKIP oluyordu → gazete üretiliyor ama yayınlanmıyordu (08-22..24 kayıp). **Fix (#53):** commit+heartbeat reel'lerden ÖNCE + timeout 60 + reel `continue-on-error`.
- **Kök neden 2:** i18n çeviri her alanı her sağlayıcıda 60s dener; degrade free-tier'da 30-45dk → job timeout. **Fix (#57):** `I18N_LLM_ORDER=gemini,groq` bounded.
- **KALICI çözüm (#59):** `GAZETE_SKIP_I18N` — TR ÖNCE yayınlanır (çeviri kritik yolda değil), diller commit sonrası best-effort. Gazete artık free-tier ne olursa olsun HER GÜN çıkar. Cache ısındıkça hızlanır.
- **İzleme:** heartbeat/baskı-provası · Healthchecks.io dead-man's-switch (`GAZETE_HEALTHCHECK_URL` secret EKLİ) · `line-heartbeat.yml` (günlük tüm hat provası) · health-check gemini-first+retry.

### Site denetimi (5 rapor + master — `C:\Users\socie\SITE-AUDIT-*.md`, `SITE-AUDIT-MASTER.md`)
Boyutlar: SEO/GEO · İçerik/i18n · Güvenlik · UX/Mobil · Kod mimarisi. ~60 bulgu.

### "Ürün net çalışsın" fix'leri (canlı)
- **#60** Güvenlik immutable-triggers (stays/marketplace/jobs/reviews tahrif açığı) — *migration YAZILDI, `db push` BEKLİYOR* · `>>>` nav artefaktı + CSP (deniz sıcaklığı/GA açıldı).
- **#61** i18n sitemap üretici (318→386 URL, hreflang, dil URL'leri keşfedilebilir) + build-all'a bağlı.
- **#62** hreflang `?lang=` → `/en/` dizin şeması (kök 37 sayfa) — en büyük i18n SEO bug'ı.
- **#63** Mobil consent/install banner login'i BLOKE ETMİYOR (slim ≤120px, auth'ta install gizli) + bayat/geçmiş etkinlik filtrelendi + antik-kentler hreflang tamamlama.
- **#64** Formlara label + inline validation (`js/form-validate.js`; login/register/ilan-ver/kirala-ekle/tatil-asistani) · içerik çeviri aracı (`translate-venue-summaries.mjs` + workflow).
- **#65** venue-translate workflow secret adı fix (GOOGLE_GEMINI_API_KEY) → **çeviri workflow'u TETİKLENDİ** (144 restoran + 24 plaj çevriliyor, bitince otomatik commit).

---

## ⏳ BEKLEYEN — BERKAY'IN 2 AKSİYONU
1. **`supabase db push`** → `20260824120000_security_immutable_fields.sql` (+ `20260824000000_stays.sql`). Gerçek tahrif açığını kapatır. TEK gerçek açık kalan güvenlik işi. *(Not: named `$` blok var → db push, elle paste değil.)*
2. **Otomatik run'ları izle:** (a) içerik çeviri run'ı (168 mekan, birkaç saat, otomatik commit) · (b) yarın 07:45 TR gazete scheduled run = warm-cache self-sustain kanıtı (Telegram'a bak).

---

## 🔜 SONRAKİ TUR — "altyapı olgunlaşması" (ürün çalışıyor, şimdi büyüme zemini)
Denetimde "kırık" DEĞİL "iyileştirme" olan büyük maddeler (`SITE-AUDIT-MASTER.md` §çözüm yol haritası):
- **api/ 12/12 tavanı** — yeni backend (iyzico/rezervasyon) deploy EDİLEMEZ. 3 cron→router değil (grounding: sadece 2 cron, ig-token ölü değil) → newsletter/welcome-email birleştirme. **Marketplace'in ÖN KOŞULU.**
- **Çift business veri-kaynağı** — `data/restoranlar.json` vs Supabase `ai_businesses` → AI bayat bilgi verebilir. Tek kanonik kaynak.
- **Kopya-kod** — env-yükleme 42×, telegram 28×, reel script 14× → `scripts/_lib/env.mjs` + `lib/telegram.js` + `reel-pipeline.mjs`. Ölü Firebase stack → `_archive/`.
- **Tasarım/IA** — 5 farklı header birleştir · ilanlar/pazar-yeri/pazarlar isim karışıklığı · çift villa sayfaları (`-site`/`-visionary`) tekle.
- **Küçük i18n kalan** — index/hakkimizda title lokalize · TR-in-langdir villa/rehber sayfaları · patara-360 hreflang.

## 📍 MARKETPLACE (Airbnb-alternatifi — büyüme hattı, gelecek yıl foundation)
Stays MVP kodu hazır (`kirala*.html` + `stays` şeması, PR #50, foundation güvenli). Sıra: api-tavanı aç → envanter (tasarım hazır `INVENTORY-SYSTEM-DESIGN.md`) → müsaitlik → rezervasyon → ödeme (iyzico).

---
**Referans dosyalar (`C:\Users\socie\`):** SITE-AUDIT-MASTER + 5 rapor · SOLUTION-*.md · KALKANINFO-ISLETME-SISTEMLERI.md · HABER-AJANSI-ISLEME-SISTEMI.md · INVENTORY-SYSTEM-DESIGN.md
