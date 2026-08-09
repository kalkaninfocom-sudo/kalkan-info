# Kalkan Info

**kalkaninfo.com** — Kalkan (Kaş / Antalya) bölgesinin AI destekli dijital rehberi ve işletmelere "dijital kimlik" sunan ajans platformu. Bölge rehberi (restoran, otel, villa, plaj, tur, etkinlik), AI destekli yerel gazete, işletmeler için demo site + admin panelleri ve Instagram / haber / etkinlik otomasyonlarını tek bir statik-öncelikli mimaride birleştirir. Site runtime çok dillidir (TR / EN / DE / RU / FR — `?lang=` parametresi ile).

> **Devir notu:** Bu repo bir satış/teslim (devir) sürecindedir. Devralan bir geliştiricinin sıfırdan kurup çalıştırabilmesi için hazırlanmıştır. Hesap ve dış bağımlılık devir listesi için [`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md) ve [`HANDOVER.md`](HANDOVER.md) dosyalarını okuyun.

---

## Özellikler

- **Bölge rehberi:** Restoran, otel, villa, plaj, tur, aktivite, antik kent, etkinlik sayfaları — çoğu build zamanında veriden üretilir.
- **Çok dillilik:** Runtime dil değişimi (`?lang=tr|en|de|ru|fr`), sayfa yeniden yüklemeden.
- **AI gazete:** Bölgesel haber toplama + editöryal katman ile otomatik üretilen dijital gazete (`newspaper/`).
- **Dijital ajans / SaaS:** İşletmelere özel demo siteler + admin panelleri (`demo/`, `satis-demo/`), teklif ve hedef analizi araçları (`scripts/agency/`).
- **AI konsiyerj (Lyra):** Supabase Edge Function üzerinde çalışan sohbet asistanı.
- **Otomasyonlar:** Instagram paylaşım / oto-cevap, etkinlik keşfi, haber toplama, günlük rapor.
- **Maliyet-optimize AI katmanı:** `lib/cheap-llm.mjs` router (ücretsiz → ücretli sağlayıcı sırası).

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend | Statik HTML + Vanilla JS + Tailwind CSS (CDN + build-time `scripts/build-tailwind.mjs`) |
| Backend (veri/auth/storage) | **Supabase** (Postgres + Auth + Storage + 5 Edge Function) |
| Serverless | Vercel `api/*.js` (12 fonksiyon — Hobby limiti dolu) |
| Hosting / CI-CD | **Vercel** (git-connected; `origin/main` push → otomatik prod deploy) |
| Cron | Vercel Cron (2 adet — Hobby limiti dolu) |
| AI | Anthropic + Gemini + NVIDIA NIM + Ollama (yerel), `lib/cheap-llm.mjs` router ile |
| Video / reel | Remotion (`remotion/`) |
| Analitik | Google Tag Manager, Meta Pixel, Plausible |
| Çalışma zamanı | Node.js `>= 20` |

> **Not:** Bu repo **Supabase + Vercel** kullanır. Eski dokümanlarda geçen Firebase mimarisi artık geçerli **değildir**.

---

## Hızlı Başlangıç

```bash
# 1. Repoyu klonla
git clone <repo-url> kalkan-info
cd kalkan-info

# 2. Bağımlılıkları kur (Node >= 20 gerekir)
npm install

# 3. Ortam değişkenlerini hazırla
cp .env.example .env.local
#   .env.local içine gerçek değerleri gir (bkz. docs/EXTERNAL_DEPS.md)

# 4. Lokal dev sunucusunu başlat
npm run dev          # = node serve.mjs

# 5. Tarayıcıda aç
#    http://localhost:3000
```

Kurulumun tüm detayları (neyin lokal çalıştığı, neyin Supabase gerektirdiği) için [`SETUP.md`](SETUP.md).

---

## Build & Deploy

```bash
# Tam build zinciri (Vercel bunu otomatik çağırır)
npm run build        # = node scripts/build-all.mjs
```

`build-all.mjs`, `vercel.json` içindeki `buildCommand`'dır ve 9 adımlı bir zincir çalıştırır (Tailwind, Supabase config, restoran sayfaları, gazete, reklam, haber toplama vb.). Zincirin ayrıntısı için [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Deploy:**

```bash
git push origin main   # → Vercel otomatik production deploy
```

Ayrı bir manuel deploy komutu **yoktur**. Vercel projesi git'e bağlıdır; `origin/main`'e her push production'a gider.

---

## Dizin Haritası

| Dizin | Dosya (yaklaşık) | Sorumluluk |
|---|---|---|
| `newspaper/` | 246 | AI gazete motoru (üretici + şablon + kaynaklar) |
| `restoran/` | 180 | Restoran detay sayfaları (build ile üretilir) |
| `scripts/` | 179 | Build + otomasyon + `_` önekli tek-seferlik manuel araçlar |
| `remotion/` | 45 | Video / reel üretimi |
| `js/` | 48 | Tarayıcı tarafı client script'leri |
| `hizmet/` | 31 | Hizmet işletmesi route'ları |
| `supabase/` | 29 | Edge Function'lar + migration / config |
| `satis-demo/` | 26 | Satış demo siteleri |
| `plaj/` | 25 | Plaj detay sayfaları |
| `lib/` | 26 | Paylaşılan modüller (`cheap-llm`, `ig-reply`, `reklam-uyum` vb.) |
| `lamora/` | 18 | La Mora demo işletme sitesi |
| `otel/` | 17 | Otel detay route'ları |
| `villa/` | 16 | Villa detay route'ları |
| `demo/` | — | İşletme demo siteleri (site + admin) |
| `api/` | 12 | Vercel serverless fonksiyonları (limit dolu) |
| `functions/` | 11 | Yardımcı fonksiyon modülleri |
| Kök | 34 HTML | Ana sayfalar (`index`, `villalar`, `oteller`, `restoranlar`, `plajlar`, `turlar`, `aktiviteler`, `antik-kentler`, `hakkimizda`, `tatil-asistani`, `gazete` vb.) |

> `scripts/` altındaki `_` önekli araçlar Berkay'ın manuel/tek-seferlik iş araçlarıdır (foto çekme, keşif, reel üretimi). Build zincirinin parçası değildir ama **değerlidir** — silmeyin.

---

## Otomasyonlar

| Otomasyon | Giriş noktası |
|---|---|
| Gazete üretimi | `newspaper/generator/build.mjs` (morning + magazine) |
| Etkinlik takvimi | `data/etkinlik-takvimi.json` + `scripts/build-events-page.mjs` + `scripts/discover-events.mjs` |
| Haber toplama | `scripts/news-aggregator.mjs` (bölgesel RSS) |
| IG haber kartı → paylaşım | `scripts/ig-news-card.mjs` / `scripts/ig-news-post.mjs` |
| IG oto-cevap | `lib/ig-reply.mjs` + `scripts/ig-reply-poll.mjs` |
| FB lead yanıtı | `scripts/fb-lead-responder.mjs` |
| Günlük durum raporu | `scripts/daily-status-report.mjs` (Telegram) |
| Günlük rebuild cron | `api/cron-rebuild.js` (03:00 UTC — ilan kapatma + deploy hook) |
| Haftalık plan cron | `api/cron-weekly-plan.js` (Pazartesi 06:00 UTC) |

Otomasyon envanterinin tam açıklaması: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Ortam Değişkenleri & Servisler

Tüm ortam değişkenleri `.env.example` içinde placeholder + açıklama ile listelidir. `.env.local` git'te **değildir** (`.gitignore`'lu). Kod değerleri `process.env.*` üzerinden okur.

Ana servis grupları: **Supabase**, **Anthropic**, **Gemini**, **NVIDIA NIM**, **Meta / Instagram**, **Facebook**, **Resend** (e-posta), **SerpAPI**, **Plausible / GTM / Meta Pixel** (analitik).

Servis-servis devir tablosu, hesapların nereden alındığı ve token yenileme notları için: **[`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md)**.

---

## Dokümanlar

| Doküman | İçerik |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Sistem mimarisi, veri akışı, build zinciri, Edge Function rolleri, AI katmanı |
| [`SETUP.md`](SETUP.md) | Sıfırdan kurulum + lokal geliştirme + deploy akışı |
| [`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md) | Dış bağımlılık & hesap devir tablosu |
| [`HANDOVER.md`](HANDOVER.md) | Devir kontrol listesi |
| [`CLAUDE.md`](CLAUDE.md) | Repo geliştirme kuralları (cheap-llm zorunluluğu, Vercel limitleri, otomasyon envanteri) |

> **Geçmiş plan dosyaları (güncel değil):** Kökteki `MASTER_PLAN.md`, `ROADMAP.md`, `DEPLOY_ROADMAP.md`, `AUDIT_ROADMAP.md`, `AGENT_SIRKETI_YOL_HARITASI.md` eski yol haritalarıdır ve **mevcut mimariyi yansıtmaz**. Referans/arşiv olarak tutulmaktadır; güncel bilgi için yukarıdaki dokümanları kullanın.

---

## Lisans & Sahiplik

Özel (private) ticari proje. Tüm hakları Berkay Elmastaş / kalkaninfo.com'a aittir. Devir kapsamında mülkiyet, alan adı, Supabase ve Vercel projeleri ile ilişkili hesaplar alıcıya transfer edilir — ayrıntı [`HANDOVER.md`](HANDOVER.md) ve [`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md).
