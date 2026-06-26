# Kalkan Info — 30 Günlük Instagram Yayın Planı

**Dönem:** 16 Haziran 2026 (Pzt) → 15 Temmuz 2026 (Salı)
**Hesap:** @kalkaninfo (IG Business · Travel & Tourism)
**Dil:** TR ana + EN paralel caption (bilingual). 5 dil için `language` alanı multiplekslenir.
**Otomasyon:** Bu plan `data/social-media-plan-30day.json` üzerinden `social_posts` tablosuna seed edilir. Telegram approval bot → publish queue → Meta Graph API.
**Cron uyumu:** Pazartesi 09:00 TR content planner mevcut akışıyla uyumlu — bu plan onun ilk 30 günlük çıktısı kabul edilir.

---

## Sütun yapısı (5 pillar)

| Kod | Sütun | Post | % | Algoritma çapası |
|---|---|---|---|---|
| **S1** | Antik Kentler & Likya | 8 | 27% | Saves + watch time (kültür/tarih izleyici "kaydet ve git" eğilimli) |
| **S2** | Plaj & Doğa | 6 | 20% | Sends + reach (FOMO — "buraya gitmeliyim") |
| **S3** | Aktiviteler & Macera | 5 | 17% | Sends + completion (rezervasyon niyeti) |
| **S4** | Konaklama (Otel + Villa) | 5 | 17% | Saves + profile visits (uzun karar dönemi) |
| **S5** | Yemek, Gece & Pratik | 6 | 20% | Comments + DM (anlık ihtiyaç) |

## Serialized Content (Recurring Series)

Algoritma binge sinyali + marka sadakati için tekrar eden 3 seri. Her seri'nin sabit görsel/intro kimliği var → izleyici "yine o seri" der.

| Seri | Frekans | Format | Sütun bağı | Hook formülü |
|---|---|---|---|---|
| **"Kalkan'da Bugün"** | Her gün story (3-5 frame) | Story serisi, hep aynı template | S2/S5 destek | hava + deniz suyu + önerilen aktivite |
| **"Berkay'la Mekan Testi"** | Haftalık 1 reels | 30-45sn POV, ilk sahne masa + ses "bu hafta..." | S5 birincil | "hangi 3 yıldız hak ediyor?" |
| **"Villa Sahibi Cevaplıyor"** | 2 haftada 1 reels | Q&A, ekran split (soru üst / cevap alt) | S4 birincil | misafir sorusu → sahip 30sn cevap |

**Kural:** Seri başlığı caption'ın ilk satırı, görsel kimlik (renk + font + intro 2sn) her seri için sabit.

## Format dağılımı

| Format | Sayı | Algoritma sinyali |
|---|---|---|
| **Reels** (15-60sn) | 18 | Watch time + completion + sends |
| **Carousel** (3-8 slayt) | 9 | Saves + sends (paylaşılabilirlik) |
| **Statik Feed** | 3 | Caption SEO + saves |
| **Story** (günlük 3-5 frame) | 30 gün × 4 ortalama = ~120 frame | Üst sıra + DM trigger |

## Yayın saatleri (Europe/Istanbul)

| Format | Saat | Mantık |
|---|---|---|
| Sabah carousel (bilgi/rehber) | **10:00** | Sabah scroll, "kaydet ileride lazım olur" |
| Öğle reels (aktivite/yemek) | **13:00** | Öğle yemeği zihni, rezervasyon DM |
| Akşam reels (manzara/lezzet) | **19:00** | Akşam plan zihni |
| Sunset reels (cinematic) | **20:30** | Mavi saat / golden hour FOMO |
| Story (3 dilim) | **09:00 / 13:00 / 19:00** | Üst sıra süreklilik |

---

## Hafta 1 — Açılış (16–22 Haz)

> Kalkan'ı "Likya'nın merkezi + Akdeniz plajı + akşam keyfi" üçlüsünde kafalara kazıyalım. İlk üç gün hesabın ne yaptığını net söyler.

