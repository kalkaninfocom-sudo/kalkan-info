# Kalkan Info — Yatırımcı Sunumu

Pre-seed pitch deck. 16 slide, 1920×1080 (16:9), kalkan-info brand renkleri.

## İçerik

- `index.html` — sunum HTML (tek dosya, embed CSS, Google Fonts CDN)
- `export-pdf.mjs` — Puppeteer ile PDF export script
- `kalkan-info-pre-seed-deck.pdf` — üretilen PDF (export sonrası)

## Önizleme

Lokal serve aktifse (`node serve.mjs` proje kökünde) tarayıcıda aç:

```
http://localhost:3000/investor-deck/index.html
```

## PDF Üretimi

Proje kökünden çalıştır (Puppeteer global yüklü):

```bash
node investor-deck/export-pdf.mjs
```

Çıktı: `investor-deck/kalkan-info-pre-seed-deck.pdf`

## Slide Sırası (16)

| # | Başlık | Süre |
|---|---|---|
| 01 | Cover | 30s |
| 02 | Problem | 2 dk |
| 03 | Çözüm | 1.5 dk |
| 04 | Neden Şimdi | 1 dk |
| 05 | Pazar Büyüklüğü (TAM/SAM/SOM) | 1.5 dk |
| 06 | Ürün | 2 dk |
| 07 | AI Agent Mimarisi (11 agent) | 1 dk |
| 08 | İş Modeli | 1.5 dk |
| 09 | Go-to-Market | 1.5 dk |
| 10 | Traction & Milestones | 1 dk |
| 11 | Rekabetçi Üstünlük | 1 dk |
| 12 | Takım | 1.5 dk |
| 13 | Finansal Projeksiyon | 2 dk |
| 14 | Fonun Kullanımı | 1 dk |
| 15 | Yatırım Talebi ($650K) | 30s |
| 16 | Vizyon | 1 dk |
| | **TOPLAM** | **~22 dk + 10-15 dk Q&A** |

## Brand

- Sea-deep `#0a2e4c`, Sun `#f4b53d`, Cream `#f5ede0`
- Heading: Montserrat 900, Body: Inter 400-600
- Slide format: 1920×1080 (16:9), `@page size: 1920px 1080px landscape`

## Düzenleme

Slide içeriği `index.html`'de inline. Sayısal güncellemeler için:
- Pazar verisi: `.omc/research/PAZAR_ARASTIRMASI.md`
- Finansal: `.omc/research/MIMARI_VE_BUTCE.md`
- Slide outline: `.omc/research/PITCH_DECK_ISKELET.md`

## Notlar

- Speaker notes `<aside class="speaker-notes">` ile inline; `@media print` ile PDF'te gizleniyor
- Cover slide'da Unsplash Kaputaş URL'i — internet bağlantısı gerekiyor
- Türkçe karakterler UTF-8, font CDN'den çekiliyor (üretim sırasında çevrimiçi olunmalı)
