# Kalkan Info — Çok-Marka & Çok-Dil İçerik Mimarisi (canlı)

**Vizyon (Berkay, 2026-07-11):** Kalkan Info tek hesap değil, bir **marka ailesi**. Ajans her hattın kendi
içeriğini üretsin, hatlar karışmasın. Her reels **5 dilde** üretilip ilgili dil hesabında paylaşılsın.

> TEK canlı yol haritası. Başa-sarma yasağı + ADHD: her parça tek başına çalışır bırak.

## Marka hatları (her biri AYRI stream/hesap, ajans ayrı üretir)
| Hat | İçerik | IG hesabı | Durum |
|-----|--------|-----------|-------|
| **Kalkan Info** (ana) | genel rehber, öne çıkanlar | @kalkan.info (mevcut) | ✅ canlı |
| **Kalkan Info Haber** | yerel haber, güncel, teyitli | ⛔ Berkay açacak | ⏳ |
| **Kalkan Info Magazin** | gece hayatı, kültür, lezzet, magazin | ⛔ Berkay açacak | ⏳ |
| **Kalkan Info TV** | sokak röportajı, insan hikâyeleri (çekim Berkay) | ⛔ Berkay açacak | ⏳ |

## Çok-dil (her reels 5 dilde → ilgili dil hesabı)
- Diller kesinleşti: **TR, EN, DE, FR, RU** (sitenin mevcut i18n seti).
- ✅ **İLK KANIT ÇALIŞIYOR (2026-07-11):** `scripts/ig-event-card.mjs` artık etkinlik kartını **5 dilde** üretiyor
  (sabit etiketler elle lokalize, tarih/gün `Intl`, etkinlik alt-başlığı cheap-llm ile ücretsiz çevrilir).
  Indigo Movie Night 5 dilde üretildi + görsel doğrulandı (`assets/ig-events/<id>.<lang>.jpg`). Pipeline hazır — reels'e genişletilecek.
- Her dil için AYRI IG hesabı (Berkay açacak) VEYA tek hesapta çok-dil altyazı — **karar gerek**.
- Reels motoru zaten **EN+TR** üretiyor → cheap-llm çeviri + dil-başına render + dil-başına post ile 5'e çıkar.

## Ne BEN yaparım (yazılım) · ne BERKAY yapar (dış)
**Ben:** ajans marka-stream ayrımı (Haber/Magazin/TV ayrı üretim + ayrı basket), 5-dil reels pipeline
(çeviri→render→dil-başına kuyruk), TV röportaj post-prodüksiyon (altyazı/çok-dil caption/kırpma/zamanlama),
her hesap için config + token-hazır posting.
**Berkay:** 5 IG hesabını + Haber/Magazin/TV hesaplarını Meta'da AÇ (ben açamam), her hesap için token ver,
TV röportajlarını ÇEK (kamera).

## Açık kararlar (Berkay)
1. 5 dil hangileri? (site setiyle aynı mı?)
2. Her dil AYRI hesap mı, yoksa tek hesap çok-dil altyazı mı? (hesap yönetimi vs erişim)
3. TV: dikey reels röportaj formatı — süre, jenerik, altyazı stili?

## Bağlantılı
- Ajans motoru: `scripts/agency/*` + AjansAI repo (github.com/kalkaninfocom-sudo/ajansai) — stream/brand kavramı zaten var.
- Reels motoru: `scripts/agency/build-*-reel.mjs` (EN+TR hazır) → 5 dile genişletilecek.
