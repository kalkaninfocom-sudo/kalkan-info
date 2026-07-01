# Kalkan Today — Yazı İşleri (Agent Kadrosu)

Gazete her gün **rolleri atanmış AI editör kadrosu** tarafından hazırlanır, yayından önce **insan (Berkay) onayından** geçer. Onaylanan sayı aynı anda **web + Instagram + Facebook**'ta paylaşılır.

> İlke: **İçeriği ekip üretir, insan denetler.** Angarya/çıkarım işleri ücretsiz LLM'e (`lib/cheap-llm.mjs`), editöryal kalite kararları Claude'a.

## Roller

| Rol | Sorumluluk | Girdi / Kaynak | Çıktı |
|---|---|---|---|
| 🗞️ **Genel Yayın Yönetmeni** | Sayıyı kurar, manşeti seçer, akışı ve önceliği belirler, **yayına onay verir** | Tüm alt çıktılar | Onaylı sayı (morning + magazine) |
| ✍️ **Haber Muhabiri** | Ön sayfa: yerel haber + etkinlik derler, manşet/deck/3 sütun yazar | `data/haberler.json`, `data/etkinlik-takvimi.json` | `lead_*`, `col1/2/3_*` |
| 🌙 **Magazin Editörü** | Arka yüz: gece hayatı hero + 3 kart + "Bu Akşam Program" | gece mekanları (`restoranlar.json`), etkinlik takvimi | `hero_*`, `cards`, `program_rows` |
| 📷 **Foto Editörü** | Kapak/görsel seçer, grayscale/ton kararları, altyazı yazar | mekan `image/gallery`, arşiv | `lead_image`, `hero_img_tag`, caption |
| 📣 **Sosyal Medya Editörü** | Sayıyı IG & FB için paylaşıma hazırlar (kapak kartı + caption + hashtag) | onaylı sayı | `social_posts` satırı (pending_approval) |
| 🛡️ **Reklam & Uyum** | İLAN etiketi, KVKK, Basın/Reklam mevzuatı denetimi | `data/ads.json`, `/q` takip | uyum onayı / red |

## Üretim akışı (günlük)

```
1. Muhabir + Magazin Editörü → veri katmanından içerik derler
2. Foto Editörü → görselleri yerleştirir
3. Reklam & Uyum → İLAN slotlarını + etiketleri denetler
4. Genel Yayın Yönetmeni → sayıyı kurar (morning + magazine PDF/HTML)
5. → İNSAN ONAYI (Telegram) ←  [zorunlu kapı]
6. Sosyal Medya Editörü → onaylı sayıyı web'de yayınlar + IG/FB'ye kuyruklar
```

Otomasyon: `scripts/newspaper-daily.mjs` (üret → index → sosyal kart → onay kuyruğu).
Onay & yayın altyapısı: `api/telegram-webhook.js` + `api/social-publish-queue.js` (mevcut).

## Kısıtlar
- **Otomatik yayın YOK, onay kapısı zorunlu** (hiçbir sayı insan onayı olmadan yayınlanmaz).
- İLAN içerikleri açıkça etiketli (Reklam Kurulu). Alkol markası/fiyat reklamı yayınlanmaz (TAPDK).
- Vercel Hobby: api 12/12, cron 2/2 DOLU → günlük tetikleme **harici** (cron-job.org) veya PC scheduler.
- Kişisel veri (düğün/haber öznesi) hafızaya/loga yazılmaz (KVKK).
