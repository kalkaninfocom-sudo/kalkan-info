# 🧠 KALKAN İNFO — "2. BEYİN" YOL HARİTASI

> Berkay'ın vizyonu: her gün tek tek bilgi girmek yerine, arka planda sürekli çalışan,
> **kendi başına iş yapan + öğrenen** bir 2. beyin. Bedava, benden (Claude Code) bağımsız.

## 🔬 VİZYON — araştırma temelli (2026 ajan literatürü)
Bir sistemi "otomasyon"dan **"beyin/ajan"a** çeviren şey daha iyi LLM değil:
1. **HAFIZA** — "hafızası olan vs olmayan" farkı, farklı LLM'ler arası farktan BÜYÜK (arXiv 2603.07670)
2. **KAPALI GERİ-BESLEME DÖNGÜSÜ** — yayınla → **ölç** → **öğren** → **uyarla**. Döngü kapanınca "ajan" olur.

**Tek cümle:** Bugünkü beyin *yapıyor*; sıradaki eklentiyle beyin **öğreniyor ve büyüyor.** Kaslara sinir sistemi ekliyoruz.

## ✅ ŞU AN CANLI (bu oturumda kuruldu)
- **kalkan-brain pm2 ile ÇALIŞIYOR** (Berkay'ın PC'si, worktree `kalkan-info-devir`): 7/24 while-PC-on, tek-instance kilit (tekrar sorunu çözüldü), auto-restart, boot auto-start (`pm2-windows-startup`). Yönetim: `pm2 list/logs/restart kalkan-brain`.
- **Çalıştığı model:** cheapLLM router → NVIDIA/Ollama/Gemini (bedava) → Claude son-çare (lokal bakiye yok = pratikte hiç). **Claude token'ımdan/oturumdan BAĞIMSIZ.**
- **Yaptığı:** her 30dk IG(7 hesap)+FB harvest → haber filtre → taslak → Telegram onay → yayın.
- **Kuruldu ama aktivasyon bekliyor:** site-edit kuyruğu (`site_edit_queue` migration + `site-edit-worker.mjs` + webhook `detectSiteEdit` intercept → Telegram'dan "etkinlik ekle" → git push → ~1dk canlı). Migration push + PR merge gerek.
- **VPS deploy kit hazır:** `deploy/setup-vps.sh` + systemd (env-guard commit'i blokladı → sanitize edilecek). Hetzner CX22 (4GB, ~€5) önerildi. Şimdilik PC, sonra VPS = tam bağımsız.
- **Günlük içerik parçaları HAZIR:** reel builder'lar (restoran/plaj/antik/villa/etkinlik), `reel-i18n` (5 dil), `reels-critic`/`content-critic` (kalite kapısı), review-mining hook motoru, IG/FB publish, gerçek Kalkan fotoları.

## 🚀 SONRAKİ OTURUM — "GERİ-BESLEME BEYNİ" (asıl iş)
Beyni öğrenen hale getirecek 4 katman (hepsi bedava stack):
1. **HAFIZA katmanı** — Supabase `brain_memory` (yapılan her iş + sonucu) + Kalkan bilgi tabanı (semantik). Beyin ne yaptığını + neyin tuttuğunu hatırlar.
2. **ENGAGEMENT DUYUSU** — IG/FB insights harvester: hangi post kaç takipçi/erişim/kaydetme getirdi (Graph API insights). Sonuçları hafızaya yazar.
3. **STRATEJİST** — hafızayı okur, korelasyon çıkarır (içerik-tipi × hook × dil × saat → takipçi kazanımı), yarını planlar.
4. **GÜNLÜK 5-DİL İÇERİK ORKESTRATÖRÜ** — stratejiste bağlı: her gün Kalkan konusu seç → markalı reel+post 5 dilde üret → `reels-critic` kapısı (çöpse at, sormaz) → **güvenli içerikte OTOMATİK IG+FB yayın** (Berkay: "bana sormadan"). Öğrenerek: "Rusça plaj reels sabah 8 → +40 takipçi → daha fazla yap".

**Trust ladder:** güvenli/kendi-içerik = otomatik yayın; yeni 3.taraf işletme/belirsiz = Telegram onay (Hera/Hadrian tipi yanlış-yayını önler).

## 📌 BEKLEYEN AKTİVASYONLAR (Berkay aksiyonu)
- **PR #42 merge** (su-sporlari +12, WhatsApp webhook, site-edit kodu) → canlı
- **site_edit_queue migration** push (`supabase db push` — worktree link ya da linkli dizinden)
- **WhatsApp Lyra:** webhook + doğrulama CANLI (verify yeşil), ama **herkese açık** için Business Verification gerekir (Berkay'da şirket belgesi/vergi no yok → şimdilik test-modu). Kod hazır: `supabase/functions/wa-webhook`.
- **VPS:** Hetzner CX22 → `deploy/setup-vps.sh` → beyin tam bağımsız.

## KARARLAR (verildi)
- VPS sonra, şimdilik PC (pm2). · Güvenli işlerde direkt yayın. · Villalar HARİÇ (yasal). · Bedava stack, Claude'dan bağımsız.

Bkz: `docs/PROJE_DURUMU.md`, [[project_kalkan_ig_inventory_20260810]].
