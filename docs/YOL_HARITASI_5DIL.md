# 🌍 5 DİL İÇERİK YOL HARİTASI (canlı)

> **Vizyon:** Her üretilen içerik **5 dilde** (TR + EN + DE + RU + FR). Kalkan turist kitlesi çok uluslu (İngiliz/Alman/Rus/Fransız).
> **Berkay kararı (2026-08-08):** Önce **web + reel** 5 dil; **IG paylaşımı sonraki faz**. Kapsam: **hepsi** (gazete + tüm reeller + IG kartları).
> **Kodlar:** ✅ bitti&test · 🔨 sürüyor · ⏳ sırada · ⛔ bloke
> Kaynak dil TR; hedefler EN/DE/RU/FR.

---

## 0. Baseline — mevcut durum (2026-08-08 disk gerçeği)
- **Yarım başlanmış vizyon:** `scripts/agency/line-multilang.mjs` zaten 5 dil için yazılmış AMA kopuk (social_posts'ta canlıda sadece tr/en var, de/ru/fr yok).
- **Gazete EN kalıbı vardı ama durmuş:** `gazete-editorial-en.mjs` + `gazete-today.en.json` **2026-07-03'te donmuş** (1 ay+ üretilmiyor).
- **Merkezi çeviri modülü YOKTU** → her üretici kendi EN çevirisini ayrı yapıyordu.

## ✅ P0 — Merkezi 5-dil çeviri motoru (BİTTİ, test edildi)
- `lib/i18n-translate.mjs` — `translateFields(obj, lang)` / `translateToAll(obj)` / `translateText(t, lang)`.
- cheap-llm üzerine (ücretsiz önce: groq→cerebras→nvidia→gemini→claude). "SADECE çevir, uydurma yok, JSON yapısını koru" kuralı (gazete-editorial-en kalıbından).
- **Test:** manşet 4 dile paralel çevrildi (groq), özel adlar korundu, yapı bozulmadı. 🟢

## 🔨 P1 — Gazete 5 dil (SÜRÜYOR)
- [x] ✅ `gazete-editorial-i18n.mjs` (i18n-translate ile) → `data/gazete-today.{en,de,ru,fr}.json` + arşiv. **Test edildi (4 dil, groq).** Idempotent + dile-özel byline/caption/CTA etiketleri.
- [ ] `gazete-approval.yml`'ye i18n adımı ekle (TR editöryalden sonra `gazete-editorial-i18n.mjs` çağır). Ücretsiz LLM env + CHEAP_LLM_ORDER dahil.
- [x] ✅ **Web build 5 dil (`build.mjs --lang=xx`):** her dile ayrı statik sayfa (`morning.<lang>.html`), TR base + render-öncesi çeviri (alan-alan paralel → küçük JSON, güvenilir), `hreflang` 5 cross-link + sabit dil switcher + locale tarih. **Test:** `morning.de.html` üretildi, 19/20 içerik alanı DE, lang/hreflang/switcher doğru. Template'lere `{{lang}}/{{hreflang_links}}/{{lang_switcher}}` eklendi (morning+magazine).
- [x] ✅ **Template sabit UI etiketleri i18n** — morning (13 etiket) + magazine (8 etiket) `{{ui_*}}` yapıldı; `build.mjs` UI_TR sözlüğü çeviri havuzuna katılıyor (manuel dil sözlüğü yok). **Test:** DE morning UI ("Schlagzeile", "Restaurants der Woche"...) + magazine UI ("Nachtleben", "MAGAZIN", "Heutiges Abendprogramm") Almanca. TR bozulmadı.
- [x] ✅ **`newspaper-daily.mjs` entegrasyonu** — morning+magazine × en/de/ru/fr otomatik build (non-fatal). Sistem her gün 10 sayfa üretir (TR + 4 dil × 2 tip). Syntax OK.
- [x] ✅ `gazete/index.html` dil switcher — TR/EN/DE/RU/FR butonları (localStorage), gazete kart linkleri seçili dile gider (`morning`→`morning.de`), PDF sadece TR. JS syntax doğrulandı.
- [x] ✅ **Kalite turu:** i18n-translate prompt sıkılaştırıldı — marka adları ("Kalkan Today/İnfo") korunuyor (test: DE/FR/RU'da "Kalkan Today" aynen kaldı), HTML tag koruma kuralı eklendi.
- **Çıktı ölçütü:** kalkaninfo.com gazete 5 dilde ayrı URL + hreflang + tam çeviri (içerik+UI). ✅ build hattı hazır; canlıya PR + deploy ile çıkar.

## Not: canlı akışa bağlama
- Çeviri CI'da `gazete-approval.yml` → `newspaper-daily` içinden çalışır. i18n-translate default order groq-first (ollama'yı atlar), GROQ_API_KEY o adımda mevcut (PR #24). Ek env gerekmez.
- Dosyalar diskte + `docs/YOL_HARITASI_5DIL.md`. Canlıya çıkış: 5-dil işini branch/PR'da topla → merge → deploy.

## ⏳ P2 — Reeller 5 dil
- [ ] `reel-approval-en.mjs` + `build-gazete-reel-en.mjs` kalıbını 5 dile genelleştir (villa/restoran/plaj/antik/bülten).
- [ ] Reel altyazı + kapanış kartı metinleri i18n-translate ile.
- **Çıktı ölçütü:** haftalık reel serisi 5 dil dist'te.

## ⏳ P3 — IG haber kartları 5 dil
- [ ] `ig-news-card.mjs` metin katmanını i18n-translate'e bağla.

## ⏳ P4 — IG PAYLAŞIM (Berkay kararı bekliyor — sonraki faz)
- Model seçilecek: (a) tek hesap 5-dil caption, (b) dil-bazlı ayrı postlar, (c) 5 ayrı IG hesabı.
- `line-multilang.mjs` (mevcut 5-dil caption üreticisi) buraya bağlanır.

---

## Mimari kararlar
- **Web dil sunumu:** dil-başına ayrı JSON (`gazete-today.de.json`) + `?lang=xx` + `hreflang` (SEO-dostu, standart). Ayrı sayfa değil.
- **Çeviri beyni:** her zaman `lib/i18n-translate.mjs` (tek kaynak). Doğrudan LLM çağrısı YAZMA.
- **Maliyet:** çeviri ücretsiz LLM'de (groq/cerebras). Claude sadece fallback.

## ▶️ Nerede kaldık
P0 bitti+test edildi. Sıradaki: **P1 gazete i18n** (editorial-i18n + web dil switcher + hreflang).
