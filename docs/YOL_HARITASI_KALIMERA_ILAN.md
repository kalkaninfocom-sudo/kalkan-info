# Yol Haritası — Kalimera Tanıtım + İlan/Üyelik Sistemi

Son güncelleme: 2026-07-09 · Berkay'ın toplu isteği (8 madde) bu dosyada takip edilir.
Durum kodları: ✅ bitti+canlı · 🔨 devam · ⏳ sıradaki · ⛔ bloke

## Bu oturumda BİTEN (canlı)
- ✅ **Catering en üstte** — `hizmetler.html` servis grid'inde Catering zaten 1. kart (teyit edildi).
- ✅ **Sağlayıcı kartına web sitesi linki** — `js/providers-modal.js`; `website` alanı olan her sağlayıcıda WhatsApp altında çıkar. Kalimera → kalimerakitchen.com. (commit 4ef8cf8)
- ✅ **Kalimera %10 WhatsApp indirimi** — altın promo rozeti + WhatsApp mesajına indirim notu. `promo/promoI18n/promoWa` alanları (5 dil). (commit b006804)

## SIRADAKİ — İçerik Otomasyonu (gazete)
- ⏳ **Kalimera günlük tanıtım (gazetede, her gün farklı)** — bir gün menü bilgisi, bir gün fotoğraflı, rotasyon. Mekanizma: `newspaper/generator/build.mjs` içine "günlük sponsor bölümü" + `data/kalimera-content.json` (N farklı içerik, gün indeksine göre döner). Gerçek menü/foto girdisi Berkay'dan.
- ⏳ **"Anlık Usta Hattı" reklamı** — hizmetler + gazetede reklam bloğu. Tesisat/elektrik/havuz acil → tek WhatsApp hattı. İçerik + görsel gerekiyor.
- ⏳ **Her gün gerçek hizmet kişisi tanıtımı** — hizmetlerdeki gerçek ustaların günlük tanıtımı. GEREK: gerçek kişi ad/foto/onay (KVKK — açık rıza şart, memory kuralı). Veri: `data/hizmet-saglayicilari.json` genişletilir (kişi + rıza alanı).

## SIRADAKİ — İlan/Üyelik Sistemi (çoğu VAR, tamamlama işi)
ŞU AN VAR: `register.html` + `login.html` + `profil.html` + `js/auth.js` (Supabase Auth, users tablosu, soft-delete, dil/pazarlama tercihi) · `ilan-ver.html` (giriş zorunlu, `jobs` tablosuna ekler) · `ilanlar.html` (listeleme+filtre) · `api/ilan-page.js`/`job-decision.js`/`jobs-sitemap.js` · tablolar: jobs, job_applications, providers, users, reviews.

NE EKSİK / YAPILACAK:
- ⏳ **"İlanlarım" yönetim sayfası** — giriş yapan kullanıcı kendi ilanlarını görür, **düzenler, kaldırır**. (En büyük gerçek boşluk. `js/lost-found.js`'te delete kalıbı var, örnek alınır.)
- ⏳ **İşletme ilanı tipi** — kişi vs işletme ayrımı (`jobs` tablosuna `poster_type` alanı + ilan-ver formunda seçim).
- ⏳ **RLS güvenlik** — kullanıcı SADECE kendi ilanını düzenler/siler (Supabase RLS policy `auth.uid() = user_id`). KVKK/güvenlik kritik.
- ⏳ **Layout düzeltme** — `ilanlar.html` "görünüm biraz kayık" (görsel inceleme + grid/responsive fix).
- ⏳ **Uçtan uca test** — kayıt → giriş → ilan ver → düzenle → sil → çıkış. Son kullanıcıya sunmadan önce.

## Kısıtlar (unutma)
- `api/*.js` = **12/12 DOLU** — yeni Vercel serverless function EKLENEMEZ. Yeni backend = Supabase Edge Function veya doğrudan supabase-js client.
- KVKK: gerçek kişi tanıtımı = açık rıza. Müşteri PII memory'ye yazılmaz.
- STABİLİTE > yeni özellik. Auth/RLS değişiklikleri dikkatli + test edilerek.
