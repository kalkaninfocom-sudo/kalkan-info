# 📊 KALKAN INFO — PROJE DURUMU (Tek Bakışta)

> **Amaç:** Tüm kalkaninfo işlerinin "ne yaptık · nerede kaldık · sıradaki ne"sini tek canlı dosyada toplamak.
> Parça parça çalışıyoruz, çok iş yarım kalıyor — bu dosya kayıp thread bırakmamak için var.
>
> **Son güncelleme:** 2026-07-08
> **Durum kodları:** ✅ bitti & canlı · 🔨 sürüyor · ⏳ bekliyor (sıraya alındı) · ⛔ bloke (canlıya bir şey lazım — ne lazımı yazılı)
>
> Bu dosya **CANLI**'dır: her oturumda güncellenir. Her parça **tek başına çalışır** halde bırakılır; yarım kalsa bile birleşince bütün tamamlanır.

---

## 🗓️ SON OTURUM — 2026-07-08 (Publish fix + Gazete kalite + Öğrenme + IG izleme)

**5 commit push'landı, canlıda.** 4 faz:

- **Phase 0 — Publish bug ÇÖZÜLDÜ (kök neden):** Onaylı postlar `approved`'da çürüyordu — onları yayınlayacak tetikleyici yoktu. Ayrıca "korumalı endpoint'i `IG_CRON_SECRET` ile curl'le" deseni repo genelinde KIRIK (prod secret dış çağrılarla eşleşmiyor → 401; `auto-publish.yml` de sessizce fail ediyormuş). Çözüm: self-contained `scripts/agency/publish-approved.mjs` (Supabase + IG/FB doğrudan, secret-eşleştirme yok) + `.github/workflows/publish-approved.yml` (saatlik). IG env toleransı + tazelik guard'ı (12h). IG/FB token canlı geçerli+kalıcı doğrulandı.
  - ✅ **ÇÖZÜLDÜ (2026-07-08 17:01):** `IG_BUSINESS_ID` + `IG_LONG_LIVED_TOKEN` GitHub Actions secret'larına eklendi. Doğrulama: "Onaylı postları yayınla" workflow'u 17:01'de **success** (17:01 öncesi 16:49 schedule fail idi). Otonom yayın hattı artık uçtan uca çalışıyor.
- **Phase 1 — Gazete kalite ✅:** `sources.mjs`/`build.mjs` — restoran/magazin deterministik seçimi rotasyon+dedup'a çevrildi (`data/gazete-history.json`; 7 gün=7 farklı mekan). Antalya-merkez düzeltildi (`news-aggregator.mjs` REGION_RX + skorlamadan `antalya` çıkarıldı, Antalya-only negatif). Demo "Kaptan" hardcode kaldırıldı. **Agent→gazete köprüsü:** `gazete-editorial.mjs` artık `agency_jobs` (sabah ajan araştırması) + site etkinlik + IG mekan sinyalini kaynak alıyor.
- **Phase 2 — Saatlik öğrenme ✅:** `scripts/agency/agent-learn.mjs` + `learn-rotation.mjs` + `data/agency/reading-list.json` + `knowledge/<id>.json`. Muhabir Poynter/Reuters Institute'tan gazetecilik dersi çıkardı (doğrulandı). Edge Function `runAgent` öğrendikleri prompt'a enjekte ediyor. `schedule.json` 6 kota-güvenli slot (10-22).
- **Phase 3 — IG mekan izleme ✅:** `scripts/ig-venue-watch.mjs` + `data/ig-watch-accounts.json` + business_discovery (canlı test 18 gönderi). Editöryale bağlandı.
  - ⏳ **Berkay:** `ig-watch-accounts.json` — sadece 3 hesap doğrulandı aktif (kalamarbeachclub/kalkanregency/korsankalkan). 11 tahmini ad "Invalid user id" (pasif). Gerçek Kalkan mekan IG adlarını ekle → `active:true`.

**Sıradaki:** (1) ✅ 2 GitHub secret eklendi → otomatik yayın uçtan uca doğrulandı (workflow success). (2) IG hesap adlarını doldur. (3) Sabah gazete akışında rotasyon+editöryal çıktısını canlı gözlemle.

---

## 🧭 1 DAKİKALIK ÖZET

