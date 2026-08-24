-- Kalkan Info — KONAKLAMA / KİRALAMA (stays) — oda→daire→bina kiralama marketplace'i
-- CouchSurfing yelpazesi (oda→tüm bina) + Airbnb modeli (ücretli, talep→onay).
-- Client-side supabase-js ile çalışır (YENİ Vercel api/ fonksiyonu YOK). marketplace_listings ikizi.
-- Yardımcılar mevcut: public.is_email_verified(), public.is_admin().
-- NOT: Dashboard SQL Editor kopya-yapıştırında bozulmasın diye $$ blok ve generated column KULLANILMADI (düz komut).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;   -- çift-rezervasyon önleme (exclusion constraint) için

-- 1) İLANLAR
create table if not exists public.stays (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
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
  amenities      text[] default '{}',
  location       text,
  neighborhood   text,
  lat            numeric,
  lng            numeric,
  images         text[] default '{}',
  house_rules    text,
  description    text check (char_length(coalesce(description,'')) <= 5000),
  instant_book   boolean default false,
  available_from date,
  available_to   date,
  contact_whatsapp text,
  status         text not null default 'active' check (status in ('active','pending','paused','removed')),
  is_verified    boolean default false,
  view_count     int default 0,
  created_at     timestamptz default now(),
  published_at   timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_stays_status on public.stays (status, published_at desc);
create index if not exists idx_stays_type on public.stays (listing_type);
create index if not exists idx_stays_owner on public.stays (owner_id);
create index if not exists idx_stays_location on public.stays (location);

-- 2) MANUEL KAPALI GÜNLER
create table if not exists public.stay_blocked_dates (
  stay_id  uuid not null references public.stays(id) on delete cascade,
  day      date not null,
  reason   text,
  primary key (stay_id, day)
);

-- 3) REZERVASYONLAR (talep→onay). nights uygulama katmanında hesaplanır.
create table if not exists public.stay_bookings (
  id            uuid primary key default gen_random_uuid(),
  stay_id       uuid not null references public.stays(id) on delete cascade,
  guest_id      uuid not null references auth.users(id) on delete cascade,
  check_in      date not null,
  check_out     date not null,
  guests        int not null default 1,
  nights        int,
  total_price   numeric(12,2),
  currency      text default 'TRY',
  status        text not null default 'requested',
  guest_message text,
  host_response text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_bookings_stay on public.stay_bookings (stay_id, check_in);
create index if not exists idx_bookings_guest on public.stay_bookings (guest_id, created_at desc);

-- ÇİFT-REZERVASYON KİLİDİ: aynı stay için ONAYLI tarih aralıkları çakışamaz (DB seviyesinde garanti).
alter table public.stay_bookings drop constraint if exists stay_no_overlap;
alter table public.stay_bookings add constraint stay_no_overlap exclude using gist (stay_id with =, daterange(check_in, check_out, '[)') with &&) where (status = 'confirmed');

-- FİYAT SUNUCUDA HESAPLANIR (client'a GÜVENME): total_price + nights her zaman stays'ten türetilir.
-- Kötü niyetli misafir total_price:0 gönderse bile trigger üzerine yazar. (NOT: db push ile uygula, elle paste değil — $ blok.)
create or replace function public.stay_booking_price() returns trigger language plpgsql as $stay_price$
declare s record;
begin
  select price_per_night, cleaning_fee into s from public.stays where id = new.stay_id;
  new.nights := greatest((new.check_out - new.check_in), 0);
  new.total_price := coalesce(s.price_per_night, 0) * new.nights + coalesce(s.cleaning_fee, 0);
  new.currency := 'TRY';
  return new;
end
$stay_price$;
drop trigger if exists trg_stay_booking_price on public.stay_bookings;
create trigger trg_stay_booking_price before insert on public.stay_bookings for each row execute function public.stay_booking_price();

-- RLS
alter table public.stays              enable row level security;
alter table public.stay_blocked_dates enable row level security;
alter table public.stay_bookings      enable row level security;

drop policy if exists stays_public_read on public.stays;
create policy stays_public_read on public.stays for select to anon, authenticated using (status = 'active');
drop policy if exists stays_owner_all_read on public.stays;
create policy stays_owner_all_read on public.stays for select to authenticated using (auth.uid() = owner_id or public.is_admin());
drop policy if exists stays_owner_insert on public.stays;
create policy stays_owner_insert on public.stays for insert to authenticated with check (auth.uid() = owner_id and public.is_email_verified());
drop policy if exists stays_owner_update on public.stays;
create policy stays_owner_update on public.stays for update to authenticated using (auth.uid() = owner_id or public.is_admin()) with check (auth.uid() = owner_id or public.is_admin());
drop policy if exists stays_owner_delete on public.stays;
create policy stays_owner_delete on public.stays for delete to authenticated using (auth.uid() = owner_id or public.is_admin());

drop policy if exists blocked_public_read on public.stay_blocked_dates;
create policy blocked_public_read on public.stay_blocked_dates for select to anon, authenticated using (true);
drop policy if exists blocked_owner_write on public.stay_blocked_dates;
create policy blocked_owner_write on public.stay_blocked_dates for all to authenticated using (exists (select 1 from public.stays s where s.id = stay_id and (s.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.stays s where s.id = stay_id and (s.owner_id = auth.uid() or public.is_admin())));

drop policy if exists bookings_guest_read on public.stay_bookings;
create policy bookings_guest_read on public.stay_bookings for select to authenticated using (auth.uid() = guest_id or exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()) or public.is_admin());
drop policy if exists bookings_guest_insert on public.stay_bookings;
create policy bookings_guest_insert on public.stay_bookings for insert to authenticated with check (auth.uid() = guest_id and public.is_email_verified() and status = 'requested' and not exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()));
-- UPDATE: misafir yalnız KENDİ talebini İPTAL eder (self-confirm ENGELLİ) · host onaylar/reddeder/tamamlar · admin hepsi.
drop policy if exists bookings_update on public.stay_bookings;
drop policy if exists bookings_guest_cancel on public.stay_bookings;
create policy bookings_guest_cancel on public.stay_bookings for update to authenticated using (auth.uid() = guest_id) with check (auth.uid() = guest_id and status = 'cancelled');
drop policy if exists bookings_host_manage on public.stay_bookings;
create policy bookings_host_manage on public.stay_bookings for update to authenticated using (exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()) or public.is_admin()) with check ((exists (select 1 from public.stays s where s.id = stay_id and s.owner_id = auth.uid()) and status in ('confirmed','rejected','completed')) or public.is_admin());

-- Storage: ilan fotoğrafları (public okuma, host kendi <uid>/ klasörüne yükler)
insert into storage.buckets (id, name, public) values ('stay-photos', 'stay-photos', true) on conflict (id) do nothing;
update storage.buckets set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'stay-photos';
drop policy if exists stay_photos_read on storage.objects;
create policy stay_photos_read on storage.objects for select to anon, authenticated using (bucket_id = 'stay-photos');
drop policy if exists stay_photos_insert on storage.objects;
create policy stay_photos_insert on storage.objects for insert to authenticated with check (bucket_id = 'stay-photos' and public.is_email_verified() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists stay_photos_delete on storage.objects;
create policy stay_photos_delete on storage.objects for delete to authenticated using (bucket_id = 'stay-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
