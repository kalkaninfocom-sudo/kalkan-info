# 🗺️ YOL HARİTASI — Gazete + Etkinlik + Sosyal Medya Otomasyonu

> **Bu dosya CANLI haritadır.** İş parça parça gidiyor; yarım kalırsa buradan "ne yaptık, nerede kaldık, sıradaki ne" görülür. Her büyük adımda güncellenir.
>
> **Son güncelleme:** 2026-08-24
> **Durum kodları:** ✅ bitti · 🔨 sürüyor · ⏳ bekliyor · ⛔ bloke (canlıya bir şey lazım)

---

## 🎯 Vizyon
Kalkan'ın günlük medya ekosistemi: **gerçek veriyle dolan günlük gazete (ön: haber, arka: gece hayatı magazini)** + **gün-gün etkinlik takvimi (web + gazete)** + **kalkaninfo kendi sosyal medyasında otonom haber-ajansı yayını ve oto-cevap** + bölgesel haber toplama. Hepsi tek veri katmanından beslenir.

---

## 📊 DURUM TABLOSU

| # | İş | Durum | Dosyalar | Canlıya ne lazım |
|---|----|-------|----------|------------------|
| 1 | Gazete ön yüz — gerçek veri | ✅ | `newspaper/generator/sources.mjs`, `build.mjs` | — (çalışıyor) |
| 2 | Etkinlik takvimi backbone | ✅ | `data/etkinlik-takvimi.json`, `scripts/events-lib.mjs` | — |
| 3 | Gazete ön yüz "Bugün Kalkan'da" → takvim | ✅ | `sources.mjs` getEventsColumn | — |
| 4 | Magazin arka yüz (gece hayatı) | ✅ | `newspaper/templates/magazine.html` | — (Chocolate hero çalışıyor) |
| 5 | Web `/etkinlikler` sayfası | ✅ kod (localhost doğrulandı) | `scripts/build-events-page.mjs`, `etkinlikler/index.html` | deploy (commit + push) |
| 6 | Kendi IG: haber → ajans paylaşımı | ✅ kod (kart üretildi) | `scripts/ig-news-card.mjs`, `ig-news-post.mjs` | IG token doğrula + cron/PC runner |
| 7 | Kendi IG: yorum/DM oto-cevap | ✅ kod | `lib/ig-reply.mjs`, `scripts/ig-reply-poll.mjs` | IG token + runner (api 12/12 → polling) |
| 8 | Bölgesel haber RSS genişletme | ✅ canlı | `scripts/news-aggregator.mjs` (+4 RSS, 7/7) | — |
| 9 | Otonom etkinlik toplama | ✅ kod (dry-run) | `scripts/discover-events.mjs` | ⛔ SerpApi quota + IG scraper kararı |
| 10 | FB "Friends of Kalkan" güvenli responder | ✅ kod (test geçti) | `scripts/fb-lead-responder.mjs`, `docs/FB_RESPONDER.md` | ⛔ FB okuma (Apify ~$30-49/ay) + onay |
| 11 | Ucuz LLM router (token tasarrufu) | ✅ CANLI+BAĞLI | `lib/cheap-llm.mjs` | nvidia+ollama(llama3.2:3b)+gemini hazır. 4 script bağlandı. `CHEAP_LLM_TIMEOUT_MS` knob eklendi (2026-08-24) |
| 12 | Proje geneli durum haritası | ✅ | `docs/PROJE_DURUMU.md` | — (master "nerede kaldık") |
| 13 | Günlük 00:00 Telegram raporu | ✅ kod (dry-run) | `scripts/daily-status-report.mjs`, `docs/GUNLUK_RAPOR.md` | Telegram token/chat ID + cron wiring |
| 14 | **Gazete güvenilirlik katmanı** | ✅ **2026-08-24** | `gazete-approval.yml`, `gazete-heartbeat.mjs`, `data/i18n-cache/` | Commit+heartbeat reel'den ÖNCE; job 60dk cap; `I18N_LLM_ORDER: gemini,groq`; reel continue-on-error+10dk timeout; i18n-cache kalıcı |
| 15 | **Hat nöbeti (line-heartbeat)** | ✅ **2026-08-24** | `line-heartbeat.yml`, `scripts/agency/line-heartbeat.mjs` | 12:30 TR'de tüm hatlar prova; bayat hat → Telegram + `LINES_HEALTHCHECK_URL` dead-man's-switch |
| 16 | **Healthchecks.io dead-man's-switch** | ✅ **2026-08-24** | `GAZETE_HEALTHCHECK_URL` secret | Her sabah heartbeat ping; 2 gün sessizlik → harici alarm |

---

## ✅ BİTENLER (detay)
- **Gazete demo → gerçek veri:** Open-Meteo (hava/deniz/UV/rüzgar/gün doğ-bat) + `haberler.json` Kalkan-yerel skorlama (ulusal haber sızması çözüldü) + Şefin Önerisi (restoranlar.json) + nöbetçi eczane. `--demo` flag + her alan fallback.
- **Etkinlik takvimi:** recurring (haftalık) + oneoff (tarihli) şema, 11 seed (hepsi `verified:false` taslak). Motor: gün/hafta açar, mekan koordinat/foto enrich. CLI: `node scripts/events-lib.mjs 2026-06-28`.
- **Magazin:** "Chocolate Club Kalkan dün geceyi salladı" hero + 3 kart + "Bu Akşam Program". Foto `file://` (PDF garanti) + gradient fallback. `node newspaper/generator/build.mjs magazine`.

