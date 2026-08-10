-- WhatsApp konuşma eşlemesi: bir WhatsApp numarası (wa_id) → süregelen ai_conversation
-- wa-webhook edge fn gelen WhatsApp mesajını doğru konuşmaya bağlamak için kullanır.

alter table if exists public.ai_conversations
  add column if not exists wa_id text;

create index if not exists ai_conversations_wa_id_idx
  on public.ai_conversations (wa_id)
  where wa_id is not null;
