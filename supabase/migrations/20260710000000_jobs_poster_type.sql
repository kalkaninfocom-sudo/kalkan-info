-- ==============================================================================
-- Jobs: ilan veren tipi (kişi vs işletme)
-- ==============================================================================
-- İlan bireysel biri tarafından mı (ör. eve temizlikçi/bakıcı arayan hane) yoksa
-- bir işletme tarafından mı veriliyor? İlanlar sayfasında rozet + filtre için.
-- Mevcut kayıtlar işveren/işletme kabul edilir → default 'isletme'.
-- ==============================================================================

alter table public.jobs
  add column if not exists poster_type text not null default 'isletme'
    check (poster_type in ('kisi', 'isletme'));

-- Public view'i yeniden oluştur — poster_type'ı anon okumaya dahil et.
-- DROP+CREATE: CREATE OR REPLACE VIEW mevcut kolon sırasının ortasına yeni kolon
-- ekleyemez (poster_type'ı view_count'tan önce koyunca 42P16 "rename" hatası verir).
drop view if exists public.jobs_public;
create view public.jobs_public as
  select
    id, slug, title, category, type, location, employer_name,
    description, description_html, requirements, languages,
    experience, salary_min, salary_max, currency,
    employment_type_iso, content_lang, workplace_type, poster_type,
    view_count, application_count,
    published_at, expires_at, created_at
  from public.jobs
  where status = 'active'
    and (expires_at is null or expires_at > now());

comment on view public.jobs_public is
  'Aktif ve süresi dolmamış iş ilanları. Anon kullanıcılar bu view''den okur.';

grant select on public.jobs_public to anon, authenticated;
