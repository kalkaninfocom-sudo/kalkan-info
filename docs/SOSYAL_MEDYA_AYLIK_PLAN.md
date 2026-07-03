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

## 2. Günlük sabit ritim (her gün)

| Saat (TR) | İçerik | Ton | Platform | Kaynak / not |
|---|---|---|---|---|
| **07:45** | **Günün gazetesi** — ön sayfa + magazin | CİDDİ | Web + IG carousel + Reel | gazete-approval.yml (Pzt–Cmt). Telegram onayı → yayın. |
| **13:00** | **Günün teması** (aşağıdaki haftalık tema) | ORİJİNAL | IG post/reel | Temaya göre kaynak (restoran/antik/plaj…) |
| **19:30** | **Etkinlik / mekan / bu akşam** | KARIŞIK | IG post + story | etkinlik-takvimi + mekan |
| **21:00** | **Magazin / gece hayatı** | ORİJİNAL | IG story/reel | magazin şeridi |
| Anlık | **Story-tag repost** (biri etiketlerse) | ORİJİNAL | IG story | otomatik onay → repost |

## 3. Haftalık tema (13:00 orijinal içerik)

| Gün | Tema | Ton | Not |
|---|---|---|---|
| **Pazartesi** | Bu hafta Kalkan'da (rehber) | ORİJİNAL | Haftalık etkinlik/hava önizleme |
| **Salı** | 🍽️ Restoran / mekan tanıtım **reels** | ORİJİNAL 💰 | Ücretli işletme tanıtımı (gelir) |
| **Çarşamba** | 🏛️ Antik kent / kültür (derinlemesine) | ORİJİNAL | Patara/Ksanthos/Kekova/Antiphellos |
| **Perşembe** | 🏖️ Plaj / koy / aktivite | ORİJİNAL | Kaputaş, tekne turu, dalış |
| **Cuma** | 🎉 Hafta sonu etkinlik rehberi | KARIŞIK | Gece programı + etkinlik |
| **Cumartesi** | 🏡 Villa / konaklama vitrini | ORİJİNAL 💰 | Konaklama tanıtımı (gelir) |
| **Pazar** | 📰 **Haftanın bülteni** + magazin özeti | CİDDİ | 09:00 haftalık özet (gazete yerine) |

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
