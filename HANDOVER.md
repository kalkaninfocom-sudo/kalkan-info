# Kalkan Info — Devir Kontrol Listesi

Bu doküman, kalkaninfo.com'u devralan geliştirici / işletme için pratik teslim rehberidir. Mimari ve kurulum detayları için: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`SETUP.md`](SETUP.md), [`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md).

---

## 1. Devralınacak Hesaplar

Öncelik sırasıyla erişim / transfer alınması gerekenler:

| Hesap | Ne için | Devir işlemi |
|---|---|---|
| **Supabase** | Postgres, Auth, Storage, 5 Edge Function | Proje transfer (organization / owner devri) |
| **Vercel** | Hosting, CI/CD, serverless, cron | Proje + domain transfer, env değişkenleri |
| **Alan adı (kalkaninfo.com)** | Domain + DNS | Registrar transfer (auth/EPP code) + DNS yönetimi |
| **Meta / Instagram / Facebook** | IG widget, IG/FB otomasyon, WhatsApp | Meta App devri, token yenileme, App Secret reset |
| **Anthropic** | Claude API (AI) | Yeni API key |
| **Google Gemini** | cheap-llm ücretsiz LLM | Yeni API key |
| **NVIDIA NIM** | cheap-llm + Edge Function LLM | Yeni API key (build.nvidia.com) |
| **Resend** | Transactional e-posta | Yeni API key + domain doğrulama |
| **SerpAPI** | İşletme zenginleştirme | Yeni API key |
| **GTM / GA4 / Plausible** | Analitik | Hesap erişimi |

Servis-servis detay (env değişkenleri, nereden alınır): **[`docs/EXTERNAL_DEPS.md`](docs/EXTERNAL_DEPS.md)**.

---

## 2. İlk Adımlar (kurulum sırası)

1. **Repoyu klonla + bağımlılıklar:** `git clone ... && cd kalkan-info && npm install` (Node >= 20).
2. **Env hazırla:** `cp .env.example .env.local`, gerçek değerleri gir (bkz. EXTERNAL_DEPS).
3. **Lokal test:** `npm run dev` → http://localhost:3000 — statik sayfaların açıldığını doğrula.
4. **Supabase bağla:** projeye eriş, migration'ları uygula (`supabase db push`), 5 Edge Function'ı deploy et, Edge Function secret'larını set et.
5. **Vercel bağla:** projeyi devral / bağla, tüm env değişkenlerini Vercel → Settings → Environment Variables'a gir, `VERCEL_DEPLOY_HOOK_URL` oluştur.
6. **Domain & DNS:** alan adını devral, DNS'i Vercel'e yönlendir.
7. **Meta token'ları:** Meta App'i devral, `IG_LONG_LIVED_TOKEN` yenile, `META_APP_SECRET` reset et, WhatsApp webhook doğrula.
8. **Deploy test:** küçük bir değişikliği `git push origin main` ile prod'a göndererek CI/CD'yi doğrula.

Kurulum ayrıntısı için [`SETUP.md`](SETUP.md).

---

## 3. Kritik Bilinmesi Gerekenler

> Bu kısıtlara uymamak deploy'u bozar veya servisi keser.

- **Vercel `api/*.js` limiti: 12 / 12 DOLU.** Yeni `api/` fonksiyonu **eklenemez** — deploy'u bozar. Yeni sunucu tarafı iş için: script, cron-dalı veya polling kullanın (ya da mevcut bir fonksiyonu birleştirin).
- **Vercel cron limiti: 2 / 2 DOLU** (`cron-rebuild` + `cron-weekly-plan`). 3. cron deploy'u bozar. Ek zamanlı iş gerekirse mevcut cron'lara dallanın.
- **IG token yenileme:** `IG_LONG_LIVED_TOKEN` **60 gün** geçerli, periyodik yenilenmeli. `api/cron-refresh-ig-token.js` bunun için var (harici tetiklenir). Yenilenmezse IG otomasyonları durur.
- **cheap-llm zorunluluğu:** Yeni otomasyon yazarken doğrudan Anthropic/OpenAI çağrısı **yapmayın** — `lib/cheap-llm.mjs` router'ını kullanın (ücretsiz → ücretli sıra: ollama → nvidia → gemini → claude). Token maliyetini minimumda tutar. Bkz. [`CLAUDE.md`](CLAUDE.md).
- **Deploy modeli:** `git push origin main` = otomatik production. Ayrı deploy komutu yok. `origin/main`'e doğrudan push production'a gider.
- **`.env.local` git'e girmez;** secret'ları log'a basmayın. Production env'i Vercel Dashboard'da tutulur.
- **IG görsel formatı:** feed/carousel paylaşımlarında görsel JPEG olmalı (PNG → 9004 hatası).
- **`scripts/` `_` önekli araçlar:** tek-seferlik manuel iş araçlarıdır (foto çekme, keşif, reel). Build zincirinin parçası değildir ama değerlidir — silmeyin.

---

## 4. Doğrulama (devir tamamlandı mı?)

- [ ] Lokal `npm run dev` çalışıyor, ana sayfalar açılıyor.
- [ ] `npm run build` hatasız tamamlanıyor.
- [ ] Supabase migration + 5 Edge Function deploy edildi ve yanıt veriyor.
- [ ] Vercel'de tüm env değişkenleri girildi, `git push` ile prod deploy başarılı.
- [ ] Domain kalkaninfo.com Vercel'e yönleniyor, SSL aktif.
- [ ] Meta token'lar yenilendi, IG/WhatsApp otomasyonları çalışıyor.
- [ ] Resend domain doğrulaması yeni hesapta yapıldı (test maili gidiyor).
- [ ] 2 cron ve deploy hook çalışıyor.

Devralan geliştirici için repo kuralları: [`CLAUDE.md`](CLAUDE.md).
