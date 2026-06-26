-- Agent runs telemetry — her agent çalıştırması bir satır.
-- Kullanım: lib/agent-logger.js wrapper'ı her run'da insert + update yapar.
-- Sorgu: /agents komutu (Telegram) son N run özetini çeker.

create table if not exists public.agent_runs (
  id           bigint generated always as identity primary key,
  agent_name   text        not null,
  status       text        not null check (status in ('running','success','failed','timeout')),
  trigger      text,
  input_brief  text,
  output_brief text,
  error_msg    text,
  cost_usd     numeric(10,4) default 0,
  duration_ms  int,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  meta         jsonb       default '{}'::jsonb
);

create index if not exists agent_runs_agent_idx       on public.agent_runs (agent_name, started_at desc);
create index if not exists agent_runs_started_idx     on public.agent_runs (started_at desc);
create index if not exists agent_runs_status_idx      on public.agent_runs (status) where status in ('running','failed');

-- Public read engelle, sadece service role yazar
alter table public.agent_runs enable row level security;

create policy "agent_runs_service_only_read"
  on public.agent_runs for select
  using ( auth.role() = 'service_role' );

create policy "agent_runs_service_only_write"
  on public.agent_runs for all
  using ( auth.role() = 'service_role' )
  with check ( auth.role() = 'service_role' );

-- 90 gün retention için pg_cron job (extension varsa)
-- delete from public.agent_runs where started_at < now() - interval '90 days';
comment on table public.agent_runs is 'Agent telemetry — 90 gün retention, RLS service-role only';
