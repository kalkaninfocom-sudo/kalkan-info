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

## ✅ ADMİN PANELLİ SİTELER (mini-CMS) — YAPILDI (2026-07-11 devam)
Berkay: "kardelenfastfood.tr benzeri siteler üretsek yeterki **admin paneli olan**".
- ✅ **Generator zenginleştirildi** (`scripts/agency/build-venue-site.mjs`): artık **Menü** (kategori+ürün+fiyat+açıklama), **Hakkında** (aboutP1/P2 → paragraflar), **Çalışma saatleri**, slogan bölümleri üretir. GERÇEK veriden (`v.menu`, `aboutI18n`, `hours`). index.html **+ admin.html** birlikte üretir.
- ✅ **Site canlı içerik overlay:** açılışta baked GERÇEK veriyle render (SEO/hız), sonra `venue_sites`'ten yayınlanmış içerik varsa üzerine yazar (admin düzenlemeleri anında yansır). Satır yoksa zarifçe baked'e düşer.
- ✅ **Admin paneli** (`demo/<slug>/admin.html`): Supabase auth (email/şifre) girişi → slogan/hakkında/saat/telefon/WhatsApp/Instagram + **tam menü editörü** (kategori/ürün ekle-sil, fiyat, açıklama) → `venue_sites.content` upsert (published=true). Mevcut kaydı açılışta yükler.
- ✅ **4 örnek üretildi + görsel doğrulandı:** Omar's Kokobüs (27 foto, **6 kat/42 ürün tam menü** — yıldız demo), THE VIEW TERRACE, Olala, Luna. (Menüsüz olanlarda admin'den menü eklenebilir.)
- ✅ **Migration YAZILDI:** `supabase/migrations/20260711110000_venue_sites.sql` (venue_sites: slug, content jsonb, RLS public-read + owner/admin-write, `is_admin()` mevcut).
- ✅ **BLOKAJ KALKTI — `supabase db push` UYGULANDI (2026-07-11 22:xx):** migration `20260711110000_venue_sites` Remote'ta (Berkay çalıştırdı). Admin artık kaydedebilir.

## ✅ SATIŞ CEPHANESİ — 20 GROUNDED DEMO ÜRETİLDİ (2026-07-11 devam)
- `build-venue-site.mjs` batch → üst 20 sıcak lead için `demo/<slug>/` site + admin (commit `b758974`, canlıya push'lu).
- Zeugma(729 yorum)/Adams/Rose/Luna/Nova/Mussakka/Çakıl/Coast/Kaptan/Kardelen/Antioch/Keske/Leon/The View... hepsi gerçek foto+puan+WhatsApp CTA. Görsel doğrulandı (Zeugma premium).
- Paylaşılabilir URL: `kalkaninfo.com/demo/<slug>/` (Vercel deploy ~1dk). Aramada "işte siteniz" diye göster.
- Not: menüsüz mekanlarda menü bölümü JS ile gizli (boşluk yok); admin'den menü eklenince görünür.

## ⏳ SIRADAKİ NET ADIMLAR (buradan devam)
1. ✅ ~~`supabase db push`~~ — YAPILDI.
2. **Admin login testi (Berkay):** Supabase auth hesabıyla (admin claim'li — `is_admin`) `/demo/omar-.../admin.html` → giriş → menü düzenle → Kaydet → site overlay'i doğrula.
3. **Satış outreach:** 20 demo hazır → sıcak lead'leri ara, demo linkini göster, kapat.
4. **Müşteriye erişim:** owner_id ataması (sonra) — MVP'de Berkay tüm siteleri düzenler.
5. **Deploy modeli:** satılınca siteyi kendi domainine (Vercel) deploy — foto bundle dahil (tek komut, sonra kurulacak).
6. ✅ ~~commit~~ — oturum işleri commit'li (`1b7ec70`, `b758974`).

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
