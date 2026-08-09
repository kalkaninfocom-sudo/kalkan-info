# Kalkan Info — Kurulum & Deploy Rehberi

Bu doküman, kalkaninfo.com'u sıfırdan kurmak, lokal geliştirmek ve deploy etmek için adım adım rehberdir. Mimari: **statik HTML + Supabase + Vercel**. (Repo daha önce Firebase kullanıyordu; artık kullanmıyor — eski Firebase talimatları geçersizdir.)

---

## 0. Önkoşullar

```bash
node --version    # >= 20  (zorunlu)
npm --version     # >= 10
git --version
```

Opsiyonel:
- **Supabase CLI** — Edge Function deploy / migration için: `npm install -g supabase`
- **Ollama** — cheap-llm yerel LLM için (yüksek hacimli angarya işleri): https://ollama.com

---

## 1. Klonlama & Bağımlılıklar

```bash
git clone <repo-url> kalkan-info
cd kalkan-info
npm install
```

`package.json` bağımlılıkları: `@supabase/supabase-js` (runtime), Remotion + `sharp` + `tailwindcss` (dev/build).

---

## 2. Ortam Değişkenleri

```bash
cp .env.example .env.local
```

`.env.local` içine gerçek değerleri girin. `.env.local` **git'e girmez** (`.gitignore`'lu). Değişken referansları için `.env.example` (açıklamalı) ve servis-servis rehber için [`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md).

Lokalde en azından çalışan bir görünüm için gerekenler:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — dinamik özellikler (auth, form, AI sohbet) için.
- Diğer anahtarlar (Anthropic, NVIDIA, Meta, Resend, SerpAPI) yalnızca ilgili otomasyon/özellik test edilecekse gereklidir.

---

## 3. Lokal Geliştirme

```bash
npm run dev          # = node serve.mjs
```

Tarayıcıda: **http://localhost:3000**

`serve.mjs` proje kökünü statik olarak servis eder (varsayılan port 3000, `PORT` env ile değişir). Directory traversal koruması vardır.

### Neyin lokal çalıştığı / neyin Supabase gerektirdiği

| Lokalde `serve.mjs` ile çalışır (statik) | Supabase / serverless gerektirir |
|---|---|
| i18n dil değiştirici (`?lang=`) | Auth (giriş / kayıt) |
| Harita, hava durumu (Open-Meteo anahtarsız) | Yorum yazma, hizmet ekleme |
| Antik kentler, plajlar, restoranlar, oteller, villalar listeleri | Tatil asistanı submit (Edge Function) |
| Aktiviteler, etkinlikler, gazete (statik üretilmiş) | AI konsiyerj Lyra sohbet (Edge Function) |
| Demo işletme siteleri (görsel) | İlan yönetimi, admin moderasyon |

> **Not:** Statik sayfaları gezmek için Supabase şart değildir. Ama Supabase JS client `js/supabase-config.js`'i arar — bu dosya build zamanında env'den üretilir; lokalde elle bir kopya tutabilirsiniz (gitignore'lu).

---

## 4. Supabase Bağlantısı

1. supabase.com → yeni proje oluşturun (veya devralınan projeye erişin).
2. Settings → API'den `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; Settings → General'dan `SUPABASE_PROJECT_REF`'i `.env.local`'a yazın.
3. **Migration'lar** (`supabase/` altında) DB'ye uygulanmalı:
   ```bash
   supabase link --project-ref <SUPABASE_PROJECT_REF>
   supabase db push
   ```
4. **Edge Function'lar** (5 adet) deploy edilmeli:
   ```bash
   supabase functions deploy agency
   supabase functions deploy lyra-chat
   supabase functions deploy vacation-planner
   supabase functions deploy lost-found
   supabase functions deploy newsletter-subscribe
   ```
   Edge Function'ların ihtiyaç duyduğu secret'lar (`ANTHROPIC_API_KEY`, `NVIDIA_API_KEY` vb.) Supabase → Edge Functions → Secrets üzerinden set edilir.

---

## 5. Build Testi

```bash
npm run build        # = node scripts/build-all.mjs
```

9 adımlı zincir çalışır (bkz. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §3). Her adım fail-safe'tir: yalnızca `supabase-config` ve `tailwind` zorunludur, diğerleri hatada uyarı verip devam eder. `SUPABASE_URL`/`SUPABASE_ANON_KEY` yoksa supabase-config adımı yazmayı atlar (build durmaz).

Build sonrası statik çıktılar kökte üretilir (`outputDirectory: "."`).

---

## 6. Deploy Akışı

Vercel projesi git'e bağlıdır. Deploy tek adımdır:

```bash
git push origin main
```

- Vercel `origin/main`'i algılar → `npm install` → `node scripts/build-all.mjs` (`vercel.json` `buildCommand`) → production'a deploy.
- **Ayrı bir deploy komutu yoktur.** `vercel --prod` gibi manuel komut kullanılmaz.
- Tüm production env değişkenleri Vercel Dashboard → Settings → Environment Variables'ta olmalıdır (`.env.local` deploy'a taşınmaz).

### Cron & Deploy Hook

- `api/cron-rebuild` (günlük 03:00 UTC) ve `api/cron-weekly-plan` (Pazartesi 06:00 UTC) `vercel.json`'da tanımlıdır.
- Günlük rebuild için Vercel → Settings → Git → Deploy Hooks'tan bir hook oluşturup URL'ini `VERCEL_DEPLOY_HOOK_URL` env değişkenine girin.

---

## 7. Sabit Kısıtlar (önemli)

| Kısıt | Değer |
|---|---|
| Node | `>= 20` |
| Vercel `api/*.js` fonksiyon limiti | **12 (DOLU)** — yeni ekleme deploy'u bozar; script/cron-dalı/polling kullanın |
| Vercel cron limiti | **2 (DOLU)** — 3. cron deploy'u bozar |
| `.env.local` | Git'e girmez; secret'ları log'a basmayın |
| IG token | `IG_LONG_LIVED_TOKEN` 60 günde bir yenilenir |

Repo geliştirme kuralları (cheap-llm zorunluluğu, otomasyon envanteri) için [`CLAUDE.md`](CLAUDE.md).

---

## Sorun Giderme

| Sorun | Çözüm |
|---|---|
| `node serve.mjs` port 3000 dolu | `PORT=3001 node serve.mjs` |
| Supabase client "config bulunamadı" | `js/supabase-config.js` yok — build çalıştırın veya lokal kopya oluşturun |
| Build'de bir adım fail | Zorunlu değilse build devam eder; log'a bakın. Zorunlu (supabase-config/tailwind) ise env / bağımlılık kontrol edin |
| Vercel deploy "too many functions" | `api/` 12/12 dolu — yeni `api/` eklemeyin |
| Edge Function 500 | Supabase → Edge Functions → Logs; ilgili secret set edilmiş mi kontrol edin |
| IG paylaşımı 9004 hatası | Görsel JPEG olmalı (PNG kabul edilmez) |

---

**Mimari detay:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · **Dış servisler:** [`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md) · **Devir:** [`HANDOVER.md`](HANDOVER.md)
