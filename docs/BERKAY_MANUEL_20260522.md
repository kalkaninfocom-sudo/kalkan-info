# Berkay Manuel Aksiyonlar — Sprint 2026-05-22 sonu

**Sprint sonucu:** 5 audit + Wave 1 + Wave 2 paralel otonom yürütme. ~16+ atomik commit (push edilmedi). Aşağıdaki adımlar **otonom yapılamayan** işlerdir (kimlik / üyelik / karar gerektirir).

---

## 🔴 KRİTİK (24 saat içinde)

### 1. IG_CRON_SECRET rotate
**Süre:** 5 dk
**Sebep:** Git history'de açık metin commit'lenmiş (`IG_CRON_SECRET=kalkan-ig-cron-7f3e9a8b2c5d4e6f`).
**Adımlar:**
1. Yeni secret üret: `openssl rand -hex 32` veya benzeri.
2. Vercel Dashboard → kalkan-info → Settings → Environment Variables → `IG_CRON_SECRET` güncelle.
3. Cron endpoint çağrılarında yeni secret kullan.
4. Redeploy.

### 2. supabase db push (yeni 2 migration)
**Süre:** 5 dk
**Komut:** `supabase db push` veya Supabase Dashboard SQL Editor.
**Yeni migration'lar:**
- `20260522180000_newsletter_validation.sql` — anon insert email regex + length + source whitelist
- `20260522190000_booking_inquiries.sql` — booking ön rezervasyon tablo + 4 RLS policy

**Test:** `supabase db diff` migration mismatch yok.

---

## 🟡 BU HAFTA

### 3. Git push (16+ commit zinciri)
**Süre:** 2 dk
**Komut:** `git push origin master`
**Beklenen:** Vercel auto-deploy main branch → ~3 dk sonra production canlı.
**Doğrulama:** `curl -I https://kalkaninfo.com` → 200, ardından 12 URL smoke (Faz E).

### 4. Plausible Goals 11 event
**Süre:** 3 dk
**Plausible Dashboard → Site Settings → Goals → +Add (Custom Event):**
- `newsletter_subscribe`, `wa_click`, `vacation_planner_complete`, `engaged`, `qualified_lead`, `concierge_open`, `providers_modal_open`, `cta_click`, `lang_switch`, `ig_arrival`, `outbound_link`
- Custom Properties allowlist: `source, provider_id, agent, page_url, cta, from, to, category, campaign, dest, budget_band, locale`

### 5. ELEVENLABS_API_KEY karar
**Süre:** 5 dk + plan kararı
**Mevcut durum:** 10 antik kent × 5 dil = 50 script hazır. Sadece 3 MP3 üretildi (Patara TR/EN, Xanthos TR).
**Plan opsiyonu:**
- **Starter $5/ay** — TR+EN için (10 kent × 2 dil = 20 MP3, ~25K karakter)
- **Creator $22/ay** — 5 dil tam (50 MP3, ~75K karakter)
**Komut:** Vercel env `ELEVENLABS_API_KEY` → sonra:
```bash
ELEVENLABS_API_KEY=sk_... node scripts/build-voiceover.mjs
```

### 6. Twilio + Resend + Supabase PAT + admin parola rotate
**Süre:** 30 dk
**Sebep:** Daha önceki audit'lerde git history'de tespit edilmiş.
- Twilio Console → API Keys → Disable + yeni key → Vercel env `TWILIO_API_KEY`
- Resend Dashboard → API Keys → Revoke + yeni "Production" key → Vercel env
- Supabase Dashboard → PAT'ler → Revoke + yeni proje-scoped token → `supabase login`
- Admin parola `kalkan2026` → Supabase Auth Users → Reset → 24-karakter random + 1Password

---

## 🟢 BU AY

### 7. iyzico merchant başvuru
**Süre:** 1 saat aktif + 3-7 gün bekleme
**Önkoşul:** Vergi levhası, IBAN, ticari sicil (solo founder ise şahıs şirketi).
**Akış:** `merchant.iyzipay.com` → application → onay sonrası `IYZICO_API_KEY` + `IYZICO_SECRET_KEY` Vercel env'e ekle.
**Sonuç:** `api/iyzico-checkout.js` stub'ı production'a alır (mevcut 501 → 200).

