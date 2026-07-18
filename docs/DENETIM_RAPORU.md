# KALKANINFO MARKA DENETİMİ — 3 Yüz

> Kriter: `docs/MARKA_STRATEJISI.md` §1 palet (`#FAF6EF` zemin / `#0E1A24` metin /
> `#E8A020` amber / teal küçük vurgu) + §5 altı denetim sorusu.
> Yöntem: localhost:3000 server, görsel screenshot + kod bazlı inceleme.
> Tarih: 2026-07-17

---

## Özet Tablo

| Yüz | Skor | Açık tema | Gerçek foto | Serif+sans ayrı | Mavi/indigo yok | Boşluk/nefes | Alçak ton |
|-----|------|-----------|-------------|-----------------|-----------------|--------------|-----------|
| **PORTAL** `index.html` | **2/6** | ❌ koyu lacivert | ✅ Kaputaş .webp | ❌ iki de sans | ❌ mavi hakim | ⚠️ tıkış | ⚠️ orta |
| **AJANS** `ajansAI/index.html` | **0/6** | ❌ siyah-navy | ❌ foto yok | ❌ iki de sans | ❌ `#4a9ef5` | ❌ yoğun tablo | — yanlış ürün |
| **MÜŞTERİ** `demo/ciku/index.html` | **2/6** | ❌ `#150b06` | ⚠️ gerçek ama Kalkan değil | ✅ Fraunces+Manrope | ✅ | ✅ ferah | ✅ iyi |

---

## 1) PORTAL — 2/6

**Stratejiye aykırı en kritik 3 sorun:**

1. **Koyu tema (§0 YASAK).** `index.html:38` body `background:#dce6ef` olsa da tüm ana
   bölümler koyu blok: hero header `#072136`, hızlı erişim section `#0a2e4c`, gazete
   `#072136`, footer koyu. Golden-hour açık temanın zıddı. Zemin `#FAF6EF` olmalı.
2. **Mavi hakim palet (§1).** `sea.900 #072136 → sea.800 #0a2e4c` her yerde birincil
   renk. Strateji amber (`#E8A020`) + kum zeminini ana yapıp mavi/teal'i "sadece küçük
   vurgu" ister — burada tersi: mavi zemin, amber aksan.
3. **Tek font ailesi (§1).** `index.html:38-39` başlık `Montserrat`, gövde `Inter` —
   ikisi de sans, serif YOK. Strateji "display serif (Fraunces/Canela)" şart koşuyor.
   Ayrıca hero editoryal değil, "HIZLI ERİŞİM" tuğla ızgarası = §4 hata #3 (tıkış).

**Tek satır düzeltme:** Zemini `#FAF6EF`'e çevir, başlıklara Fraunces serif ekle, mavi
blokları amber-vurgulu açık editoryal bölümlere indir.

---

## 2) AJANS — 0/6 (yanlış ürün)

**Stratejiye aykırı en kritik 3 sorun:**

1. **B2B satış sitesi değil — şifreli iç panel.** `ajansAI/index.html:7` "AjansAI
   Operasyon Merkezi", `:397` `PASS='123'` gate, `:6` `noindex,nofollow`. §2-B'nin
   hiçbir bölümü yok (sonuç-vaadi hero, sorun aynası, grounded demo, çapa fiyat, vaka).
2. **Tam koyu tema + default'a yakın mavi (§0+§1).** `:13` `--navy:#071726` zemin,
   `:13` `--sea:#4a9ef5` (default Tailwind mavisine yakın parlak mavi).
3. **Serif yok + foto sıfır (§1).** `:9` `Montserrat`+`Inter` (ikisi sans). Gerçek
   Kalkan fotoğrafı hiç yok — dashboard tablosu. Marka çekirdeği (foto=%70) tümüyle yok.

**Tek satır düzeltme:** Paneli iç araç bırak; ayrı `ajans.html` yaz — açık kum zemin,
serif başlık, grounded `/demo/<slug>` demoları, çapa fiyat (§2-B sırasıyla).

---

## 3) MÜŞTERİ ŞABLONU (Ciku) — 2/6

**Stratejiye aykırı en kritik 3 sorun:**

1. **Koyu tema — en ağır ihlal (§0 YASAK).** `demo/ciku/index.html:79` tailwind config
   `cocoa.950:'#150b06'` + `:94` `body background:#150b06`. Kahve-siyah zemin,
   golden-hour açık temanın tam zıddı.
2. **Foto grounded değil (§4 hata #1 riski).** `:219,256,343` ürün fotoları gerçek ama
   işletme Samsun'da — Kalkan envanteri değil. Şablon Kalkan işletmesine uygulanınca
   doğru foto disipliniyle çözülmeli.
3. **La Mora dersi tekrarı — canlı müşteri de koyu.** `lamora/style.css:18`
   `--bg: #0a0a0a; /* SİYAH zemin (eskiden krem) */` + `lamora/index.html:12`
   `theme-color #111111`. Teslim edilen iki müşteri sitesi de (Ciku demo + La Mora
   canlı) koyu. Yorum satırı krem→siyah çevrildiğini itiraf ediyor.

**Olumlu:** Ciku tipografisi strateji-uyumlu tek yer — `:73,84-87` `Fraunces` (serif
display) + `Manrope` (sans), tracking-tightest başlık, line-height 1.7 gövde, katmanlı
warm shadow, ferah boşluk, doğru palet yapısı (cocoa/cream/gold/pist). Sadece zemin ters.

**Tek satır düzeltme:** `cocoa.950` zemini `cream.50 #fbf7f1`'e çevir, metni koyu cocoa
yap (Fraunces/Manrope + gold aksanı koru) — açık temaya çevirince şablon ~5/6'ya çıkar.

---

## Genel Bulgu

Üç yüzün **hiçbiri golden-hour açık temada değil** — Berkay'ın iki kez reddettiği
(`feedback_light_not_dark_themes`) ve stratejinin §0'da "YASAK" dediği tek en kritik
sistemik sorun. **Serif başlık yalnızca Ciku'da var** (portal + ajans tümüyle sans).
**Ajans yüzü stratejik olarak eksik**: satış sitesi yerine şifreli iç panel var. En yakın
uyumlu iskelet Ciku şablonu — sadece zemin ters çevrilirse ~5/6'ya çıkar.

**Görsel kanıt:** `C:\Users\socie\temporary screenshots\` → `screenshot-203-portal.png`,
`screenshot-204-ciku.png`, `screenshot-205-lamora.png`. Ajans şifre kapısı nedeniyle kod
bazlı denetlendi.

**Not:** `serve.mjs` / `screenshot.mjs` kalkan-info kökünde değil `C:\Users\socie\`
kökünde.
