# Instagram Otomasyon Belgeleri

Kalkan Info IG otomasyonları — iki ayrı poller, sıfır otomatik yayın (varsayılan).

---

## 1. IG Oto-Cevap (`ig-autoreply.yml` + `scripts/ig-reply-poll.mjs`)

### Ne yapar?

`@kalkan.info` hesabının son medyalarındaki **yeni yorumları** ve **DM'leri** çeker.
Her biri için `cheap-llm` (Groq → Ollama → NVIDIA → Claude) ile kısa, marka-uyumlu bir
cevap önerir. Varsayılan modda hiçbir şey otomatik gönderilmez — Telegram'a onay bildirimi
gider.

### Zamanlama

```
cron: '7,22,37,52 * * * *'   → her 15 dakikada bir
```

### Onay akışı (approve modu — varsayılan)

1. Script yeni yorum/DM bulur.
2. Telegram'a şu bilgileri gönderir: `@kullanıcı`, mesaj metni, önerilen cevap.
3. Manuel onay için CLI komutu:
   ```bash
   node scripts/ig-reply-poll.mjs --list-pending    # bekleyenleri gör
   node scripts/ig-reply-poll.mjs --apply-all       # hepsini IG'ye gönder
   ```
4. Durum `data/ig-replied.json`'a kaydedilir (git'e commit edilir → dedup korunur).

### approve → auto geçişi

`.github/workflows/ig-autoreply.yml` içindeki şu satırı değiştirin:

```yaml
IG_AUTOREPLY_MODE: approve   # ← bunu
IG_AUTOREPLY_MODE: auto      # ← buna çevirin
```

**Dikkat:** `auto` modda script yorumlara anında cevap yazar. Spam/hatalı cevap riski artar.

### Gerekli GitHub Secrets

| Secret | Açıklama |
|---|---|
| `IG_LONG_LIVED_TOKEN` | Uzun ömürlü IG Page token (60 gün) |
| `IG_BUSINESS_ID` | IG Business hesap ID |
| `TELEGRAM_BOT_TOKEN` | Bildirim botu token |
| `TELEGRAM_ADMIN_CHAT_ID` | Berkay'ın chat ID |
| `ANTHROPIC_API_KEY` | Claude fallback (cheap-llm) |
| `NVIDIA_API_KEY` | NVIDIA NIM ücretsiz tier |
| `GROQ_API_KEY` | Groq ücretsiz tier (öncelikli) |

---

## 2. IG Hikaye Repost (`ig-story-repost.yml` + `scripts/ig-story-repost.mjs`)

### Ne yapar?

`@kalkan.info`'ya **etiketlenen** başka hesapların gönderilerini tespit eder.
Her yeni etiket için Telegram'a bildirim gönderir; onaylandıktan sonra (veya `auto` modda
doğrudan) kendi hikayemize yayınlar.

### Zamanlama

```
cron: '13,43 * * * *'   → her 30 dakikada bir
```

### Onay akışı (approve modu — varsayılan)

1. Script `/{IG_BUSINESS_ID}/tags` endpoint'inden etiketleri çeker.
2. Yeni etiket bulununca Telegram'a: hesap adı, medya türü, caption, orijinal link gönderir.
3. Manuel yayın:
   ```bash
   node scripts/ig-story-repost.mjs --list-pending          # bekleyenleri gör
   node scripts/ig-story-repost.mjs --apply <MEDIA_ID>      # tek medyayı yayınla
   ```
4. Durum `data/ig-reposted.json`'a kaydedilir.

### approve → auto geçişi

`.github/workflows/ig-story-repost.yml` içinde:

```yaml
IG_STORY_REPOST_MODE: approve   # ← bunu
IG_STORY_REPOST_MODE: auto      # ← buna çevirin
```

### Gerekli GitHub Secrets

| Secret | Açıklama |
|---|---|
| `IG_LONG_LIVED_TOKEN` | IG Page token |
| `IG_BUSINESS_ID` | IG Business hesap ID |
| `TELEGRAM_BOT_TOKEN` | Bildirim botu token |
| `TELEGRAM_ADMIN_CHAT_ID` | Berkay'ın chat ID |

---

## IG API Kısıtlamaları ve Dürüst Uyarılar

### Hangi izinler gerekli?

| Özellik | Gerekli İzin | Durum |
|---|---|---|
| Kendi medyalarımızın yorumları | `instagram_basic` | Standart erişimde var |
| DM'ler | `instagram_manage_messages` + Advanced Access | App Review gerektirir |
| Etiketlenmiş gönderiler (`/tags`) | `instagram_basic` + Business/Creator hesap | Genellikle var |
| Story mention'lar (`/mentions`) | `instagram_manage_mentions` | **App Review gerektirir** |
| Hikayeye yayın | `instagram_content_publish` | Standart erişimde var |

### Story "reshare" gerçeği

IG mobil uygulamasındaki "Hikayene Ekle" (native reshare) özelliği **Graph API'de mevcut
değildir** (2024 itibarıyla; Meta bu endpoint'i kamuya açmamıştır).

Bu scriptin yaptığı şey:
- Etiketlenen medyanın `media_url` adresini alır
- Bu URL'i `image_url` / `video_url` olarak kendi hikaye container'ımıza yükler
- Yani teknik olarak "yeniden paylaşım" değil, başka kullanıcının içeriğini kendi adımıza
  yeniden yayınlamadır

**Hukuki not:** Başka kullanıcının içeriğini yayınlamadan önce izin alınması önerilir.
Bizi etiketleyen hesaplarla önceden anlaşma yapın ya da sadece iş ortakları / onaylı
hesaplar için bu özelliği kullanın.

### `media_url` erişilebilirlik kısıtı

- IG CDN URL'leri imzalıdır ve belirli bir süre sonra süresi dolar (genellikle 1-24 saat).
- Script bulduğu anda Telegram bildirimi gönderir; onay çok geç gelirse URL artık
  geçersiz olabilir.
- Bu durumda `--apply <ID>` komutu API'den güncel URL'i yeniden çekmeye çalışır.

### Video hikayeleri

- Video stories için IG, `video_url` adresli bir MP4 ister.
- Container oluşturulduktan sonra işleme (transcode) tamamlanana kadar beklemek gerekir.
- Bu script max 30 saniye bekler; daha uzun sürerse hata verir (yeniden dene).

### Story mention'ları neden çalışmayabilir?

`/{IG_BUSINESS_ID}/mentions` endpoint'i `instagram_manage_mentions` iznini gerektirir.
Bu izin **Meta App Review** sürecinden geçmeden verilemez. Üretim hesabında bu izin
yoksa script şu logu verir ve devam eder:

```
[mentions] Story mention erişimi yok — "instagram_manage_mentions" izni + App Review gerektirir.
```

Çözüm için: https://developers.facebook.com/docs/instagram-api/reference/ig-user/mentions

---

## Token Yenileme

IG Long-Lived token 60 günde bir yenilenmeli. Mevcut script:

```bash
node scripts/refresh-ig-token.mjs
```

Yenilenen token'ı GitHub → Settings → Secrets → `IG_LONG_LIVED_TOKEN` olarak güncelleyin.
