# CLAUDE.md — kalkan-info repo kuralları

## 🪙 ANGARYA İŞLERİ ÜCRETSİZ LLM'E VER (token tasarrufu — VARSAYILAN)
Berkay'ın kuralı: basit/angarya LLM işlerini **otomatik** ücretsiz modellere yönlendir. Her seferinde "NVIDIA kullan" demesine gerek YOK — bu varsayılan davranış.

**Router:** `lib/cheap-llm.mjs` → `import { cheapLLM, cheapJSON } from './lib/cheap-llm.mjs'`
- `cheapLLM(prompt, { system, json, maxTokens })` → `{ text, provider, model }`
- `cheapJSON(prompt, { system })` → `{ data, provider, model }`
- Sıra (env `CHEAP_LLM_ORDER`): **ollama (yerel, sınırsız bedava) → nvidia (NIM, ~40 RPM bedava) → gemini → claude (fallback)**

**Kural:**
- ✅ Ücretsiz router'a ver: etkinlik/metin çıkarımı, sınıflandırma, caption, haber özeti, çeviri, taslak üretimi, mock/fixture, boilerplate, yorum.
- 🧠 Claude'u (token harca) sadece: mimari karar, çok-dosya muhakeme, güvenlik analizi, kaliteli editöryal içerik için kullan.
- 🔁 Yüksek hacimli/trivial işleri **Ollama'ya** (yerel, RPM limiti yok) yönlendir ki NVIDIA 40 RPM kotası büyük işlere kalsın. `{ only:'ollama' }` ile zorlanabilir.
- Yeni otomasyon yazarken doğrudan Anthropic çağrısı YAZMA — `cheap-llm` kullan.

**Kurulum:** `NVIDIA_API_KEY` (.env.local, build.nvidia.com `nvapi-...`) + Ollama yerel (model: `OLLAMA_MODEL`, varsayılan llama3.2:3b). Detay: bu router dosyasının başındaki yorum.

## 🗺️ Durum & Yol Haritası (ADHD — her zaman güncel tut)
- `docs/PROJE_DURUMU.md` — TÜM proje master durumu (ne bitti/yarım/bloke).
- `docs/YOL_HARITASI_GAZETE_OTOMASYON.md` — gazete+etkinlik+otomasyon detayı.
- Büyük adımlarda bu dosyaları GÜNCELLE. Her parça tek başına çalışır halde bırak.

## ⚙️ Sabit Kısıtlar
- **Vercel Hobby: api/*.js max 12 (DOLU 12/12).** Yeni `api/` fonksiyonu EKLEME — script/cron-dalı/polling kullan.
- **Vercel Hobby: max 2 cron** (cron-rebuild + cron-weekly-plan, ikisi dolu). 3. cron deploy'u bozar.
- `.env.local` git'e girmez; secret'ları loglara basma.
- Frontend görsel iş için kök `C:\Users\socie\CLAUDE.md` kurallarını da uygula (serve.mjs + localhost screenshot; ASLA file://).

## 🤖 Otomasyon Envanteri (bu repo)
- Gazete: `newspaper/generator/build.mjs` (morning + magazine), `sources.mjs` (gerçek veri), `templates/`.
- Etkinlik: `data/etkinlik-takvimi.json` + `scripts/events-lib.mjs` + `scripts/build-events-page.mjs` + `scripts/discover-events.mjs`.
- Sosyal: `scripts/ig-news-card.mjs` / `ig-news-post.mjs` (haber→IG), `lib/ig-reply.mjs` + `scripts/ig-reply-poll.mjs` (oto-cevap), `scripts/fb-lead-responder.mjs` (FB öneri).
- Hook motoru: `scripts/agency/review-mining.mjs` (gerçek Google yorumları → müşterinin kendi diliyle 10 hook; groq/cerebras, çıktı `content/hooks/<slug>.json`; reel/caption girdisi).
- Huni: `scripts/agency/comment-dm-funnel.mjs` (yorum-kelime → otomatik DM; `private_replies`, kampanyalar `data/dm-funnel.json`, DRY-RUN varsayılan, `--live` ile gönderir).
- Haber: `scripts/news-aggregator.mjs` (RSS, bölgesel kaynaklı).
- Rapor: `scripts/daily-status-report.mjs` (günlük Telegram durum).
