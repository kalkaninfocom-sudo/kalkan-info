# Kalkan Info — Yol Haritası v1

> ⚠️ **ARŞİV / ESKİ PLAN (Firebase-devri)** — Bu doküman Nisan 2026 planlama dönemine ait. İşaretsiz `- [ ]` kutuların ÇOĞU Supabase+Vercel ile **ZATEN YAPILDI** (kutu hiç işaretlenmedi): reviews.js, map.js, weather.js, tatil-asistani.html, aktiviteler.html, auth/profil, i18n vb. hepsi canlı. **Açık-iş listesi olarak KULLANMA.** Güncel canlı durum tek kaynak: **`docs/PROJE_DURUMU.md`**.

**Tarih:** 2026-04-30
**Durum:** Statik HTML + JSON tabanlı yerel rehber → Tam yığın platform geçişi
**Sahip:** Berkay Elmastaş (solo founder)

---

## 0. Hedef

Mevcut yerel rehberi şu üç katmana büyütmek:

1. **Üye platformu** — Google/Facebook ile giriş, KVKK uyumlu, profil + işletme yönetimi.
2. **İçerik & otomasyon** — WhatsApp'tan teyitli haber → çoklu sosyal medyaya otomatik dağıtım.
3. **Asistan & araçlar** — Tatil planlayıcı (uçak/transfer/villa/evde aşçı), harita, hava durumu, 5 dil.

---

## 1. Mimari Kararlar

| Karar | Seçim | Gerekçe |
|---|---|---|
| Backend | **Firebase** (Auth + Firestore + Functions + Storage + Hosting) | Mevcut site Firebase Hosting üzerinde. Solo founder için ops yükü düşük. KVKK için EU bölgesi (`europe-west3`). |
| Auth provider | Google + Facebook + e-posta (sadece üye olmak isteyenler için) | İstenen platformlar + fallback. |
| DB modeli | Firestore + Storage (görseller) | NoSQL doküman modeli profil/yorum yapısına uygun. |
| Frontend | Mevcut vanilla HTML + Tailwind CDN + ES modules | Refactor maliyetinden kaçın; yeni sayfalar aynı pattern. |
| i18n | Static `lang/*.json` + küçük `i18n.js` | SSR yok; client-side switcher yeterli. |
| Harita | **Leaflet** + OpenStreetMap | Ücretsiz, anahtar gerekmez, hafif. Mapbox sadece premium istenirse. |
| Hava durumu | **Open-Meteo** (anahtarsız, ücretsiz, EU-friendly) | OpenWeather alternatifi; key gerekmez. |
| Otomasyon | Cloud Functions + Cloud Scheduler + WhatsApp Business API | Twilio veya Meta direkt. |
| Sosyal medya yayını | Buffer/Publer API VEYA platform-direkt API | Maliyet/karmaşıklık dengesi Faz 4'te netleşecek. |
| LLM (asistan + teyit) | Claude API (Sonnet 4.6 / Haiku 4.5) | Mevcut OMC altyapısı + Berkay alışkın. |
| Email | Firebase Trigger Email extension (Mailgun veya SendGrid SMTP) | KVKK için unsubscribe + opt-in zorunlu. |

---

## 2. Veri Modeli (Firestore koleksiyonları)

```
users/{uid}
  email, displayName, photoURL, provider, createdAt
  kvkkConsent: { version, timestamp, ip }
  preferredLang, marketingOptIn

profiles/{profileId}              # işletme/hizmet sağlayıcı profili
  ownerUid, type (restoran|asci|villa|transfer|...), status (pending|active|rejected)
  name, slug, category, summary, descriptionML (i18n)
  images[], menu[], priceRange, hours
  contact { phone, whatsapp, email }
  location { lat, lng, address }
  createdAt, updatedAt, ratingAvg, ratingCount

reviews/{reviewId}
  targetType, targetId, authorUid, rating(1-5), text, photos[]
  createdAt, status (visible|hidden|reported)
  reply (sahibin yanıtı)

vacations/{planId}                # tatil asistanı çıktıları
  ownerUid, dateRange, groupSize, budget
  items[] { type, refId, price, status }

activities/{activityId}           # bölgesel aktiviteler/etkinlikler
  title, season, dateStart, dateEnd, location, descriptionML

newsItems/{newsId}                # WhatsApp → teyit → yayın
  source, rawText, verifiedSummary, claudeConfidence
  publishedTo { youtube, instagram, facebook, twitter, tiktok }
  status (draft|verified|published|rejected)

automations/{job}
  type, schedule, lastRun, lastStatus
```

