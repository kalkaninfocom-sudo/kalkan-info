# Olay Müdahale Playbook — Kalkan Info

**Versiyon:** 1.0
**Tarih:** 2026-05-17
**Sorumlu:** Berkay Elmastaş (DPO + CEO)
**Otomatik tetikleyici:** KVKKGuardian agent, sentry alert, uptime robot

> KVKK Kurumu, BDDK, BTK ve etkilenen kullanıcılara süresinde bildirim için yazılı prosedür. Saldırı/sızıntı/kesinti anında bu playbook'tan sapma — yetkili kişi karar verir.

---

## 1. Olay Türleri ve Şiddet Skalası

| Şiddet | Tanım | İlk yanıt süresi | Eskalasyon |
|---|---|---|---|
| **P0 — Kritik** | Veri sızıntısı yüksek risk / sistem komple offline | <15 dk | DPO + avukat + mali müşavir |
| **P1 — Yüksek** | Veri sızıntısı düşük risk / kısmi outage | <1 saat | DPO |
| **P2 — Orta** | Hata yoğunluğu artışı / performans düşüşü | <4 saat | DeployAgent |
| **P3 — Düşük** | Kullanıcı raporu / kozmetik bug | <24 saat | DeployAgent |

## 2. Tetikleyici Kanalları

- **Sentry:** error rate >10/dk → Telegram alert
- **Uptime Robot:** endpoint 503/timeout → SMS + Telegram
- **KVKKGuardian:** veri sızıntısı sinyali (anormal SELECT pattern, beklenmedik 3rd party trafik)
- **Kullanıcı raporu:** info@kalkaninfo.com, +90... WhatsApp
- **Manuel:** Berkay'ın gözle gördüğü problem

## 3. P0 — Veri Sızıntısı Playbook

### Adım 1: İlk Tepki (T+0 → T+15 dk)
1. KVKKGuardian agent olayı `COMPANY/INCIDENT_LOG.md`'ye yaz (otomatik)
2. Berkay'a Telegram alert + telefon
3. Berkay sistemde aktif saldırı varsa **uygulamayı geçici kapat** (Vercel deployment promote-revert)
4. Etki alanını tahmin et: kaç kullanıcı? hangi veri tipi?

### Adım 2: İzolasyon (T+15 → T+60 dk)
1. DeployAgent: etkilenen Edge Function / API endpoint'i devre dışı bırak
2. Etkilenen Supabase tablosunda anormal session'ları feshet (`SELECT auth.uid(), sign_out_users(...)`)
3. Vercel + Supabase erişim tokenlarını rotate
4. Backup'tan etkilenmemiş snapshot doğrula

### Adım 3: Etki Değerlendirmesi (T+1 → T+24 saat)
1. Audit log + Supabase log review (kim, ne zaman, neyi okudu)
2. Etkilenen kullanıcı listesi (mail, telefon)
3. Sızdırılan veri kategorisi (KVKK 6698 madde 6)
4. Risk skoru: olasılık × etki
5. Hukuki danışman bilgilendir (avukat retainer)

### Adım 4: Bildirim (T+72 saat — KVKK zorunlu)
1. **KVKK Kurumu** — kvkk.gov.tr ihlal bildirim formu (72 saat hard limit)
   - Olay tanımı, etkilenen kişi sayısı, alınan önlemler, iletişim
2. **Etkilenen kullanıcılar** — Resend ile bireysel mail (yüksek risk ise)
   - Aydınlatıcı dil, abartmadan
   - Önerilen aksiyon (şifre değiştir, dolandırıcılık alert)
3. **BTK** — 5651 kapsamında yer sağlayıcı yükümlülüğü ise (rare)
4. **BDDK** — ödeme verisi sızdıysa
5. **Kamuoyu** — yüksek profilli ise basın açıklaması (avukat onayı)

### Adım 5: Düzeltme (T+1 → T+30 gün)
1. Kök sebep analizi (post-mortem) `COMPANY/POSTMORTEM_{tarih}.md`
2. Aynı sınıf bug için kod sertleştirme
3. Yeni audit alert kuralı
4. RLS policy revize

### Adım 6: Kapanış (T+30 → T+90 gün)
1. KVKK Kurumu'na ek bilgi (talep ederse)
2. Etkilenen kullanıcılara durum güncelleme
3. Yıllık denetim raporuna olay eklenir
4. Sigorta (siber sorumluluk) varsa talep

## 4. P0 — Sistem Komple Offline Playbook

### Adım 1: Doğrula (T+0 → T+5 dk)
1. `curl -I https://www.kalkaninfo.com` → status code?
2. Vercel Dashboard → en son deploy durumu
3. Supabase Dashboard → DB sağlık + Edge Function status

### Adım 2: Triage (T+5 → T+15 dk)
- Vercel down ise: status.vercel.com kontrol — global mı, sadece bizim mi
- Supabase down ise: status.supabase.com kontrol
- DNS down ise: Cloudflare dashboard
- Son deploy hatası ise: önceki Ready deploy'a promote (DeployAgent rollback)

### Adım 3: Rollback (T+15 → T+30 dk)
```bash
vercel ls --yes
vercel promote <previous_ready_url> --yes
curl -I https://www.kalkaninfo.com
```

### Adım 4: Post-Mortem (T+24 saat)
- Neden oldu? (commit, env, 3rd party)
- Nasıl önlenir? (test, staging, canary deploy)

## 5. Yetki ve İletişim

| Pozisyon | Kişi | İletişim |
|---|---|---|
| DPO + CEO | Berkay | Telegram, mail, telefon |
| Hukuk danışman | (Faz 0'da atanacak) | retainer |
| Mali müşavir | (Faz 0'da atanacak) | retainer |
| Vercel destek | support@vercel.com | dashboard ticket |
| Supabase destek | support@supabase.com | dashboard ticket |
| KVKK Kurumu | kvkk.gov.tr | formal bildirim formu |
| BTK | btk.gov.tr | 5651 bildirim |
| iyzico (Faz 3) | iyzico-destek | dashboard |

## 6. Log Kayıtları

Her olay sonrası `COMPANY/INCIDENT_LOG.md`'ye satır eklenir:

```markdown
## 2026-05-17 23:15 — P0 — Resend API key invalid
- Tetik: Berkay raporu (newsletter onay maili gitmiyor)
- Etki: 0 kullanıcı (newsletter henüz canlı kullanılmıyor)
- Tepki: Resend dashboard → key rotate, Vercel env güncelle
- Kapanış: T+2 saat — newsletter test mail dahil
- Postmortem: secret rotation cron yok, P2 görev oluştur
```

## 7. Simülasyon Takvimi

KVKKGuardian agent çeyreklik **veri sızıntısı simülasyonu** çalıştırır:
- Q1 (Mart): Auth bypass simülasyonu
- Q2 (Haziran): RLS bypass simülasyonu
- Q3 (Eylül): 3rd party DPA ihlali simülasyonu
- Q4 (Aralık): Tam P0 drill (Berkay + avukat dahil)

## 8. Eğitim

- Berkay yıllık KVKK denetim hazırlığı (online kurs veya avukat workshop)
- Saha kadrosu (Faz 2 sonrası) — temel KVKK eğitimi onboarding'de

## 9. Versiyon

| Versiyon | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 2026-05-17 | İlk yayın — P0/P1/P2/P3 skala, KVKK 72 saat playbook |
