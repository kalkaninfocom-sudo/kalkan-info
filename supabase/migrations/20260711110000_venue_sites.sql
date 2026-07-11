-- Kalkan Info — İşletme siteleri mini-CMS (admin panelli grounded siteler için içerik deposu)
-- Site içeriği (hakkında/menü/saatler/iletişim) burada tutulur; site public okur, sahip/admin düzenler.
-- Client-side supabase-js ile calisir (yeni Vercel api/ YOK). marketplace/jobs deseninin ikizi.

create table if not exists public.venue_sites (
  slug        text primary key,
  owner_id    uuid references auth.users(id) on delete set null,
  name        text,
  content     jsonb not null default '{}'::jsonb,  -- {about, menu:[{cat,items:[{name,price,desc}]}], hours:[{d,h}], phone, whatsapp, instagram, tagline}
  published   boolean default true,
  updated_at  timestamptz default now()
);

create index if not exists idx_venue_sites_owner on public.venue_sites (owner_id);

alter table public.venue_sites enable row level security;

-- Herkes yayınlanmış site içeriğini okur (site bunu fetch eder)
do $$ begin
  drop policy if exists venue_sites_public_read on public.venue_sites;
  create policy venue_sites_public_read on public.venue_sites
    for select to anon, authenticated
    using (published = true);
exception when others then null; end $$;

-- Sahip VEYA admin ekler (upsert icin insert)
do $$ begin
  drop policy if exists venue_sites_owner_insert on public.venue_sites;
  create policy venue_sites_owner_insert on public.venue_sites
    for insert to authenticated
    with check (public.is_admin() or auth.uid() = owner_id);
exception when others then null; end $$;

-- Sahip VEYA admin gunceller
do $$ begin
  drop policy if exists venue_sites_owner_update on public.venue_sites;
  create policy venue_sites_owner_update on public.venue_sites
    for update to authenticated
    using (public.is_admin() or auth.uid() = owner_id)
    with check (public.is_admin() or auth.uid() = owner_id);
exception when others then null; end $$;

do $$ begin
  drop policy if exists venue_sites_admin_delete on public.venue_sites;
  create policy venue_sites_admin_delete on public.venue_sites
    for delete to authenticated
    using (public.is_admin());
exception when others then null; end $$;
