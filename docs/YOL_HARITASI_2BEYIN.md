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

## 🚀 GERİ-BESLEME BEYNİ — KATMAN 1-3 KURULDU (2026-08-10)
Beyni öğrenen hale getiren 4 katman (hepsi bedava stack). **"Ölç → öğren" yarısı canlı:**

1. **✅ HAFIZA katmanı** — `lib/brain-memory.mjs`. YEREL-ÖNCELİKLİ append-only JSONL (`data/agency/brain-memory.jsonl`, migration beklemez, hep çalışır) + opsiyonel Supabase (`brain_memory` tablosu, `BRAIN_MEMORY_REMOTE=1`). API: `record(kind,data,tags)` / `query({kind,since,tag,limit})` / `stats()`. kind: action·outcome·insight·plan. Smoke test ✓.
2. **✅ ENGAGEMENT DUYUSU** — `scripts/agency/engagement-harvest.mjs`. Supabase `social_posts`'tan yayınlanan (ig_media_id) postları alır → IG Graph node (like/comment) + `/insights` (reach/saved/shares) → hafızaya `outcome` + `data/agency/engagement.json` snapshot. İzin yoksa temel sayaçlarla devam (kör kalmaz). Uçtan uca test ✓ (0 post → graceful).
3. **✅ STRATEJİST** — `scripts/agency/strategist.mjs`. Hafızayı okur, **DETERMİNİSTİK** korelasyon çıkarır (tür × dil × yayın-saati → avg reach/saved/likes; matematik kodda, LLM'e bırakılmaz), sonra cheapLLM ile yarının planını yazar → `data/agency/strategy.json` + hafızaya `insight`+`plan`. 5+ ölçüm yoksa dürüst "soğuk başlangıç" planı. Test: 6 sentetik ölçümde ru+sabah+reels'i doğru en-iyi seçti ✓.
   - **Bağlandı:** `always-on.mjs` tick — engagement/12sa (ölç), strateji/24sa (öğren), ölçüm stratejiden önce. Env: `ENGAGEMENT_INTERVAL_HR`, `STRATEGY_INTERVAL_HR`.
4. **✅ GÜNLÜK İÇERİK ORKESTRATÖRÜ** — döngünün "uygula" yarısı KAPANDI. `lib/strategy-advisor.mjs` (strategy.json → deterministik öneri: topLang/topFormat/topHour/avoid) + `scripts/agency/daily-orchestrator.mjs` (öneriye göre bugün hangi temayı üretelim: plaj/restoran/antik → **mevcut reel-approval builder'ı çalıştırır**, o zaten qualityGate + 5-dil + social_posts pending + Telegram yapar). **Villa BİLEREK YOK (yasal).** Dedup (son 3 gün hafızadan), bütçe cap (günde 1 tema), foto-bekleyen tema hariç.
   - **KEŞİF: builder'lar zaten VAR ve kendi cron'larında** (plaj-reel.yml, restoran-reel.yml...). "Üret" + "yayınla" (auto-publish-stale = gate→approved) yarıları çalışıyordu; eksik olan tek şey **stratejiyi üretime bağlamaktı** — bu orkestratör onu yapar, medyayı yeniden yazmaz.
   - **GÜVENLİK: varsayılan ÖNİZLEME** (karar + Telegram öneri, üretim YOK → mevcut cron'ları çift-üretmez). Gerçek üretim `ORCHESTRATOR_RUN=1` (Berkay bilinçli açar). always-on tick'e bağlı: uygula/24sa. Test: cold-start→plaj rotasyonu, veri-güdümlü→ru+restoran, dedup→plaj'a düşme ✓.
   - **⏳ Kalan (Berkay kararı):** `ORCHESTRATOR_RUN=1` açılınca 6 sabit builder-cron'u orkestratöre konsolide et (yoksa çift üretim). O zaman tam otonom: öğrenerek "Rusça reels sabah → daha fazla".

**Trust ladder:** güvenli/kendi-içerik = otomatik yayın; yeni 3.taraf işletme/belirsiz = Telegram onay (Hera/Hadrian tipi yanlış-yayını önler). **Not:** oto-yayın dışa-dönük — kör açılmadı; orkestratör önizleme varsayılan, üretim+auto-approve Berkay'ın `ORCHESTRATOR_RUN=1` kararıyla.

## 🔄 GERİ-BESLEME DÖNGÜSÜ — TAM ŞEMA (kuruldu)
```
üret (reel builder) → yayınla (publish-approved) → ÖLÇ (engagement-harvest → hafıza)
   ↑                                                          ↓
UYGULA (daily-orchestrator ← strategy-advisor) ← ÖĞREN (strategist: korelasyon → strategy.json)
```
Hepsi `always-on.mjs` tick'inde: ölç/12sa → öğren/24sa → uygula/24sa. Hafıza `lib/brain-memory.mjs` (yerel JSONL). Bedava stack, Claude'dan bağımsız.

## 📌 BEKLEYEN AKTİVASYONLAR (Berkay aksiyonu)
- **PR #42 merge** (su-sporlari +12, WhatsApp webhook, site-edit kodu) → canlı
- **site_edit_queue migration** push (`supabase db push` — worktree link ya da linkli dizinden)
- **WhatsApp Lyra:** webhook + doğrulama CANLI (verify yeşil), ama **herkese açık** için Business Verification gerekir (Berkay'da şirket belgesi/vergi no yok → şimdilik test-modu). Kod hazır: `supabase/functions/wa-webhook`.
- **VPS:** Hetzner CX22 → `deploy/setup-vps.sh` → beyin tam bağımsız.

## KARARLAR (verildi)
- VPS sonra, şimdilik PC (pm2). · Güvenli işlerde direkt yayın. · Villalar HARİÇ (yasal). · Bedava stack, Claude'dan bağımsız.

Bkz: `docs/PROJE_DURUMU.md`, [[project_kalkan_ig_inventory_20260810]].
