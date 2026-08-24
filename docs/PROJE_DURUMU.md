# 📊 KALKAN INFO — PROJE DURUMU (Tek Bakışta)

> **Amaç:** Tüm kalkaninfo işlerinin "ne yaptık · nerede kaldık · sıradaki ne"sini tek canlı dosyada toplamak.
> Parça parça çalışıyoruz, çok iş yarım kalıyor — bu dosya kayıp thread bırakmamak için var.
>
> **Son güncelleme:** 2026-08-24
> **Durum kodları:** ✅ bitti & canlı · 🔨 sürüyor · ⏳ bekliyor (sıraya alındı) · ⛔ bloke (canlıya bir şey lazım — ne lazımı yazılı)
>
> Bu dosya **CANLI**'dır: her oturumda güncellenir. Her parça **tek başına çalışır** halde bırakılır; yarım kalsa bile birleşince bütün tamamlanır.

---

## 📁 DOKÜMAN REHBERİ (hangisine güven)

> **Bu dosya (`PROJE_DURUMU.md`) TEK CANLI KAYNAKTIR.** Diğer yol haritaları alt-detay ya da arşivdir.

| Doküman | Durum | Not |
|---------|-------|-----|
| `docs/PROJE_DURUMU.md` | 🟢 **CANLI — buna güven** | Tüm işlerin tek bakış master durumu |
| `docs/YOL_HARITASI_GAZETE_OTOMASYON.md` · `YOL_HARITASI_KALIMERA_ILAN.md` | 🟢 CANLI alt-harita | Gazete/otomasyon + Kalimera/İlan detayı |
| `docs/AJANSAI_ACIK_REPO_YOL_HARITASI.md` · `AJANS_MIMARI_VE_YOL_HARITASI.md` | 🔷 İLERİ VİZYON | AjansAI ürünleşme + çok-kiracılı genişleme (stratejik karar) |
| `ROADMAP.md` · `AGENT_SIRKETI_YOL_HARITASI.md` · `MASTER_PLAN.md` | 🗄️ **ARŞİV — güvenme** | Eski Firebase-devri plan; `- [ ]` kutuların çoğu ya yapıldı ya offline iş/hukuk. Açık-iş listesi olarak kullanma. |

---

## 🗓️ SON OTURUM — 2026-08-24 (Gazete güvenilirlik sertleştirme — kök neden düzeltmesi)

**Kök neden bulundu ve düzeltildi:** `gazete-approval.yml` iş akışında reel adımı timeout olunca commit adımı SKIP ediliyordu → gazete üretilmesine rağmen **3 gün (08-22..24) yayınlanmadı** (sessiz kesinti). Ikinci kök neden: i18n çevirisi her alan için her sağlayıcıda 60 saniye deniyordu; ölü sağlayıcılarla cold-cache çalışmasında 30+ dakika harcayıp job'ı timeout ettiriyordu.

**Bu oturumda yapılanlar (`.github/workflows/gazete-approval.yml`):**

- ✅ **Commit + heartbeat adımları reel'lerden ÖNCE taşındı** — reel ne olursa olsun gazete web'e çıkar.
- ✅ **Job timeout 60 dakikaya yükseltildi** (eskiden varsayılan 6 saat ama etkin limit yoktu; özel cap eklendi).
- ✅ **i18n sağlayıcı sırası `gemini,groq` ile sınırlandı** (`I18N_LLM_ORDER: gemini,groq`) — ölü/ücretsiz-tier tükenmiş sağlayıcılarda 60s×ölü bekleme artık oluşmaz.
- ✅ **Reel adımları `continue-on-error: true` + `timeout-minutes: 10`** — asılı Remotion render job'ı cancel ettiremez.
- ✅ **`data/i18n-cache` arşivde commit'leniyor** — cold-cache çalışmalarında çeviri yeniden yapılmaz.
- ✅ **`gazete-heartbeat.mjs`** — her sabah "sayı çıktı mı?" baskı provası; boş sayı/TR-as-lang/placeholder durumunda Telegram alarm + `GAZETE_HEALTHCHECK_URL` dead-man's-switch ping.
- ✅ **`line-heartbeat.yml`** — 12:30 TR'de TÜM üretim hatlarını (gazete/haber/brifing/reel/bülten/ilan) prova eder; bayat hat → Telegram alarm, `LINES_HEALTHCHECK_URL` ile Healthchecks.io dead-man's-switch.
- ✅ **`cheap-llm.mjs` `CHEAP_LLM_TIMEOUT_MS` knob** — angarya LLM çağrısı için dışarıdan timeout ayarlanabilir.