- **Canlı site:** https://kalkaninfo.com — Vercel + Cloudflare DNS, repo PRIVATE. 270+ URL sitemap'te.
- **En aktif cephe (bu hafta):** Gazete + etkinlik takvimi + 6 otomasyon agent'ı (çoğu **commit edilmedi**), Google Maps işletme keşfi (170 işletme canlı), SEO sertleştirme (Faz 1+2 canlı), Street Munch + Çiku demo vitrinleri.
- **En kritik 3 bloke:** (1) **IG/FB token + scraper kararı** — reels & sosyal otomasyon yayını buna takılı. (2) **SerpApi quota dolu** — Google Maps eksik kategoriler + otonom etkinlik. (3) **Resend API key invalid** — newsletter onay maili gitmiyor.
- **Hemen yapılacak:** Bu oturumdaki commit edilmemiş 6-agent çıktısını **tek commit grubu** halinde commit + deploy etmek (aşağıda detay).

---

## 📰 GAZETE & MEDYA

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| Gazete MVP (A4 broadsheet sabah şablonu + Puppeteer PDF) | ✅ | `newspaper/generator/build.mjs`, `newspaper/templates/` | Aşama 0 tamam, örnek edisyon üretildi (`newspaper/archive/2026-06-28/`) | — |
| Gazete ön yüz → **gerçek veri** | ✅ | `newspaper/generator/sources.mjs` | Open-Meteo hava/deniz/UV + Kalkan-yerel haber skoru + Şefin Önerisi + nöbetçi eczane. `--demo` fallback'li | — (commit bekliyor) |
| Gazete DB (editions/articles/ads/placements/qr_events, KVKK IP-hash + RLS) | ✅ | `supabase/` migration (`newspaper qr_slug pgcrypto`) | Migration yazıldı + commit'lendi | `supabase db push` (doğrulanmalı) |
| Magazin arka yüz (gece hayatı) | ✅ | `newspaper/templates/magazine.html` | "Chocolate Club" hero + 3 kart + "Bu Akşam Program". Foto `file://` PDF-garanti | — (commit bekliyor) |
| Gazete reklam satışı (gece hayatı sponsor) | ⏳ | `docs/GAZETE_PROJESI.md` | Planlandı, satış akışı kurulmadı | İş modeli kararı (Berkay) |
| **Ajans → gazete editöryal köprüsü** | ✅ **FIX 2026-07-10** | `scripts/agency/gazete-editorial.mjs`, `scripts/newspaper-daily.mjs`, `.github/workflows/newspaper-daily.yml` | KÖK SORUN: daily pipeline editöryal agent'ı hiç çağırmıyordu → `gazete-today.json` bayat kalıp gazete her gün ham RSS'e düşüyordu. Fix: build'den önce editorial adımı (non-fatal) + workflow'a LLM secret'ları (GROQ/CEREBRAS/NVIDIA/GEMINI, hepsi mevcuttu). Local doğrulandı (groq, editöryal byline) | — (push sonrası bir sonraki 06:00 çalışmasında veya manuel `workflow_dispatch` ile canlı) |
| RSS haber motoru (saatlik refresh) | ✅ | `scripts/news-aggregator.mjs`, `data/haberler.json` | Otomatik `chore(news)` commit'leri akıyor | — (çalışıyor) |
| Bölgesel haber RSS genişletme | 🔨 | `scripts/news-aggregator.mjs` | Agent çalışıyor; RSS'i olan kaynaklar | — |

> Detay yol haritası: `docs/YOL_HARITASI_GAZETE_OTOMASYON.md` (gazete+etkinlik+otomasyon canlı haritası), `docs/GAZETE_PROJESI.md`.

---

