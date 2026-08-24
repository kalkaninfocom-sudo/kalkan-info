-- Kalkan Info — KONAKLAMA / KİRALAMA (stays) — oda→daire→bina kiralama marketplace'i
-- CouchSurfing yelpazesi (oda→tüm bina) + Airbnb modeli (ücretli, talep→onay).
-- Client-side supabase-js ile çalışır (YENİ Vercel api/ fonksiyonu YOK). marketplace_listings ikizi.
-- Yardımcılar mevcut: public.is_email_verified(), public.is_admin().

create extension if not exists pgcrypto;
create extension if not exists btree_gist;   -- çift-rezervasyon önleme (exclusion constraint) için

-- ══════════════════════════════════════════════════════════════════════════
-- 1) İLANLAR (stays)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists public.stays (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,   -- HOST
  slug           text unique,
  title          text not null check (char_length(title) between 3 and 120),
  listing_type   text not null check (listing_type in ('room','apartment','villa','whole_building','couch')),
  capacity       int  not null default 1 check (capacity between 1 and 50),
  bedrooms       int  default 1,
  beds           int  default 1,
  bathrooms      int  default 1,
  price_per_night numeric(12,2) not null check (price_per_night >= 0),
  currency       text default 'TRY',
  cleaning_fee   numeric(12,2) default 0,
  min_nights     int default 1 check (min_nights >= 1),
  max_nights     int,
  amenities      text[] default '{}',              -- wifi,pool,ac,kitchen,parking,seaview,washer,heating...
  location       text,                              -- Kalkan/Kaş/Patara/İslamlar...
  neighborhood   text,
  lat            numeric,
  lng            numeric,
  images         text[] default '{}',              -- Supabase Storage public URL (max 12, uygulama sınırlar)
  house_rules    text,
  description    text check (char_length(coalesce(description,'')) <= 5000),
  instant_book   boolean default false,             -- MVP: false = talep→onay
  available_from date,                               -- kiralanabilir sezon başı (null = her zaman)
  available_to   date,                               -- sezon sonu
  contact_whatsapp text,
  status         text not null default 'active' check (status in ('active','pending','paused','removed')),
  is_verified    boolean default false,             -- güven: admin/ekip doğruladı (gerçek foto/konum)
  view_count     int default 0,
  created_at     timestamptz default now(),
  published_at   timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_stays_status on public.stays (status, published_at desc);
create index if not exists idx_stays_type on public.stays (listing_type);
create index if not exists idx_stays_owner on public.stays (owner_id);
create index if not exists idx_stays_location on public.stays (location);

-- ══════════════════════════════════════════════════════════════════════════
-- 2) MANUEL KAPALI GÜNLER (stay_blocked_dates) — host'un elle kapattığı tarihler
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists public.stay_blocked_dates (
  stay_id  uuid not null references public.stays(id) on delete cascade,
  day      date not null,
  reason   text,
  primary key (stay_id, day)
);

-- ══════════════════════════════════════════════════════════════════════════
-- 3) REZERVASYONLAR (stay_bookings) — talep→onay akışı
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists public.stay_bookings (
  id           uuid primary key default gen_random_uuid(),
  stay_id      uuid not null references public.stays(id) on delete cascade,
  guest_id     uuid not null references auth.users(id) on delete cascade,
  check_in     date not null,
  check_out    date not null,
  guests       int  not null default 1 check (guests >= 1),
  nights       int  generated always as ((check_out - check_in)) stored,
  total_price  numeric(12,2),                         -- uygulama hesaplar (nights*price + cleaning)
  currency     text default 'TRY',
  status       text not null default 'requested'
               check (status in ('requested','confirmed','rejected','cancelled','completed')),
  guest_message text check (char_length(coalesce(guest_message,'')) <= 2000),
  host_response text check (char_length(coalesce(host_response,'')) <= 2000),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  check (check_out > check_in)
);
create index if not exists idx_bookings_stay on public.stay_bookings (stay_id, check_in);
create index if not exists idx_bookings_guest on public.stay_bookings (guest_id, created_at desc);

