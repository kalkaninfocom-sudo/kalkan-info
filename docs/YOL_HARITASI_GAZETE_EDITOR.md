# 📰 GAZETE TOPLULUK EDİTÖRÜ — YOL HARİTASI (canlı)

> **Vizyon (Berkay):** Kullanıcılar admin/giriş ile Kalkan Today + Magazin şablonundaki **belirli slot'lara** yarınki sayı için kendi haber içeriklerini önerir. A4 gazete görüntüsünden slot seçerek öneride bulunur. Şablon sabit, içerik topluluktan.
> **Kararlar (2026-08-08):** Katılım = **onaylı üyeler** (herkes başvurur, admin onaylar). Akış = **her öneri admin onayından geçer**.
> **Kodlar:** ✅ bitti · 🔨 sürüyor · ⏳ sırada

## Baseline — mevcut altyapı (kullanılıyor)
- **Auth HAZIR:** Supabase Auth + `app_metadata.role` (güvenli, sunucu-set). `js/admin-auth.js` (`requireAdmin`), `js/supabase-client.js`, `login.html`. Migrations + RLS sistemi.
- **Gazete slot'ları:** `lead_headline/deck/body/image/caption`, `col1_*`, `col3_*`, `magazine_lead_*` (gazete-today.json).
- **Kısıt:** Vercel Hobby 12/12 api DOLU → client-side Supabase (auth+RLS) + Supabase Edge Fn. Yeni `api/` YOK.

## ✅ P0 — Veri şeması (BİTTİ)
- `supabase/migrations/20260808200000_gazete_submissions.sql`:
  - `gazete_submissions` (user, target_date, edition, slot, fields jsonb, status) + RLS (contributor kendi önerisini ekler/görür, admin hepsini yönetir).
  - `gazete_contributors` (üye başvuru/onay: pending/approved/blocked) + RLS.
  - `jwt_role()` helper (app_metadata.role).
- ⏳ **Uygula:** `supabase db push` (Berkay/CLI).

## 🔨 P1 — Editör sayfası (`gazete/editor.html`) — SIRADAKİ
- Contributor/admin auth guard (admin-auth deseni, ama rol 'contributor' de kabul).
- **A4 gazete önizlemesi** (morning + magazine, gerçek şablon görünümü) + **tıklanabilir slot'lar**.
- Slot'a tıkla → form (başlık/deck/gövde/foto/caption) → "yarınki sayı için öner" → `gazete_submissions` insert (status pending).
- "Önerilerim" listesi (kendi pending/approved/rejected).
- Giriş yapan ama katkıcı olmayan → "katkıcı ol" başvuru (`gazete_contributors` insert pending).

## ⏳ P2 — Admin onay (admin.html "Gazete Önerileri" sekmesi)
- Pending submission listesi → onayla/düzenle/reddet (+ admin_note).
- Üye başvuruları → onayla → Edge Fn ile `app_metadata.role='contributor'` ata.
- Edge Fn: `set-contributor-role` (service_role, admin JWT doğrula).

## ⏳ P3 — Üretim entegrasyonu
- Onaylı yarınki `gazete_submissions` → `gazete-today.json` slot'larına işlenir (gazete-editorial/newspaper-daily akışında, LLM içeriğiyle birlikte/yerine).
- 5-dil: onaylı TR içerik i18n-translate ile çevrilir (mevcut motor).

## ▶️ Nerede kaldık
P0 şema hazır. Sıradaki: P1 editör sayfası (A4 önizleme + slot + form).
