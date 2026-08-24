# KALKAN STAYS — Kiralama App Build Spec (paralel agent referansı)

Oda→daire→bina kiralama marketplace'i (Airbnb-modeli, ücretli, **talep→onay**, iyzico YOK). CouchSurfing = sadece "oda→bina yelpazesi" ilhamı. Arz: mevcut villa/otel seed + host kaydı.

## MİMARİ (değişmez kurallar)
- **Backend:** Supabase. Şema `supabase/migrations/20260824000000_stays.sql` (tables: `stays`, `stay_blocked_dates`, `stay_bookings`). RLS içeride. Çift-rezervasyon veritabanı seviyesinde kilitli (exclusion constraint).
- **Client-side supabase-js**, YENİ Vercel `api/` fonksiyonu **YASAK** (12/12 dolu). Her şey tarayıcıda RLS ile.
- **Referans desen (AYNEN taklit et):** `ilanlar.html` + `ilan-ver.html` + `js/marketplace.js`. Bunları OKU, aynı yapıyı kur.
- **Supabase client:** `import { supabase } from '/js/supabase-client.js'`. Auth: `js/auth.js` (giriş/oturum). Storage bucket: `stay-photos`, kullanıcı `<uid>/dosya` klasörüne yükler.
- **Dil:** Ana site kök + `de/`,`en/`,`ru/`,`fr/` dizin deseni. MVP: TR kök sayfa; i18n sonra (`lib/i18n-cache` motoru var).
- **Tasarım:** kök `CLAUDE.md` marka kuralları (koyu Tailwind mavi/indigo YASAK; özel marka rengi; katmanlı gölge; hover/focus state). Ama işlevsellik > cila; çalışan + temiz yeter, sonra cilalarız.
- **Para birimi:** TRY. total = nights × price_per_night + cleaning_fee (uygulama hesaplar).
- **Müsaitlik:** stay `available_from/to` sezonu + `stay_blocked_dates` (elle kapalı) + onaylı `stay_bookings` çakışması. Bir tarih aralığı bookable ⇔ sezon içi ∧ blocked değil ∧ onaylı rezervasyonla çakışmıyor.
- **DOKUNMA:** `js/supabase-client.js`, `js/auth.js`, ortak nav/CSS gibi paylaşımlı dosyaları DEĞİŞTİRME. Sadece kendi dosyalarını YARAT. Paylaşımlı değişiklik gerekiyorsa çıktında NOT düş, yapma.
- Test için canlı Supabase gerekmez — kodu referans desene göre doğru kur, kendini marketplace.js'e karşı gözden geçir.

## MODÜLLER (her agent SADECE kendi dosyalarını yaratır)
- **M1 Seed:** `scripts/seed-stays.mjs` — `data/villalar.json` + `data/oteller.json`'ı `stays` satırlarına çevirir (upsert, service-role ile). listing_type haritala (villa→'villa', otel oda→'room'). Fiyat/kapasite/foto/konum/amenities eşle. Idempotent (slug ile).
- **M2 Gezinme:** `kirala.html` + `js/stays-browse.js` — ilan listesi + filtre (tarih aralığı, listing_type, kapasite, fiyat aralığı, konum). Kart: foto/başlık/tip/kapasite/fiyat-gece. `ilanlar.html` düzeninin ikizi.
- **M3 Detay+Booking:** `kirala-ilan.html` (slug querystring) + `js/stays-detail.js` — galeri, amenities, açıklama, müsaitlik takvimi (blocked+booked işaretli), tarih seç → fiyat özeti → "Rezervasyon talebi gönder" (stay_bookings insert status='requested', giriş şart). Kendi tarihini çakıştırma kontrolü (UX; DB zaten kilitli).
- **M4 Host paneli:** `kirala-ekle.html` (ilan oluştur/düzenle + foto upload stay-photos'a) + `kiralamalarim.html` (host: gelen talepleri onayla/reddet; misafir: kendi taleplerim). `ilan-ver.html` foto-upload desenini taklit et.

## KABUL KRİTERLERİ
- RLS ihlali yok (herkes aktif ilanı okur; yazma auth+email-verified). Yeni Vercel api YOK. supabase-client.js import doğru. marketplace.js deseniyle tutarlı. Foto upload `<uid>/` klasörüne. Booking insert status='requested'. Konsol hatasız (statik inceleme).