-- ÇİFT-REZERVASYON KİLİDİ: aynı stay için ONAYLI tarih aralıkları ÇAKIŞAMAZ (veritabanı seviyesinde garanti).
do $$ begin
  alter table public.stay_bookings
    add constraint stay_no_overlap
    exclude using gist (
      stay_id with =,
      daterange(check_in, check_out, '[)') with &&
    ) where (status = 'confirmed');
exception when duplicate_object then null; when others then null; end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════════════════
alter table public.stays              enable row level security;
alter table public.stay_blocked_dates enable row level security;
alter table public.stay_bookings      enable row level security;

-- stays: herkes AKTİF ilanı görür · host kendi ilanını ekler (e-posta doğrulu) · host/admin günceller/siler
do $$ begin
  drop policy if exists stays_public_read on public.stays;
  create policy stays_public_read on public.stays for select to anon, authenticated
    using (status = 'active');
  drop policy if exists stays_owner_all_read on public.stays;
  create policy stays_owner_all_read on public.stays for select to authenticated
    using (auth.uid() = owner_id or public.is_admin());
  drop policy if exists stays_owner_insert on public.stays;
  create policy stays_owner_insert on public.stays for insert to authenticated
    with check (auth.uid() = owner_id and public.is_email_verified());
  drop policy if exists stays_owner_update on public.stays;
  create policy stays_owner_update on public.stays for update to authenticated
    using (auth.uid() = owner_id or public.is_admin()) with check (auth.uid() = owner_id or public.is_admin());
  drop policy if exists stays_owner_delete on public.stays;
  create policy stays_owner_delete on public.stays for delete to authenticated
    using (auth.uid() = owner_id or public.is_admin());
exception when others then null; end $$;

-- blocked_dates: herkes okur (müsaitlik göstermek için) · sadece host/admin yazar
do $$ begin
  drop policy if exists blocked_public_read on public.stay_blocked_dates;
  create policy blocked_public_read on public.stay_blocked_dates for select to anon, authenticated using (true);
  drop policy if exists blocked_owner_write on public.stay_blocked_dates;
  create policy blocked_owner_write on public.stay_blocked_dates for all to authenticated
    using (exists (select 1 from public.stays s where s.id = stay_id and (s.owner_id = auth.uid() or public.is_admin())))
    with check (exists (select 1 from public.stays s where s.id = stay_id and (s.owner_id = auth.uid() or public.is_admin())));
exception when others then null; end $$;

-- bookings: misafir KENDİ rezervasyonunu görür/ekler · host KENDİ ilanının rezervasyonunu görür/onaylar · admin hepsi
do $$ begin
  drop policy if exists bookings_guest_read on public.stay_bookings;
  create policy bookings_guest_read on public.stay_bookings for select to authenticated
    using (auth.uid() = guest_id
      or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid())
      or public.is_admin());
  drop policy if exists bookings_guest_insert on public.stay_bookings;
  create policy bookings_guest_insert on public.stay_bookings for insert to authenticated
    with check (auth.uid() = guest_id and public.is_email_verified() and status = 'requested');
  -- host onaylar/reddeder (kendi ilanı) · misafir kendi talebini iptal eder · admin hepsi
  drop policy if exists bookings_update on public.stay_bookings;
  create policy bookings_update on public.stay_bookings for update to authenticated
    using (auth.uid() = guest_id
      or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid())
      or public.is_admin())
    with check (auth.uid() = guest_id
      or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid())
      or public.is_admin());
exception when others then null; end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Storage: ilan fotoğrafları (public okuma, host kendi <uid>/ klasörüne yükler) — marketplace deseni
-- ══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('stay-photos', 'stay-photos', true)
on conflict (id) do nothing;
do $$ begin
  drop policy if exists stay_photos_read on storage.objects;
  create policy stay_photos_read on storage.objects for select to anon, authenticated using (bucket_id = 'stay-photos');
  drop policy if exists stay_photos_insert on storage.objects;
  create policy stay_photos_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'stay-photos' and public.is_email_verified() and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists stay_photos_delete on storage.objects;
  create policy stay_photos_delete on storage.objects for delete to authenticated
    using (bucket_id = 'stay-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
exception when others then null; end $$;
