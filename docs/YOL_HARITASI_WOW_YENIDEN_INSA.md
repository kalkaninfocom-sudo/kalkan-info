# 🚀 KALKAN INFO — "WOW" Yeniden İnşa Yol Haritası

_Son güncelleme: 2026-08-09. Çalışma branch'i: `work` (worktree `kalkan-info-devir`). Canlı: `origin/main` → Vercel._

Berkay: tüm yarım kalan geliştirmeleri "wow + sınır tanımayan" seviyede, 3 küme paralel yeniden inşa.
Odak GELİR değil ÜRÜN/DENEYİM. Detaylı plan: `~/.claude/plans/temporal-exploring-simon.md`.

---

## 🔴 BEKLEYEN DÜZELTMELER (bir sonraki oturum İLK bunlar — Berkay bildirdi)

### 1. Sezin Çetiner'i "geliştiren" bölümüne GERİ ekle (BENİM HATAM — fazla sildim)
Sezin SADECE concierge'den (WhatsApp destek) kaldırılacaktı; **"Projeye Dahil Olup Geliştirenler"** kısmından KALDIRILMAYACAKTI.
- **Nereye:** `hakkimizda.html` satır ~355 "Projeye Dahil Olup Geliştirenler" bölümü, Nurdan Değirmenci / Serdar Tüfekçi / Veysi Avcı yanına.
- **Eski kayıt (geri getir):** `git show 1cab73ab^:hakkimizda.html` satır 359-364 →
  `assets/img/team/sezin-cetiner.jpg`, isim "Sezin Çetiner", IG `https://www.instagram.com/sezininkosesi/` (@sezininkosesi).
- **DOKUNMA (doğru kaldık):** `data/concierge.json`, `data/hizmetler.json`, `js/lyra-widget.js` humans, `cocuk-bakimi/sezin-cetiner/` — Sezin concierge/WhatsApp'tan çıktı, orada kalsın.
- Commit + PR + merge.

### 2. Lyra FAB mobilde alt nav'a çakışıyor (mobil bug)
Telefonda alttaki nav bar'ın "Giriş" bölümünün üzerine geliyor Lyra "ile konuşma" butonu.
- **Dosya:** `js/lyra-widget.js` satır ~50: `#lyra-root{position:fixed;bottom:24px;right:24px;...}`
- **Fix:** mobil media query ekle — `@media(max-width:600px){#lyra-root{bottom:84px;right:16px;}}` (alt nav ~64px üstünde dursun). Panel `#lyra-panel` bottom:80px de mobilde gözden geçir.
- **Cache-bust ZORUNLU:** lyra-widget.js değişince `js/concierge-modal.js` içindeki `?v=20260809c → d` + 24 kök sayfada `concierge-modal.js?v=...c → d` (node ile bump). DERS: `env-commit-guard` hook commit mesajında/komutta ".env" string'i görürse bloke eder.

---

## ✅ BUGÜN CANLIYA GİDEN (2026-08-09, hepsi doğrulandı)
Repo devir-hazır (3-katman yedek + git tek-kaynak + README/ARCHITECTURE/EXTERNAL_DEPS/SETUP/HANDOVER) ·
villa yanlış-özellik fix (bilardo/otopark/çocuk parkı) · Sezin concierge'den kaldırma · gazete kalite kapısı (critic-llm) ·
venue-redesign · reel-igkart-5dil · **topluluk gazete editörü (uçtan uca: migration+edge fn+admin UI+P3)** ·
**Keşfet 3B haritası** (`/harita-3d`, MapLibre, 186 mekan, açık tema, filtre) · concierge cache-bust ·
**IG token aylık cron** (zaman bombası) · dağınıklık temizliği · **Lyra grounding** (gerçek villa doluluk + etkinlik) ·
Lyra aksiyon yönlendirme + **widget aksiyon butonları** (Haritada Keşfet + WhatsApp) ·
**çok-dilli SEO liste sayfaları** (/en /de /fr /ru restoran/villa/otel/plaj).

## 🔄 DEVAM EDEN
- **Küme C çok-dilli detay batch**: 180 restoran ×4 dil = 720 sayfa. ASIL DİZİNDE (`kalkan-info`) nohup arka planda.
  Log: `/tmp/i18n-restoran-batch.log`. Komut deseni: `node -r dotenv/config scripts/build-i18n-site.mjs --lang=all --only="<paths>" dotenv_config_path=.env.local`
  (worktree'de node_modules YOK → asıl dizinde çalışır). **Bitince:** asıl dizin `en/de/fr/ru/restoran/*` → work'e kopyala + commit + merge.
  DERS: motor `.env` yükleme + cache'te başarısız kayıt (value==key) title bug'ıydı — çözüldü (dotenv.config eklendi + cache temizlendi).

## ⏳ KALAN İŞLER (öncelik sırası)
1. **Küme C tamamla:** restoran detay batch bitince taşı → villa/otel/plaj detay batch (~58 sayfa ×4) → **sitemap hreflang** (`sitemap.xml`'e /{lang}/ URL + xhtml:link alternates; şu an 0 hreflang) → runtime switcher (`js/i18n.js`) statik URL'e köprü.
2. **Küme B F2 kalan:** sesli Lyra (edge-tts ücretsiz baz + ElevenLabs premium) + `tatil-asistani.html` (73KB form) → Lyra planlama moduna birleştir (`vacation-planner` edge fn güçlendir).
3. **Küme A F2 — ⚠️ BİLLİNG ENGELİ:** gerçek-3D gsplat villa turları (ML pipeline, büyük) + Cesium sinematik (Google 3D Tiles = **API key BILLING, Berkay açmalı**) + "Arkadaşım Nerede" canlı konum (`arkadasim-nerede.html`, Supabase Realtime + **gömülü Google API key güvenlik fix**). Billing+kapsam → ayrı planla.

## 📌 BERKAY AKSİYONLARI (teknik değil)
- **IG_CRON_SECRET** GitHub repo secret ekle (IG token cron için, Vercel env'deki ile aynı).
- **Anthropic API bakiyesi düşük** (çeviri groq'la çalışıyor; Lyra fallback için bakılabilir).
- **Google 3D Tiles billing** (Küme A F2 gerçek-3D için gerekli).
- Villa gerçek koordinatları (harita F2 — şu an yaklaşık Kalamar; villacim'den kesin).

## 🧭 TEKNİK NOTLAR
- Çalışma: worktree `kalkan-info-devir` branch `work`. Her iş: work commit → PR → merge → Vercel deploy.
- Vercel 12/12 api DOLU + 2/2 cron DOLU → yeni api YOK, cron GitHub Actions'a.
- Supabase CLI linkli (`dgichfealzdpfhdgryym`), access token cached → `supabase db push` / `functions deploy` çalışır.
- Yedek: `~/kalkan-info-FULL-BACKUP-20260809.bundle` + `-WORKTREE-*.tar.gz` + `yedek/yarim-fikirler-20260809` branch.
- Çok-dilli motor `yedek/yarim-fikirler` branch'inden work'e alındı (origin/main'de yoktu).
