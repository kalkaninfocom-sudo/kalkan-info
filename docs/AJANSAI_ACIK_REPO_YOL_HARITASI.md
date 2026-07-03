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

## FAZ 1 — Burada çalışır hale getir (KANIT) · ✅ ÇEKİRDEK CANLI (2026-07-03)

Karar (Berkay 2026-07-03): LLM tek başına haber uyduramaz → gerçek RSS kaynağı + agent editöryal katmanı.

- [x] **Editöryal katman CANLI** — `scripts/agency/gazete-editorial.mjs`: ham RSS'i Kalkan-alaka+güncelliğe
      göre sıralar, en iyi 4'ünü cheap-llm ile editöryal manşet/sütun/magazine'e çevirir → `data/gazete-today.json`.
      `sources.mjs.getNews()` bugünün dosyasını ÖNCE okur, yoksa RSS fallback. gazete-approval.yml'de build'den
      önce çalışır. CI testi ✓ (NVIDIA 8B, ~5sn, geçerli JSON).
- [x] **LLM sağlayıcı çözüldü**: Gemini free kotası tükenmiş (429), NVIDIA 70B CI'da timeout → **NVIDIA 8B**
      (`meta/llama-3.1-8b-instruct`) hızlı+geçerli JSON. GitHub secret'ları eklendi: NVIDIA_API_KEY, GOOGLE_GEMINI_API_KEY.
      Katı "sadece JSON" prompt küçük modelin şemaya uymasını sağladı. timeoutMs 180s.
- [x] Uçtan uca CI testi ✓ — "Editöryal içerik üretildi (nvidia)".
- [x] POLİSAJ ✅: `newspaper-daily.mjs` app-level upsert (satır 109-119: mevcut kontrolü + insert; `on_conflict` query kaldırıldı → 400 noise yok).
- [x] POLİSAJ ✅: sabah bayat social_posts guard'ı `gazete-approval.yml` satır 62-74'te otomatik (sabah çalışmadan önce bayat `gazete-<date>` satırını DELETE → taze onay; elle silme gerekmez).
- [ ] İYİLEŞTİRME: Gemini billing açılırsa (GCP kredisi) daha hızlı/güvenilir olur; NVIDIA gece yavaşlarsa yedek.
- [ ] İYİLEŞTİRME: magazine (arka yüz) build'i de gazete-today.json magazine_* alanlarını kullansın (şu an sadece ön yüz).

## GAZETE / REEL / PLAN — DURUM & YENİ OTURUM YOL HARİTASI

### ✅ BİTENLER (2026-07-03 maraton oturumu)
- Sabah gazete onayı tamir + kalıcı (adanmış `gazete-approval.yml`, 4 secret, bayat-row temizleme).
- **Editöryal köprü**: RSS → Groq 70B editöryal içerik → `gazete-today.json` → gazete build. Kartsız/ücretsiz.
- **Kartsız LLM**: cheap-llm'e Groq + Cerebras (kart yok, 70B kaliteli). Groq birincil.
- **Kaş içerik kaynağı**: haberler.com/kas scraper + localScore (Kalkan/Kaş/Patara üstte).
- **Reel motoru olgun** (`GazeteReel.tsx` + `build-gazete-reel.mjs`): 30sn snappy, masthead→manşet→başlıklar→
  Evergreen(Biliyor muydun Kaş + REKLAM)→CTA, müzik (ffmpeg), Kaş antik + hizmet reklamı. Berkay onayladı.
- **Evergreen** (`scripts/agency/evergreen.mjs`): haber azken antik az-bilinen + hizmet reklamı.
- **Yazı işleri kılavuzu** (`docs/YAZI_ISLERI_KILAVUZU.md`) — agent gazetecilik eğitimi (system prompt).
- **✅ AYLIK PLAN ONAYLANDI**: `docs/SOSYAL_MEDYA_AYLIK_PLAN.md` + `data/agency/aylik-icerik-plani.json`
  (gün-gün algoritma-optimize saat, %40 ciddi/%60 orijinal, hashtag stratejisi MAX 5). = KAYNAK DOĞRULUK.
- /ajansAI rename, dolmuş konum fix, IG token süresiz, maliyet/SaaS raporları.

### 🔜 YENİ OTURUM — SIRADAKİ (plan onaylı; her slot'un ÜRETİCİSİNİ tek tek kur, çalışır+test)
1. [x] **Haftalık bülten (Paz 09:00) — CANLI + TEST ✅ (2026-07-03)** — 2 parça: **(A) günlük editöryal arşivi**
      (`gazete-editorial.mjs` artık `data/gazete-archive/<date>.json` yazıyor; gazete-approval.yml commit'liyor → CI'da kalıcı)
      + **(B) Pazar üreticisi** `scripts/agency/build-bulten-reel.mjs` (son 7 gün arşivi topla → haftanın en iyi ~4 haber
      + magazin, cheap-llm seçim/heuristik fallback) → `remotion/src/BultenReel.tsx` (intro→öne çıkanlar→magazin→outro,
      fotosuz/hafif). Render+QA doğrulandı (2.1MB, 4 sahne ✓). Yayın: `bulten-approval.mjs` + adanmış
      `.github/workflows/bulten-weekly.yml` (Paz 06:00 UTC=09:00 TR, npm ci+ffmpeg). Not: arşiv biriktikçe 4 haber dolar (ilk hafta az).
