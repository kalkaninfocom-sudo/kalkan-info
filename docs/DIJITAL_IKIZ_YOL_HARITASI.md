# Kalkan Dijital İkizi (Digital Twin) — Canlı Yol Haritası

**Vizyon (Berkay, 2026-07-11):** Kalkan'ın **foto-gerçekçi 3B dijital kopyası**. Harita üzerinde her kayıtlı
işletme gerçek konumunda; her mekanın **son IG paylaşımı**, paylaşımlardan türetilen **doluluk tahmini**,
**web sitesi + görseller** ve mekanın **3B hali** görünüyor. Instagram konum-haritası deneyimi gibi ama 3B + canlı.

> TEK canlı yol haritası. Her adımda güncelle. (ADHD kuralı + başa-sarma yasağı.)
> 3B kararı: **Foto-gerçekçi — Google Photorealistic 3D Tiles** (Berkay seçti 2026-07-11).

## Legend: ✅ bitti · 🔨 devam · ⏳ bekliyor · ⛔ bloke

## Veri temeli (ELİMİZDE — sıfırdan başlamıyoruz)
- ✅ **190 mekan gerçek GPS + açık/kapalı + kapanış saati** (`data/discovered/all-kalkan-*.json`): bar/barber/beach_club/cafe/restaurant, rating, reviewCount, priceLevel, website, thumbnail, place_id.
- ✅ Küratörlü katalog (restoranlar 177 / oteller 17): yerel galeri (`assets/img/**`), IG handle, özet, detay sayfaları — isim/slug ile eşlenir.
- ✅ IG mekan gönderileri: `data/ig-venue-intake.json` (son paylaşım kaynağı).

## FAZ 1 — MVP: etkileşimli 3B harita + mekan panelleri (KANIT)
- 🔨 `scripts/build-harita-data.mjs` → `data/harita-mekanlar.json` (discovered geo + küratörlü galeri/IG birleşik, kategori renk/ikon).
- 🔨 Doluluk tahmini (heuristik): açık/kapalı + saat + rating + reviewCount + priceLevel → 0-100% **"tahmini"** etiketli.
- 🔨 `harita-3d/index.html` — CesiumJS + Google 3D Tiles (key gelince foto-gerçekçi; keysiz OSM imagery fallback). Mekanlar 3B işaretçi; tıkla → panel (isim, kategori, rating, doluluk göstergesi, açık/kapalı, son IG, web, galeri).
- ⏳ Görsel QA (localhost screenshot) + kalkan-info marka dili.

## ⛔ BLOKAJ / GİRDİ (Berkay)
- **Google Maps "Map Tiles API" key YOK** (sadece Gemini var). Foto-gerçekçi 3B için gerekli:
  Google Cloud Console → Map Tiles API etkinleştir → API key → `.env.local` `GOOGLE_MAPS_API_KEY`.
  Key gelene kadar MVP keysiz fallback (OSM) ile çalışır; etkileşim/panel/doluluk tam demolanır.
- **Kapsama riski:** Kalkan küçük kasaba — Google foto-gerçekçi 3B binaları kapsıyor mu, key gelince test edilecek.
  Kapsamıyorsa fallback: OSM bina extrusion (gerçek konum + yükseklik, stilize).

## FAZ 2 — Canlı katman
- ⏳ Son IG paylaşımı: her mekan için IG Graph API / `ig-venue-intake` → panelde canlı post.
- ⏳ Doluluk iyileştirme: Google "popular times" (varsa) / gün-saat kalıbı / mekan-bildirimli feed.
- ⏳ Mekana özel 3B: flagship mekanlar için foto/model; Google 3D Tiles zaten gerçek binayı verir.

## FAZ 3 — Ürünleştirme
- ⏳ Plaj/otel/tur/aktivite katmanları (plajlarda koordinat eksik → geocode/place_id ile tamamla).
- ⏳ Filtreler (kategori/açık şimdi/fiyat/rating), arama, mobil.
- ⏳ Kayıtlı işletme = premium pin + doğrulanmış rozet (satış modeli).