**Nerede kaldık:** `gazete-approval.yml` güncellemesi bu branch'te (feat/parallel-improve-2). Bir sonraki sabah çalışmasında (04:45 UTC) doğrulama: commit adımının reel'den önce tamamlandığını GitHub Actions logunda gör.

**Sıradaki:**
- ⏳ **PR #55** (G7 sıralama + G6 yerel yeniyazım + denetim temizliği + envanter tasarımı) gazete yayını onaylanana kadar beklemeye alındı.
- IG hesap adlarını (`ig-watch-accounts.json`) güncelle — 11 tanesi hâlâ "Invalid user id" (pasif).
- Control Tower dashboard'da üretim hattı bölümünü canlı izle (sabah 07:45 sonrası).

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
| **Ajans → gazete editöryal köprüsü** | ✅ | `scripts/agency/gazete-editorial.mjs`, `scripts/newspaper-daily.mjs`, `gazete-approval.yml` | Köprü canlı; gazete-approval içinde haber odası zinciri (muhabir/editör/doğrulayıcı/şef) → `data/gazete-today.json` → build → commit | — |
| **Gazete güvenilirlik katmanı** | ✅ **YENİ 2026-08-24** | `gazete-approval.yml`, `scripts/agency/gazete-heartbeat.mjs`, `data/i18n-cache/` | Commit+heartbeat reel'lerden ÖNCE; job timeout 60dk; `I18N_LLM_ORDER: gemini,groq` (cold-cache timeout giderildi); reel `continue-on-error+timeout-minutes:10`; i18n-cache kalıcı | — (bu oturum uygulandı) |
| **Hat nöbeti (line-heartbeat)** | ✅ **YENİ 2026-08-24** | `.github/workflows/line-heartbeat.yml`, `scripts/agency/line-heartbeat.mjs` | 12:30 TR'de tüm üretim hatlarını prova eder; bayat hat → Telegram alarm + `LINES_HEALTHCHECK_URL` dead-man's-switch | — |
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
| **↳ Gerçek-veri kişiselleştirilmiş teklif + satış hattı** | ✅ commit `d00f32e`→`dc3281c` | `satis-demo/build-teklif.mjs`, `teklif-data.json`, `teklif/index.html` (panel) | 259 işletme gerçek boşluk analizi (Google yorum/foto/web/IG) → kişisel before/after. **Tek-JSON `?slug=` mimarisi** (işletme başına HTML gerekmez) + **satış paneli** (ara→Teklifi Aç/Linki Kopyala). **Cookieless Plausible tracking** (Teklif Açıldı/WhatsApp/Paket/E-posta). Kullanım: `node build-teklif.mjs --all` (data+panel), tekil için `node build-teklif.mjs "Omar's Kokobüs"`. Uçtan uca headless doğrulandı. ⏳ Plausible'da 4 event'i Goal olarak ekle (Berkay, ~2dk). Sonraki fikir: "fotoğraflı gün" + partner çok-müşteri | — (deploy sonrası canlı: panel `/satis-demo/teklif/`, teklif `/satis-demo/?slug=<slug>`) |

---

## 🏗️ ALTYAPI

