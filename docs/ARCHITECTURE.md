# Kalkan Info — Mimari

Bu doküman kalkaninfo.com'un güncel sistem mimarisini anlatır: statik build + Supabase + Vercel serverless + cron. (Repo daha önce Firebase kullanıyordu; artık **Supabase + Vercel** kullanır. Eski Firebase dokümanları geçersizdir.)

---

## 1. Sistem Genel Bakış

kalkaninfo.com **statik-öncelikli** bir sitedir. Sayfaların büyük çoğunluğu build zamanında üretilen düz HTML'dir; dinamik işler (auth, form gönderimi, AI sohbet, ilan yönetimi) iki serverless katmana dağıtılmıştır:

```
┌──────────────────────────────────────────────────────────────┐
│  TARAYICI (statik HTML + Vanilla JS + Tailwind)              │
│  runtime i18n (?lang=), Supabase JS client (anon key)         │
└───────────┬──────────────────────────────┬───────────────────┘
            │                              │
   ┌────────▼─────────┐          ┌─────────▼──────────────────┐
   │ Vercel api/*.js  │          │ Supabase                    │
   │ (12 fn, Node)    │          │  - Postgres (RLS)           │
   │  webhook/cron/   │          │  - Auth                     │
   │  ilan/email      │          │  - Storage                  │
   └────────┬─────────┘          │  - 5 Edge Function (Deno)   │
            │                    └─────────┬──────────────────┘
   ┌────────▼─────────┐                    │
   │ Vercel Cron (2)  │          ┌─────────▼──────────────────┐
   │ rebuild + weekly │          │ AI sağlayıcıları            │
   └──────────────────┘          │ Anthropic/Gemini/NVIDIA/    │
                                 │ Ollama (lib/cheap-llm.mjs)  │
                                 └─────────────────────────────┘
```

**Hosting & CI/CD:** Vercel projesi git'e bağlıdır. `origin/main`'e her push, `vercel.json` içindeki `buildCommand` (`node scripts/build-all.mjs`) ile build alınıp production'a deploy edilir. Ayrı deploy komutu yoktur.

---

## 2. Veri Akışı

### Statik build akışı
1. Geliştirici `git push origin main` yapar.
2. Vercel `npm install` → `node scripts/build-all.mjs` çalıştırır.
3. Build zinciri: Tailwind CSS derler, Supabase config'i env'den enjekte eder, veri dosyalarından (`data/`, `content/`) restoran/gazete/reklam/etkinlik sayfaları üretir, GTM/Meta Pixel enjekte eder.
4. `outputDirectory: "."` — üretilen statik dosyalar kökten servis edilir.

