-- ============================================================================
-- Kayıp & Bulunan ilan tablosu (T2.8)
-- ----------------------------------------------------------------------------
-- Anonim insert (Edge Function üzerinden rate-limited),
-- anonim select (sadece active ilanlar),
-- silme: delete_code eşleşmesi ile Edge Function üzerinden status='removed'.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.lost_found_items (
  id           uuid        primary key default gen_random_uuid(),
  type         text        not null check (type in ('kayip','bulundu')),
  title        text        not null,
  description  text,
  location     text,
  phone        text,
  photo_url    text,
  contact_name text,
  status       text        not null default 'active'
                           check (status in ('active','resolved','removed')),
  ip_hash      text,
  delete_code  text        not null default encode(gen_random_bytes(6),'hex'),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

alter table public.lost_found_items enable row level security;

-- Anonim insert (rate limit Edge Function'da kontrol edilir)
drop policy if exists "lf_anon_insert" on public.lost_found_items;
create policy "lf_anon_insert"
  on public.lost_found_items
  for insert
  to anon
  with check (true);

-- Anonim select: yalnızca aktif ilanlar
drop policy if exists "lf_anon_read_active" on public.lost_found_items;
create policy "lf_anon_read_active"
  on public.lost_found_items
  for select
  to anon
  using (status = 'active');

-- Anonim update yasak — silme işlemi Edge Function (service_role) üzerinden yapılır
-- Service role tüm işlemleri yapabilir (default davranış)

create index if not exists lf_status_created_idx
  on public.lost_found_items (status, created_at desc);

comment on table public.lost_found_items is
  'Kayıp & Bulunan ilanları. Anonim yayınlanır; delete_code ile Edge Function üzerinden silinir.';
comment on column public.lost_found_items.delete_code is
  'Kullanıcıya gösterilen 12-karakter hex silme kodu. Hashsiz saklanır, Edge Function karşılaştırır.';
