# KALKANINFO — MARKA STRATEJİSİ (Tek Çekirdek → Üç Yüz)

> Bu doküman **yönü belirleyen** üst karardır. Portal (B2C), Ajans sitesi (B2B) ve
> teslim ettiğimiz müşteri siteleri **aynı marka çekirdeğinden türer**. Her yeni
> tasarım/kopya kararı bu dokümana karşı denetlenir.
> Son güncelleme: 2026-07-17

---

## 0 · Marka Çekirdeği — değiştirilemez konum

Kalkan, İngiltere/İskandinav üst-orta segmentin **sessiz-lüks (quiet luxury)** tatil
bölgesidir. Bodrum/Çeşme'nin gösterişçiliği DEĞİL. Marka konumu tek cümle:

> **"Kalkan'ı bilenlerin rehberi."** — turist tuzağı değil, içeriden biri.

Bu karar her şeyi belirler:
- **Ton:** alçak sesli, kendinden emin, az sıfat
- **Tasarım:** ferah, pahalı-boşluklu, editoryal (dergi gibi)
- **Renk:** golden-hour AÇIK tema — koyu tema YASAK (Berkay iki kez reddetti)
- **Kanıt:** gerçek Kalkan fotoğrafı + doğrulanmış işletme verisi = gerçek rekabet üstünlüğü

---

## 1 · Ortak Tasarım Dili (üç yüzde de SABİT)

### Palet
| Rol | Değer |
|-----|-------|
| Zemin (kum/kireç) | `#FAF6EF` |
| Metin (gece mavisi) | `#0E1A24` |
| Aksan (altın saat) | `#E8A020` (amber) + mercan |
| Vurgu (Akdeniz) | teal — sadece küçük vurguda |

- Default Tailwind mavi/indigo **YASAK**.
- Gölge: katmanlı, düşük opasiteli, renk-tonlu (flat `shadow-md` yasak).

### Tipografi
- Display serif (başlık, editoryal): Fraunces / Canela tarzı
- Temiz sans (gövde)
- Büyük başlık `letter-spacing: -0.03em`, gövde `line-height: 1.7`
- Başlık ve gövde AYNI font olamaz.

### Fotoğraf = markanın %70'i
- Gerçek Kalkan fotoğrafı (137 fotolu envanter). Stok foto **YASAK**.
- Her görsele hafif golden-hour grade + `mix-blend` derinlik katmanı.
- Görsel üstü gradient overlay (`from-black/60`) okunabilirlik için.

### Boşluk = lüks
Yoğunluk değil nefes. Katmanlı derinlik sistemi (base → elevated → floating),
her şey aynı z-düzleminde oturmaz.

### Hareket
Sadece `transform` + `opacity`, spring easing. `transition-all` YASAK.
Her tıklanabilir eleman: hover + focus-visible + active state.

---

## 2 · Üç Yüz — bölümler (doğru sırada)

### A) PORTAL (B2C — turist)
1. Hero: tek sinematik Kalkan planı + tek vaat, "keşif" çağrısı
2. Neden Kalkan — 3-4 duygusal kanıt (koy, ışık, sofra)
3. Deneyim kategorileri: Villalar · Plajlar/Koylar · Sofra · Antik · Tekne
4. Editoryal öne çıkanlar (haftanın mekânı / gizli koy) — otorite sinyali
5. İnteraktif harita (3D "Arkadaşım Nerede" buraya bağlanır)
6. Mevsim/rehber içerik (SEO + otorite)
7. Güven şeridi: "gerçek veri, doğrulanmış işletme"
8. Footer: bölge sözlüğü, çok dil

### B) AJANS SİTESİ (B2B — işletme sahibi)
1. Hero: sonuç vaadi ("Kalkan'da bulunur olun") + canlı demo CTA
2. Sorun aynası: sitesi olmayan / Google'da görünmeyen 3 acı
3. **Kanıt-önce: gerçek grounded demo** (`/demo/<slug>`) — satışın kalbi
4. Ne veriyoruz: site + foto + AI içerik + Google görünürlük
5. Fiyat/paket — çapa fiyat ŞART (hata #2)
6. Vaka: canlı müşteri sitesi (La Mora / Çiku)
7. Süreç: 3 adımda yayında
8. CTA + WhatsApp

### C) MÜŞTERİ SİTESİ ŞABLONU (teslim ürünü)
1. Hero: en iyi foto tam-ekran + tek cümle kimlik
2. Öne çıkan (menü/oda/villa) — 3-6 kart
3. Hikaye/atmosfer (kısa editoryal)
4. Galeri (grounded gerçek foto)
5. Konum + harita (koordinata sabit — La Mora dersi)
6. Rezervasyon/WhatsApp — tek dokunuş
7. Footer: saat, dil, sosyal

---

## 3 · Kopya Tonu

Alçak sesli, kendinden emin, az sıfat. Lüks = az kelime + yüksek kesinlik.

- ❌ "Muhteşem eşsiz cennet"
- ✅ "Kalkan'ın en sessiz koyu, öğleden sonra 4'te"
- İşletme tarafı: sonuç odaklı, abartısız — "3 günde yayında, gerçek fotoğraflarınızla"

---

## 4 · Kaçınılacak 3 Yaygın Hata (bu sektörde)

1. **Stok foto + genel "paradise" dili** → anında ucuzlar. Bölge sitelerinin #1 hatası.
   Silahımız gerçek foto; asla stokla seyreltme.
2. **Fiyatı gizlemek / "iletişime geçin"** → B2B'de güvensizlik. Çapa fiyat + net paket
   premium algıyı ARTIRIR.
3. **Her şeyi tek sayfaya tıkmak** (yoğunluk = değer sanısı) → tersi. Lüks boşluktur.
   40 kategoriyi hero'ya doldurmak siteyi pazar tezgâhına çevirir.

---

## 5 · Denetim Kuralı

Her yeni sayfa/bileşen yayına gitmeden bu 6 soruyu geçmeli:
- [ ] Golden-hour AÇIK tema mı? (koyu değil)
- [ ] Gerçek Kalkan fotoğrafı mı? (stok değil)
- [ ] Başlık serif + gövde sans farklı mı?
- [ ] Default Tailwind mavi/indigo YOK mu?
- [ ] Boşluk/nefes var mı, yoksa tıkış mı?
- [ ] Ton alçak sesli + spesifik mi, abartı sıfat yok mu?
