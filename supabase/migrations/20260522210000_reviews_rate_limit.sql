-- 2026-05-22: Reviews rate-limit pg trigger
-- audit-backend P2-16: anon review insert rate-limit. 1/dk + 10/saat IP_hash bazlı.
CREATE OR REPLACE FUNCTION public.reviews_rate_limit_check()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  recent_count int;
BEGIN
  IF NEW.ip_hash IS NULL THEN
    RETURN NEW;
  END IF;
  -- 1 dakika içinde aynı IP'den 1 review max
  SELECT count(*) INTO recent_count
    FROM public.reviews
   WHERE ip_hash = NEW.ip_hash
     AND created_at > now() - interval '1 minute';
  IF recent_count >= 1 THEN
    RAISE EXCEPTION 'rate_limit_minute' USING ERRCODE = '23P01';
  END IF;
  -- 1 saat içinde aynı IP'den 10 review max
  SELECT count(*) INTO recent_count
    FROM public.reviews
   WHERE ip_hash = NEW.ip_hash
     AND created_at > now() - interval '1 hour';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limit_hour' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_rate_limit ON public.reviews;
CREATE TRIGGER trg_reviews_rate_limit
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_rate_limit_check();

COMMENT ON FUNCTION public.reviews_rate_limit_check() IS
  '2026-05-22 audit-backend P2-16: anon review insert rate-limit. 1/dk + 10/saat IP_hash bazlı.';
