-- ============================================================================
-- Admin Claim Helper View + Doğrulama (T2.5 — admin auth refactor)
-- ----------------------------------------------------------------------------
-- Mevcut migrationlar ZATEN admin pattern'ini kuruyor:
--   • public.is_admin() helper        — auth.jwt()->'app_metadata'->>'role'='admin'
--   • RLS policy'ler ilgili tablolarda — listings, providers, jobs, news_items,
--                                        mail_queue, audit_log, vacation_requests,
--                                        automations vb.
--
-- Bu migration eklenenler:
--   1. public.admin_users — admin claim'i set edilmiş auth.users'a okunabilir view
--   2. is_admin_user(uid) — uid bazlı admin kontrolü (auth.jwt() yoksa kullanım)
--   3. Doğrulama: kritik tablolarda admin RLS policy'lerinin varlığını test eder.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. public.admin_users — sadece role='admin' kullanıcıları listeleyen view
--    Admin panelinden "kim admin?" sorgusu için. RLS uygulanır.
-- ---------------------------------------------------------------------------
create or replace view public.admin_users
with (security_invoker = true)
as
  select
    u.id,
    u.email,
    u.created_at,
    u.raw_app_meta_data->>'role' as role
  from auth.users u
  where (u.raw_app_meta_data->>'role') = 'admin';

comment on view public.admin_users is
  'Admin claim atanmış kullanıcılar. raw_app_meta_data->>''role''=''admin'' eşleşir. SADECE is_admin() okuyabilir.';

-- View'a sadece adminlerin erişebilmesi için RLS bypass YOK; client'a okuma izni vermiyoruz.
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to service_role;

-- ---------------------------------------------------------------------------
-- 2. is_admin_user(uid) — uid bazlı kontrol (server-side için)
--    api/job-decision.js gibi service_role ile çalışan endpoint'ler için.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin_user(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_uid
      and (u.raw_app_meta_data->>'role') = 'admin'
  );
$$;

comment on function public.is_admin_user(uuid) is
  'uid verilen kullanıcı admin mi? api/job-decision.js gibi server-side rotalar için.';

-- ---------------------------------------------------------------------------
-- 3. Mevcut admin RLS policy'lerini DOĞRULA — eksik varsa hata fırlat
--    Bu migration var olan policy'leri DEĞİŞTİRMEZ, sadece varlığı denetler.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text[] := '{}';
  v_checks text[][] := array[
    array['public','jobs',             'jobs_owner_update'],
    array['public','mail_queue',       'mail_admin_only'],
    array['public','audit_log',        'audit_admin_write'],
    array['public','vacation_requests','vacations_owner_update']
  ];
  v_row text[];
begin
  foreach v_row slice 1 in array v_checks loop
    if not exists (
      select 1 from pg_policies
      where schemaname = v_row[1]
        and tablename  = v_row[2]
        and policyname = v_row[3]
    ) then
      v_missing := array_append(v_missing,
        format('%s.%s::%s', v_row[1], v_row[2], v_row[3]));
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise exception 'Admin RLS doğrulaması başarısız — eksik policy''ler: %', v_missing;
  end if;
end;
$$;

-- ============================================================================
-- MANUEL ADMIN ATAMA (migration dışında çalıştır — Supabase Dashboard SQL Editor)
-- ----------------------------------------------------------------------------
-- Berkay'a admin claim ata:
--
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                              || '{"role":"admin"}'::jsonb
--    where email = 'kalkaninfo.com@gmail.com';
--
-- Alternatif (Dashboard UI): Authentication → Users → kullanıcıyı seç →
--   "User App Metadata" alanına {"role":"admin"} ekle → Save.
--
-- Doğrulama:
--   select id, email, raw_app_meta_data->>'role' as role
--     from auth.users
--    where (raw_app_meta_data->>'role') = 'admin';
-- ============================================================================
