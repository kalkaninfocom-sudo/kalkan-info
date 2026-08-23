-- 2. BEYİN HAFIZA KATMANI — brain_memory
-- Yerel JSONL (data/agency/brain-memory.jsonl) her zaman birincil kaynaktır; bu tablo
-- OPSİYONEL uzak yedek/sorgu içindir. lib/brain-memory.mjs BRAIN_MEMORY_REMOTE=1 iken yazar.
-- Sadece service-role erişir (dahili beyin verisi; public/anon erişimi YOK).

create table if not exists public.brain_memory (
  id    text primary key,
  ts    timestamptz not null default now(),
  kind  text not null check (kind in ('action','outcome','insight','plan')),
  tags  text[] not null default '{}',
  data  jsonb  not null default '{}'::jsonb
);

create index if not exists brain_memory_kind_ts_idx on public.brain_memory (kind, ts desc);
create index if not exists brain_memory_ts_idx       on public.brain_memory (ts desc);
create index if not exists brain_memory_tags_idx     on public.brain_memory using gin (tags);

-- RLS: açık ama policy YOK → anon/authenticated erişemez, service_role bypass eder.
alter table public.brain_memory enable row level security;

comment on table public.brain_memory is '2. beyin geri-besleme hafızası: action/outcome/insight/plan. Yerel JSONL birincil, bu tablo opsiyonel yedek.';
