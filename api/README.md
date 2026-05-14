# Kalkan Info — API Route Env Vars

Vercel dashboard → Settings → Environment Variables → aşağıdakileri ekle.

## WhatsApp Webhook (`/api/whatsapp`)

| Değişken | Açıklama | Zorunlu |
|---|---|---|
| `META_VERIFY_TOKEN` | Meta Business console'da set ettiğin token | Evet |
| `META_APP_SECRET` | Meta App → App Secret (HMAC imza doğrulama) | Evet |
| `META_PHONE_NUMBER_ID` | WhatsApp Cloud API Phone Number ID | Hayır (gelecek kullanım) |
| `META_ACCESS_TOKEN` | WhatsApp Cloud API erişim token'ı | Hayır (gelecek kullanım) |
| `WHATSAPP_ALLOWLIST` | Virgülle ayrılmış izinli telefon listesi: `+905XXXXXXXXX,+905YYYYYYYYY` | Hayır (boşsa herkesi kabul eder) |

## Welcome Email (`/api/welcome-email`)

| Değişken | Açıklama | Zorunlu |
|---|---|---|
| `RESEND_API_KEY` | resend.com API anahtarı | Hayır* |
| `EMAIL_FROM` | Gönderici adresi (varsayılan: `Kalkan Info <noreply@kalkaninfo.com>`) | Hayır |
| `EMAIL_REPLY_TO` | Reply-To adresi (varsayılan: `info@kalkaninfo.com`) | Hayır |

*`RESEND_API_KEY` yoksa stub mode: e-posta `mail_queue` tablosuna `status='pending'` olarak eklenir. Anahtar gelince toplu flush için ayrı bir cron/manuel script kullanılabilir.

## Supabase (her iki route için)

| Değişken | Açıklama | Zorunlu |
|---|---|---|
| `SUPABASE_URL` | `https://<proje-id>.supabase.co` | Evet |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **anon değil** (RLS bypass) | Evet |

> Service role key frontend'e asla gönderilmez. Sadece `api/` dizinindeki server-side fonksiyonlarda kullanılır.

## Stub Mode Davranışı

Env var eksikse fonksiyonlar hata fırlatmaz:
- `api/whatsapp`: console.log + 200 döner (Meta retry yapmaz)
- `api/welcome-email`: `RESEND_API_KEY` yoksa `mail_queue` insert, Supabase env yoksa 200 stub döner
