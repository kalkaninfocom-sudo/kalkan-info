# Kişisel Veri Envanteri — Kalkan Info

**Versiyon:** 1.0
**Tarih:** 2026-05-17
**Veri Sorumlusu:** Kalkan Info Bilişim ve Turizm Ltd. Şti.
**DPO:** Berkay Elmastaş — info@kalkaninfo.com

> KVKK 6698 madde 16 + Yönetmelik gereği veri sorumlusu envanteri. Şekilsel olarak VERBİS kayıt formatına uyumlu (eşik aşılınca aktarılır).

---

## Tablo 1 — Kişisel Veri Akışı

| # | Veri | KVKK Kategorisi | Kaynak | Saklama Yeri | Retention | Açık Rıza | Aktarılan |
|---|---|---|---|---|---|---|---|
| 1 | Ad-Soyad | Kimlik | Kayıt formu | `auth.users.raw_user_meta_data.full_name` | Hesap aktif + 6 yıl | Hayır (sözleşme) | Resend (mail), Twilio (SMS) |
| 2 | E-posta | İletişim | Kayıt formu | `auth.users.email` | Hesap aktif + 3 yıl | Hayır | Resend |
| 3 | Telefon | İletişim | Profil + rezervasyon | `profiles.phone` | Hesap aktif + 6 yıl | Hayır | Twilio (SMS), iyzico |
| 4 | Doğum tarihi | Kimlik | Profil opsiyonel | `profiles.birth_date` | Hesap aktif | EVET (açık rıza) | Yok |
| 5 | Profil fotoğrafı | Kimlik (görüntü) | Profil upload / Google OAuth | `profiles.avatar_url` (Storage) | Hesap aktif | Hayır (görünür için) | Supabase Storage |
| 6 | IP adresi | Trafik | HTTP request | `audit_log.ip_address` | 2 yıl (5651) | Hayır (zorunlu) | Yok |
| 7 | User-Agent | Cihaz | HTTP request | `audit_log.user_agent` | 2 yıl | Hayır | Yok |
| 8 | Konum (GPS) | Konum | TatilPlanner formu | `vacation_requests.location` | 1 yıl | EVET | Anthropic API (öneri üretme) |
| 9 | Cookie ID (analytics) | Trafik | Browser | localStorage + GA4 | 12 ay | EVET (opt-in) | GA4 (US — DPA) |
| 10 | Cookie ID (functional) | Trafik | Browser | localStorage | Session | Hayır | Yok |
| 11 | Yorum + foto | İçerik | reviews.html | `reviews.text + photo` | Yayında kaldıkça / kullanıcı silerse | Hayır (yayın amacı) | Yok |
| 12 | WhatsApp mesaj | İletişim | webhook | `support_conversations.message` (PII redacted) | 90 gün | Hayır | Twilio, opsiyonel Anthropic (sınıflandırma) |
| 13 | TC kimlik no (provider) | Kimlik (özel) | Provider onboarding | `providers.tax_id` (AES-256 şifreli) | Sözleşme + 10 yıl | Hayır (KOR + vergi) | iyzico (KYC) |
| 14 | IBAN (provider) | Mali | Provider onboarding | `providers.iban` (şifreli) | Sözleşme + 10 yıl | Hayır | iyzico |
| 15 | Rezervasyon detay | Mali + Kimlik | bookings.html | `bookings` | 10 yıl (vergi) | Hayır | iyzico, mali müşavir |
| 16 | Pazarlama izni | Onay | Newsletter checkbox | `newsletter_subscribers.consent + IYS_id` | İzin iptaline kadar | EVET | Resend, İYS |
| 17 | KOR bildirim | Yabancı kimlik | Booking + yabancı misafir | `kor_reports` | 10 yıl | Hayır (5651 + KOR) | Emniyet Genel Md (KOR API) |
| 18 | İş başvurusu CV | Kimlik + Mesleki | ilan-ver.html | `job_applications.cv_url` | 1 yıl | EVET | Yok |
| 19 | Sosyal medya kimliği | Onay (Google OAuth) | Login flow | `auth.identities.identity_data` | Hesap aktif | EVET | Google |
| 20 | Davet kodu / referans | Kimlik (link) | Referans linki | `auth.users.raw_user_meta_data.ref` | Hesap aktif | Hayır | Yok |

