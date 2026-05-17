# KVKK Uyum Matrisi — Kalkan Info

**Versiyon:** 1.0
**Tarih:** 2026-05-17
**Veri Sorumlusu:** Kalkan Info Bilişim ve Turizm Ltd. Şti. (kuruluş bekleniyor — Faz 0)
**DPO:** Berkay Elmastaş — info@kalkaninfo.com
**Yetki:** KVKK 6698 + GDPR Madde 6 (yabancı kullanıcı kapsamı)

---

## 1. Kişisel Veri Kategorileri

| Veri | Tablo | Kategori (KVKK 6) | Açık Rıza? | Retention | Hard Delete |
|---|---|---|---|---|---|
| Ad-Soyad | `auth.users`, `profiles` | Kimlik | Hayır (sözleşme) | Hesap aktif + 6 yıl | 6 yıl sonra |
| E-posta | `auth.users` | İletişim | Hayır (zorunlu) | Hesap aktif + 3 yıl | 3 yıl sonra |
| Telefon | `profiles.phone` | İletişim | Hayır (rezervasyon zorunlu) | Hesap aktif + 6 yıl | 6 yıl sonra |
| IP adresi | `audit_log.ip` | Trafik | Hayır (5651) | 2 yıl | 2 yıl sonra |
| User-Agent | `audit_log.ua` | Cihaz | Hayır (5651) | 2 yıl | 2 yıl sonra |
| Konum (GPS) | `vacation_requests.location` | Konum | **EVET** | 1 yıl veya hesap sonu | 1 yıl |
| Cookie ID | Çerezler | Trafik | **EVET (analytics)** | 12 ay | 12 ay |
| Yorum + foto | `reviews` | İçerik | Hayır (yayın için onay) | Yayında kaldıkça | Kullanıcı silerse |
| Mesaj (WhatsApp) | `support_conversations` | İletişim | Hayır (müşteri hizmeti) | 90 gün | 90 gün otomatik |
| TC Kimlik (provider KYC) | `providers.tax_id` (şifreli) | Kimlik | Hayır (zorunlu) | Sözleşme + 10 yıl | 10 yıl sonra |
| IBAN (provider) | `providers.iban` (şifreli) | Mali | Hayır (sözleşme) | Sözleşme + 10 yıl | 10 yıl sonra |
| Rezervasyon detay | `bookings` | Mali + Kimlik | Hayır (sözleşme + KOR) | 10 yıl (vergi) | 10 yıl |
| Pazarlama izni | `subscriptions.consent` | Onay | **EVET** | Kullanıcı iptal eder | Hemen revoke |
| KOR bildirimi | `kor_reports` | Yabancı kimlik | Hayır (5651 + KOR zorunlu) | 10 yıl | 10 yıl |

## 2. Üçüncü Taraf İşleyenler

| İşleyen | Verisi | Lokasyon | DPA durumu | Risk |
|---|---|---|---|---|
| Supabase | Auth + DB | ap-southeast-2 Sydney (**TAŞIMA GEREKLİ** → eu-central-1) | Standard DPA | **YÜKSEK** — yabancı transfer Risk |
| Vercel | Hosting + Edge | global (eu-west region pinli) | Standard DPA | Düşük |
| Resend | E-posta | EU/US | DPA imzalı (e-mail) | Düşük |
| Twilio | SMS/WhatsApp | US (TR data zorunlu değil) | Trial → onay üzerine DPA | Orta |
| Anthropic | AI agent input | US | API DPA | **Orta** — kullanıcı PII gönderme YASAK |
| Google OAuth | Auth | EU/US | Standard | Düşük |
| iyzico (Faz 3) | Ödeme | TR (lokal) | BDDK denetimli | Düşük |
| GA4 + Mixpanel | Analytics | US | DPA + anonimize | Orta |

## 3. KVKK Aydınlatma Akışı

