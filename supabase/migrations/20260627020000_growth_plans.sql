-- growth_plans — haftalık trafik büyütme planı (growth-strategist çıktısı).
-- Secretary WhatsApp "bu hafta ne yapıyoruz" sorusuna bu tablodan cevap verir.

create table if not exists public.growth_plans (
  id              bigint generated always as identity primary key,
  week_label      text not null,
  current_state   text,
  actions         jsonb not null default '[]'::jsonb,
  warnings        jsonb default '[]'::jsonb,
  data_gaps       jsonb default '[]'::jsonb,
  meta            jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists growth_plans_week_idx on public.growth_plans (week_label);
create index if not exists growth_plans_created_idx on public.growth_plans (created_at desc);

alter table public.growth_plans enable row level security;

create policy "growth_plans_service_only"
  on public.growth_plans for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.growth_plans is 'Weekly growth strategy — 1 yıl retention öneri';