**KVKK güvenlik kuralları (Firestore rules):**
- Kullanıcı sadece kendi `users/{uid}` dokümanına yazabilir.
- Profil yalnızca `ownerUid == auth.uid` veya admin tarafından yazılabilir.
- Yorumlar yalnızca authenticated kullanıcılar yazabilir, kendi yorumunu silebilir.
- Public read: aktif profiller, görünür yorumlar, aktiviteler, haber.
- Storage: kullanıcı sadece kendi `users/{uid}/` ve `profiles/{ownedProfileId}/` altına yazabilir.

---

## 3. Fazlar

### Faz 1 — Temel (1-2 hafta)
- [ ] Firebase projesi (`kalkan-info`) — Auth, Firestore (europe-west3), Storage, Functions, Hosting
- [ ] i18n iskelesi: `lang/{en,tr,ru,ja,ar}.json` + `js/i18n.js` + dil seçici. **EN default**, AR için RTL.
- [ ] KVKK aydınlatma metni + cookie banner + privacy.html + terms.html
- [ ] Auth sayfaları: `login.html`, `register.html` (Google + Facebook + e-posta)
- [ ] Welcome email Cloud Function (Trigger Email extension)

### Faz 2 — Kullanıcı paneli (1 hafta)
- [ ] `profil.html` — kullanıcı kendi profilini yönetir (avatar, dil, bildirim tercihi, hesap silme)
- [ ] "Hizmet Ekle" akışı: kullanıcı → kategori seçer → profil oluşturur → admin onayı kuyruğuna düşer
- [ ] Admin panelde **profil onay** sekmesi

### Faz 3 — Yorum & değerlendirme (3-5 gün)
- [ ] `js/reviews.js` reusable component (yıldız, fotoğraf, yanıt)
- [ ] Hizmetler/restoranlar/villalar/turlar kartlarına rating özeti
- [ ] Detay sayfalarına yorum bölümü
- [ ] Moderasyon kuyruğu (admin)

### Faz 4 — İşletme detay sayfaları (1 hafta)
- [ ] `restoran/{slug}.html` template — galeri, menü, harita, yorumlar, rezervasyon CTA
- [ ] Çoklu görsel yükleyici (Storage + thumbnail Cloud Function)
- [ ] Menü editörü (kategori → ürün → fiyat) + frontend menü görünümü
- [ ] Aynı template villa/aşçı/transfer için varyantlar

### Faz 5 — Harita & hava durumu (3 gün)
- [ ] `js/map.js` Leaflet wrapper, her kart üzerinde küçük "Konum" butonu modal harita açar
- [ ] `js/weather.js` Open-Meteo'dan 3 günlük tahmin, hero altında widget
- [ ] Hizmet kartlarında "Yol tarifi" linki (Google Maps deeplink)

### Faz 6 — Tatil tasarlama asistanı (1-2 hafta)
- [ ] `tatil-asistani.html` — multi-step form (tarih/kişi/bütçe/tercihler)
- [ ] Cloud Function: form → Claude API → JSON plan (uçak, transfer, villa, aşçı, aktivite)
- [ ] Plan PDF/email çıktısı + kayıt (`vacations` koleksiyonu)
- [ ] Uçak araması: Skyscanner Partner API veya Amadeus self-service (faz başında karar)