## ✅ 8 AGENT TAMAMLANDI (paralel, 2026-06-28)
5–13 numaralı işler 8 paralel agent + cheap-llm ile inşa edildi, hepsi diskte doğrulandı (syntax + smoke test + görsel). Web sayfası localhost'tan, magazin/gazete PDF, IG kartı screenshot ile teyit edildi. **Hiçbiri henüz commit edilmedi.**

## ⛔ BLOKE / KARAR BEKLEYEN (Berkay)
- **SerpApi quota DOLU** → otonom Google etkinlik (#9) çalışmaz. Çözüm: saat başı reset bekle ya da plan upgrade ($75/ay → 5K query).
- **IG/FB scraper (sahip olunmayan profil/sayfa)** → #9 (IG caption), #10 (FB okuma). Karar: Apify (~$30-49/ay, ToS gri) mı, manuel mı, atla mı?
- ~~**IG token**~~ → ✅ ÇÖZÜLDÜ (2026-07-08). Secret'lar eklendi, publish workflow success.
- **api/ 12/12 DOLU** (Vercel Hobby) → yeni webhook eklenemez; otomasyonlar script/cron olarak çalışır.
- **PR #55 beklemeye alındı** → gazete yayını 2026-08-24 sabahı doğrulanınca merge edilecek.
- **`LINES_HEALTHCHECK_URL` secret eksik olabilir** → line-heartbeat için harici dead-man's-switch (Healthchecks.io).

## ▶️ SIRADAKİ NET ADIM
1. **2026-08-25 sabah 07:45+ GitHub Actions log kontrolü** — commit adımı reel'den önce tamamlandı mı? Heartbeat Telegram mesajı geldi mi?
2. **Gazete yayını doğrulanınca PR #55 merge.**
3. **`LINES_HEALTHCHECK_URL` secret ekle** (Healthchecks.io'da yeni check → URL'yi secret'a yaz).
4. IG hesap adlarını (`data/ig-watch-accounts.json`) güncelle — 11 hesap hâlâ pasif.

## 📌 NOTLAR
- Her parça tek başına çalışır/test edilmiş halde; yarım kalsa bile birleşince bütün tamamlanır.
- **2026-08-22..24 sessiz kesinti kök neden:** reel timeout → commit SKIP → gazete 3 gün yayınlanmadı. Düzeltme bu oturumda uygulandı.

## ✅ SOSYAL ONAY ZİNCİRİ — 3 BOŞLUK KAPATILDI (2026-07-01)
n8n/VPS spec'i geldi ama sistemin %85'i zaten canlıydı (Supabase `social_posts` + `weekly-content-planner` + `telegram-webhook` onay + `social-publish-queue` yayın). n8n kurulmadı; 3 gerçek boşluk mevcut sisteme script/dal olarak eklendi:

- **Gap A — "Önerilen Saatte" ölü yol:** `social-publish-queue.js` çalışıyordu ama onu tetikleyen cron yoktu (cron 2/2 dolu). Çözüm: `api/cron-weekly-plan.js`'e `mode=publish` dalı (queue mantığını çağırır, yeni fonksiyon/cron yok).
- **Gap B — Workflow 4 (hatırlatma/eskalasyon):** hiç yoktu → `scripts/approval-reminder.mjs`. Kademe: H1 nazik, H2 ikinci+ping, H3 son çare (config'e göre auto-approve veya atla). `engagement_metrics.reminder_stage` ile tekrar spam engellenir.
- **Gap C — seed→onay kopukluğu:** `seed-30day-social.mjs` `pending_approval` ekliyor ama onay mesajı göndermiyordu. Aynı `approval-reminder.mjs`: `telegram_message_id` yoksa ilk onay mesajını (4 buton) gönderir.

**Dal:** `api/cron-weekly-plan.js?mode=publish` ve `?mode=remind` (mevcut router, secret korumalı).

### ⛔ BERKAY MANUEL (2 adım, ~5 dk) — cron 2/2 dolu olduğu için dış tetikleyici
1. **cron-job.org** (bedava) → 2 iş ekle, ikisi de `Authorization: Bearer <IG_CRON_SECRET>` header ile:
   - `https://www.kalkaninfo.com/api/cron-weekly-plan?mode=remind` → **saatte 1** (hatırlatma/eskalasyon + seed onay gönderimi)
   - `https://www.kalkaninfo.com/api/cron-weekly-plan?mode=publish` → **saatte 1** (zamanı gelen approved post'ları yayınla)
2. **Vercel env** (opsiyonel, varsayılan güvenli): `APPROVAL_ESCALATION=skip` (24s onaysız → atla) veya `=default` (24s onaysız → otomatik yayınla). Eşikler: `APPROVAL_REMIND_H1/H2/H3` (varsayılan 4/12/24 saat).

**Not:** local test 401 verir (Supabase service-role local'de bayat, bilinen kısıt); prod env'de geçerli. Henüz commit edilmedi.