2. [x] **Restoran reel (Sal 20:00 flagship 💰) — CANLI + TEST ✅ (2026-07-03)** — `RestoranReel.tsx` (GazeteReel
      kardeşi: intro→hero→galeri→bilgi→outro, 30sn, müzik) + `scripts/agency/build-restoran-reel.mjs`
      (restoranlar.json'dan rotasyonla seçer: ≥2 gerçek foto olan **31/175** restoran havuzu, rating önceliği,
      `data/agency/restoran-reel-state.json` tekrar önler; tagline cheap-llm; **foto → base64 data URI**
      çünkü Chromium file://+cross-origin(CORP same-site)+Remotion publicDir hepsi bloklu).
      Uçtan uca render doğrulandı (Salonika 1881, 11.9MB, 5 sahne gözle QA ✓). Yayın: `restoran-reel-approval.mjs`
      (build→Supabase upload→Telegram video onayı, reel-approval ikizi) + **adanmış `.github/workflows/restoran-reel.yml`**
      (Salı 17:00 UTC, npm ci + ffmpeg + Remotion Chrome). Scheduler'a EKLENMEDİ (her-10dk tick npm ci yapmıyor →
      Remotion patlar; gazete `_moved` dersi). ⛔ CI'da çalışması için secret'lar: SUPABASE_*, TELEGRAM_*, GROQ/CEREBRAS/NVIDIA.
3. [x] **EN çift dil (gazete reel) — CANLI + RENDER ✅ (2026-07-03, commit 1e7b729)** — `build-gazete-reel-en.mjs`
      + `gazete-editorial-en.mjs` (cheap-llm çeviri → `gazete-today.en.json`) + `reel-approval-en.mjs`
      + `gazete-approval.yml` entegrasyonu (bayat EN satır temizleme). dist/social/gazete/gazete-reel-en.mp4 ✓.
      KALAN: IG çift post/altyazı (EN varyantını IG'ye ayrı gönderme) — henüz yok.
4. [x] **Villa/Antik/Plaj reel — CANLI + RENDER ✅ (2026-07-03, commit 1e7b729)** — `VillaReel/AntikReel/PlajReel.tsx`
      + `build-{villa,antik,plaj}-reel.mjs` (veriden rotasyon, data-URI foto, müzik, state ile tekrar önleme)
      + `{villa,antik,plaj}-reel-approval.mjs` + adanmış workflow (villa Cmt 20:00 flagship 💰 / antik Çar / plaj Prş,
      restoran-reel deseni, scheduler'a EKLENMEDİ). 4'ü de render doğrulandı (6-18MB). Root.tsx'e kayıtlı.
      ⛔ CI secret'ları: SUPABASE_*, TELEGRAM_*, GROQ/CEREBRAS/NVIDIA (restoran-reel ile aynı — doğrula).
5. [ ] **IG story-tag oto-repost** — etiketlenince onay→repost (IG API story mentions + STORIES publish; kısıt araştır).
6. [x] **Webhook secret ÇÖZÜLDÜ ✅ (2026-07-03)** — kök sorun: Telegram'a kayıtlı `secret_token` ≠ Vercel `TELEGRAM_WEBHOOK_SECRET` (401). Yeni secret üretilip Telegram webhook'una (non-www URL) kaydedildi + Vercel env'e aynı değer + redeploy. Doğrulandı: doğru secret→200, yanlış→401, pending→0. `setup-telegram.mjs` www→non-www tuzağı da düzeltildi (commit 6ab287f). Onay butonu→IG yayın zinciri artık aktif.
7. [x] **İş ilanları ÇİFT-MOD ✅ (2026-07-03)** — `scripts/agency/ilan-post.mjs`: jobs(active) VARSA haftalık
      "KALKAN'DA İŞ VAR" dijest kartı (≤5 ilan), YOKSA "İş var mı?" tanıtım kartı (iş arayan+işveren çağrısı →
      boş board flywheel'i). NOT: jobs tablosu şu an BOŞ (0) → şimdilik promo üretir, ilan girilince otomatik
      dijeste döner. 1080×1350 navy+gold kart (puppeteer), cheap-llm caption, Supabase storage upload → public URL,
      social_posts pending_approval + Telegram onay. Adanmış `.github/workflows/ilan-weekly.yml` (Pzt 08:00).
      Her iki kart görsel QA'dan geçti. Ölüm ilanı: hâlâ veri kaynağı yok (Berkay input).
8. [ ] **Agent-Reach** — Kalkan içerik kaynağını daha da genişlet.
9. [x] **Cerebras FIX ✅ (2026-07-03)** — kök sorun "boş yanıt" değil model-ID: hesap seti değişmiş, `llama-3.3-70b`
      404 (yok). Erişilebilir: gemma-4-31b / gpt-oss-120b / zai-glm-4.7. Son ikisi reasoning → json'da boş.
      `gemma-4-31b` hem text hem JSON'da güvenilir → yeni Cerebras varsayılanı (commit 408ace1). groq birincil.

> Motora bağlama = yukarıdaki üreticiler kurulunca scheduler/haftalık-planlayıcı `aylik-icerik-plani.json`'u okuyup
> otomatik üretir/kuyruğa alır. Gazete daily zaten planın sabah ayağını çalıştırıyor.

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