### Faz 7 — Bölgesel aktiviteler (3 gün)
- [ ] `aktiviteler.html` + `data/aktiviteler.json` (statik başlangıç, sonradan Firestore'a göç)
- [ ] Mevsimsel filtre, takvim görünümü

### Faz 8 — WhatsApp → sosyal medya otomasyonu (2 hafta)
- [ ] WhatsApp Business webhook → Cloud Function → ham mesaj `newsItems` koleksiyonuna düşer
- [ ] Claude API ile teyit (kaynaklar, tarih, çelişki kontrolü) + özet
- [ ] Admin panelde "Yayın Onay" ekranı (insan doğrulaması zorunlu — ilk fazda)
- [ ] Onaylananlar Buffer/Publer API ile YT/IG/FB/X/TikTok'a sıraya
- [ ] Yayın sonuçları `publishedTo` field'ına geri yaz

### Faz 9 — Çoklu dil tüm içeriğe yayma (sürekli)
- [ ] Tüm sayfalardaki statik metinler `data-i18n` ile işaretli
- [ ] Profil/yorum/menü içeriği için `descriptionML: { en, tr, ru, ja, ar }` modeli
- [ ] Otomatik çeviri fallback (admin panelde "AI ile çevir" butonu — Claude)

### Faz 10 — Polish & büyüme
- [ ] PWA push notification (yeni nöbetçi eczane, hava uyarısı)
- [ ] Sitemap + hreflang çoklu dil için güncellensin
- [ ] Lighthouse skoru 95+ tüm sayfalarda

---

## 4. Paralel Çalışma Planı (Bu Oturum)

Aşağıdaki agent'lar **paralel** başlatılır, her biri kendi dosya alanında çalışır (çakışma yok):

| Agent | Görev | Dosya alanı | Model |
|---|---|---|---|
| **architect** | Firebase proje strüktürü, KVKK Firestore rules, security model dokümanı | `docs/ARCHITECTURE.md`, `firestore.rules`, `storage.rules` | opus |
| **executor-A** | i18n iskelesi: `lang/*.json` (5 dil), `js/i18n.js`, dil seçici, RTL CSS | `lang/`, `js/i18n.js`, `index.html` (sadece dil seçici) | sonnet |
| **executor-B** | Auth sayfaları + KVKK metinleri | `login.html`, `register.html`, `profil.html`, `kvkk.html`, `privacy.html`, `js/auth.js` | sonnet |
| **executor-C** | Harita + hava durumu widget'ları | `js/map.js`, `js/weather.js`, `index.html` (hero altı) | sonnet |

Sonraki round'da (Faz 2+):
- Yorum komponenti (executor-D)
- Profil self-onboarding (executor-E)
- Restoran detay template (designer + executor)

---

## 5. Riskler & Açık Sorular

- **WhatsApp Business API onayı** — Meta Business hesabı gerekli, başvuru 1-2 hafta sürebilir. Alternatif: Twilio sandbox ilk fazda.
- **Sosyal medya API'leri** — TikTok ve Instagram resmi posting API'si kısıtlı. Buffer/Publer aracılık ücretli (~$15/ay başlar).
- **Maliyet** — Firebase Blaze plan zorunlu (Functions için). Aylık ~$0-10 başlangıçta, kullanım arttıkça izle.
- **KVKK denetimi** — Aydınlatma metni hukuki gözden geçirme gerekir. Şablon ile başla, avukat onayı Faz 1 sonu.
- **Skyscanner Partner API** — Onay süreci var. Alternatif: Amadeus self-service veya Kiwi.com Tequila.
- **Claude API maliyeti** — Tatil asistanı her sorgu için ~$0.05-0.15. Caching + rate limit zorunlu.

---

## 6. Tamamlanma Kriterleri

Bu yol haritası şu olduğunda v1 kapanır:
- Kullanıcı Google ile giriş yapar, profilini düzenler, hizmet profili ekler.
- 5 dilde site gezilebilir.
- Hava durumu + harita çalışır.
- En az 1 restoran sayfası galeri+menü+yorum+harita ile tam dolu.
- Tatil asistanı en az 1 başarılı plan üretir.
- WhatsApp'tan gelen 1 haber teyit edilip 5 platforma yayınlanır.

---

**Sonraki adım:** Paralel agent'lar başlatılıyor (architect + 3 executor).
