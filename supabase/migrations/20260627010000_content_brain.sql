-- Content Brain — trend + decision + guard log.
-- Daily director cron çıktıları burada birikir.

-- 1) trending_topics — trend-scout'un yazdığı, 24h pencere ile okunur.
create table if not exists public.trending_topics (
  id          bigint generated always as identity primary key,
  source      text not null,
  title       text not null,
  snippet     text,
  relevance   numeric(3,2) not null default 0,
  traffic     text,
  meta        jsonb default '{}'::jsonb,
  fetched_at  timestamptz not null default now()
);
create index if not exists trending_topics_fetched_idx
  on public.trending_topics (fetched_at desc, relevance desc);

-- 2) content_decisions — content-director'ın günlük kararı (3 aday).
create table if not exists public.content_decisions (
  id              bigint generated always as identity primary key,
  decision_date   date not null,
  rank            int not null,
  pillar          text,
  format          text,
  hook            text,
  caption_draft   text,
  hashtags        jsonb default '[]'::jsonb,
  confidence      numeric(3,2) default 0,
  rationale       text,
  asset_plan      text,
  status          text not null default 'pending_brand_guard'
                   check (status in ('pending_brand_guard','auto_approved','pending_human','published','rejected')),
  guard_result    jsonb,
  meta            jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists content_decisions_date_idx
  on public.content_decisions (decision_date desc, rank);
create index if not exists content_decisions_status_idx
  on public.content_decisions (status, created_at desc);

-- 3) brand_guard_log — her denetim audit trail.
create table if not exists public.brand_guard_log (
  id            bigint generated always as identity primary key,
  input_brief   text not null,
  pass          boolean not null,
  overall       numeric(3,2) not null,
  flags         jsonb default '[]'::jsonb,
  meta          jsonb default '{}'::jsonb,
  checked_at    timestamptz not null default now()
);
create index if not exists brand_guard_log_checked_idx
  on public.brand_guard_log (checked_at desc, pass);

-- RLS — sadece service role
alter table public.trending_topics    enable row level security;
alter table public.content_decisions  enable row level security;
alter table public.brand_guard_log    enable row level security;

create policy "trending_topics_service_only"   on public.trending_topics   for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "content_decisions_service_only" on public.content_decisions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "brand_guard_log_service_only"   on public.brand_guard_log   for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

comment on table public.trending_topics    is 'Google Trends + IG hashtag sinyalleri — 7 gün retention öneri';
comment on table public.content_decisions  is 'Daily content director çıktısı — 30 gün retention öneri';
comment on table public.brand_guard_log    is 'Yayın öncesi denetim audit trail — 90 gün retention öneri';
