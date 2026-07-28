# KalkanInfo AI — Enterprise Concierge OS · Architecture v1.0

> **Durum:** TASARIM — onay bekliyor. Kod YOK (Berkay'ın kuralı: önce mimari, onay sonrası modül modül kod).
> **İlk AI çalışan:** **LYRA** — lüks dijital konsiyerj.
> **Onaylanmış çekirdek iş akışı:** Lyra misafir adına **işletmeyi telefonla arar** (rezervasyon konsiyerji).
> Son güncelleme: 2026-07-28

---

## 0. CTO KARARLARI (gerçeğin üstüne mimari — literal prompt'a değil)

Solo kurucu + canlı üretim sitesi + olgun Supabase kurulumu var. Bu yüzden 3 load-bearing kararı düzeltiyorum:

| # | Prompt diyor | Karar | Neden |
|---|--------------|-------|-------|
| D1 | "Firebase primary backend" | ❌ **Supabase primary** (Postgres+Auth+Edge+pgvector+Realtime+Storage) | Zaten 18 migration + 4 Edge Function canlı. RLS güvenlik modeli kurulu (`admin_claims`). **pgvector = yerleşik uzun-dönem vektör bellek** (ayrı vektör DB'ye gerek yok). Rezervasyon/booking için SQL ilişkisel bütünlük şart. Firebase = ikinci bir stack + veri parçalanması + daha pahalı. (Push gerekirse Supabase + OneSignal/Expo.) |
| D2 | "Modern React/Vite/TS, yeni proje" | ✅ Kabul **ama brownfield monorepo** | Canlı `kalkaninfo.com` statik HTML. Onu KIRMA (STABILITE kuralı). Yeni AI OS = monorepo; konsiyerj **embeddable widget** olarak mevcut siteye gömülür, admin ayrı React/Vite/TS SPA. Site çalışmaya devam eder. |
| D3 | Agent runtime nerede? | ✅ **Supabase Edge (Deno) + ayrı Node agent-worker** | Vercel Hobby **api/*.js 12/12 DOLU** ve **2/2 cron dolu**. Vercel'e yeni fonksiyon eklenemez. Ajan runtime + telefon orkestrasyonu Edge Functions + bağımsız worker'da. |

**Firebase'i yine de istersen** (D1'i veto edersen) tüm DB/güvenlik/bellek katmanı değişir — söyle, yeniden tasarlarım. Varsayılan: Supabase.

---

## 1. SİSTEM MİMARİSİ (katmanlar)

```
┌─────────────────────────────────────────────────────────────────┐
│  KANALLAR:  Web widget · Sesli (ElevenLabs) · WhatsApp · Telegram │
│             · Instagram · Telefon (Twilio inbound/outbound)       │
└───────────────┬─────────────────────────────────────────────────┘
                │  (normalize edilmiş mesaj zarfı)
        ┌───────▼────────┐
        │  GATEWAY (Edge) │  kanal adaptörleri → tek "turn" formatı
        └───────┬────────┘
        ┌───────▼───────────────────────────────────────────┐
        │  AGENT RUNTIME (packages/core)                     │
        │  Orchestrator loop:                                │
        │  perceive → retrieve memory → build context →      │
        │  plan → tool-call → respond → persist              │
        │  ├─ Model Router (claude/gpt/gemini/local)         │
        │  ├─ Memory Manager (5 katman + pgvector)           │
        │  ├─ Tool Registry (maps/weather/reserve/call...)   │
        │  └─ Agent Registry (lyra + gelecek ajanlar)        │
        └───────┬───────────────────────────────────────────┘
        ┌───────▼────────┐        ┌──────────────────────────┐
        │  SUPABASE       │        │  AGENT-WORKER (Node)     │
        │  Postgres+RLS   │◄──────►│  uzun işler: telefon     │
        │  pgvector       │        │  araması, kuyruk, cron   │
        │  Storage/Realtime│       │  Twilio × ElevenLabs     │
        └────────────────┘        └──────────────────────────┘
```

**İki çalışma zamanı, tek kaynak:**
- **Edge Functions (Deno):** düşük gecikmeli, stateless — chat stream, tool proxy, webhook'lar.
- **agent-worker (Node, kalıcı):** uzun süren/asenkron — çıkış aramaları, kuyruk tüketimi, cron. Vercel limitini bypass eder (Railway/Fly/kendi VPS).

---

## 2. KLASÖR YAPISI (monorepo — pnpm workspaces + Turborepo)

```
kalkan-ai/                         # yeni workspace (kalkan-info repo içinde /ai)
├─ apps/
│  ├─ concierge-widget/            # Lyra chat+voice — web-component, siteye <script> ile gömülür
│  ├─ admin/                       # Dashboard: React+Vite+TS+Tailwind, dark luxury
│  └─ agent-worker/               # Node: telephony orchestrator, queue consumer, cron
├─ packages/
│  ├─ core/                        # orchestrator, context builder, tool-calling loop
│  ├─ agents/                      # ajan tanımları (config-driven): lyra.agent.ts + gelecek
│  ├─ memory/                      # 5 bellek katmanı API'si (short/conv/user/business/vector)
│  ├─ tools/                       # tool arayüzleri: maps, weather, reserve, call, whatsapp...
│  ├─ model-router/                # çok-LLM router (mevcut lib/cheap-llm.mjs'i genelleştir)
│  ├─ prompts/                     # sürümlenmiş prompt şablonları + eval golden set
│  ├─ db/                          # supabase client + generated types + zod şemalar
│  └─ shared/                      # tipler, util, guardrail'ler, KVKK yardımcıları
├─ supabase/
│  ├─ migrations/                  # mevcut kalkan-info projesini GENİŞLETİR (ai şema)
│  └─ functions/                   # edge: lyra-chat, lyra-voice-webhook, tool-proxy, reserve
├─ prompts/                        # markdown prompt kaynağı (build → packages/prompts)
├─ turbo.json · pnpm-workspace.yaml · tsconfig.base.json
```

Prompt'taki düz modül listesi (/core /agents /memory /tools /api /frontend...) bu monorepo'ya birebir haritalanır — dağılmış değil, sürümlenebilir paketler halinde.

---

## 3. VERİTABANI TASARIMI (Supabase Postgres · şema `ai`)

RLS her tabloda açık. Widget (anon) yalnızca Edge Function'ın service-role'ü üzerinden yazar; admin `admin_claims` (mevcut) ile okur/yönetir.

```sql
create schema ai;
create extension if not exists vector;      -- pgvector

-- Ajan kayıt defteri (çoklu AI çalışan buradan büyür)
ai.agents(
  id uuid pk, slug text unique,             -- 'lyra'
  name text, role text, personality jsonb,
  model_config jsonb,                       -- {primary:'claude-opus-4-8', fallback:[...]}
  status text, version int, created_at)

-- Konuşmalar (tüm kanallar tek tabloda)
ai.conversations(
  id uuid pk, agent_id fk, channel text,    -- web|voice|whatsapp|telegram|ig|phone
  guest_id fk null, status text,            -- active|resolved|handoff
  summary text, lang text, started_at, last_at)

ai.messages(
  id uuid pk, conversation_id fk, role text,-- user|assistant|tool|system
  content text, tool_calls jsonb, tokens int, created_at)
  -- KALICI konuşma belleği (restart'tan sağ çıkar ✓)

-- Misafir (PII — RLS kilitli, KVKK)
ai.guests(
  id uuid pk, name text, phone text, email text,
  lang text, prefs jsonb, consent jsonb,    -- {marketing:bool, recording:bool}
  created_at)

-- Uzun-dönem VEKTÖR bellek (pgvector)
ai.memories(
  id uuid pk, scope text,                   -- user|business|global
  subject_ref text,                         -- guest_id | business_slug
  content text, embedding vector(1536),
  importance real, metadata jsonb, created_at)
create index on ai.memories using ivfflat (embedding vector_cosine_ops);

-- İşletmeler (mevcut venue verisine köprü)
ai.businesses(
  id uuid pk, venue_slug text,              -- restoran/villa data'sına link
  type text, phone text, whatsapp text,
  hours jsonb, booking_policy jsonb,
  commission numeric, active bool)

-- Rezervasyonlar (konsiyerj çekirdeği)
ai.reservations(
  id uuid pk, conversation_id fk, business_id fk, guest_id fk,
  type text,                                -- restaurant|villa|boat|transfer
  party_size int, requested_at timestamptz, notes text,
  status text,                              -- pending|calling|confirmed|failed|cancelled
  confirmation_ref text, channel text, created_at)

-- Telefon oturumları (Twilio × ElevenLabs)
ai.call_sessions(
  id uuid pk, reservation_id fk, provider text, eleven_agent_id text,
  to_number text, status text, duration int, cost numeric,
  recording_url text, transcript text, created_at)

-- Lead / satış hunisi
ai.leads(id uuid pk, guest_id fk, intent text, score int, status text, assigned_business fk)

-- Prompt sürümleme (admin'den düzenlenir)
ai.prompts(id uuid pk, agent_slug text, key text, version int,
           template text, active bool, evals jsonb, created_at)

-- İzlenebilirlik
ai.tool_invocations(id uuid pk, conversation_id fk, tool text, args jsonb,
                    result jsonb, latency_ms int, error text, created_at)
ai.audit_log(id uuid pk, actor text, action text, entity text, meta jsonb, created_at)
```

**Yeniden kullanılan mevcut tablolar:** `venue_sites`, `marketplace`, `whatsapp_conversations` (köprü), `agent_runs`, `admin_claims`, `newsletter`. Sıfırdan başlamıyoruz.

---

## 4. BELLEK SİSTEMİ (5 katman → depolama haritası)

| Katman | Amaç | Depolama | Restart'ta yaşar? |
|--------|------|----------|-------------------|
| Short-term | aktif turn buffer / plan | worker RAM | hayır (geçici) |
| Conversation | tam diyalog geçmişi | `ai.messages` | ✅ |
| User | misafir tercihleri/geçmiş | `ai.guests.prefs` + `ai.memories(user)` | ✅ |
| Business | işletme bilgisi/politika | `ai.businesses` + `ai.memories(business)` | ✅ |
| Booking | rezervasyon durumu | `ai.reservations` | ✅ |
| Long-term Vector | semantik hatırlama | `ai.memories.embedding` (pgvector) | ✅ |

**Context Builder** (packages/memory): her turn'de sistem promptu + kişilik + retrieve edilen bellek (vektör benzerlik + recency + importance) + tool şemalarını birleştirir → token bütçesine göre budar.

---

## 5. PROMPT MİMARİSİ (katmanlı + sürümlü + eval'lı)

```
[BASE PERSONA: Lyra]     — sıcak, zarif, kısa, asla robotik (sabit çekirdek)
  + [CHANNEL ADAPTER]    — web/voice/whatsapp ton farkı
  + [TASK/WORKFLOW]      — rezervasyon | öneri | şikayet | FAQ
  + [RETRIEVED CONTEXT]  — Context Builder'dan bellek + işletme verisi
  + [GUARDRAILS]         — KVKK, fiyat söyleme kuralı, halüsinasyon önleme, onay kapıları
```

- Tümü `ai.prompts` içinde sürümlü; admin'den düzenlenebilir; `active` flag ile canary.
- **Eval harness:** golden konuşma seti → her prompt sürümü otomatik puanlanır (görev başarımı, ton, doğruluk). Regresyon = deploy bloklanır.

---

## 6. AJAN MİMARİSİ (tek loop, çoğa ölçeklenir)

**Orchestrator (packages/core):** perceive → retrieve → plan → tool-call → respond → persist. Modelden bağımsız (Model Router). Tool'lar JSON-schema ile kayıtlı.

**Ajan arayüzü (bugün tasarla, sonra doldur):**
```ts
interface Agent {
  slug: string;
  persona: PromptRef;
  tools: ToolName[];
  memoryScopes: Scope[];
  canDelegateTo?: string[];   // supervisor deseni
}
```
- **Faz 1:** yalnız **Lyra** (supervisor + tek yürütücü).
- **Sonra:** Lyra bir tool ("handoff") ile alt-ajanlara delege eder → Restaurant/Villa/Boat/Travel/Marketing/Sales/Support/Analytics/CEO. Arayüz aynı; yeni ajan = yeni config + prompt, kod değişmez. **Plug-in mimari.**

---

## 7. API & TOOL KONTRATLARI

**Edge Functions (Supabase — Vercel limitini bypass):**
| Endpoint | İş |
|----------|-----|
| `POST /lyra/chat` (SSE stream) | web/whatsapp/telegram metin turu |
| `POST /lyra/voice/webhook` | ElevenLabs conversational tool callback'leri |
| `POST /lyra/reserve` | rezervasyon oluştur → agent-worker'a kuyruk |
| `POST /tool-proxy/:tool` | maps/weather/stripe için güvenli proxy |

**Tool arayüzleri (packages/tools):** `maps`, `weather`, `check_availability`, `create_reservation`, `call_business` (Twilio×ElevenLabs), `send_whatsapp`, `send_telegram`, `send_email`, `collect_lead`, `get_menu_prices`, `calendar`. Her biri `{schema, run(args,ctx)}`; hepsi `ai.tool_invocations`'a loglanır.

---

## 8. ÇEKIRDEK İŞ AKIŞI — KONSIYERJ TELEFON ARAMASI ✅ (onaylı)

```
1. Misafir → Lyra (web/sesli):  "bu akşam 20:00, Zeugma'da 4 kişilik masa"
2. Lyra detayı toplar + MİSAFİRE onaylatır → ai.reservations(status=pending)
3. agent-worker kuyruğu tüketir → make_outbound_call(
      eleven_agent = "Lyra-Rezervasyon-Arayıcı", twilio_number, business.phone)
4. Ayrı bir ElevenLabs ajanı işletmeyi TR konuşarak arar:
   müsaitlik sorar → onaylar → post-call transcript webhook
5. Sonuç → ai.reservations(status=confirmed|failed) + ai.call_sessions kaydı
6. Lyra misafiri bilgilendirir (web + WhatsApp)
   Fallback: cevap yok → WhatsApp'tan işletmeye + misafire "arıyoruz" bildirimi
```

**Dürüst kısıtlar:**
- Eldeki Twilio no **ABD (+18578473105)** — Türk işletme +1'i açmaz. Ciddi kullanım için **+90 Türk Twilio numarası** şart (aylık + dakika ücreti).
- İşletme rızası + arama kaydı KVKK bildirimi gerekir.
- Maliyet: ElevenLabs dakika + Twilio dakika (arama başına gerçek para). Faz 2'de pilot işletmelerle test.

---

## 9. ADMIN DASHBOARD (apps/admin — React+Vite+TS+Tailwind, dark luxury)

Modüller: **İşletmeler** (CRUD) · **Rezervasyonlar** (canlı board: pending→calling→confirmed) · **Konuşma Logları** · **Bellek Explorer** (vektör bellek arama/temizleme) · **Prompt Manager** (düzenle+sürümle+eval) · **Ajan Monitörü** (run/cost/latency) · **Analytics** · **Telefon Kayıtları** (transcript+recording review). Realtime Supabase subscription ile canlı.

---

## 10. GÜVENLİK

- **Auth:** Supabase Auth + RLS; roller `admin_claims` (mevcut) üzerinden.
- **Secrets:** Supabase Vault / env; loglara asla basılmaz.
- **Rate limiting:** Edge'de IP + conversation başına.
- **Audit:** `ai.audit_log` + `ai.tool_invocations` her aksiyon.
- **KVKK/PII:** misafir verisi at-rest şifreli (Supabase), `consent` flag'leri, arama kaydı bildirimi, bellek saklama/silme politikası. **PII asla log/memory dosyasına yazılmaz** (mevcut kural).

---

## 11. YOL HARİTASI (fazlı — her faz TEK BAŞINA çalışır; ADHD kuralı)

| Faz | Teslim (standalone çalışır) | Ana parçalar |
|-----|------------------------------|--------------|
| **0 · Temel** | Canlı sitede metin Lyra konsiyerj | monorepo, `ai` şema migration, model-router (cheap-llm sarmalar), Lyra persona prompt, `lyra-chat` edge fn, concierge-widget embed |
| **1 · Bellek+Ses** | Lyra hatırlar + sesli konuşur | pgvector memory, conversation persistence, Context Builder, ElevenLabs "Lyra" sesli reconnect |
| **2 · Rezervasyon+Telefon** ⭐ | Lyra restoranı telefonla arar/rezerve eder | reservations, agent-worker, rezervasyon-arayıcı ElevenLabs ajanı, **+90 Twilio no**, WhatsApp fallback, misafir bildirimi |
| **3 · Admin** | Yönetim paneli canlı | dashboard: rezervasyon board, loglar, prompt manager, bellek explorer |
| **4 · Çoklu-ajan+Ödeme** | Villa/Boat/Travel ajanları + kapora | agent handoff, Stripe deposit, lead scoring, analytics |
| **5 · Ölçek** | Değerlendirme + çok kanal | eval harness, model A/B, IG/Telegram kanalları, CEO/Analytics ajanları |

**Öneri başlangıç:** Faz 0 → 1 → 2. Faz 2 = senin onayladığın telefon konsiyerji (asıl değer). Her faz canlıya çıkar, yarım kalsa bile önceki faz çalışır durumda kalır.

---

## 12. AÇIK KARARLAR (kod öncesi Berkay onayı)

1. **D1 — Backend:** Supabase (öneri) mi, Firebase (prompt) mı? → Supabase öneriyorum.
2. **Başlangıç fazı:** Faz 0'dan mı, doğrudan Faz 2 telefon PoC'undan mı?
3. **+90 Twilio numarası:** Faz 2 için alınacak mı (para kararı)?
4. **Repo konumu:** `kalkan-info/ai/` (monorepo içine) mi, ayrı repo mu?

Onay sonrası: modül modül production kod, Faz 0'dan başlayarak.
```