---

## Tablo 2 — Veri İşleyenler (3rd Party)

| İşleyen | Veri | Yer | DPA | Aktarım Sebebi | Risk |
|---|---|---|---|---|---|
| Supabase | Tüm DB + Auth | ap-southeast-2 Sydney | Standard DPA | Hosting | **Yüksek (taşıma gerekli → eu-central-1)** |
| Vercel | Statik web + Edge | global (eu-west pin) | Standard DPA | Hosting | Düşük |
| Resend | E-posta | EU | DPA imzalı | Mail gönderim | Düşük |
| Twilio | SMS + WhatsApp | US | Trial → DPA bekleniyor | İletişim | Orta |
| Anthropic | Prompt input (PII'siz) | US | API DPA | AI agent | Orta — PII gönderme YASAK |
| Google OAuth | Kimlik | EU/US | Standard | Auth | Düşük |
| Google Analytics 4 | Kullanım | US | Standard + IP anonimize | Analytics | Orta |
| Plausible | Anonim kullanım | EU | Standard | Analytics | Düşük |
| iyzico (Faz 3) | Ödeme + KYC | TR | BDDK denetimli | Ödeme + alt-bayilik | Düşük |
| Meta (FB/IG) | OAuth + Hashtag API | US/EU | Standard | Sosyal medya entegrasyon | Orta |

---

## Tablo 3 — Erişim Hakları (Roller)

| Rol | Kim | Hangi veriye | Audit log |
|---|---|---|---|
| guest | Anonim ziyaretçi | Public içerik | Yok |
| member | Üye | Kendi profili + rezervasyon | Var |
| provider | Hizmet sağlayıcı | Kendi listing + booking | Var |
| staff | Saha kadrosu | Atanmış booking | Var |
| admin | Berkay | Tüm veri | Var (kendi aksiyon) |
| super_admin | (yok — admin = super) | - | - |
| DPO | Berkay | Tüm KVKK akış | Var |

---

## Tablo 4 — Silme Akışları

| Olay | Tetikleyici | Süre | Sorumlu |
|---|---|---|---|
| Kullanıcı "hesabımı sil" | `profil.html` butonu | T+30 gün soft, sonra hard | KVKKGuardian cron |
| audit_log retention | Otomatik (pg_cron `audit_log_purge_daily`, 03:00 UTC) | 90 gün | pg_cron / Edge Function fallback |
| support_conversations | Otomatik | 90 gün | KVKKGuardian cron |
| Vergi belgesi (bookings) | Yasal | 10 yıl | Manuel (mali müşavir) |
| Pazarlama izni iptali | "Aboneliği iptal" link | Hemen | Webhook |

---

## Tablo 5 — Şifreleme Standardı

| Veri | At Rest | In Transit | Anahtar Rotasyonu |
|---|---|---|---|
| PII (tax_id, iban) | AES-256 (Supabase Vault) | TLS 1.3 | Yıllık |
| Şifre | Bcrypt (Supabase Auth) | TLS 1.3 | N/A |
| Session token | HS256 JWT | TLS 1.3 + HttpOnly | 24 saat |
| Audit log | Plain (PII redacted) | TLS 1.3 | N/A |
| Backup | AES-256 (Supabase) | TLS 1.3 | N/A |

---

## Güncelleme Politikası

Bu envanter:
- Her yeni schema değişikliğinde KVKKGuardian agent ile güncellenir
- Her yeni 3rd party servis eklendiğinde manuel revize edilir
- Yıllık avukat retainer review'unda kontrol edilir
- VERBİS eşiği aşılırsa resmi VERBİS formatına dönüştürülür

## Versiyon

| Versiyon | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 2026-05-17 | İlk yayın — 20 veri kategorisi, 10 işleyen, 5 silme akışı |
