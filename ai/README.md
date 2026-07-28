# KalkanInfo AI — `ai/` workspace

Lyra konsiyerj OS. Tam mimari: [`../docs/KALKANINFO_AI_ARCHITECTURE.md`](../docs/KALKANINFO_AI_ARCHITECTURE.md).

## Durum
| Faz | Durum |
|-----|-------|
| 0 · Temel (metin Lyra) | ✅ **CANLI + doğrulandı** (backend). |
| 1a · Grounding (gerçek mekan) | ✅ **CANLI + doğrulandı** — 220 mekan seed, Lyra artık gerçek isim/puan veriyor, uydurma YOK. Homepage'e HAZIR. |
| 1c · Site entegrasyonu (Lyra = ana konsiyerj) | ✅ **kod hazır + lokal doğrulandı**, DEPLOY (git push) bekliyor |
| 1b · Semantik bellek (pgvector) + ses | ⏳ (rafine katman) |
| 2 · Rezervasyon+Telefon (konsiyerj arama) ⭐ | ⏳ |
| 3 · Admin · 4 · Çoklu-ajan+Ödeme · 5 · Ölçek | ⏳ |

## Faz 0 — ne yazıldı
- `supabase/migrations/20260728120000_ai_concierge.sql` — `ai_*` tabloları (agents, guests, conversations, messages, businesses, tool_invocations, prompts) + RLS + Lyra seed.
- `supabase/functions/lyra-chat/index.ts` — sohbet edge fn (NVIDIA bedava → Anthropic → stub).
- `ai/prompts/lyra.md` — persona kaynağı (migration'a da seed edildi).
- `ai/concierge-widget/lyra-widget.js` + `demo.html` — gömülebilir lüks widget. ✅ Görsel doğrulandı (çevrimdışı mod).

## ✅ Deploy edildi + doğrulandı (2026-07-28)
- `supabase db push` → `ai_*` tabloları + Lyra seed **production'da**.
- `supabase functions deploy lyra-chat` → **canlı**: `https://dgichfealzdpfhdgryym.supabase.co/functions/v1/lyra-chat`
- Canlı curl testi: `provider:"groq"` gerçek yanıt, ~5s warm. **Konuşma belleği çalışıyor** (conversationId ile ad hatırlandı).
- LLM zinciri: **Groq → Cerebras → NVIDIA → Anthropic → stub** (Groq/Cerebras/NVIDIA secret'ları mevcut; NVIDIA 70B yavaş olduğu için Groq öncelikli).

### ✅ GROUNDING ÇÖZÜLDÜ (Faz 1a — 2026-07-28)
- `ai_businesses` gerçek veriyle dolu: **220 mekan** (175 restoran + 17 otel + 15 plaj + 3 villa + 10 tur; 152 telefonlu).
- Seeder: `ai/scripts/seed-businesses.mjs` (idempotent, `data/*.json` → upsert). Veri değişince tekrar çalıştır.
- `lyra-chat` her turda kategori tespit edip ilgili gerçek mekanları prompt'a enjekte ediyor; persona "SADECE listeden öner, isim UYDURMA".
- **Doğrulandı:** Lyra "Kaptan Restaurant / Patara Plajı ⭐4.9 / Kekova Tekne Turu" → hepsi DB'de gerçek, puanlar birebir. Hallüsinasyon yok.
- Kalan rafine (1b): pgvector semantik recall (NVIDIA embeddings) + ses. Zorunlu değil.

### Homepage'e gömme (hazır snippet — anon key public, güvenli)
```html
<script>window.LYRA_CONFIG={endpoint:'https://dgichfealzdpfhdgryym.supabase.co/functions/v1/lyra-chat',anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWNoZmVhbHpkcGZoZGdyeXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTU4MTcsImV4cCI6MjA5NDIzMTgxN30.iu4IunNFuy5TEfiQ6bwmWlf7YH5cOCZOG1tY-tDxjQc'};</script>
<script src="/ai/concierge-widget/lyra-widget.js" defer></script>
```

## Deploy (referans komutlar)
```bash
cd kalkan-info

# 1) DB şeması (production Supabase — ref dgichfealzdpfhdgryym)
supabase db push

# 2) Edge function
supabase functions deploy lyra-chat

# 3) Secret'lar (yoksa) — NVIDIA bedava öncelikli; ANTHROPIC fallback
supabase secrets set NVIDIA_API_KEY=nvapi-...
#   opsiyonel: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
#   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY otomatik enjekte edilir.

# 4) Widget'ı canlı siteye göm (index.html veya global include):
#   <script>window.LYRA_CONFIG={endpoint:'https://dgichfealzdpfhdgryym.supabase.co/functions/v1/lyra-chat',anonKey:'<SUPABASE_ANON_KEY>'};</script>
#   <script src="/ai/concierge-widget/lyra-widget.js" defer></script>
```

## Yerel test
```bash
# widget görseli (çevrimdışı mod)
cd ai/concierge-widget && python -m http.server 4599   # → http://localhost:4599/demo.html

# edge fn yerel
supabase functions serve lyra-chat --env-file supabase/.env.local
curl -X POST http://localhost:54321/functions/v1/lyra-chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"akşam yemeği için yer öner"}'
```

## Güvenlik notları
- Widget ANON çağırır ama tablolara **doğrudan yazmaz** — yalnız `lyra-chat` (service_role) yazar.
- PII (misafir ad/tel) yalnız rezervasyonda toplanır (Faz 2), memory dosyalarına ASLA yazılmaz (KVKK).
- `ai_messages`/`ai_conversations` yalnız `is_admin()` okur.
