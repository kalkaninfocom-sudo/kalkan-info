# Kalkan Info — Aylık Sosyal Medya Paylaşım Planı

Bu plan, **Kalkan Info sosyal medya ajansının çalıştığı takvimdir**. Hangi gün, hangi saatte, hangi içerik,
hangi tonda (ciddi/orijinal), hangi platformda paylaşılacağını tanımlar. Ajans (agency scheduler + planlayıcılar)
bu ritmi uygular. Makine-okur sürümü: `data/agency/aylik-icerik-plani.json`.

## 1. İçerik felsefesi: CİDDİ vs ORİJİNAL

İki sütun üzerine kurulu. Denge: **~%40 ciddi (otorite/güven), ~%60 orijinal (marka/etkileşim).**

| CİDDİ (otorite, güven, haber) | ORİJİNAL (marka, etkileşim, keşif) |
|---|---|
| Günlük gazete (ön sayfa + magazin) | Antik kent "biliyor muydun" |
| Haber reels / manşet | Plaj & koy tanıtımı (Kaputaş, tekne turu) |
| Haftalık bülten (Pazar) | Restoran / mekan tanıtım reels (💰 monetizasyon) |
| Etkinlik & duyuru (resmi) | Villa / konaklama vitrini |
| Bilgilendirme (dolmuş, eczane, hava) | Magazin / gece hayatı / kullanıcı story-repost |

**Zamanlama mantığı:** SABAH = ciddi (haber otoritesi; insanlar günü haberle açar). AKŞAM & HAFTA SONU =
orijinal (yaşam tarzı, etkileşim, monetizasyon; insanlar akşam keşfeder/eğlenir).

## 2. Gün-gün program (algoritma-optimize — saatler her gün FARKLI)

2026 IG verisi: en iyi günler **Çar > Prş > Sal**; Pazar sakin; en iyi saatler **sabah 07-09 & akşam 18-21**.
Bu yüzden **flagship reels (restoran/antik/plaj) hafta ortası akşam prime'a** konur; gazete sabah kalır ama
saati güne göre kayar; hafta sonu geç sabah. Tekdüzelik yok — her günün kendi saatleri var.

| Gün | Sabah (CİDDİ) | Gündüz/Akşam (ORİJİNAL) | Flagship |
|---|---|---|---|
| **Pzt** | 08:00 gazete | 13:00 "Bu hafta Kalkan'da" · 19:00 etkinlik story | — |
| **Sal** | 07:45 gazete | 12:00 orijinal · **20:00 🍽️ Restoran reel 💰** | ✅ prime |
| **Çar** | 07:45 gazete | 11:00 story (EN) · **19:30 🏛️ Antik kent reel** | ✅ EN İYİ GÜN |
| **Prş** | 07:45 gazete | 12:30 orijinal · **20:00 🏖️ Plaj/aktivite reel** | ✅ prime |
| **Cum** | 08:00 gazete | 18:30 🎉 Hafta sonu rehberi | — |
| **Cmt** | 08:30 gazete | 14:00 🏡 Villa reel 💰 · 21:00 gece magazin | 💰 |
| **Paz** | **09:00 📰 Haftanın bülteni** (gazete yerine) | 17:00 magazin özet | otorite |

+ **Story-tag repost**: anlık (biri etiketlerse) → otomatik onay → hikayemize ekle.

## 3. Hashtag (etiket) stratejisi — 2026 kuralı

⚠️ **Instagram artık MAX 5 etiket** (Aralık 2025 sabit limit). 30-etiket devri bitti. Etiket = algoritma
sınıflandırma sinyali, spam değil.

- **Formül:** 1 marka + 2 niş + 1-2 yerel/konum = **max 5**.
- **Altın kural:** konum+niş birleştir. `#kalkanvillas` > `#villas` (yerel + niyetli kitle).
- **Setleri döndür** (tekrar etme). İçerik türüne göre hazır setler `aylik-icerik-plani.json > hashtag_strategy.sets`:
  - Gazete: `#kalkaninfo #kalkan #kaşgündem #antalyahaber #kalkantoday`
  - Restoran: `#kalkaninfo #kalkanrestaurants #kalkanfood #kalkan #visitkalkan`
  - Villa: `#kalkaninfo #kalkanvillas #kalkankiralıkvilla #kalkan #turkishriviera`
  - Antik: `#kalkaninfo #patara #lycianway #ancientlycia #visitkalkan`
  - Plaj: `#kalkaninfo #kaputasbeach #kalkanbeach #kalkan #turkishriviera`
- **EN erişim** (İngiliz kitle): `#kalkanturkey #visitkalkan #turkishriviera #lycianway` niş yerine koy.

## 4. Dil (TR / EN) — İngiliz yerliler & tatilciler

- **Gazete + haftalık bülten**: her zaman **TR + EN** (çift altyazı reel veya iki ayrı post).
- **Orijinal içerik**: gün aşırı **TR / EN** dönüşümlü; antik kent & plaj içerikleri EN öncelikli (turist ilgisi).
- Caption'lar: birincil dil + ikinci dil kısa özet.

## 5. Aylık özel günler / kampanyalar

- Ayın 1'i: "Bu ay Kalkan'da" aylık etkinlik önizlemesi.
- Her ayın ilk Salı'sı: partner işletme spot (kampanya).
- Resmî/yerel özel günler (bayram, festival): temayı override et.
- Ay sonu: aylık öne çıkanlar / topluluk teşekkürü (story-repost derlemesi).

## 6. Onay & yayın akışı

Her içerik **Telegram görselli onay kapısından** geçer (pub:<id>:now/scheduled/reject) → onayda IG/FB.
Ciddi içerik (gazete/bülten) günlük otomatik; orijinal içerik planlayıcı tarafından haftalık kuyruğa alınır.
QA: reels-critic kapısı (banner/404/çöp engelle). Kaynak yoksa → evergreen fallback (antik + hizmet reklamı).

## 7. Ajans bağlantısı

- Sabit saatli görevler: `data/agency/schedule.json` (scheduler her 10 dk).
- Haftalık reels planı: `scripts/weekly-content-planner.mjs` (Pzt 09:00).
- Aylık makine planı: `data/agency/aylik-icerik-plani.json` (bu dokümanın kod karşılığı).
- Üretim: gazete (newspaper/generator), reel (remotion + build-gazete-reel), evergreen (scripts/agency/evergreen.mjs).
