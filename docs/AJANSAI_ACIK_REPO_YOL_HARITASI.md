# AjansAI — Açık Repo Yol Haritası (canlı)

**Vizyon (Berkay, 2026-07-03):** AjansAI'yi (yarı-otonom AI ajans cockpit'i + agent motoru) başkalarının
kullanabileceği/fork'layabileceği **açık kaynak template repo**'ya dönüştürmek. "İnsanlar GitHub'da nasıl
skill yapıyorsa, biz de altyapıyı repo olarak sunalım." Marka vizyonuyla uyumlu (AI-native solo founder,
showcase). Bu dosya bu girişimin TEK canlı yol haritasıdır — her adımda güncelle.

> Sıralama kuralı: ÖNCE burada gerçekten çalışsın (kanıtlı), SONRA temiz public repo'ya çıkar.
> Çalışmayan bir template kimseye sunulmaz. (Berkay'ın "başa sarma yasağı" kuralı.)

---

## Bugünkü durum (2026-07-03) — neyi çözdük

- ✅ **Sabah gazete onayı tamir edildi + kalıcı.** 4 bug: cron throttling, detached-spawn, puppeteersiz CI,
  **GitHub secret'ları hiç tanımlı değildi.** Çözüm: adanmış `.github/workflows/gazete-approval.yml`
  (build+web+Telegram onay, puppeteer'lı, senkron, tek günlük cron 04:45 UTC/07:45 TR). 4 secret eklendi.
  Bugün elle tetikleyip kurtarıldı (Telegram message 26). `scheduler.mjs` script görevleri artık senkron.
- ✅ **/oyun → /ajansAI rename** (git mv + vercel 301 redirect'ler). Canlı.

## Tespit edilen KÖK sorunlar (açık repo öncesi çözülmeli)

1. **Gazete ↔ agent şirketi BAĞLI DEĞİL.** Gazete içeriği yalnız `data/haberler.json` (RSS) → `newspaper/generator/{build,sources}.mjs`.
   Sabah muhabir/magazin agent'ları çıktıyı `agency_jobs` tablosuna yazıyor ama gazete build'i bunu HİÇ okumuyor.
   RSS değişmezse gazete aynı kalır. **Berkay'ın şikâyeti bu.**
2. **Agent'lar güvenilir çalışmıyor.** `agency_jobs` son kayıtlar: "Signal timed out." (NVIDIA NIM Edge Function
   süre limitini aşıyor) + eskiden "NVIDIA_API_KEY yok". Cron throttling nedeniyle 07:00–07:50 araştırma
   tick'leri de çoğu sabah hiç ateşlenmiyor.

## FAZ 1 — Burada çalışır hale getir (KANIT) · SEÇİLDİ: "RSS + agent editöryal katman"

Karar (Berkay 2026-07-03): LLM tek başına haber uyduramaz → gerçek RSS kaynağı + agent editöryal katmanı.

- [ ] **Editöryal katman**: sabah workflow'unda (scheduler'a GÜVENME):
      1. RSS tazele → `data/haberler.json` güncel.
      2. Muhabir agent ham haberleri 3 editöryal manşet+özete dönüştürür.
      3. Magazin editörü arka yüz başlıklarını yazar.
      4. Çıktı → `data/gazete-today.json`; `sources.mjs.getNews()` ÖNCE bunu okur, RSS'e fallback.
- [ ] **Agent timeout fix**: editöryal çağrıyı Edge Function yerine workflow içinde `lib/cheap-llm.mjs`
      ile yap (CI'da nvidia uzun timeout / gemini fallback). Edge Function timeout'u da gözden geçir.
- [ ] Uçtan uca test: workflow'u tetikle → gazete içeriği gerçekten değişti mi doğrula.
- [ ] `newspaper-daily.mjs` `on_conflict=content_pack_id` 400 fix (tabloda unique yok) — app-level upsert'e çevir.
- [ ] Sabah bayat social_posts satırı guard'ını sağlamlaştır (gece oluşan satır sabahki gönderimi bloklamasın).

## FAZ 2 — Temiz public template repo'ya çıkar

- [ ] Yeni repo (örn. `ajansai`) — framework'ü kalkan-info'dan ayıkla.
- [ ] **Genelleştir**: kalkan markası/içeriği çıkar; hardcoded Supabase proje URL'i + `sb_publishable_...`
      anahtarı **KALDIR** (env-driven config; kullanıcı kendi backend'ini bağlar). ⚠️ Template'e ASLA
      Berkay'ın proje anahtarı/secret'ı girmez.
- [ ] Config: `.env.example`, agent persona'ları JSON/dizin ile tanımlanır (kullanıcı kendi ajansını kurar).
- [ ] `README.md` (mimari + kurulum), `LICENSE`, `setup` script, örnek agent'lar + örnek zamanlanmış görev.
- [ ] Cockpit UI'yi (`ajansAI/index.html`) config-driven yap (marka/agent listesi dışarıdan).
- [ ] Demo: temiz kurulumda 1 agent + 1 zamanlı görev uçtan uca çalışsın.

## FAZ 3 — kalkaninfo.com = satılabilir çok-kiracılı (multi-tenant) SaaS

**Vizyon (Berkay 2026-07-03):** kalkaninfo.com altyapısını başka küçük tatil bölgelerine satmak. Alan kişi kendi
bölgesine entegre eder, o bölgeye uygun "info" sitesini çalıştırır. Doğru terim: **white-label / vertical
multi-tenant SaaS** (bölgesel turizm platformu). Gerçekçi ve yapılabilir — abartı değil.

> AÇIK-REPO (Faz 2) vs SaaS (Faz 3) gerilimi: İkisi aynı teknolojinin farklı dağıtım modeli. Öneri = "open core":
> çekirdek/showcase açık (lead-gen), asıl gelir white-label SaaS. Şimdi ODAK dağıtmadan ÖNCE ortak önkoşulu bitir.

**Ortak önkoşul (her üç yol için de aynı):** sistem gerçekten çalışsın (Faz 1) + kalkan hardcoding'i kaldır
(konfig/tenant-driven). Bu iş yapılmadan ne repo ne SaaS satılır.

Adımlar:
- [ ] **Genelleştirme/tenant modeli**: bölge verisi (restoran/otel/plaj/etkinlik/haber kaynağı), marka (renk/logo/font),
      dil seti, harita merkezi → tek `tenant config` (JSON/DB). Kod bölgeden bağımsız hale gelir.
- [ ] **İçerik edinme sorunu (asıl zor kısım, teknik değil)**: her yeni bölge kendi işletme/etkinlik verisini ister.
      Çözüm: onboarding'de Google Maps/SerpApi scrape + RSS kaynak seçimi + agent'ların bölgeye adapte olması.
- [ ] **Fiyatlama/paket**: aylık abonelik + kurulum ücreti; katmanlar (info / info+ajans / info+ajans+gazete).
- [ ] **Self-serve onboarding**: yeni bölge = yeni tenant kaydı → domain/subdomain → config → veri seed.
- [ ] **Operasyon**: destek, güncelleme dağıtımı, tenant izolasyonu, faturalama (Stripe/iyzico).
- [ ] Pilot: Kalkan dışı 1 küçük bölge ile kanıt (case study) → sonra satış.

**Dürüst zorluklar:** teknik kısım (multi-tenant) yapılabilir; asıl zorluk (1) her bölge için içerik/veri,
(2) satış/dağıtım kanalı, (3) sürekli destek yükü. Ürün iyi + genelleştirilmiş olursa model sağlam.

## FAZ 0 (paralel) — İLERLEME RAPORU altyapısı (şu an BLOKE)

Berkay gerçek veri raporu istedi (IG erişim + Google Analytics → kalkaninfo.com nasıl ilerliyor).
- ⛔ **IG_LONG_LIVED_TOKEN 17-May-2026'da expire** → IG Insights çekilemiyor. Yenilenmeli (Meta re-auth,
      IG_BUSINESS_ID + META_APP_ID/SECRET mevcut).
- ⛔ **Google Analytics API erişimi yok** — site sadece GTM-PLWTGK2G (client-side). GA4 Data API için property ID +
      service account (veya Berkay export/paylaşım) gerekir.
- Kredi gelince: `scripts/agency` altında recurring `analyst` raporu (IG reach + GA + site trafiği → Telegram/PDF).

## Mimari (mevcut, ayıklanacak parçalar)

- Cockpit UI: `ajansAI/index.html` (izometrik ofis; Supabase Edge Function `agency`'e konuşur).
- Agent motoru: `supabase/functions/agency/index.ts` (enqueue → `agency_jobs`/`agency_content`/`agency_state`, NVIDIA NIM).
- Zamanlayıcı: `scripts/agency/scheduler.mjs` + `data/agency/schedule.json` (+ GitHub Actions `agency-scheduler.yml`).
- Gazete köprüsü (kurulacak): sabah workflow → editöryal katman → `data/gazete-today.json` → `sources.mjs`.
- Ucuz LLM router: `lib/cheap-llm.mjs` (ollama→nvidia→gemini→claude).
