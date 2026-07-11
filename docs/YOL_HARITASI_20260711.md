# Kalkan Info — Oturum Yol Haritası & Handoff (2026-07-11)

**Yeni oturumda İLK BU.** Maraton oturum. Nerede kaldık + sıradaki net adımlar. Durum: ✅ bitti · 🔨 devam · ⏳ bekliyor · ⛔ bloke

---

## ✅ BUGÜN CANLIYA ÇIKAN (kalkaninfo.com, hepsi push'lu)
- **Etkinlik:** Indigo Movie Night (16 Tem) takvimde + `/etkinlikler` "Yaklaşan Öne Çıkanlar" şeridi. IG reklam kartı **5 dilde** (`ig-event-card.mjs`).
- **/etkinlikler yeniden tasarım:** sol "Haftalık Program" gün-seçici + sağ açıklamalı program. **Ana sayfa:** 7-günlük haftalık etkinlik tablosu (bugün vurgulu).
- **Sağ menü (drawer):** 5 dilde çeviri (data-*) + **Dolmuş** eklendi + **Pazar Yeri** eklendi; ana sayfa banner'dan Dolmuş kaldırıldı.
- **Pazar Yeri = ÇALIŞAN Letgo marketplace:** Supabase `marketplace_listings` tablosu + `marketplace-photos` storage + RLS **canlı DB'ye uygulandı**. İlan ver (giriş+doğrulama+foto upload) / ara / filtre / detay / WhatsApp iletişim. `js/marketplace.js`.
- **IG otomasyonları (ikisi de canlı, approve modu):** yorum/DM oto-cevap (`ig-autoreply.yml`, 15dk) + etiket→hikaye repost (`ig-story-repost.yml`, 30dk). Token GEÇERLİ (@kalkan.info). Kısıtlar: `docs/IG_OTOMASYON.md`.
- **Grounded mekan spotlight (Fix #3, asıl değer):** `venue-spotlight.mjs` — gerçek mekan+foto+puan+5dil → Telegram onayı. Workflow Salı+Cuma. **Berkay beğendi.**
- **Sağlık nöbeti (Fix #4):** `health-check.mjs` — IG token/LLM/aktivite/veri → bozulunca Telegram alarm. Günlük workflow.
- **Ajans envanteri (Fix #5):** `docs/AJANS_ENVANTER.md` — 24 canlı / 11 bağlı-değil (bu oturum orphan) / ölü temizlendi.

## ✅ AJANSAI (github.com/kalkaninfocom-sudo/ajansai — PUBLIC MIT)
- Config-driven motor + Managed SaaS funnel: `site/onboarding.html` + landing pricing → funnel. GTM runbook yerelde (`GO_TO_MARKET.md`).
- **Dürüst tez (bkz memory):** değer framework'te değil; **gerçek veri + grounded çıktı + hizmet**te. Bkz `feedback_ajansai_grounding_value`.

## ✅ WEB SİTESİ SATIŞ YAPISI (asıl fırsat)
- **Lead listesi:** `website-leads.mjs` → **144 sitesiz işletme / 52 SICAK lead** (`data/agency/website-leads.json`).
- **Tekrarlanabilir generator:** `build-venue-site.mjs` — `lead → gerçek veri+foto ile premium grounded site` tek komut. Test: THE VIEW TERRACE + Olala + Luna üretildi (`demo/<slug>/`).
- Her site: gerçek ad/puan/yorum + gerçek foto + WhatsApp/tel + Google Maps + "Site by Kalkan Info". Uydurma yok.

---

## 🔨 KALDIĞIMIZ YER: Admin panelli siteler (mini-CMS)
Berkay: "kardelenfastfood.tr benzeri siteler üretsek yeterki **admin paneli olan**" + birkaç örnek istiyor.
- ✅ **Migration YAZILDI:** `supabase/migrations/20260711110000_venue_sites.sql` (venue_sites tablosu: slug, content jsonb {about,menu,hours,...}, RLS public-read + owner/admin-write). ⛔ **HENÜZ UYGULANMADI** (db push onayı gerek — marketplace gibi).

## ⏳ SIRADAKİ NET ADIMLAR (buradan devam)
1. **Generator'ı zenginleştir** (`build-venue-site.mjs`): kardelenfastfood.tr gibi bölümler ekle → **Menü** (kategoriler+ürünler+fiyat), **Hikaye/Hakkında**, **Çalışma saatleri**, differentiators. (Referans stil: story-driven, warm, QR/menü, galeri, yorumlar, iletişim.)
2. **Admin paneli:** her site `admin.html` üret → Supabase auth (mevcut `js/auth.js`) girişi → admin/sahip **menü/hakkında/saat/iletişim/foto** düzenler → `venue_sites.content` upsert. Site içeriği `venue_sites`'ten fetch eder (yoksa baked grounded veriye fallback).
3. **Migration'ı uygula:** `supabase db push` (Berkay onayı → venue_sites canlıya).
4. **Birkaç örnek üret:** Kardelen, Omar's Kokobüs (27 foto), THE VIEW TERRACE, Olala → admin panellerini test et (giriş→düzenle→yansıyor).
5. **Deploy modeli:** satılınca siteyi kendi domainine (Vercel) deploy — foto bundle dahil (tek komut, sonra kurulacak).

## 📞 BERKAY'IN AKSİYONLARI (dış — yazılım hazır bekliyor)
- **Web sitesi satışı:** sıcak lead'leri ara → demoyu göster ("işte siteniz + kendi admin paneliniz, ₺X kurulum + ₺Y/ay") → kapat. Fiyat: kurulum ₺3-8K + aylık ₺300-500 (admin panel aylığı haklı çıkarır).
- **AjansAI Managed satış:** LemonSqueezy $49/mo ürün + Web3Forms key + landing deploy+domain (bkz `GO_TO_MARKET.md`).
- IG: yeni etiketli medya + DM'ler Telegram'a onaya gelecek → onayla.
- Spotlight Telegram onaylarını gör/onayla.

## ⚠️ AÇIK KARARLAR / NOTLAR
- venue_sites admin: MVP'de admin (Berkay) tüm siteleri düzenler; müşteriye erişim = owner_id atama (sonra).
- 2. bölge (Fethiye/Bodrum?) pipeline'ı (#1/#2 moat) — ertelendi, ayrı odak.
- Orphan 11 script (brand-lines + agents) IG hesapları açılınca aktifleşir (deneysel).
- Vercel Hobby: api/ 12/12 DOLU + max 2 cron. Yeni site/CMS = Supabase client-side (api/ ekleme YOK).
- MEMORY.md limite yaklaşıyor (~24KB) — sıkıştırılmalı.