## 📣 SOSYAL MEDYA OTOMASYON

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| L1 otonom içerik motoru (trend-scout + content-director + brand-guard) | ✅ kod | `lib/trend-scout.js`, `lib/content-director.js`, `lib/brand-guard.js` | "Brain" katmanı kodlandı + commit'lendi | Runner/cron + telemetri doğrula |
| Pazarlama kanadı (ads-optimizer + social-analyst) | ✅ kod | `lib/ads-optimizer.js`, `lib/social-analyst.js` | Canlı telemetri bağlandı | Çalışma doğrulanmalı |
| Secretary (WhatsApp founder modu) + growth-strategist | ✅ kod | `lib/secretary.js`, `lib/growth-strategist.js` | Haftalık trafik planı üretiyor | WhatsApp entegrasyon doğrula |
| Kendi IG: haber → ajans paylaşımı | 🔨 agent | `scripts/ig-news-card.mjs`, `lib/instagram-publish.js`, `assets/ig-news/` | Kart üretimi hazır | ⛔ **IG token doğrula** + cron/PC runner |
| Kendi IG: yorum/DM oto-cevap | 🔨 agent | `lib/ig-reply.mjs`, `data/ig-replied.json` | Reply polling yazıldı; `api/` 12/12 dolu → webhook yok, polling şart | ⛔ **IG token** + PC runner |
| FB "Friends of Kalkan" güvenli responder | 🔨 agent | `scripts/fb-lead-responder.mjs`, `docs/FB_RESPONDER.md`, `lib/facebook-publish.js` | Onay-akışlı taslak | ⛔ **FB okuma** (Apify ~$30-49/ay, ToS gri) + onay akışı kararı |
| Telegram komut asistanı (telefondan iş buyur) | ⛔ | `lib/telegram.js` (+ memory: ayrı PC polling botu) | Plan→onayla→uygula akışı kodlu | ⛔ **Telegram bot token** (Berkay alacak). Social bot webhook ile çakışmasın → ayrı polling |
| 30 günlük sosyal medya planı + seed | ✅ | `content/social-media-plan-30day.json/.md` | Plan + seed script hazır | — |
| IG/FB post-story HTML şablonları (gece hayatı/villa) | ✅ | `instagram/`, capture scripts | Şablon + capture script | — |

> ⚠️ `lib/` çoğu otomasyon **commit edildi** ama `lib/ig-reply.mjs` ve birkaç script hâlâ untracked — commit grubu bekliyor.

---

## 📅 ETKİNLİK

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| Etkinlik takvimi backbone (recurring + oneoff şema) | ✅ | `data/etkinlik-takvimi.json`, `data/etkinlik-haftalik.json`, `scripts/events-lib.mjs` | 11 seed (hepsi `verified:false` taslak), gün/hafta motoru | — (commit bekliyor) |
| Web `/etkinlikler` sayfası | 🔨 agent | `scripts/build-events-page.mjs`, `etkinlikler/index.html` | Sayfa üretiliyor | **deploy** |
| Gazete "Bugün Kalkan'da" → takvim bağı | ✅ | `newspaper/generator/sources.mjs` (getEventsColumn) | Bağlandı | — |
| Otonom etkinlik toplama (Google) | ⛔ | `scripts/discover-events.mjs` | Script hazır | ⛔ **SerpApi quota dolu** + IG caption scraper kararı |
| Etkinlik materyalleri (yatırımcı/lansman partisi PDF) | ✅ | `etkinlikler/*.pdf`, `*.html`, `make-*.mjs` | PDF + HTML üretildi | — |

---

## 🎬 İÇERİK (REELS / VİDEO)

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| Reels üretim motoru (Remotion, EN+TR, foto-enhance, audio-sync) | ✅ motor | `scripts/_build-kalkan-reel.mjs`, `_enhance-photos.mjs`, `remotion/src/KalkanReel.tsx` | Motor çalışıyor, işlenmiş gerçek Kalkan fotoları | — |
| site-intro reel (Berkay beğendi) | 🔨 | `dist/site-intro/site-intro-silent.mp4` + `voice.mp3`, `scripts/_publish-site-intro.mjs` | Render edildi, **YAYINLANMADI** | ⛔ **IG token** (publish) |
| "7 Plaj" reel EN+TR | 🔨 | `content/reel-themes/beaches.json`, `remotion/` | dist'te hazır, **YAYINLANMADI** | ⛔ **IG token** |
| Antik kentler reels — Patara EN/TR sesli pilot | 🔨 | `scripts/_voiceover-patara.mjs`, `scripts/lib/tts-free.mjs`, `assets/audio/ambient-bed.mp3` | ✅ TR native ses + müzik SIFIR-MALİYET çözüldü (edge-tts + telifsiz bed, uçtan uca test). Pipeline TR varsayılan | Sadece Berkay 4-5 foto/kent verecek (foto olunca batch) |
| 10 antik kent EN+TR senaryo | ✅ metin | `content/antik-reels.json`, `docs/antik-kentler-viral-facts.md` | Senaryolar hazır | Foto + ses (yukarıdaki blokerlar) → 20 reels batch |
| Webapp tanıtım videosu | ✅ | `scripts/_build-webapp-tour.mjs`, `_capture-webapp-tour.mjs`, `dist/site-tour/` | Pipeline + render + upload | — |
| Reel backlog / loop motoru | 🔨 | `content/reel-backlog.json`, `content/REEL_LOOP.md`, `scripts/_reel-loop-tick.mjs` | Otomatik üretim loop'u taslak | IG token + runner kararı |
| Temmuz reels planı + WhatsApp foto kampanyası | ✅ plan | `data/reels-plan-temmuz-2026.json`, `data/whatsapp-photo-campaign.json` | Plan + foto toplama kampanyası | Berkay foto toplayacak |