| # | Tarih | Gün | Saat | Format | Sütun | Konu | Hero asset |
|---|---|---|---|---|---|---|---|
| 1 | 16 Haz | Pzt | 10:00 | Carousel · 4 slayt | S1 | **"Kaş'a 35 dk: Likya'nın 10 antik kenti haritası"** — Patara, Letoon, Xanthos, Tlos, Pinara, Sidyma, Aperlae, Apollonia, Kekova, Myra | data/antik-kentler.json + harita SVG |
| 2 | 17 Haz | Sal | 13:00 | Reels · 20sn | S2 | **Kaputaş Plajı** drone alçak geçiş + döner kafa kamera | local_assets/kaputas-drone-* |
| 3 | 18 Haz | Çar | 19:00 | Reels · 30sn | S5 | **"Kalkan'da bir akşam"** — liman → balık restoranı → kadeh tokuşturma | restoranlar + meyhane local + footage |
| 4 | 19 Haz | Per | 13:00 | Reels · 30sn | S3 | **Tekne turu Mavi Mağara** → ahtapot dansı + tekne pruvası | turlar + Mavi Mağara drone |
| 5 | 20 Haz | Cum | 10:00 | Carousel · 5 slayt | S4 | **"16 otelle Kalkan rehberi"** — Hadrian, Doruk, Hera, Pirat, Olea Nova, Asfiya highlights | data/otel-photos/* JSON |
| 6 | 21 Haz | Cmt | 20:30 | Reels · 45sn | S1 | **Patara Antik Kenti** cinematic — sütunlar → tiyatro → plaj geçişi | drone + arşiv (antik-reels.json'dan) |
| 7 | 22 Haz | Pzr | 19:00 | Reels · 25sn | S2 | **Patara Plajı sunset** — uzun pan + ayak izi | patara-drone-clips.json |

**Story rutini (her gün 3-5 frame):** günün hava + deniz suyu sıcaklığı · "şu otel boş" müsaitlik sticker · poll ("bu akşam tekne mi restoran mı?") · @kalkaninfo dahil UGC repost (izinli) · sunset countdown.

---

## Hafta 2 — Lezzet + Macera (23–29 Haz)

> Aktivite ve restoran ağırlığı — yaz sezonu peak öncesi rezervasyon dönüşümü.

| # | Tarih | Gün | Saat | Format | Sütun | Konu | Hero asset |
|---|---|---|---|---|---|---|---|
| 8 | 23 Haz | Pzt | 10:00 | Carousel · 6 slayt | S3 | **Likya Yolu rehberi** — Kalkan etabı 5 sahne + sertifika ipucu | likya-yolu.json |
| 9 | 24 Haz | Sal | 19:00 | Reels · 30sn | S5 | **Kalkan limanı akşam** — fish bar + ışıklar + canlı müzik | restoranlar + ambiance footage |
| 10 | 25 Haz | Çar | 13:00 | Reels · 45sn | S1 | **Xanthos Antik Kenti** — Harpy mezarı + Lykia başkenti hikâyesi | antik-kentler/xanthos |
| 11 | 26 Haz | Per | 13:00 | Reels · 25sn | S3 | **Paragliding Babadağ** — Ölüdeniz açılış + alçalış | aktiviteler + adventure footage |
| 12 | 27 Haz | Cum | 10:00 | Carousel · 5 slayt | S4 | **Top 5 villa** — Villa Linda, Sea House, White House, Mahal, Likya Residence | data/otel-photos villa subset |
| 13 | 28 Haz | Cmt | 20:30 | Reels · 30sn | S2 | **Mavi Mağara dalış** — POV mask + ışık huzmesi underwater | turlar + dalış footage |
| 14 | 29 Haz | Pzr | 19:00 | Carousel · 4 slayt | S5 | **Kalkan plaj kulüpleri** — Lighthouse, Mavi Köşe, Yat Kulübü, Kalamar Beach | plajlar.html data |

**Story rutini:** dalış için hava check · "şu villada Cmt boş" sticker · countdown ("bu akşam canlı müzik 21:00") · UGC tag + repost · meze tabağı close-up.

---

## Hafta 3 — Antik Kentler Haftası (30 Haz – 6 Tem)

> "Likya'nın kalbi Kalkan" temasını sabitle. Tatil gelen yabancıya kültür çapası ver. Reels haftası — 4 antik kent + sabah aktivitesi.

| # | Tarih | Gün | Saat | Format | Sütun | Konu | Hero asset |
|---|---|---|---|---|---|---|---|
| 15 | 30 Haz | Pzt | 13:00 | Reels · 30sn | S1 | **Letoon Antik Kenti** — Leto tapınakları üçlüsü drone + statik karşılaştırma | antik-kentler/letoon + reels.json |
| 16 | 1 Tem | Sal | 09:30 | Reels · 25sn | S3 | **Kayak Patara Plajı sunrise** — kürek + tekne pruvası geniş plan | aktiviteler + dawn footage |
| 17 | 2 Tem | Çar | 10:00 | Carousel · 7 slayt | S1 | **Tlos antik kenti rehberi** — kaya mezarları, akropol, tiyatro, stadyum | antik-kentler/tlos data |
| 18 | 3 Tem | Per | 19:00 | Reels · 25sn | S5 | **Kalkan gece müziği** — meyhane masası + rakı + canlı sazende | meyhane footage |
| 19 | 4 Tem | Cum | 13:00 | Reels · 20sn | S2 | **Kaputaş Plajı dronesnap** — döner pan + sırt üstü deniz | kaputas-drone |
| 20 | 5 Tem | Cmt | 10:00 | Carousel · 5 slayt | S4 | **Bütçe & lüks otel kıyaslaması** — Hotel Pirat (mid) + Hadrian + Doruk + Asfiya | data/otel-photos 4 otel |
| 21 | 6 Tem | Pzr | 20:30 | Reels · 45sn | S1 | **Pinara Antik Kenti** cinematic — kayalara oyulmuş mezarlar pan + akropol | drone + antik-reels.json |

**Story rutini:** "bugün hangi antik kente?" poll · plaj suyu sıcaklık ticker · transfer rehberi sticker · UGC sayfa link sticker · gün batımı countdown.

---

## Hafta 4 — Konaklama + Topluluk + Köprü (7–13 Tem)

> Kalkan'ı "yıl boyu" konumlandır. Cmt batık şehir final reels'i sezon kapsülü.

| # | Tarih | Gün | Saat | Format | Sütun | Konu | Hero asset |
|---|---|---|---|---|---|---|---|
| 22 | 7 Tem | Pzt | 10:00 | Carousel · 6 slayt | S4 | **"3 günlük Kalkan rotası"** — Day1 antik kent + Day2 plaj/tekne + Day3 yemek | mixed data |
| 23 | 8 Tem | Sal | 13:00 | Reels · 30sn | S3 | **Saklıkent Kanyon** — su yürüyüşü + ayak ıslatma POV | aktiviteler |
| 24 | 9 Tem | Çar | 10:00 | Carousel · 8 slayt | S5 | **Restoran rehberi** — 8 restoran (Kaptan, Hera Garden, Trio, vs.) hero foto + 1 satır karakter | restoranlar.html data |
| 25 | 10 Tem | Per | 19:00 | Reels · 25sn | S2 | **Patara Plajı uzun pan** — sonsuz kum çizgisi + caretta caretta info | patara-drone |
| 26 | 11 Tem | Cum | 10:00 | Carousel · 4 slayt | S4 | **Asfiya Retreat Spa + Likya Residence** — lüks pazar segmenti | otel-photos/asfiya-retreat-spa + likya-residence |
| 27 | 12 Tem | Cmt | 20:30 | Reels · 35sn | S1 | **Apollonia / Kekova batık şehir** — tekne üstü + cam tabanlı su altı | turlar + Kekova footage |
| 28 | 13 Tem | Pzr | 19:00 | Statik Feed | S5 | **"30 günde Kalkan"** özet hero + caption SEO + Ağustos teaser | en iyi 3 reels frame mash-up |

**Story rutini:** villa müsaitlik · "şu turda 2 koltuk kaldı" sticker · UGC quote · plaj suyu ticker · 14 Tem teaser countdown.

---

## Kapanış (14–15 Tem)

| # | Tarih | Gün | Saat | Format | Sütun | Konu |
|---|---|---|---|---|---|---|
| 29 | 14 Tem | Pzt | 13:00 | Reels · 30sn | S3 | **"Likya'da bir gün"** mini-doc — sabah antik kent → öğle plaj → akşam meyhane |
| 30 | 15 Tem | Sal | 10:00 | Carousel · 3 slayt | S5 | **Ağustos köprüsü** — yeni eklenen mekânlar + Ağustos etkinlik takvimi + DM CTA |

---

## Hashtag havuzları

### Lokal çapa (her post)
`#kalkan #kas #antalya #kasturkey #kalkantürkiye #lycia`

### Sütun bazlı

| Sütun | Hashtag havuzu (5-7 seç) |
|---|---|
| S1 | `#patara #xanthos #tlos #letoon #lycia #antiktürkiye #lycianway #ancientturkey` |
| S2 | `#kaputasbeach #patarabeach #turkishriviera #blueflag #bluevoyage #mediterraneanblue` |
| S3 | `#bluecruise #lycianway #paragliding #scubadiving #kayaking #adventureturkey` |
| S4 | `#kalkanvillas #kalkanhotels #mediterraneanvilla #luxuryturkey #kalkanstay` |
| S5 | `#kalkanrestaurants #kalkannightlife #turkishmeze #raki #fishrestaurant #seasideturkey` |

### Trend (haftalık 1-2 ekle, ay sonu güncelle)
`#summerinturkey #turkeytravel2026 #visitturkey #turkishsummer`

**Kural:** post başına 5-10 hashtag (spam ceza). 30 hashtag asla yazılmaz.

---

## CTA bankası (rotasyon)

- "Rezervasyon için DM"
- "Yorumlarda buluşalım — favori antik kentin?"
- "Kaydet, Kalkan'a gelirken haritan olsun"
- "Linkten detay (bio)"
- "Bu reels'i Kalkan'a gelecek arkadaşına gönder"

---

## Esneme kuralı

- **Hava kötü** → S2/S3 reels'i bir gün ileri kaydır, yerine S1 (antik kent statik) veya S4 (carousel).
- **Bir reels viral** (>20K reach) → sonraki gün post atma, story aktif kal.
- **Trend olay** (regatta, festival, etkinlik) → o günkü plana ek, sütun atla.
- **Foto/video yok** → footage_queries → Pexels/Pixabay search; markdown'da `needs_shoot:true` olarak işaretle, content planner harvester eder.

---

## Otomasyon kontratı

| Dosya | Görev |
|---|---|
| `content/social-media-plan-30day.json` | Bu planın `social_posts` şemasına uyumlu makine-okunur formatı |
| `scripts/seed-30day-social.mjs` | `node scripts/seed-30day-social.mjs` → 30 satır `social_posts` tablosuna upsert (status=`pending_approval`) |
| `api/social-publish-queue.js` | Mevcut — Telegram onayından sonra IG'ye publish (kullanılıyor) |
| `lib/instagram-publish.js` | Mevcut — Meta Graph API wrapper |
| `scripts/refresh-ig-token.mjs` | Long-lived token rotation (60 günde bir) |

**Önemli:** Bu seed `status='pending_approval'` ile gelir. Berkay Telegram onaylayıncaya kadar hiçbir post yayına gitmez (mevcut sistemde böyle, ona uyduk).

---

## KPI hedefleri (30 gün sonu)

| Metrik | Hedef | Mantık |
|---|---|---|
| Reach | 80K cumulative | Yeni hesap için makul |
| Sends/reach | > 2.5% | Algoritma çapası |
| Saves/reach | > 1.5% | Alıcı niyet (kaydet → gel) |
| Reels completion | > 60% | İlk 3 sn hook + 30-45sn ideal |
| Profil ziyaret | > 4K | Hesap sayfa CTA dönüşümü |
| Bio link tık (kalkaninfo.com) | > 800 | Asıl iş hedefi |

---

**Plan tarihi:** 13 Haziran 2026 · **Yazar:** Claude (sosyal medya planner lane) · **Onay:** Berkay