### 8. 14 villa içerik (foto + kapasite + fiyat)
**Süre:** ~2 saat
**Dosya:** `data/villalar-placeholder.json` (14 placeholder hazır)
**Her villa için doldur:**
- `image` — gerçek foto URL (`https://placehold.co/...` yerine)
- `gallery` — 5-10 foto array
- `price` — gece başı TRY veya null bırak (concierge fiyat ver)
- `instagram` — IG profili
- `placeholder: false` veya alanı sil
- `data/villalar.json`'a manuel ekle (placeholder dosyasından taşı)

### 9. Meta WhatsApp Business onay
**Süre:** 1 saat aktif + 1-3 gün bekleme
**Akış:** `business.facebook.com` → WhatsApp Business Platform onboarding.
**Sonuç:** Onay sonrası `whatsapp_send` event Plausible'da görünür, template'ler ile otomatik response.

### 10. IG bio link güncelle
**Süre:** 1 dk
**Yeni link:** `https://kalkaninfo.com/?utm_source=ig&utm_medium=bio&utm_campaign=brand`

### 11. KVKK VERBİS başvuru + Mesafeli Satış avukat onayı
**Süre:** 1-3 hafta
**VERBİS:** `verbis.kvkk.gov.tr` — solo founder 25M altı muafiyet kontrol.
**Mesafeli Satış:** Avukatla draft — iyzico ödeme öncesi 6502 sayılı Kanun zorunlu.

---

## 📋 Doğrulama Checklist (Berkay deploy sonrası)

```bash
# 1. Production canlı
curl -I https://kalkaninfo.com  # 200

# 2. Yeni özellikler
curl -I https://kalkaninfo.com/pricing.html  # 200
curl -I https://kalkaninfo.com/events.html  # 200
curl -I https://kalkaninfo.com/rehber/kalkan-tekne-turu-rehberi.html  # 200, ~1500+ kelime

# 3. KVKK güncel
curl -s https://kalkaninfo.com/kvkk.html | grep -ic supabase  # ≥ 1

# 4. JSON-LD inject
curl -s https://kalkaninfo.com/restoranlar.html | grep -c 'TouristAttraction\|Restaurant'  # ≥ 1

# 5. Drawer 4 yeni link
curl -s https://kalkaninfo.com/js/site-drawer.js | grep -cE 'rehber/|events|transfer|pricing'  # ≥ 4

# 6. Bottom-nav Menü
curl -s https://kalkaninfo.com/js/bottom-nav.js | grep -c 'Menü\|Menu'  # ≥ 1
```

---

## 🎯 Sprint Sonu Hedef Tablo

| Metrik | Önce | Hedef | Doğrulama |
|---|---|---|---|
| Atomik commit | — | 25-30 | `git log --oneline` |
| KVKK uyum | Eski | Güncel | `grep -i firebase kvkk.html` = 0 |
| Test coverage | 0 | 15+ unit + 5 e2e | `pnpm test && pnpm test:e2e` |
| Rehber içerik | 6 stub | 6 makale × 1200-1700 kelime | `wc -w rehber/*.html` |
| Drawer link | 21 | 25 | site-drawer.js |
| JPG → WebP | 46 jpg | 0 jpg | `ls assets/img/*.jpg | wc -l` |
| hreflang pattern | 2 (çakışma) | 1 (subdir) | `grep -c '?lang=' index.html` = 0 |
| JSON-LD coverage | 3 schema | 5+ schema | restoranlar/villalar/antik-kentler |
| Body cross-link | 4 (nav-only) | 30+ (related-section) | antik-kentler/*.html |
| Sentry PII | Risk | Strip ✓ | `grep REDACTED js/sentry-init.js` = 2 |

---

## ⏭ Sonraki Sprint (Wave 3+ Önerileri)

- Auth-gate Vercel Edge Middleware (P1-9) — admin/profil JWT check (sunucu tarafı)
- CSP nonce migration (P1-10) — unsafe-inline kaldır
- 14 villa foto + içerik (Berkay tamamlandıktan sonra)
- Reviews rate-limit (P2-16)
- AI concierge 3+ turn sonra booking CTA (P2-6)
- RU + FR çevirileri (Anthropic Haiku batch)
- Mesafeli Satış Sözleşmesi (avukat draft + terms.html ek bölüm)
