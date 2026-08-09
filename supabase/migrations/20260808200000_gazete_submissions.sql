-- ═══════════════════════════════════════════════════════════════════════
-- GAZETE TOPLULUK EDİTÖRÜ — kullanıcı içerik önerileri
-- Kullanıcılar (onaylı üye) Kalkan Today / Magazin şablonundaki slot'lara
-- yarınki sayı için içerik önerir → admin onaylar → gazeteye işlenir.
-- Auth: Supabase Auth. Rol app_metadata.role: 'admin' | 'contributor' | (yok).
-- Onaylı üye = admin bir kullanıcıya 'contributor' rolü atar (Edge Fn ile).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.gazete_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  user_email   text,                          -- denormalize (admin listesi için hızlı)
  target_date  date not null,                 -- hangi sayı için (genelde yarın)
  edition      text not null default 'morning'
               check (edition in ('morning','magazine')),
  slot         text not null,                 -- lead / col1 / col3 / magazine_lead / event ...
  fields       jsonb not null default '{}'::jsonb,  -- {headline, deck, body, image, caption}
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  admin_note   text,
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_gazete_sub_status  on public.gazete_submissions (status, target_date);
create index if not exists idx_gazete_sub_user    on public.gazete_submissions (user_id, created_at desc);
create index if not exists idx_gazete_sub_date_ed on public.gazete_submissions (target_date, edition);

alter table public.gazete_submissions enable row level security;

-- Yardımcı: rol app_metadata'dan (kullanıcı değiştiremez → güvenli)
create or replace function public.jwt_role() returns text
language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
  );
$$;

-- CONTRIBUTOR: kendi önerilerini görür + ekler (pending). admin/contributor rolü şart.
drop policy if exists gsub_insert_contributor on public.gazete_submissions;
create policy gsub_insert_contributor on public.gazete_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.jwt_role() in ('admin','contributor')
    and status = 'pending'
  );

drop policy if exists gsub_select_own on public.gazete_submissions;
create policy gsub_select_own on public.gazete_submissions
  for select to authenticated
  using (user_id = auth.uid() or public.jwt_role() = 'admin');

-- Kullanıcı kendi PENDING önerisini düzenleyebilir/silebilir (onaydan önce)
drop policy if exists gsub_update_own_pending on public.gazete_submissions;
create policy gsub_update_own_pending on public.gazete_submissions
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

-- ADMIN: her şeyi yönetir (onay/red/düzenle). Yazma yolu asıl olarak service_role
-- (Edge Fn) üzerinden; bu policy admin JWT'li client için de kapıyı açar.
drop policy if exists gsub_admin_all on public.gazete_submissions;
create policy gsub_admin_all on public.gazete_submissions
  for all to authenticated
  using (public.jwt_role() = 'admin')
  with check (public.jwt_role() = 'admin');

-- Katkıcı başvuru/onay durumu (opsiyonel görünüm): app_metadata.role zaten kaynak.
-- Onaylı üye listesi için basit profil tablosu (admin panelde "üye onayla").
create table if not exists public.gazete_contributors (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  status      text not null default 'pending'  -- pending | approved | blocked
               check (status in ('pending','approved','blocked')),
  applied_at  timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);
alter table public.gazete_contributors enable row level security;

-- Kullanıcı kendi başvuru kaydını görür + oluşturur (pending). admin hepsini görür/yönetir.
drop policy if exists gc_self on public.gazete_contributors;
create policy gc_self on public.gazete_contributors
  for select to authenticated
  using (user_id = auth.uid() or public.jwt_role() = 'admin');

drop policy if exists gc_apply on public.gazete_contributors;
create policy gc_apply on public.gazete_contributors
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists gc_admin on public.gazete_contributors;
create policy gc_admin on public.gazete_contributors
  for all to authenticated
  using (public.jwt_role() = 'admin')
  with check (public.jwt_role() = 'admin');

comment on table public.gazete_submissions is 'Kullanıcıların gazete slot içerik önerileri (topluluk editörü). Admin onayı sonrası yarınki sayıya işlenir.';
comment on table public.gazete_contributors is 'Gazeteye katkı için üye başvuru/onay durumu. Onaylanınca admin app_metadata.role=contributor atar.';
