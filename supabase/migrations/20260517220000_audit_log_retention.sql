-- ============================================================================
-- audit_log PII Retention (B5-ek — KVKK 6698)
-- ----------------------------------------------------------------------------
-- audit_log tablosu actor_email (PII) ve ip (inet) saklıyor. KVKK 6698 + 5651
-- gereği maksimum 2 yıl. Pratik retention: 90 gün (operasyonel + denetim
-- penceresi için yeterli, KVKK ilkesi: gerektiği kadar uzun).
--
-- Strateji: pg_cron extension ile günlük temizlik. Eğer pg_cron yoksa
-- (Free tier'da devre dışı olabilir), Supabase scheduled Edge Function
-- alternatifi bu dosyanın altında açıklanır.
--
-- NOT: Bu migration audit_log tablosuna ALTER yapmaz — sadece purge job ekler.
-- ============================================================================

-- 1. pg_cron extension (Supabase Pro+ otomatik var; Free için Dashboard'dan enable)
--    Supabase Dashboard → Database → Extensions → pg_cron → Enable
create extension if not exists pg_cron;

-- 2. Idempotent setup: varsa önce kaldır, sonra yeniden ekle
--    (migration ikinci kez çalıştırılırsa duplicate error'u önler)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'audit_log_purge_daily') then
    perform cron.unschedule('audit_log_purge_daily');
  end if;
end;
$$;

-- 3. Daily purge job: 90 günden eski audit_log satırlarını sil
--    Zamanlama: her gün 03:00 UTC = 06:00 TRT (düşük trafik saati)
select cron.schedule(
  'audit_log_purge_daily',
  '0 3 * * *',
  $$delete from public.audit_log where created_at < now() - interval '90 days'$$
);

comment on extension pg_cron is
  'KVKK retention: audit_log 90 gün sonra otomatik purge (job: audit_log_purge_daily, 03:00 UTC daily).';

-- ============================================================================
-- ALTERNATIF: pg_cron yoksa (Free tier / extension devre dışı)
-- ----------------------------------------------------------------------------
-- Seçenek A — Supabase Scheduled Edge Function:
--   supabase/functions/audit-purge/index.ts  →  cron: "0 3 * * *"
--   SQL: DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'
--   Aktifleştirme: Supabase Dashboard → Edge Functions → Schedules → Add
--
-- Seçenek B — Vercel Cron (vercel.json):
--   { "crons": [{ "path": "/api/cron/audit-purge", "schedule": "0 3 * * *" }] }
--   Route: supabase service_role ile yukarıdaki DELETE sorgusunu çalıştırır
--
-- Seçenek C — Manuel (geçici):
--   psql $DATABASE_URL -c "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'"
--   Her ay KVKKGuardian agent retention check'inde tetiklenir.
-- ============================================================================