### Runtime (tarayıcı) akışı
- Sayfa yüklenir → i18n script `?lang=` parametresine göre metinleri değiştirir (sayfa yeniden yüklenmez).
- Supabase JS client `js/supabase-config.js` (build zamanında env'den üretilir) üzerinden **anon key** ile bağlanır — RLS ile korunur.
- Kullanıcı etkileşimleri (auth, yorum, form, AI sohbet) Supabase'e ya da Vercel `api/*.js` fonksiyonlarına gider.

### Zamanlanmış akış
- Vercel Cron `api/cron-rebuild.js`'i günlük çağırır → süresi dolan ilanları kapatır + Vercel Deploy Hook tetikler → taze veriyle (eczane nöbet, haberler) yeni build.
- Vercel Cron `api/cron-weekly-plan.js`'i haftalık çağırır → haftalık plan üretimi.

---

## 3. Build Zinciri — `scripts/build-all.mjs`

`vercel.json` `buildCommand` 256 karakter limitli olduğu için tüm adımlar tek bir orchestrator dosyasında zincirlenmiştir. Her adım fail-safe'tir: `required: true` olan adım başarısız olursa build durur; diğerleri hatada uyarı verip devam eder.

| # | Adım | Script | Zorunlu | Ne yapar |
|---|---|---|---|---|
| 1 | supabase-config | `build-supabase-config.mjs` | ✅ | `SUPABASE_URL` + `SUPABASE_ANON_KEY` env'den `js/supabase-config.js` (ESM) ve `js/supabase-window.js` (klasik global) üretir |
| 2 | tailwind | `build-tailwind.mjs` | ✅ | Tailwind CSS'i derler (CDN yanında build-time çıktı) |
| 3 | inject-gtm | `inject-gtm.mjs` | — | Tüm HTML'lere Google Tag Manager (`GTM_ID`) + Meta Pixel (`META_PIXEL_ID`) enjekte eder |
| 4 | restoran-pages | `build-restoran-pages.mjs` | — | Veriden restoran detay sayfalarını üretir |
| 5 | news-aggregator | `news-aggregator.mjs` | — | Bölgesel RSS kaynaklarından haber toplar |
| 6 | fetch-eczane | `fetch-eczane.mjs` | — | Nöbetçi eczane verisini çeker |
| 7 | build-ads | `build-ads.mjs` | — | Reklam / ilan sayfalarını üretir |
| 8 | newspaper-index | `build-newspaper-index.mjs` | — | Gazete index sayfasını üretir |
| 9 | agent-panel | `build-agent-panel.mjs` | — | Agent/ajans panelini üretir |

> **Not:** Görev tanımında geçen `vill-visionary` gibi adımlar bu sürümde zincirde değildir — kaynak `scripts/build-all.mjs`'e göre yukarıdaki 9 adım geçerlidir. Yeni adım eklerken bu dosyaya ekleyin, `vercel.json`'ı değiştirmeyin.

---

## 4. Supabase Edge Function'ları (5)

Deno tabanlı, `supabase/functions/<ad>/index.ts`. Çoğu **service_role** ile RLS'i bypass ederek yazar; anon widget'lar bu fonksiyonları çağırır ama tablolara doğrudan yazmaz.

| Fonksiyon | Rol | Notlar |
|---|---|---|
| `agency` | Ajans (agent şirketi) canlı backend | `/status`, `/enqueue`, `/run`, `/approve`, `/publish` uçları. LLM: NVIDIA NIM. State: `agency_jobs` / `agency_content` / `agency_state` |
| `lyra-chat` | AI konsiyerj (Lyra) sohbet | Konuşma belleği + persona. LLM sırası: NVIDIA (bedava) → Anthropic → stub |
| `vacation-planner` | Tatil asistanı plan üretimi | `ANTHROPIC_API_KEY` yoksa stub plan döner |
| `lost-found` | Kayıp / buluntu ilan servisi | Anon çağrı, service_role yazım |
| `newsletter-subscribe` | Bülten abonelik kaydı | E-posta abonelik + onay akışı |

---

## 5. Vercel Serverless (`api/*.js` — 12/12 DOLU)

Vercel Hobby planı en fazla **12** serverless fonksiyona izin verir; bu limit doludur. **Yeni `api/` fonksiyonu eklenemez** — bunun yerine script/cron-dalı/polling kullanılmalıdır.

Mevcut 12 fonksiyon: `cron-rebuild`, `cron-refresh-ig-token`, `cron-weekly-plan`, `ilan-page`, `instagram-hashtag`, `job-decision`, `jobs-sitemap`, `newsletter-confirm`, `social-publish-queue`, `telegram-webhook`, `welcome-email`, `whatsapp`.

**Cron (Vercel Hobby limiti: max 2, DOLU):**
- `api/cron-rebuild` — `0 3 * * *` (günlük 03:00 UTC): ilan kapatma RPC + deploy hook tetikleme.
- `api/cron-weekly-plan` — `0 6 * * 1` (Pazartesi 06:00 UTC): haftalık plan.

> Not: `cron-refresh-ig-token` bir `api/` fonksiyonudur ama `vercel.json` cron listesinde değildir (harici olarak tetiklenir). 3. bir Vercel cron eklemek deploy'u bozar.

---

## 6. Otomasyon Envanteri

| Alan | Bileşenler |
|---|---|
| **Gazete** | `newspaper/generator/build.mjs` (morning + magazine), `newspaper/generator/sources.mjs` (gerçek veri), `newspaper/templates/` |
| **Etkinlik** | `data/etkinlik-takvimi.json` + `scripts/events-lib.mjs` + `scripts/build-events-page.mjs` + `scripts/discover-events.mjs` |
| **Sosyal (IG)** | `scripts/ig-news-card.mjs` / `scripts/ig-news-post.mjs` (haber→IG), `lib/ig-reply.mjs` + `scripts/ig-reply-poll.mjs` (oto-cevap), `scripts/fb-lead-responder.mjs` (FB öneri) |
| **Haber** | `scripts/news-aggregator.mjs` (bölgesel kaynaklı RSS) |
| **Rapor** | `scripts/daily-status-report.mjs` (günlük Telegram durum) |

> IG paylaşımlarında görsel formatı JPEG olmalıdır (feed/carousel PNG kabul etmez). Bkz. ilgili script'lerdeki notlar.

---

## 7. AI Katmanı — `lib/cheap-llm.mjs`

Maliyet optimizasyonu için "angarya" LLM işleri (metin çıkarımı, sınıflandırma, caption, haber özeti, çeviri, taslak, boilerplate) otomatik olarak **ücretsiz → ücretli** sırasıyla yönlendirilir. Claude yalnızca kalite gerektiren işlerde ya da fallback olarak kullanılır.

**API:**
```js
import { cheapLLM, cheapJSON } from './lib/cheap-llm.mjs';
const { text, provider, model } = await cheapLLM(prompt, { system, json, maxTokens });
const { data, provider, model } = await cheapJSON(prompt, { system });
```

**Sağlayıcı sırası** (`CHEAP_LLM_ORDER` env ile değiştirilebilir; varsayılan): `ollama` (yerel, sınırsız bedava) → `nvidia` (NIM, ~40 RPM bedava) → `gemini` → `claude` (fallback). Kodda ayrıca `cerebras`, `groq`, `routellm` sağlayıcıları da tanımlıdır (ilgili env anahtarı varsa devreye girer).

**Kural:** Yeni otomasyon yazarken doğrudan Anthropic çağrısı yapmayın — daima `cheap-llm` router'ını kullanın. Yüksek hacimli işleri `{ only: 'ollama' }` ile yerel modele zorlayarak NVIDIA kotasını büyük işlere saklayın.

Detaylı repo kuralı: [`../CLAUDE.md`](../CLAUDE.md).

---

## 8. Dizin Sorumlulukları

| Dizin | Sorumluluk |
|---|---|
| `scripts/` | Build orchestrator (`build-all.mjs`) + adım script'leri + otomasyon + `_` önekli tek-seferlik manuel araçlar |
| `newspaper/` | AI gazete motoru (generator + sources + templates) |
| `restoran/` `otel/` `villa/` `plaj/` `hizmet/` | Build ile üretilen veya elle bakımı yapılan detay route sayfaları |
| `demo/` `satis-demo/` `lamora/` | İşletme demo siteleri + admin panelleri (SaaS satış ürünü) |
| `supabase/` | Edge Function'lar + migration / config |
| `api/` | Vercel serverless fonksiyonları (12/12 dolu) |
| `functions/` | Yardımcı fonksiyon modülleri |
| `lib/` | Paylaşılan modüller (`cheap-llm`, `ig-reply`, `reklam-uyum` vb.) |
| `js/` | Tarayıcı tarafı client script'leri |
| `remotion/` | Video / reel üretimi |
| `data/` `content/` | Build girdisi veri dosyaları (etkinlik, haber, işletme envanteri) |
