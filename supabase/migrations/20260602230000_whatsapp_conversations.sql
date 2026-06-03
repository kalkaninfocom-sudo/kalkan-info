-- ==============================================================================
-- WhatsApp Conversations — chat history for the auto-reply assistant
-- ==============================================================================
-- Her mesaj (kullanıcı veya asistan) tek satır. Telefon hash'lenir (KVKK).
-- api/whatsapp.js bu tabloya yazıp Claude'a son N mesajı geçer.
-- ==============================================================================

create table if not exists public.whatsapp_conversations (
  id            uuid primary key default gen_random_uuid(),
  phone_hash    text not null,
  phone_mask    text not null,
  wa_message_id text,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  lang          text,
  model         text,
  tokens_in     integer,
  tokens_out    integer,
  created_at    timestamptz not null default now()
);

create index if not exists idx_wa_conv_phone_created
  on public.whatsapp_conversations (phone_hash, created_at desc);

create index if not exists idx_wa_conv_created
  on public.whatsapp_conversations (created_at desc);

-- RLS: sadece service role yazar/okur. Anon ve authenticated erişimi yok.
alter table public.whatsapp_conversations enable row level security;

-- 90 günden eski kayıtları silmek için retention helper (manuel/cron tetikli)
create or replace function public.purge_old_whatsapp_conversations()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from public.whatsapp_conversations
  where created_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on table public.whatsapp_conversations is
  'WhatsApp auto-reply bot konuşma geçmişi. Telefon hash + maskelenmiş. 90 gün retention.';
