# İçerik Üretim Uyum Yol Haritası — Ticari Reklam Yönetmeliği (1 Ağustos 2026)

> **Durum:** 🔨 AKTİF · **Yürürlük:** 2026-08-01 · **Oluşturma:** 2026-07-28
> Kaynak: Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği değişikliği (RTK).
> Bu belge kalkaninfo'nun **kendi** AI içerik üretimini yeni yönetmeliğe uyumlar. Canlı tutulur (✅/🔨/⏳).

## Yönetmelik → Kalkaninfo Etkisi

| # | Madde (özet) | Kalkaninfo'da neyi etkiler | Risk |
|---|---|---|---|
| 1 | **AI kullanımı açıklama:** Tüketicinin ekonomik davranışını etkileyecek AI kullanımı VEYA insandan ayırt edilemeyen dijital karakter → açık, anlaşılır, ayırt edilebilir belirtilmeli | **Lyra & Deniz** AI konsiyerj (chat+sesli), AI reels seslendirme, AI görseller, AI gazete | 🔴 YÜKSEK — Lyra/Deniz açık AI kimliği YOK, promptlar "insana benzet" diyor |
| 2 | **AI sahte tavsiye yasağı:** Gerçek kişinin AI dijital kopyasının bir mal/hizmeti bizzat deneyimlediği/tavsiye ettiği izlenimi YASAK | Higgsfield Soul ID / avatar ile testimonial üretimi | 🟡 ORTA — şu an aktif kullanılmıyor, ilke olarak yasak koy |
| 3 | **Hedefli reklam şeffaflığı:** Çevrimiçi davranış/konum/demografi ile hedefleme → hangi kriterle gösterildiği + nasıl değiştirileceği kolay erişilebilir sunulmalı | Venue spotlight rotasyonu, AjansAI müşteri hedefli reklamları | 🟡 ORTA — kendi sitede ağır hedefleme yok; AjansAI tarafında kritik |
| 4 | **Çocuk profilleme yasağı:** Çocuk olduğu bilinen/beklenen tüketiciye kişisel veriyle profilli hedefli reklam YAPILAMAZ | Hiçbir üründe çocuk verisi profillemesi yok | 🟢 DÜŞÜK — teyit + yazılı ilke |
| 5 | **Özel kategoriler:** Influencer reklamı, çevresel beyan, indirimli satış, sadakat, tüketici değerlendirmesi, takviye gıda | Gazete/reels/kampanya içerikleri; "reklam" ibaresi, doğrulanmış yorum | 🟡 ORTA — disclosure standardı gerek |

## Uyum Kuralları (İçerik Üretim Standardı)

1. **AI kimliği açık:** Lyra & Deniz her oturum açılışında + "hakkında"da açıkça yapay zeka olduğunu belirtir. İnsan devri (Berkay/Sezin) ayrı ve net.
2. **AI içerik etiketi:** AI ile üretilen/otomatik reels, görsel, gazete metni → görünür "Yapay zeka ile üretilmiştir/desteklenmiştir" ibaresi.
3. **Sahte deneyim yok:** Gerçek kişilerin AI kopyasıyla "bizzat kullandı/tavsiye etti" içeriği üretilmez.
4. **Hedefleme şeffaf:** Hedefli gösterim yapılırsa kriter + değiştirme yolu erişilebilir olur.
5. **Çocuk profillemesi yok.**
6. **Reklam ibaresi:** Ücretli/sponsorlu/işbirliği içerik açıkça "reklam/işbirliği" etiketli. Tüketici yorumları doğrulanmış olur.

## Aksiyon Checklist

### P0 — Yürürlükten önce (4 gün)
- [x] ✅ Lyra **açık AI kimliği** — DENETLENDİ, zaten uyumlu: `lyra.md` + `lyra-voice.md` "yapay zeka konsiyerji, insan taklidi yapma, bizzat denedim deme"; widget header rozeti "Yapay zeka konsiyerj · çevrimiçi"; sesli açılış `FIRST_MESSAGE` "ben Lyra — Kalkan'ın yapay zeka konsiyerjiyim". (Deniz = La Mora repo'su, burada persona yok.)
- [x] ✅ AI **şeffaflık etiketi** — gazete künyesi (`morning.html` + `magazine.html`: "Yapay zeka destekli hazırlanmıştır") + antik story reels kapanış kartı ("Yapay zeka destekli anlatım")
- [x] ✅ `reels-critic.mjs` QA gate'ine **AI şeffaflık checklist**'i (AI ibaresi VAR mı + sahte tavsiye YOK mu + reklam etiketi VAR mı — pozitif kontrol)

### P1 — Kısa vade
- [ ] ⏳ AjansAI müşteri içerik üretimine uyum şablonu (disclosure + hedefleme şeffaflığı)
- [ ] ⏳ Sitenin ilgili yerlerine kısa "AI kullanım bildirimi" / KVKK-uyum notu
- [ ] ⏳ Influencer/sponsorlu içerik için "reklam" etiketi standardı

### P2 — Süreç
- [ ] ⏳ Çocuk profilleme yapılmadığına dair yazılı ilke
- [ ] ⏳ Takviye gıda / çevresel beyan içeriklerinde iddia doğrulama

## Nerede Kaldık
2026-07-28 (2. güncelleme): **P0 tamamlandı.** Denetim düzeltmesi: Lyra (chat+sesli) açık AI kimliği ZATEN vardı — ilk tarama yanıltıcıydı. Eklenen: gazete künyesi + antik story kapanış kartı AI ibaresi + reels-critic AI şeffaflık checklist. Berkay kararı: zarif açılış + küçük rozet (mevcut yapı bunu zaten karşılıyor). **Sıradaki (P1):** AjansAI müşteri içerik uyum şablonu, sitede kısa "AI kullanım bildirimi", influencer/sponsorlu "reklam" etiketi standardı. villalar draft'ı hâlâ vet bekliyor.
