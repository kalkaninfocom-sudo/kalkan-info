# Friends of Kalkan — Lead Responder

`scripts/fb-lead-responder.mjs`

"Friends of Kalkan" grubunda biri öneri sorduğunda (catering, restoran, villa,
transfer, tamir…), kalkaninfo.com veritabanından ilgili işletmeyi eşleyip
**samimi, spam olmayan İngilizce bir cevap taslağı** üretir ve Telegram'dan
Berkay'a onaya sunar.

---

## ⚠️ DÜRÜST RİSK AÇIKLAMASI — ÖNCE OKU

**"Friends of Kalkan" Berkay'a ait DEĞİL.** Bu yüzden bu araç bilinçli olarak
**otomatik yorum YAZMAZ.** Neden:

- **Meta ToS ihlali:** Sahibi olmadığın bir gruba/sayfaya otomatik yorum atmak
  Facebook Kullanım Şartları'na aykırıdır.
- **Spam algısı:** Her öneri postuna otomatik düşen bir bot, topluluk tarafından
  spam olarak işaretlenir → güven kaybı + Berkay'ın itibarına zarar.
- **Hesap ban riski:** Otomasyon tespit edilirse FB hesabı/sayfası askıya alınır.
- **Geri dönüşü zor:** Bir kez "reklam botu" damgası yedin mi, marka algısı
  düzelmez.

### Güvenli tasarım (bu araçta uygulanan)

| Katman | Otomatik mi? | Açıklama |
|--------|--------------|----------|
| **Okuma** (gönderiyi almak) | Hayır (varsayılan) | Manuel kopyala-yapıştır (`--paste`). Apify opsiyonu gri alan, aşağıda. |
| **Tespit + eşleştirme + taslak** | Evet | Claude + keyword fallback ile saniyeler içinde. |
| **Onay** | Yarı-otomatik | Telegram'dan Berkay'a taslak + buton gönderilir. |
| **Yayın (yorumu paylaşmak)** | **HAYIR — her zaman insan** | Berkay onaylar, **tercihen MANUEL** olarak kendi hesabından paylaşır. |

> **Altın kural:** Araç düşünür ve yazar; **paylaşan her zaman insandır.**

---

## Kurulum

Yeni bağımlılık yok. Mevcut `lib/anthropic.js` ve `lib/telegram.js` kullanılır.

Env değişkenleri (`.env.local`):

```
ANTHROPIC_API_KEY=...          # taslak üretimi (yoksa keyword fallback devreye girer)
TELEGRAM_BOT_TOKEN=...         # onay mesajı (yoksa konsola yazar)
TELEGRAM_OWNER_CHAT_ID=...     # Berkay'ın chat id'si (TELEGRAM_CHAT_ID de okunur)
```

> Not: Anthropic key geçersiz/bakiyesiz olsa bile araç çökmez — keyword tabanlı
> tespit + şablon cevaba düşer (test çıktısında görüldü).

---

## Kullanım

```bash
# Bir gönderiyi manuel test et (Telegram'a onay gönderir):
node scripts/fb-lead-responder.mjs --paste "Hi all, can anyone recommend a good catering service for a villa party in Kalkan?"

# Telegram göndermeden sadece taslağı gör:
node scripts/fb-lead-responder.mjs --paste "..." --no-telegram

# Eşleştir + taslakla ama onaya hiç gönderme (kuru çalıştırma):
node scripts/fb-lead-responder.mjs --paste "..." --dry-run

# Otomatik okuma stub'u (şu an bağlı değil):
node scripts/fb-lead-responder.mjs --poll
```

### Örnek çıktı

```
GÖNDERİ: Hi all, can anyone recommend a good catering service for a villa party in Kalkan?
TESPİT:  {"isRequest":true,"category":"catering","confidence":0.55,...}
EŞLEŞEN İŞLETME: Kalimera Kitchen  (https://kalkaninfo.com/hizmetler.html)
ÖNERİLEN CEVAP TASLAĞI (İngilizce):
  "Hi! For this, people often recommend Kalimera Kitchen here in Kalkan.
   Bespoke catering for villa parties, weddings and special events ...
   You can find the details and contact info on https://kalkaninfo.com/hizmetler.html — hope it helps!"
```

---

## Mimari

```
postText
  │
  ├─ detectRequest()   → Claude haiku (json) | keyword fallback
  │                       {isRequest, category, confidence, language}
  │
  ├─ matchBusiness()   → kalkaninfo veritabanından en uygun işletme
  │                       (curated overlay: catering → Kalimera Kitchen)
  │
  ├─ draftReply()      → Claude haiku | şablon fallback (İngilizce, spam değil)
  │
  └─ submitForApproval()→ Telegram: taslak + [✅ Onayla / ❌ Reddet]
                          → Berkay onaylar → MANUEL paylaşır
```

### Kategoriler ve veri kaynakları

| Kategori | Kaynak (`data/`) |
|----------|------------------|
| catering | `hizmetler.json` + curated **Kalimera Kitchen** |
| restoran / cafe / aktivite | `restoranlar.json` |
| villa | `villalar.json` |
| otel | `oteller.json` |
| transfer / tamir / diğer | `hizmetler.json` |

---

## Okuma katmanı opsiyonu — Apify (gri alan, isteğe bağlı)

Tam otomatik okuma istenirse `fetchNewPosts()` stub'una bir scraper bağlanabilir:

- **Apify "Facebook Groups Scraper"** ile yeni postlar çekilir.
- **Maliyet:** ~**$30–49/ay** (Apify plan + compute units).
- **Risk:** FB ToS'a göre scraping gri alandır; FB tespit ederse hesap/IP
  kısıtlaması olabilir. **Yine de yazma otomatik yapılmamalı** — okuma otomatik
  olsa bile yayın insan elinden geçmeli.
- Bağlamak için: `fetchNewPosts()` içindeki `TODO(apify)` yorumunu doldur, çıktıyı
  `{id, text, author, url}` formatına map et, `--poll` ile çalıştır.

---

## Canlıya almak için ne lazım

1. `ANTHROPIC_API_KEY` geçerli + bakiyeli (taslak kalitesi için; yoksa fallback).
2. `TELEGRAM_BOT_TOKEN` + `TELEGRAM_OWNER_CHAT_ID` set (onay mesajı için).
3. Telegram callback'i (Onayla/Reddet butonları) işleyen webhook — `lib/telegram.js`
   `approvalKeyboard` ile uyumlu; mevcut social-manager botundan AYRI tutulmalı
   (webhook vs polling çakışmasın).
4. (Opsiyonel) Apify okuma katmanı — yukarıdaki maliyet/risk kabul edilirse.

> **Tekrar:** Onaydan sonra cevabı **Berkay manuel paylaşır.** Otomatik yorum yok.
