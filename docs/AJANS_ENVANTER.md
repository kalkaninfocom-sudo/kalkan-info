# Ajans Envanteri — Dürüst Durum (Fix #5: birikinti temizliği)

**Amaç:** "Gerçek değer mi, kod karışıklığı mı?" sorusuna rakamla cevap. Ne CANLI çalışıyor, ne
bağlı-ama-çalışmıyor, ne ölü. Mud üstüne inşa etmemek için. (2026-07-11)

## ✅ CANLI ÇEKİRDEK (~24 script — workflow/scheduler'da GERÇEKTEN çalışıyor)
Gerçek değer BURADA. GitHub Actions cron + scheduler ile döngüde:
- **Gazete:** `gazete-editorial(-en)`, `gazete-approval`, `newspaper-daily`, `news-aggregator`, `bulten-approval`
- **Reels onay:** `reel-approval(-en)`, `restoran/villa/antik/plaj-reel-approval`, `auto-publish-stale`, `publish-approved`
- **Brifing:** `morning-briefing` (28 ajan, günlük)
- **IG/FB:** `ig-news-harvest`, `ig-reply-poll` (yorum/DM oto-cevap), `ig-story-repost` (YENİ), `ig-venue-watch`, `ig-weekly-report`, `fb-page-harvest`
- **İlan/site:** `ilan-post`, `site-freshness`, `scheduler`

## 🔌 BAĞLI DEĞİL — bu oturumda eklendi, HİÇBİR döngüde yok (ref: 0)
Manuel çalışıyor ama kimse çalıştırmıyor = **şu an DEĞER ÜRETMİYOR.** Dürüst karar gerek:
| Script | Ne yapar | Bağımlı olduğu (eksik) | Karar |
|--------|----------|------------------------|-------|
| `editor-gate` | yayın öncesi editör denetimi | — | **WIRE** → morning-briefing/gazete'yi kapıya sok (gerçek kalite) |
| `news-verifier` | haber kaynak/sansasyon skoru | — | **WIRE** → gazete pipeline'ına |
| `brand-router` + `line-producer/multilang/card` + `agency-run` | çok-marka/çok-dil hat üretimi | **IG hesapları (Haber/Magazin/TV) yok** | DENEYSEL — hesaplar açılana kadar bekle |
| `tv-producer` | röportaj→reels planı | **TV hesabı + çekim yok** | DENEYSEL |
| `venue-signal` | dijital ikiz doluluk sinyali | **Google Maps key + ikiz canlı değil** | DENEYSEL |
| `growth-agent` | büyüme + satış hunisi | **IG metriği (ig-report) yok** | DENEYSEL |

## ☠️ ÖLÜ / DRIFT (temizlenecek)
- ✅ `ig-weekly-report.mjs.local-bak` — SİLİNDİ (rebase artığı)
- ⚠️ `fb-page-harvest.mjs` **VE** `fb-pages-harvest.mjs` — ikiz; hangisi canlı belirlenip diğeri silinmeli
- ⚠️ `scheduler.mjs` `ig-news-post.mjs` + `weekly-founder-report.mjs`'e referans veriyor ama **dosyalar yok** → ölü referans, temizle

## Dürüst sonuç
- **Çalışan çekirdek gerçek ve değerli** (gazete + reels + IG oto-cevap + brifing canlı).
- **Bu oturumda eklenen 11 parçanın hiçbiri döngüde değil** → şu an "gösterişlik genişlik". 2'si (editor-gate, news-verifier) **kolay WIRE edilip gerçek kaliteye** dönüşebilir; 6'sı dış bağımlılık (hesap/key) beklerken deneysel kalmalı — çalışan sistemmiş gibi anlatılmamalı.
- Küçük drift (fb ikizi, ölü scheduler ref) temizlenmeli.

## Sıradaki (program)
- **Fix #4** reliability: token-ölüm tespiti + heartbeat + Telegram alarm.
- **Fix #3** (asıl değer): motoru gerçek küratörlü veriye + fotoğrafa GROUND et → DIY'den üstün çıktı.
- **Fix #1/#2** moat: tekrarlanabilir bölgesel veri-edinme pipeline'ı.
