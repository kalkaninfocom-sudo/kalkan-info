# 🗞️ Günlük Durum Raporu — Telegram Otomasyonu

Her gün Berkay'a Telegram'dan **"bugün ne yapıldı · ne yarım kaldı · sıradaki ne"** özeti gönderir.

- **Script:** `scripts/daily-status-report.mjs`
- **Kaynaklar:**
  1. `git log --since=midnight` → bugünkü commit'ler = **✅ Bugün yapılanlar**
  2. `docs/PROJE_DURUMU.md` (yoksa `docs/YOL_HARITASI_GAZETE_OTOMASYON.md`) durum tablosu →
     **🔨 Yarım/sürüyor**, **⏳ Bekleyen**, **⛔ Bloke** ve **▶️ Sıradaki net adım**
- **Gönderim:** `lib/telegram.js` → `sendMessage(chatId, text, { parse_mode: 'HTML' })`

---

## ⚙️ Aktivasyon — ne lazım?

İki env değişkeni (zaten sosyal-medya botu için projede kullanılıyor):

| Env | Açıklama |
|-----|----------|
| `TELEGRAM_BOT_TOKEN` | BotFather'dan alınan bot token |
| `TELEGRAM_ADMIN_CHAT_ID` | Raporun gideceği chat ID (Berkay'ın özel chat'i) |

> Chat ID'yi bilmiyorsan: bota bir mesaj at, sonra
> `https://api.telegram.org/bot<TOKEN>/getUpdates` → `message.chat.id`.
> (Proje içinde `scripts/setup-telegram.mjs` de bu işi yapar.)

Bu ikisi tanımlı **değilse** script çökmez — raporu `stdout`'a basar (graceful).

---

## ▶️ Çalıştırma

```bash
# Göndermeden ekrana bas (test)
node scripts/daily-status-report.mjs --dry-run

# Üret + Telegram'a gönder (env'ler tanımlıysa)
node scripts/daily-status-report.mjs
```

---

## ⏰ Her gün 00:00 — zamanlama

### Seçilen yöntem: PC zamanlayıcı (PRİMER, git'li tam rapor)

`git log` **yalnızca repo'nun olduğu makinede (PC) çalışır** — Vercel serverless'ta git yoktur.
Bu yüzden "bugün yapılanlar" tam listesini ancak PC üretebilir. 00:00'da PC'de zamanla:

**Windows Görev Zamanlayıcı (Task Scheduler):**
- Trigger: Daily, 00:00
- Action → Program/script: `node`
- Arguments: `scripts/daily-status-report.mjs`
- Start in: `C:\Users\socie\kalkan-info`

> PowerShell ile tek seferde kurmak için (Berkay çalıştırır):
> ```powershell
> $action  = New-ScheduledTaskAction -Execute "node" -Argument "scripts/daily-status-report.mjs" -WorkingDirectory "C:\Users\socie\kalkan-info"
> $trigger = New-ScheduledTaskTrigger -Daily -At 00:00
> Register-ScheduledTask -TaskName "KalkanGunlukRapor" -Action $action -Trigger $trigger -Description "Kalkan Info gunluk Telegram durum raporu"
> ```

### Yedek yöntem: serverless dal (yol haritası özeti, git'siz)

`api/cron-rebuild.js` içine **`?job=daily-status`** dalı eklendi. Çağrıldığında yol haritası
bölümünü (🔨/⏳/⛔/▶️) Telegram'a gönderir — **git özeti olmadan** (sunucuda git yok):

```
GET /api/cron-rebuild?job=daily-status&secret=<CRON_SECRET>
```

Bunu dışarıdan bir zamanlayıcıya (cron-job.org, GitHub Actions, UptimeRobot vb.) 00:00 TR'ye
bağlayabilirsin. **Yeni `api/*.js` eklenmedi** (12/12 dolu) ve **yeni Vercel cron eklenmedi**.

> ### ⛔ Neden vercel.json'a 3. cron EKLENMEDİ?
> Vercel **Hobby planı en fazla 2 cron** işine izin veriyor ve ikisi de dolu
> (`cron-rebuild` + `cron-weekly-plan` — bkz. `docs/PROJE_DURUMU.md`). 3. bir cron entry'si
> deploy'u bozar. Bir slot boşalır ya da plan yükseltilirse `vercel.json` → `crons`'a şunu ekle
> (00:00 TR = 21:00 UTC):
> ```json
> { "path": "/api/cron-rebuild?job=daily-status", "schedule": "0 21 * * *" }
> ```

---

## 🧩 Mimari notlar

- `buildReport({ includeGit })` export edilir; `includeGit:false` ile serverless dalı git'siz çağırır.
- Script doğrudan çalıştırılınca `main()` koşar; import edilince **koşmaz** (`import.meta.url` guard).
- Durum tablosu ayrıştırma kolon-adı tabanlıdır (her tablonun `Durum`/`İş`/`Canlıya ne lazım`
  başlığından index çıkarır) → hem çok-tablolu `PROJE_DURUMU.md` hem tek-tablolu yol haritası çalışır.
  Özet "BLOKE" tablosu (Durum kolonu yok) atlanır → çift sayım olmaz.
- Telegram mesajı **HTML** parse mode ile gönderilir (MarkdownV2 escape derdi yok).