| İş | Durum | Dosya(lar) | Nerede kaldık | Canlıya ne lazım |
|----|-------|-----------|---------------|------------------|
| Hosting (Vercel Hobby + Cloudflare DNS) | ✅ | — | Canlı, primary domain non-www | — |
| **Vercel api/ limiti DOLU (12/12)** | ⛔ sınır | `api/*.js` | Yeni webhook eklenemez | Yeni otomasyonlar **script/cron** olmalı (webhook değil) |
| Vercel cron (2 aktif) | ✅ | `api/cron-rebuild.js`, `api/cron-refresh-ig-token.js`, `api/cron-weekly-plan.js` | Cron sayısı 2'ye düşürüldü (Hobby limiti) | — |
| Supabase (DB + Auth + Edge Functions + RLS) | ✅ | `supabase/` | Migration'lar yazıldı | Yeni migration'lar için `supabase db push` (doğrulanmalı) |
| Repo güvenliği | ✅ | — | PRIVATE, security commit'leri canlı | Secret rotate listesi (Twilio/Resend/Supabase PAT) — Resend hâlâ açık |
| **Gazete dead-man's-switch** | ✅ **YENİ 2026-08-24** | `GAZETE_HEALTHCHECK_URL` secret, `gazete-heartbeat.mjs` | Healthchecks.io'ya her sabah ping; 2 gün sessizlik → harici alarm | `GAZETE_HEALTHCHECK_URL` secret eklendi mi doğrula |
| **cheap-llm timeout knob** | ✅ **YENİ 2026-08-24** | `lib/cheap-llm.mjs` | `CHEAP_LLM_TIMEOUT_MS` env ile angarya LLM timeout ayarlanabilir | — |
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
| B9 | **PR #55 beklemeye alındı** | G7 sıralama + G6 yerel yeniyazım + denetim temizliği + envanter tasarımı | Gazete yayını 2026-08-24 sabahı doğrulanınca merge et |

---

## ▶️ SIRADAKİ NET ADIMLAR (öncelik sırası)

1. **Gazete yayın doğrulama (2026-08-25 sabah 07:45+):** GitHub Actions logunda commit adımının reel'den önce tamamlandığını gör. Heartbeat Telegram mesajı geldi mi kontrol et.
2. **PR #55 merge** (B9) — gazete yayını doğrulandıktan sonra (G7 sıralama + G6 + denetim + envanter tasarımı).
3. **`GAZETE_HEALTHCHECK_URL` secret doğrula** — Healthchecks.io dead-man's-switch aktif mi kontrol et.
4. **`LINES_HEALTHCHECK_URL` secret ekle** — line-heartbeat için harici dead-man's-switch.
5. **B3 Resend key rotate** → newsletter hattı çalışır hale gelir.
6. **B2 SerpApi kararı** → Google Maps verisi + otonom etkinlik tamamlanır.
7. ~~**B1 IG token**~~ → ✅ ÇÖZÜLDÜ (2026-07-08). ~~**B6 TR ses**~~ → ✅ ÇÖZÜLDÜ (edge-tts).

---

## 📌 NOTLAR

- Bu dosya **canlı**; her oturumda güncellenir. Bir işi bitirince/ilerletince satırını güncelle, blokeri çözünce B# satırını sil.
- Her parça **tek başına çalışır** halde bırakılır — yarım kalsa bile sistem bütününü bozmaz.
- "(doğrulanmalı)" etiketli satırlar memory/commit mesajından çıkarıldı, canlı testle teyit edilmedi.
- İlgili canlı alt-haritalar: `docs/YOL_HARITASI_GAZETE_OTOMASYON.md`, `docs/GAZETE_PROJESI.md`, `docs/SEO_STRATEJI.md`, `docs/INSTAGRAM_AUTOMATION.md`, `MASTER_PLAN.md`, `ROADMAP.md`.

---

## Kalite Motoru v1 — 2026-07-11

### Eklenen Bileşenler
- lib/image-permission-guard.mjs
- scripts/agency/content-critic.mjs
- scripts/agency/ig-weekly-report.mjs
- data/agency/quality-rubric.json
- data/agency/content-columns.json
- data/agency/topic-history.json (runtime, gitignore)
- data/agency/ig-report.json (runtime, gitignore)
- data/agency/critic-log.json (runtime, gitignore)

### Değiştirilen Dosyalar
- scripts/agency/morning-briefing.mjs (+filterAndDiversify, +sütun ataması)
- scripts/agency/*-reel-approval.mjs (+eleştirmen kapısı, Telegram öncesi)
- scripts/agency/ig-news-harvest.mjs (+image_permission kontrolü)
- scripts/ig-news-card.mjs (+izin, -SON DAKİKA hardcode)
- scripts/agency/build-*-reel.mjs (+image guard)

### Akış Değişmedi
- basket-publish.mjs (insan onayı — dokunulmadı)
- Vercel konfigürasyonu (dokunulmadı, yeni api/cron yok)
- Telegram onay akışı (korundu, eleştirmen ÖNCE eklendi)

### Lane Uyarısı
Berkay (mimari) bu dosyalara yazmıyor — çakışma önlendi.
Push için Berkay onayı bekleniyor.
