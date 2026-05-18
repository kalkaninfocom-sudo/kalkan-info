-- ============================================================================
-- social_posts — Otonom sosyal medya ajansı içerik kuyruğu (Faz 1)
-- ----------------------------------------------------------------------------
-- Haftalık content planner (cron pazartesi 09:00 TR) burada draft oluşturur.
-- Telegram approval bot tıklayınca status güncellenir (approved/rejected).
-- Publish queue (cron her saat) scheduled_at <= now() olanları IG'ye gönderir.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.social_posts (
  id                    uuid primary key default gen_random_uuid(),
  content_pack_id       text not null,
  content_type          text not null default 'reels',
  language              text not null default 'en',
  voiceover_text        text,
  caption               text not null,
  hashtags              jsonb not null default '[]'::jsonb,
  music_mood            text,
  footage_queries       jsonb default '[]'::jsonb,
  local_assets          jsonb default '[]'::jsonb,
  duration_s            int default 25,
  target_audience       jsonb default '[]'::jsonb,
  status                text not null default 'draft',
  scheduled_at          timestamptz,
  published_at          timestamptz,
  telegram_chat_id      bigint,
  telegram_message_id   bigint,
  ig_creation_id        text,
  ig_media_id           text,
  engagement_metrics    jsonb default '{}'::jsonb,
  reject_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists social_posts_status_idx
  on public.social_posts (status);
create index if not exists social_posts_scheduled_at_idx
  on public.social_posts (scheduled_at)
  where status in ('approved', 'pending_approval');
create index if not exists social_posts_content_pack_idx
  on public.social_posts (content_pack_id, created_at desc);

comment on column public.social_posts.status is
  'draft, pending_approval, approved, scheduled, published, rejected, failed';

alter table public.social_posts enable row level security;

create policy social_posts_admin_all on public.social_posts
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy social_posts_service_all on public.social_posts
  for all to service_role
  using (true) with check (true);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists social_posts_touch on public.social_posts;
create trigger social_posts_touch
  before update on public.social_posts
  for each row execute function public.touch_updated_at();