> ✅ **IG token (B1) çözüldü** → reels yayın kilidi açık. ✅ Antik reels müzik + TR ses de sıfır-maliyet çözüldü (edge-tts + telifsiz bed). Kalan tek girdi: Berkay'ın kent fotoğrafları.

---

## 🔍 SEO & BÜYÜME

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| SEO Faz 1 (canonical non-www, og:url, sitemap normalize, H1 alt başlık 5 dil) | ✅ | `scripts/build-sitemap.mjs`, sayfa şablonları | Canlı. Vercel primary domain non-www'ye çevrildi | — |
| SEO Faz 1 JSON-LD geo + aggregateRating fix | ✅ | restoran/otel/villa/plaj şablonları | 210 sayfa, 0 invalid | — |
| SEO Faz 2 iç linkleme ("Benzer Mekanlar" + kart→detay anchor) | ✅ | restoran/otel/villa/plaj | Canlı | — |
| IndexNow anlık indeksleme (Bing/Yandex/DuckDuckGo) | ✅ | IndexNow key + submit script | 275 URL bildirildi | — |
| Google Search Console submit | ⏳ | — | Henüz submit edilmedi | Berkay: Search Console'a sitemap submit (doğrulanmalı) |
| Plausible + Microsoft Clarity analytics | ✅ | `api/`, tracker | 20+ event + UTM; Clarity `wtqo7vdaoe` | Plausible Goals manuel kurulum (Berkay, ~3dk) |
| 5 dil switcher (TR/EN/DE/RU/FR) | ✅ | i18n, 22+ sayfa | Canlı | Yeni içerik çevirisi için **Anthropic local key** geride (prod'da geçerli) |
| AI Concierge (Claude Haiku 24/7) | ✅ | `data/concierge.json`, `lib/anthropic.js` | Streaming canlı | — |
| Newsletter backend (onay maili) | ⛔ | `api/newsletter-confirm.js`, `api/welcome-email.js` | Migration + Edge Function deploy edildi | ⛔ **Resend API key invalid** → confirm maili gitmiyor (rotate gerek) |

---

## 🗂️ VERİ & İŞLETMELER

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| Google Maps keşif pipeline (discover/merge/enrich/generate) | ✅ | `scripts/discover-businesses.mjs`, `discover-all-kalkan.mjs`, `enrich-discovered-photos.mjs`, `generate-business-pages.mjs` | KVKK uyumlu (rating/sayı evet, yorum metni cache YOK) | — |
| 170 Google Maps işletme detay sayfası | ✅ | `data/restoranlar.json` (+145), `data/hizmetler.json` (+25 berber) | Canlı, sitemap +170 (100→270) | — |
| Berber kategorileri (Erkek 17 / Bayan 7 / Unisex 1) | ✅ | `hizmet/`, `data/hizmetler.json` | 3 kart, ana sayfadan bireysel gizlendi | — |
| SerpApi eksik 7 kategori + foto enrich | ⛔ | `scripts/enrich-discovered-photos.mjs`, `data/discovered/` | 429 ile durdu | ⛔ **SerpApi quota/plan** ($75/ay 5K query) |
| Oteller (15) + villa detayları | ✅ | `data/oteller.json`, `data/villalar.json` | 15 otel + villa sıfırdan bölüm canlı | 4 otel isim mismatch onayı (doğrulanmalı) |
| Plajlar / turlar / aktiviteler / tekne operatörleri | ✅ | `data/plajlar.json`, `turlar.json`, `aktiviteler.json` | 15 tekne operatörü, plaj/tur sayfaları | — |
| Nöbetçi eczane otomatik | ✅ | `scripts/fetch-eczane.mjs`, `data/eczane*.json` | Otomatik çekiliyor | — |
| Website'i eksik işletme lead listesi | 🔨 | `data/leads-website-eksik.json`, `data/outreach-whatsapp-mesajlari.md` | Lead + outreach mesajları hazır | Outreach kararı (Berkay) |

---

## 🏪 VİTRİN / DEMO (satış için örnek mekan siteleri)

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| Çiku çikolata demo vitrini | ✅ canlı | `demo/ciku/` (kaynak `C:\Users\socie\ciku\`) | kalkaninfo.com/demo/ciku/ — 205 ürün, WhatsApp sipariş, 3 dil, admin (şifre ciku2026). Ders: cleanUrls → statik `<base href>` şart | — |
| Street Munch restoran sayfası (premium motionsites) | ✅ canlı | `restoran/` Street Munch | Tam menü (12 poster + HTML 60 ürün), 5 dil, hero | — |
| Mabeyn Ocakbaşı örnek landing (satış taslağı) | ✅ mockup | `mockups/` | Satış taslağı | Berkay satışa sunacak |
| Kartvizit landing + PDF | ✅ | `kartvizit/`, `scripts/build-kartvizit-pdf.mjs` | Üretildi | — |
| **Dijital ajans satış teklif paketi** | ✅ commit `f11cada` | `satis-demo/` (+`urunler/` 8 hizmet sayfası + PDF) | Açık krem teklif sayfası + `?isletme=<Ad>` kişiselleştirme (hero/mock kart/başlık/WA mesajı otomatik dolar), gerçek WA no. Her müşteriye özel link: `/satis-demo/?isletme=Öz%20Adana` | — (deploy sonrası canlı; müşteriye link gönderilebilir) |
| **↳ Gerçek-veri kişiselleştirilmiş teklif üretici** | ✅ commit `d00f32e` | `satis-demo/build-teklif.mjs` → `teklif/<slug>.html` | 259 işletme verisinden (restoran/otel/hizmet/villa) gerçek boşluk analizi (Google yorum sayısı/foto/web/IG) → kişisel before/after. `node satis-demo/build-teklif.mjs "Omar's Kokobüs"` (--list ile ara). Doğrulandı: Omar's ⭐4.6·82 yorum → "82'den 300+ yoruma". Sonraki fikir: teklif başına Plausible tracking + gerçek-fotolu "fotoğraflı gün" | — (deploy sonrası canlı: `/satis-demo/teklif/<slug>.html`) |

---

## 🏗️ ALTYAPI

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| Hosting (Vercel Hobby + Cloudflare DNS) | ✅ | — | Canlı, primary domain non-www | — |
| **Vercel api/ limiti DOLU (12/12)** | ⛔ sınır | `api/*.js` | Yeni webhook eklenemez | Yeni otomasyonlar **script/cron** olmalı (webhook değil) |
| Vercel cron (2 aktif) | ✅ | `api/cron-rebuild.js`, `api/cron-refresh-ig-token.js`, `api/cron-weekly-plan.js` | Cron sayısı 2'ye düşürüldü (Hobby limiti) | — |
| Supabase (DB + Auth + Edge Functions + RLS) | ✅ | `supabase/` | Migration'lar yazıldı | Yeni migration'lar için `supabase db push` (doğrulanmalı) |
| Repo güvenliği | ✅ | — | PRIVATE, security commit'leri canlı | Secret rotate listesi (Twilio/Resend/Supabase PAT) — Resend hâlâ açık |
| Agent şirketi iskeleti | 🔨 | `COMPANY/`, `lib/*` personalar | 13 persona + Capacitor iskelet | Üretim entegrasyonu |
| Mobil (Capacitor) | ⏳ | `mobile/` | İskelet | — |
| Test/CI (ESLint + Prettier + Vitest + CI) | 🔨 | repo kökü | İskelet kuruldu | devDeps install (doğrulanmalı) |

---

## ⛔ BLOKE / KARAR BEKLEYEN (toplu — Berkay)

| # | Bloke | Neyi durduruyor | Çözüm / karar |
|---|-------|-----------------|---------------|
| ~~B1~~ | ✅ **ÇÖZÜLDÜ (2026-07-08)** — IG token + business ID GitHub secret'larına eklendi | ~~Tüm reels yayını + IG otomasyon~~ | Publish workflow success doğrulandı. Bu satır bir sonraki oturumda silinebilir. |
| B2 | **SerpApi quota dolu** | Google Maps eksik 7 kategori + foto enrich, otonom etkinlik (#9) | Saat başı reset bekle **veya** plan upgrade (~$75/ay, 5K query) |
| B3 | **Resend API key invalid** | Newsletter onay/welcome maili gitmiyor | Resend key rotate + Vercel env güncelle |
| B4 | **FB/IG scraper kararı (sahip olunmayan profil)** | FB responder (#10) okuma, IG caption etkinlik scrape | Apify (~$30-49/ay, ToS gri) mı, manuel mı, atla mı? |
| B5 | **Telegram bot token** | Telefondan komut asistanı | Berkay token alıp config'e koyacak (social bot'tan ayrı polling) |
| ~~B6~~ | ✅ **ÇÖZÜLDÜ (2026-07-08, sıfır-maliyet)** — TR native ses = edge-tts (`scripts/lib/tts-free.mjs`), müzik = telifsiz `assets/audio/ambient-bed.mp3`. ElevenLabs/plan upgrade GEREKMİYOR | ~~Antik reels batch~~ | Kalan: Berkay kent fotoğrafları verecek. Ayrıca sızmış EL anahtarı ROTATE edilmeli (koddan temizlendi, git geçmişinde) |
| B7 | **Anthropic local key geride** | Yeni içerik çeviri/AI işleri local'de | Prod'da geçerli; local manuel test için key güncelle (opsiyonel) |
| B8 | **api/ 12/12 dolu** | Yeni Vercel webhook | Otomasyonları script/cron olarak yaz (mimari karar, çözüldü) |

---

## ▶️ SIRADAKİ NET ADIMLAR (öncelik sırası)

1. **COMMIT GRUBU:** Bu oturumun gazete+etkinlik+otomasyon çıktıları **henüz commit edilmedi** (`git status`: `newspaper/generator/sources.mjs`, `magazine.html`, `etkinlikler/index.html`, `data/etkinlik-*.json`, `lib/ig-reply.mjs`, `content/reel-*`, `docs/*` untracked). Tek mantıklı commit grubu halinde commit et.
2. **Web `/etkinlikler` deploy** — sayfa hazır, sadece deploy (#5).
3. ~~**B1 IG token doğrula**~~ → ✅ ÇÖZÜLDÜ (2026-07-08): secret'lar eklendi, publish workflow success. Reels + IG otomasyon kilidi açık.
4. **B3 Resend key rotate** → newsletter hattı çalışır hale gelir (1 değişken).
5. **B2 SerpApi kararı** → Google Maps verisi + otonom etkinlik tamamlanır.
6. **Google Search Console'a sitemap submit** (SEO Faz 2 kapanışı).
7. **B4/B6 karar** → FB responder + antik reels batch'i için (para/ToS kararı).

---

## 📌 NOTLAR

- Bu dosya **canlı**; her oturumda güncellenir. Bir işi bitirince/ilerletince satırını güncelle, blokeri çözünce B# satırını sil.
- Her parça **tek başına çalışır** halde bırakılır — yarım kalsa bile sistem bütününü bozmaz.
- "(doğrulanmalı)" etiketli satırlar memory/commit mesajından çıkarıldı, canlı testle teyit edilmedi.
- İlgili canlı alt-haritalar: `docs/YOL_HARITASI_GAZETE_OTOMASYON.md`, `docs/GAZETE_PROJESI.md`, `docs/SEO_STRATEJI.md`, `docs/INSTAGRAM_AUTOMATION.md`, `MASTER_PLAN.md`, `ROADMAP.md`.
