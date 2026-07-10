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
- ✅ **"İlanlarım" yönetim sayfası** — düzenle/sil canlı. (commit deaf6ed)
- ✅ **İşletme ilanı tipi (poster_type)** — kişi/işletme radio + kart/detay rozeti + filtre. (commit f7d69d4) ⛔ **Berkay: `supabase db push` çalıştır** (migration remote'ta yok; kolon eklenmeden yeni ilan gönderiminde poster_type insert hatası olabilir).
- ✅ **RLS güvenlik** — `jobs_owner_insert/update/delete` (`auth.uid() = owner_id`) initial_schema'da zaten mevcut + client `.eq('owner_id')` savunması. Doğrulandı.
- ✅ **Layout düzeltme** — aday profili banner `-mt-2` yapışıklığı giderildi; filtre satırı `md:flex-wrap` (4. filtre dar ekranda kesilmiyor). (commit f7d69d4)
- ⏳ **Uçtan uca test** — kayıt → giriş → ilan ver (poster_type dahil) → düzenle → sil → çıkış. Migration push'landıktan sonra canlıda doğrula. (Local Supabase key'leri geride → local'de 0 ilan; test prod'da yapılmalı.)

## Kısıtlar (unutma)
- `api/*.js` = **12/12 DOLU** — yeni Vercel serverless function EKLENEMEZ. Yeni backend = Supabase Edge Function veya doğrudan supabase-js client.
- KVKK: gerçek kişi tanıtımı = açık rıza. Müşteri PII memory'ye yazılmaz.
- STABİLİTE > yeni özellik. Auth/RLS değişiklikleri dikkatli + test edilerek.
