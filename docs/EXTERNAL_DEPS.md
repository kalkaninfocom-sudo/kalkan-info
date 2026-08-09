# Kalkan Info — Dış Bağımlılıklar & Hesap Devir Tablosu

Bu doküman, devralan geliştirici / işletme için tüm dış servisleri, kullanılan ortam değişkenlerini, hesabın nereden alındığını ve devir notlarını listeler. Ortam değişkenlerinin tamamı `.env.example` içinde placeholder + açıklama ile mevcuttur. Gerçek değerler `.env.local` (git'te değil) ve Vercel Dashboard → Settings → Environment Variables'tadır.

> **Güvenlik:** Bu dokümanda hiçbir secret **değeri** yoktur — yalnızca değişken **isimleri**. Gerçek anahtarları asla git'e commit etmeyin, log'a basmayın.

---

## Devir Öncelik Sırası (kritik hesaplar)

Devralan kişinin **ilk** alması / transfer etmesi gerekenler:

1. **Supabase projesi** — tüm veri, auth, storage, Edge Function'lar burada.
2. **Vercel projesi + domain** — hosting, CI/CD, serverless, cron, alan adı.
3. **Alan adı (kalkaninfo.com) + DNS** — registrar + DNS yönetimi.
4. **Meta / Instagram / Facebook** — token'lar periyodik yenilenir (aşağıya bakın).
5. **Anthropic / Gemini / NVIDIA** — AI sağlayıcı anahtarları.
6. **Resend / SerpAPI** — e-posta ve zenginleştirme.

---

## 1. Supabase (zorunlu — çekirdek backend)

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| Postgres DB, Auth, Storage, Edge Function'lar | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | Supabase Dashboard → Project → Settings → API |

- `SUPABASE_ANON_KEY` **public**'tir (RLS korur), tarayıcıya açılır.
- `SUPABASE_SERVICE_ROLE_KEY` **secret**'tir — sadece server/Edge Function, asla tarayıcıya sızdırılmaz.
- **Devir notu:** Supabase projesi transfer edilmeli (Organization transfer veya yeni owner davet). Migration'lar `supabase/` altında. Edge Function'lar `supabase functions deploy` ile deploy edilir.

---

## 2. Vercel (zorunlu — hosting / CI-CD)

| Ne için | Env / kaynak | Nereden alınır |
|---|---|---|
| Hosting, build, serverless, cron | Vercel projesi (git-connected) + tüm env değişkenleri | Vercel Dashboard |
| Günlük rebuild deploy hook'u | `VERCEL_DEPLOY_HOOK_URL` | Vercel → Settings → Git → Deploy Hooks |
| Production URL | `VERCEL_URL` (otomatik set) | Vercel |

- **Devir notu:** Vercel projesi + domain devri gerekir. Tüm `.env.local` değişkenleri Vercel → Settings → Environment Variables'a girilmelidir. **Hobby limitleri:** max 12 `api/*.js` fonksiyon (dolu), max 2 cron (dolu).
- Deploy: `git push origin main` → otomatik prod. Ayrı komut yok.

---

## 3. Alan Adı & DNS

| Ne için | Kaynak | Devir notu |
|---|---|---|
| `kalkaninfo.com` alan adı | Registrar | Registrar hesabı + domain transfer (auth code / EPP) |
| DNS kayıtları | DNS sağlayıcı | A/CNAME kayıtları Vercel'e işaret eder; devir sırasında DNS yönetimi transfer edilmeli |

---

## 4. Anthropic (Claude)

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| Tatil planlama, rehber, doğrulama, cheap-llm fallback | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

Agent→model yönlendirme değişkenleri (`AGENT_*_MODEL`) `.env.example`'da; hangi agent'ın hangi Claude modelini çağırdığını belirler. Rate/bütçe limitleri: `AGENT_DAILY_BUDGET_USD`, `AGENT_DAILY_USER_LIMIT_ANON/AUTH`.

---

## 5. Google Gemini

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| cheap-llm zincirinde ücretsiz tier LLM | `GOOGLE_GEMINI_API_KEY` | Google AI Studio / LOA Workspace |

---

## 6. NVIDIA NIM

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| cheap-llm zincirinde ücretsiz tier (~40 RPM), agency + lyra-chat Edge Function'ları | `NVIDIA_API_KEY` (ops: `NVIDIA_MODEL`) | build.nvidia.com → API key (`nvapi-...`) |

- **Devir notu:** Ücretsiz tier dev/test/araştırma içindir; yoğun production kullanımı için NVIDIA AI Enterprise gerekebilir. Kart gerekmez.

---

## 7. Ollama (yerel — opsiyonel)

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| cheap-llm'de %100 ücretsiz yerel LLM (yüksek hacim) | `OLLAMA_MODEL` (varsayılan `llama3.2:3b`) | Yerel Ollama kurulumu (`ollama pull ...`) |

- Yerel çalıştığından devir gerektirmez; devralanın makinesinde Ollama kurulu olması gerekir (opsiyonel). `http://localhost:11434`.

---

## 8. Meta / Instagram Graph API

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| IG hashtag widget, IG paylaşım/oto-cevap | `META_APP_ID`, `META_APP_SECRET`, `IG_BUSINESS_ID`, `IG_LONG_LIVED_TOKEN`, `IG_HASHTAG`, `IG_CRON_SECRET` | developers.facebook.com → App |

- **Devir notu (kritik):** `IG_LONG_LIVED_TOKEN` **60 gün** geçerlidir ve periyodik yenilenmelidir. `api/cron-refresh-ig-token.js` fonksiyonu yenileme için mevcut (harici tetiklenir). Devralan Meta App'i (ID `2258853858192830`) kendi Business hesabına almalı veya App Secret'ı reset etmelidir.
- Eski harvester değişkenleri (`IG_ACCESS_TOKEN`, `IG_PROFILES`, `IG_HARVEST_INTERVAL_HOURS`) kullanılmıyor.

---

## 9. WhatsApp Business (Meta Cloud API)

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| WhatsApp webhook (`api/whatsapp.js`) | `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `WHATSAPP_ALLOWLIST` | Meta Developers → WhatsApp ürünü |

- `META_VERIFY_TOKEN` webhook doğrulaması için sen belirlediğin random string. `META_ACCESS_TOKEN` System User kalıcı token.

---

## 10. Meta Pixel & Facebook

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| Meta Pixel (build'de enjekte) | `META_PIXEL_ID` (varsayılan koda gömülü) | Meta Events Manager |
| FB lead yanıtı | Meta App token'ları (yukarıdaki grup) | Meta Developers |

---

## 11. Resend (E-posta)

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| Transactional e-posta (hoşgeldin, bülten onay) | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_DEV_REDIRECT` (ops) | resend.com → API Keys |

- Ücretsiz tier ~3000 mail/ay. Gönderim domain'i (`kalkaninfo.com`) Resend'de doğrulanmış olmalı (SPF/DKIM). Devirde domain doğrulaması yeni hesapta tekrar yapılmalı.

---

## 12. SerpAPI

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| İşletme foto / telefon / yorum zenginleştirme (`scripts/fetch-*-photos.mjs`, `scripts/agency/serpapi-enrich-phones.mjs`) | `SERPAPI_KEY` | serpapi.com → API Key |

- Build zincirinin zorunlu parçası değildir; manuel/periyodik zenginleştirme araçları kullanır.

---

## 13. Analitik

| Ne için | Env değişkenleri | Nereden alınır |
|---|---|---|
| Google Tag Manager | `GTM_ID` (varsayılan `GTM-PLWTGK2G`) | tagmanager.google.com |
| Google Analytics 4 | `ANALYTICS_GA4_ID` | analytics.google.com |
| Plausible | (self-host / hesap; CSP'de `plausible.io` izinli) | plausible.io |

---

## 14. Opsiyonel / Faz-sonrası servisler

`.env.example`'da yer alan ama şu an aktif kritik olmayan servisler:

| Servis | Env | Durum |
|---|---|---|
| Buffer / Publer | `BUFFER_API_KEY`, `PUBLER_API_KEY` | Sosyal posting (opsiyonel) |
| OpenAI | `OPENAI_API_KEY` | GPT alternatif/fallback (opsiyonel) |
| Sentry | `SENTRY_DSN` | Error tracking (opsiyonel) |
| Skyscanner / Amadeus | `SKYSCANNER_API_KEY`, `AMADEUS_CLIENT_ID/SECRET` | Uçuş arama (Faz 3+, onay bekliyor) |
| OpenWeather | `OPENWEATHER_API_KEY` | Hava (Open-Meteo anahtarsız kullanılıyor, bu opsiyonel) |
| Google OAuth | (`.env`'de değil — Supabase Dashboard'a girilir) | Supabase Auth provider |
| Cerebras / Groq / RouteLLM | `CEREBRAS_API_KEY`, `GROQ_API_KEY`, `ROUTELLM_API_KEY`/`ABACUS_API_KEY` | cheap-llm ek sağlayıcıları (opsiyonel) |

---

## Devir Kontrol Özeti

- [ ] Supabase projesi transfer / yeni owner
- [ ] Vercel projesi + domain transfer, tüm env değişkenleri girildi
- [ ] Alan adı registrar + DNS devri
- [ ] Anthropic / Gemini / NVIDIA anahtarları yenilendi
- [ ] Meta App devri + `IG_LONG_LIVED_TOKEN` yenilendi + `META_APP_SECRET` reset
- [ ] Resend domain doğrulaması yeni hesapta
- [ ] SerpAPI anahtarı
- [ ] GTM / GA4 / Plausible hesap erişimi

Ayrıntılı adımlar için [`../HANDOVER.md`](../HANDOVER.md).
