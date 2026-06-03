-- ==============================================================================
-- Jobs hardening — 10 yıl operasyonel için profesyonel iş ilanı altyapısı
-- ==============================================================================
-- 1. description (plain text) — JobPosting JSON-LD için
-- 2. tsvector full-text search column + trigger + index
-- 3. employment_type_iso — Google Jobs JobPosting employmentType mapping
-- 4. bump_job_view() — anonim view sayacı
-- 5. expire_old_jobs() — günlük cron'la çağrılır
-- 6. job_views tablosu — light analytics (anon)
-- ==============================================================================

-- 1. Plain text description (HTML strip edilmiş, JobPosting için)
alter table public.jobs
  add column if not exists description text check (description is null or length(description) <= 10000);

-- 2. ISO employment type mapping (Google Jobs schema)
alter table public.jobs
  add column if not exists employment_type_iso text generated always as (
    case type
      when 'full'       then 'FULL_TIME'
      when 'part'       then 'PART_TIME'
      when 'seasonal'   then 'TEMPORARY'
      when 'freelance'  then 'CONTRACTOR'
      else 'OTHER'
    end
  ) stored;

-- 3. Language tag (içerik dili — i18n için)
alter table public.jobs
  add column if not exists content_lang text not null default 'tr' check (content_lang in ('tr','en','de','ru','ar','fr'));

-- 4. Full-text search column (Turkish + simple config)
alter table public.jobs
  add column if not exists search_vec tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(employer_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(location, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'D')
  ) stored;

create index if not exists jobs_search_idx on public.jobs using gin (search_vec);

-- 5. Remote / hybrid çalışma desteği
alter table public.jobs
  add column if not exists workplace_type text not null default 'on_site'
    check (workplace_type in ('on_site', 'remote', 'hybrid'));

-- 6. View tracking — anonim, hash'lenmiş IP
create table if not exists public.job_views (
  id          bigserial primary key,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  visitor_hash text not null,
  referer     text,
  ua_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists job_views_job_idx on public.job_views (job_id, created_at desc);
create index if not exists job_views_dedup_idx on public.job_views (job_id, visitor_hash, created_at desc);

alter table public.job_views enable row level security;
-- service_role-only, anon erişimi yok

-- 7. View bump function — günde bir kez unique visitor sayar
create or replace function public.bump_job_view(
  p_job_id uuid,
  p_visitor_hash text,
  p_referer text default null,
  p_ua_hash text default null
)
returns void
language plpgsql
security definer
as $$
declare
  recent_count int;
begin
  -- 6 saat içinde aynı visitor sayılmaz
  select count(*) into recent_count
  from public.job_views
  where job_id = p_job_id
    and visitor_hash = p_visitor_hash
    and created_at > now() - interval '6 hours';

  if recent_count > 0 then
    return;
  end if;

  insert into public.job_views (job_id, visitor_hash, referer, ua_hash)
  values (p_job_id, p_visitor_hash, p_referer, p_ua_hash);

  update public.jobs
  set view_count = view_count + 1
  where id = p_job_id;
end;
$$;

-- 8. Otomatik süresi dolan ilanları kapat
create or replace function public.expire_old_jobs()
returns integer
language plpgsql
security definer
as $$
declare
  expired_count integer;
begin
  update public.jobs
  set status = 'closed'
  where status = 'active'
    and expires_at is not null
    and expires_at < now();
  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- 9. Default expiry — eğer expires_at verilmemişse, published_at + 60 gün
create or replace function public.set_default_job_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' and new.published_at is not null and new.expires_at is null then
    new.expires_at := new.published_at + interval '60 days';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_default_expiry on public.jobs;
create trigger jobs_default_expiry
  before update on public.jobs
  for each row
  when (new.status = 'active' and old.status <> 'active')
  execute function public.set_default_job_expiry();

-- 10. Public listing view — RLS'siz fast read için (sadece active jobs)
create or replace view public.jobs_public as
  select
    id, slug, title, category, type, location, employer_name,
    description, description_html, requirements, languages,
    experience, salary_min, salary_max, currency,
    employment_type_iso, content_lang, workplace_type,
    view_count, application_count,
    published_at, expires_at, created_at
  from public.jobs
  where status = 'active'
    and (expires_at is null or expires_at > now());

comment on view public.jobs_public is
  'Aktif ve süresi dolmamış iş ilanları. Anon kullanıcılar bu view''den okur.';

-- 11. RLS — anon kullanıcı SADECE jobs_public'i select edebilir
grant select on public.jobs_public to anon, authenticated;

-- jobs tablosu için anon SELECT politikası (status='active' olanlar)
do $$ begin
  drop policy if exists "jobs_public_read" on public.jobs;
  create policy "jobs_public_read"
    on public.jobs
    for select
    to anon, authenticated
    using (status = 'active' and (expires_at is null or expires_at > now()));
exception when others then null; end $$;
