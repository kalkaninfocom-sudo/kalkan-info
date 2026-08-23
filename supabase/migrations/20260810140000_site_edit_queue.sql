-- Telegram → site düzenleme kuyruğu. Webhook (Vercel) niyeti buraya yazar;
-- always-on worker (repo makinesi) işleyip git push eder, sonucu geri yazar.

create table if not exists public.site_edit_queue (
  id           bigint generated always as identity primary key,
  chat_id      text,                          -- Telegram chat (bildirim için)
  raw_text     text,                          -- kullanıcının yazdığı ham metin
  action       jsonb not null,                -- {type, ...alanlar} Lyra çıkarır
  status       text not null default 'pending',  -- pending|done|error|rejected
  result       text,                          -- worker sonucu / hata mesajı
  commit_sha   text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists site_edit_queue_status_idx
  on public.site_edit_queue (status, created_at)
  where status = 'pending';

-- RLS: yalnız service_role (webhook + worker) erişir. Anon erişemez.
alter table public.site_edit_queue enable row level security;
