-- ============================================================================
-- Newsletter abonelikleri (T1.4)
-- ----------------------------------------------------------------------------
-- Anon insert (footer/modal form), service_role read/update.
-- GDPR/KVKK uyumlu: çift opt-in, unsubscribe token, consent timestamp.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.newsletter_subscribers (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  email_lower         text generated always as (lower(email)) stored,
  source_page         text,
  locale              text not null default 'tr',
  ip_hash             text,
  user_agent          text,
  confirmed_at        timestamptz,
  confirm_token       text not null default encode(gen_random_bytes(24),'hex'),
  unsubscribe_token   text not null default encode(gen_random_bytes(24),'hex'),
  unsubscribed_at     timestamptz,
  gdpr_consent_at     timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_email_lower_uq
  on public.newsletter_subscribers (email_lower);

create index if not exists newsletter_subscribers_confirm_token_idx
  on public.newsletter_subscribers (confirm_token);

create index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

alter table public.newsletter_subscribers enable row level security;

-- Anonim INSERT: yalnızca yeni satır oluşturma izni (rate limit Edge Function'da).
drop policy if exists "newsletter_anon_insert" on public.newsletter_subscribers;
create policy "newsletter_anon_insert"
  on public.newsletter_subscribers
  for insert
  to anon
  with check (true);

-- Service role her şeyi yapabilir (default), anon başka hiçbir şey yapamaz.
drop policy if exists "newsletter_no_select" on public.newsletter_subscribers;

-- updated_at otomatik trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists newsletter_touch_updated_at on public.newsletter_subscribers;
create trigger newsletter_touch_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.touch_updated_at();

comment on table public.newsletter_subscribers is
  'KVKK uyumlu newsletter abonelikleri. Footer/modal formundan toplanır, çift opt-in ile aktive edilir.';
