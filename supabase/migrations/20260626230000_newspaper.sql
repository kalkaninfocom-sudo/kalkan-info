-- ============================================================================
-- Kalkan Today — Günlük gazete tabloları
-- ----------------------------------------------------------------------------
-- Vizyon: docs/GAZETE_PROJESI.md
-- Aşama 1 MVP: edisyon arşivi + AI üretilen makaleler + reklam slotları +
--             QR tıklama analitiği (KVKK uyumlu, IP hash'li).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. EDITIONS — her günkü her edisyon (morning/evening/weekend/venue)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.newspaper_editions (
  id            uuid primary key default gen_random_uuid(),
  edition_date  date not null,
  edition_type  text not null check (edition_type in ('morning','evening','weekend','venue','special')),
  language      text not null default 'tr' check (language in ('tr','en','ru','de','fr')),
  venue_id      uuid,                            -- profiles.id (venue edisyonu ise)
  issue_no      integer not null,
  pdf_url       text,                            -- Supabase Storage URL
  html_url      text,
  cover_image   text,
  status        text not null default 'draft' check (status in ('draft','review','published','archived')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists newspaper_editions_unique
  on public.newspaper_editions (edition_date, edition_type, language, coalesce(venue_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists newspaper_editions_pub_idx
  on public.newspaper_editions (status, published_at desc);

-- ─────────────────────────────────────────────────────────────
-- 2. ARTICLES — manşet + makaleler (AI üretir, editör onaylar)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.newspaper_articles (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid not null references public.newspaper_editions(id) on delete cascade,
  slot          text not null check (slot in ('lead','col1','col2','col3','side','filler')),
  kicker        text,                            -- "BUGÜN KALKAN'DA"
  headline      text not null,
  deck          text,
  byline        text,
  body          text,                            -- markdown veya HTML
  cover_url     text,
  cover_caption text,
  author_type   text not null default 'ai' check (author_type in ('ai','editor','syndicated')),
  ai_model      text,                            -- "claude-haiku-4-5"
  ai_prompt_id  text,
  approved      boolean not null default false,
  approved_by   uuid,                            -- auth.users.id (editor)
  approved_at   timestamptz,
  position      smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists newspaper_articles_edition_idx
  on public.newspaper_articles (edition_id, slot, position);

-- ─────────────────────────────────────────────────────────────
-- 3. ADS — reklam slotları (manşet sponsoru, çeyrek, advertorial, classified)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.newspaper_ads (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid,                          -- profiles.id (reklamveren)
  slot_type       text not null check (slot_type in ('lead_sponsor','quarter_page','advertorial','classified','micro_qr')),
  title           text not null,
  body            text,
  cta_label       text default 'Detay',
  cta_url         text not null,                 -- /q/<qr_slug> redirect'e dönüşür
  qr_slug         text not null unique default encode(extensions.gen_random_bytes(6),'hex'),
  cover_url       text,
  price_per_day   numeric(10,2) default 0,
  currency        text default 'TRY',
  starts_at       date not null,
  ends_at         date not null,
  status          text not null default 'pending' check (status in ('pending','approved','active','paused','expired','rejected')),
  click_count     integer not null default 0,
  impression_count integer not null default 0,
  approved_by     uuid,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists newspaper_ads_active_idx
  on public.newspaper_ads (status, starts_at, ends_at);
create index if not exists newspaper_ads_qr_slug_idx
  on public.newspaper_ads (qr_slug);

-- ─────────────────────────────────────────────────────────────
-- 4. AD PLACEMENTS — hangi edisyonda hangi reklam, hangi slotta
-- ─────────────────────────────────────────────────────────────
create table if not exists public.newspaper_ad_placements (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid not null references public.newspaper_editions(id) on delete cascade,
  ad_id         uuid not null references public.newspaper_ads(id) on delete cascade,
  slot_position smallint not null default 0,
  created_at    timestamptz not null default now(),
  unique (edition_id, ad_id, slot_position)
);

create index if not exists newspaper_ad_placements_edition_idx
  on public.newspaper_ad_placements (edition_id);

-- ─────────────────────────────────────────────────────────────
-- 5. QR EVENTS — KVKK uyumlu tıklama analitiği (IP HASH'li, ham IP YOK)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.newspaper_qr_events (
  id            uuid primary key default gen_random_uuid(),
  qr_slug       text not null,
  ad_id         uuid references public.newspaper_ads(id) on delete set null,
  edition_id    uuid references public.newspaper_editions(id) on delete set null,
  clicked_at    timestamptz not null default now(),
  ip_hash       text,                            -- SHA-256(ip + daily_salt), ham IP yasak
  user_agent_h  text,                            -- SHA-256(ua), ham UA yasak
  referrer      text,
  country_code  text,                            -- Vercel geo header
  created_at    timestamptz not null default now()
);

create index if not exists newspaper_qr_events_slug_idx
  on public.newspaper_qr_events (qr_slug, clicked_at desc);
create index if not exists newspaper_qr_events_ad_idx
  on public.newspaper_qr_events (ad_id, clicked_at desc);

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS — updated_at
-- ─────────────────────────────────────────────────────────────
drop trigger if exists newspaper_editions_touch on public.newspaper_editions;
create trigger newspaper_editions_touch
  before update on public.newspaper_editions
  for each row execute function public.touch_updated_at();

drop trigger if exists newspaper_articles_touch on public.newspaper_articles;
create trigger newspaper_articles_touch
  before update on public.newspaper_articles
  for each row execute function public.touch_updated_at();

drop trigger if exists newspaper_ads_touch on public.newspaper_ads;
create trigger newspaper_ads_touch
  before update on public.newspaper_ads
  for each row execute function public.touch_updated_at();

-- Click counter atomic increment trigger
create or replace function public.newspaper_inc_click()
returns trigger language plpgsql as $$
begin
  if new.ad_id is not null then
    update public.newspaper_ads
       set click_count = click_count + 1,
           updated_at = now()
     where id = new.ad_id;
  end if;
  return new;
end $$;

drop trigger if exists newspaper_qr_inc_click on public.newspaper_qr_events;
create trigger newspaper_qr_inc_click
  after insert on public.newspaper_qr_events
  for each row execute function public.newspaper_inc_click();

-- ─────────────────────────────────────────────────────────────
-- RLS — Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.newspaper_editions      enable row level security;
alter table public.newspaper_articles      enable row level security;
alter table public.newspaper_ads           enable row level security;
alter table public.newspaper_ad_placements enable row level security;
alter table public.newspaper_qr_events     enable row level security;

-- Editions: public sadece published görür, service_role her şey
drop policy if exists "editions_public_read" on public.newspaper_editions;
create policy "editions_public_read"
  on public.newspaper_editions
  for select
  to anon, authenticated
  using (status = 'published');

-- Articles: edisyonu published ise public read
drop policy if exists "articles_public_read" on public.newspaper_articles;
create policy "articles_public_read"
  on public.newspaper_articles
  for select
  to anon, authenticated
  using (
    approved = true
    and exists (
      select 1 from public.newspaper_editions e
       where e.id = newspaper_articles.edition_id
         and e.status = 'published'
    )
  );

-- Ads: aktif olanlar public read
drop policy if exists "ads_public_read" on public.newspaper_ads;
create policy "ads_public_read"
  on public.newspaper_ads
  for select
  to anon, authenticated
  using (status in ('active','approved'));

-- Ad placements: ilgili edisyon published ise public read
drop policy if exists "ad_placements_public_read" on public.newspaper_ad_placements;
create policy "ad_placements_public_read"
  on public.newspaper_ad_placements
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.newspaper_editions e
       where e.id = newspaper_ad_placements.edition_id
         and e.status = 'published'
    )
  );

-- QR events: anon INSERT only (Edge Function rate limit), kimse SELECT yapamaz (admin servis bypass eder)
drop policy if exists "qr_events_anon_insert" on public.newspaper_qr_events;
create policy "qr_events_anon_insert"
  on public.newspaper_qr_events
  for insert
  to anon, authenticated
  with check (true);
