-- ============================================================================
-- Ajans (agent şirketi) canlı backend — jobs + content + state
-- ----------------------------------------------------------------------------
-- Cockpit (/oyun/) artık canlı sitede de çalışır: Edge Function (agency) bu
-- tabloları service_role ile okur/yazar. Anon doğrudan erişemez (RLS kilitli;
-- tüm erişim Edge Function üzerinden). LLM sağlayıcı: NVIDIA NIM (cheap-llm).
-- ============================================================================

create table if not exists public.agency_jobs (
  id          text        primary key,
  agent       text        not null,
  task        text        not null,
  status      text        not null default 'queued'
                          check (status in ('queued','running','done','error')),
  result      text,
  provider    text,
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agency_jobs_created_idx
  on public.agency_jobs (created_at desc);

create table if not exists public.agency_content (
  id          text        primary key,
  agent       text,
  caption     text,
  image       text,
  status      text        not null default 'pending_approval'
                          check (status in ('pending_approval','approved','rejected','published','publish_error')),
  extra       jsonb,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  published_at timestamptz
);

create index if not exists agency_content_created_idx
  on public.agency_content (created_at desc);

create table if not exists public.agency_state (
  agent         text        primary key,
  status        text,
  last_output   text,
  last_provider text,
  last_run      timestamptz,
  updated_at    timestamptz not null default now()
);

-- RLS: kilitli — yalnızca service_role (Edge Function) erişir. Anon policy YOK.
alter table public.agency_jobs    enable row level security;
alter table public.agency_content enable row level security;
alter table public.agency_state   enable row level security;

comment on table public.agency_jobs    is 'Ajans agent iş kuyruğu + sonuçları (Edge Function agency yazar).';
comment on table public.agency_content is 'Ajans üretilen içerik onay kuyruğu (yarı-otomatik yayın).';
comment on table public.agency_state   is 'Her agent son durum/çıktı — cockpit canlı status için.';