- **Kayıt sırasında:** `register.html` üzerinde aydınlatma metni linki + açık rıza checkbox'ları (3 ayrı):
  1. Hizmet kullanım (zorunlu, sözleşme)
  2. Pazarlama ileti (opsiyonel, açık rıza)
  3. Üçüncü taraf paylaşım (opsiyonel, açık rıza)
- **Cookie banner:** opt-in (analytics + marketing ayrı toggle)
- **Veri silme talebi:** `profil.html`'de "Hesabımı sil" → 30 gün soft delete + hard delete cron

## 4. KVKKGuardian Agent Sorumlulukları

`.claude/agents/kvkk-guardian.md` agent'ı:

1. **Her schema değişikliğinde** (PR'da yeni tablo/kolon): DPIA üret
2. **Her yeni 3rd party** (yeni service eklenirse): DPA durumu kontrol
3. **Her release öncesi**: PII flow audit — `Anthropic`, `OpenAI`, `Gemini` API'ye PII gidiyor mu?
4. **Aylık**: retention süresi geçen veri var mı? Hard delete çalıştı mı?
5. **VERBİS kayıt** durumu (yıllık)
6. **Veri sızıntısı simülasyonu** (çeyreklik) — incident response playbook test

## 5. Mevcut Açıklar (2026-05-17 itibarıyla)

| Açık | Risk | Aksiyon | Sahip |
|---|---|---|---|
| Supabase Sydney bölgesinde — KVKK riski yabancı transfer | **YÜKSEK** | eu-central-1'e taşıma planı (Faz 1 hardening) | Berkay + KVKKGuardian |
| CSP `unsafe-inline` aktif | Orta | Inline script extract + nonce | DeployAgent |
| VERBİS kayıt yok (eşik aşılmadı ama proaktif) | Düşük | Berkay yıllık ciro >₺500K oluncaca zorunlu | Berkay |
| Aydınlatma metni v1, avukat onayı yok | Yüksek | Faz 0: avukat retainer + v2 metin | Berkay + avukat |
| Cookie banner yok | Orta | Faz 0 hardening: opt-in banner | DeployAgent |
| Veri silme otomasyonu yok | Yüksek | profil.html "hesabımı sil" + cron | DeployAgent |
| 5651 yer sağlayıcı bildirimi BTK'ya yapıldı mı? | Orta | Berkay başvuru | Berkay |
| ETBİS kayıt yok | Yüksek (e-ticaret faaliyeti başlamadan zorunlu) | Faz 0 ETBİS başvuru | Berkay |
| KOR sistemi entegre değil | Yüksek (Faz 2'de villa rezervasyon başlayınca) | KOR API entegre | DeployAgent + Berkay |

## 6. Hızlı Referans — Yıllık Süreler

- VERBİS kayıt yenileme: yıllık
- KVKK denetim raporu: yıllık (DPO sorumlu)
- DPA imzaları gözden geçirme: yıllık
- 3rd party DPA dosya: `.omc/legal/dpa/` (oluşturulacak)
- Avukat review: yıllık
- Penetrasyon testi: yıllık (Faz 6)

## 7. İhlal Bildirim Süreleri

| Olay | Bildirim süresi | Bildirim kime |
|---|---|---|
| Veri sızıntısı (yüksek risk) | 72 saat | KVKK Kurumu + etkilenen kullanıcılar |
| Veri sızıntısı (düşük risk) | 72 saat | KVKK Kurumu (kullanıcıya gerekmeyebilir) |
| Sistemin işlevsiz kalması | gecikme yok | Berkay (Telegram) |
| Kullanıcı silme talebi | 30 gün içinde | Kullanıcıya doğrulama |

## 8. KVKKGuardian agent çalıştırma

```bash
# Manual audit
claude -p "KVKKGuardian agent çalıştır: Supabase schema son 7 gün değişiklikleri için DPIA üret"

# Cron (Faz 4)
0 0 1 * * — aylık retention check + hard delete trigger
```
