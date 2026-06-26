# Kalkan Today — Günlük Gazete MVP

A4 broadsheet PDF üreten gazete pipeline'ı. Detaylı vizyon: [`docs/GAZETE_PROJESI.md`](../docs/GAZETE_PROJESI.md).

## Hızlı Başlangıç

```bash
# Bugünün sabah edisyonu (demo veri)
node newspaper/generator/build.mjs morning

# Belirli tarih
node newspaper/generator/build.mjs morning 2026-06-26

# Çıktı:
#   newspaper/archive/2026-06-26/morning.html
#   newspaper/archive/2026-06-26/morning.pdf
```

`puppeteer` global olarak yüklüyse PDF de üretilir; yoksa sadece HTML çıkar.

## Klasör Yapısı

```
newspaper/
├── templates/
│   └── morning.html        ← A4 broadsheet sabah şablonu
├── components/             ← (gelecek) masthead, ad-slot, qr-block
├── generator/
│   └── build.mjs           ← Mustache-style {{}} render + Puppeteer PDF
├── archive/
│   └── YYYY-MM-DD/
│       ├── morning.html
│       └── morning.pdf
└── README.md
```

## Tasarım Notları

- **Format:** A4 portrait (210 × 297 mm), tek sayfa
- **Başlık:** Playfair Display Italic Black (klasik broadsheet)
- **Gövde:** Inter (modern okunabilirlik)
- **Kicker:** IBM Plex Mono (gazete kategori şeritleri)
- **Renk:** Krem kağıt `#fbf9f4`, ink `#14181c`, altın vurgu `#b88a2f`, deniz `#1a3a52`
- **İLAN bandı:** Siyah etiket + altın CTA + QR kod (Reklam Kurulu uyumu için zorunlu)
- **QR:** `api.qrserver.com` ile inline render (server-side bağımlılık yok)

## Yol Haritası

| Aşama | Çıktı | Durum |
|---|---|---|
| **0** Şablon iskeleti | A4 morning template + Puppeteer render | ✅ |
| **1** MVP | Supabase tablolar + Claude Haiku içerik + admin onay | ⏳ |
| **2** Ticari | Reklam fiyat listesi + 3 pilot mekan abonelik | — |
| **3** Ölçek | 10+ mekan, hafta sonu + akşam edisyonu, TR/EN | — |

## Bilinen Eksikler

1. `lead_image` URL'i demo (Unsplash). Aşama 1'de Supabase `articles.cover_url` ile değiştirilecek.
2. İçerik veriler hard-coded demo. Aşama 1: Claude Haiku 4 haber + 6 manşet üretir.
3. Tek edisyon tipi (`morning`). `evening`, `weekend`, `venue` şablonları sonraki sprint.
4. Reklam slot'u 1 adet (manşet sponsoru). Aşama 1'de `ad-placer.js` slot yerleştirme.
5. Süreli yayın beyannamesi (Basın Kanunu m.7) — basılı dağıtım öncesi Berkay verecek.

## Yasal Hatırlatma

- Advertorial = açıkça `İLAN` etiketli olmalı (Reklam Kurulu)
- Alkollü içecek reklamı yayında YASAK (TAPDK)
- QR'dan toplanan tıklama IP'leri **hash'lenmeli** (KVKK)
- İlk basılı dağıtım öncesi Cumhuriyet Başsavcılığı'na süreli yayın beyannamesi
