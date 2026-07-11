-- Kalkan Info — Pazar Yeri (marketplace / Letgo-tarzı al-sat) tablosu + storage + RLS
-- Client-side supabase-js ile çalışır (yeni Vercel api/ fonksiyonu YOK). jobs deseninin ikizi.

create extension if not exists pgcrypto;

create table if not exists public.marketplace_listings (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  slug          text unique,
  title         text not null check (char_length(title) between 3 and 120),
  category      text not null,
  condition     text default 'used' check (condition in ('new','used')),
  price         numeric(12,2),
  currency      text default 'TRY',
  is_negotiable boolean default false,
  location      text,
  description   text check (char_length(coalesce(description,'')) <= 4000),
  images        text[] default '{}',            -- Supabase Storage public URL'leri (max 6, uygulama katmanı sınırlar)
  contact_name  text,
  contact_phone text,
  contact_whatsapp text,
  status        text not null default 'active' check (status in ('active','pending','sold','removed')),
  report_count  int default 0,
  view_count    int default 0,
  created_at    timestamptz default now(),
  published_at  timestamptz default now(),
  expires_at    timestamptz default (now() + interval '60 days')
);

create index if not exists idx_market_status_created on public.marketplace_listings (status, created_at desc);
create index if not exists idx_market_category on public.marketplace_listings (category);
create index if not exists idx_market_owner on public.marketplace_listings (owner_id);

alter table public.marketplace_listings enable row level security;

-- Herkes AKTİF (ve süresi dolmamış) ilanları görür
do $$ begin
  drop policy if exists market_public_read on public.marketplace_listings;
  create policy market_public_read on public.marketplace_listings
    for select to anon, authenticated
    using (status = 'active' and (expires_at is null or expires_at > now()));
exception when others then null; end $$;

-- Giriş yapmış + e-posta doğrulanmış kullanıcı KENDİ ilanını ekler (Letgo-tarzı anında 'active')
do $$ begin
  drop policy if exists market_owner_insert on public.marketplace_listings;
  create policy market_owner_insert on public.marketplace_listings
    for insert to authenticated
    with check (
      auth.uid() = owner_id
      and public.is_email_verified()
      and status in ('active','pending')
    );
exception when others then null; end $$;

-- Sahip veya admin günceller/siler
do $$ begin
  drop policy if exists market_owner_update on public.marketplace_listings;
  create policy market_owner_update on public.marketplace_listings
    for update to authenticated
    using (auth.uid() = owner_id or public.is_admin())
    with check (auth.uid() = owner_id or public.is_admin());
exception when others then null; end $$;

do $$ begin
  drop policy if exists market_owner_delete on public.marketplace_listings;
  create policy market_owner_delete on public.marketplace_listings
    for delete to authenticated
    using (auth.uid() = owner_id or public.is_admin());
exception when others then null; end $$;

-- ── Storage: ilan fotoğrafları (public okuma, giriş yapmış kullanıcı kendi klasörüne yükler) ──
insert into storage.buckets (id, name, public)
values ('marketplace-photos', 'marketplace-photos', true)
on conflict (id) do nothing;

do $$ begin
  drop policy if exists market_photos_read on storage.objects;
  create policy market_photos_read on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'marketplace-photos');
exception when others then null; end $$;

-- Kullanıcı yalnız kendi uid klasörüne (<uid>/...) yükler
do $$ begin
  drop policy if exists market_photos_insert on storage.objects;
  create policy market_photos_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'marketplace-photos'
      and public.is_email_verified()
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when others then null; end $$;

do $$ begin
  drop policy if exists market_photos_delete on storage.objects;
  create policy market_photos_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'marketplace-photos'
      and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
    );
exception when others then null; end $$;

-- slug için published_at güncelle (opsiyonel trigger yok — uygulama katmanı slug üretir)
