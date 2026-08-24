-- =============================================================================
-- Security: Immutable-field triggers for stays, marketplace_listings, jobs,
--           reviews, stay_bookings + marketplace-photos bucket hardening.
-- Audit findings: HIGH "broken access control" — owner/author can tamper with
-- system-managed fields via direct UPDATE.
--
-- Apply via:  supabase db push
-- (do NOT paste into SQL Editor — functions contain named $dollar$ blocks)
-- Idempotent: CREATE OR REPLACE functions, DROP TRIGGER IF EXISTS before CREATE.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. stays — protect owner_id, is_verified, view_count, created_at
--    Verified columns from 20260824000000_stays.sql:
--      owner_id(uuid), is_verified(boolean), view_count(int), created_at(timestamptz)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_stays_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $stays_imm$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- owner_id: hard error (ownership transfer forbidden)
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'stays.owner_id is immutable';
  END IF;

  -- system-managed fields: silently restore
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    NEW.is_verified := OLD.is_verified;
  END IF;
  IF NEW.view_count IS DISTINCT FROM OLD.view_count THEN
    NEW.view_count := OLD.view_count;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$stays_imm$;

DROP TRIGGER IF EXISTS stays_protect_immutable ON public.stays;
CREATE TRIGGER stays_protect_immutable
  BEFORE UPDATE ON public.stays
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_stays_immutable();


-- ---------------------------------------------------------------------------
-- 2. marketplace_listings — protect owner_id, report_count, view_count, created_at
--    Verified columns from 20260711093000_marketplace.sql:
--      owner_id(uuid), report_count(int), view_count(int), created_at(timestamptz)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_marketplace_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $market_imm$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- owner_id: hard error
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'marketplace_listings.owner_id is immutable';
  END IF;

  -- system-managed fields: silently restore
  IF NEW.report_count IS DISTINCT FROM OLD.report_count THEN
    NEW.report_count := OLD.report_count;
  END IF;
  IF NEW.view_count IS DISTINCT FROM OLD.view_count THEN
    NEW.view_count := OLD.view_count;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$market_imm$;

DROP TRIGGER IF EXISTS marketplace_protect_immutable ON public.marketplace_listings;
CREATE TRIGGER marketplace_protect_immutable
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_marketplace_immutable();


-- ---------------------------------------------------------------------------
-- 3. jobs — protect owner_id, status, view_count, application_count,
--            published_at, created_at
--    Verified columns from 20260513200000_initial_schema.sql + 20260604000000_jobs_hardening.sql:
--      owner_id(uuid), status(job_status enum), view_count(int),
--      application_count(int), published_at(timestamptz), created_at(timestamptz)
--    NOTE: status is restored silently (admin sets it via moderation; owner
--    cannot self-activate). bump_job_view() and expire_old_jobs() run as
--    SECURITY DEFINER so they bypass this trigger via service role context.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_jobs_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $jobs_imm$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- owner_id: hard error
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'jobs.owner_id is immutable';
  END IF;

  -- system-managed fields: silently restore
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.view_count IS DISTINCT FROM OLD.view_count THEN
    NEW.view_count := OLD.view_count;
  END IF;
  IF NEW.application_count IS DISTINCT FROM OLD.application_count THEN
    NEW.application_count := OLD.application_count;
  END IF;
  IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    NEW.published_at := OLD.published_at;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$jobs_imm$;

DROP TRIGGER IF EXISTS jobs_protect_immutable ON public.jobs;
CREATE TRIGGER jobs_protect_immutable
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_jobs_immutable();


-- ---------------------------------------------------------------------------
-- 4. reviews — protect status, helpful, author_id, created_at
--    Verified columns from 20260513200000_initial_schema.sql:
--      status(review_status enum), helpful(int), author_id(uuid),
--      created_at(timestamptz)
--    Author MAY still edit text and rating (not protected here).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_reviews_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $reviews_imm$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- author_id: hard error (review ownership transfer forbidden)
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'reviews.author_id is immutable';
  END IF;

  -- system-managed fields: silently restore
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.helpful IS DISTINCT FROM OLD.helpful THEN
    NEW.helpful := OLD.helpful;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$reviews_imm$;

DROP TRIGGER IF EXISTS reviews_protect_immutable ON public.reviews;
CREATE TRIGGER reviews_protect_immutable
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_reviews_immutable();


-- ---------------------------------------------------------------------------
-- 5. stay_bookings — protect total_price, nights, currency, guests on UPDATE
--    (existing trg_stay_booking_price only fires on INSERT; a host could
--    UPDATE total_price to 0 or change nights/currency post-booking).
--    Verified columns from 20260824000000_stays.sql:
--      total_price(numeric), nights(int), currency(text), guests(int),
--      status(text) — status intentionally NOT protected here; host updates
--      status to confirmed/rejected/completed via bookings_host_manage policy.
--    guest_id is protected (booking ownership immutable).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_stay_bookings_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $bookings_imm$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- guest_id: hard error
  IF NEW.guest_id IS DISTINCT FROM OLD.guest_id THEN
    RAISE EXCEPTION 'stay_bookings.guest_id is immutable';
  END IF;

  -- financial/core booking fields: silently restore to prevent tampering
  IF NEW.total_price IS DISTINCT FROM OLD.total_price THEN
    NEW.total_price := OLD.total_price;
  END IF;
  IF NEW.nights IS DISTINCT FROM OLD.nights THEN
    NEW.nights := OLD.nights;
  END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    NEW.currency := OLD.currency;
  END IF;
  IF NEW.guests IS DISTINCT FROM OLD.guests THEN
    NEW.guests := OLD.guests;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$bookings_imm$;

DROP TRIGGER IF EXISTS stay_bookings_protect_immutable ON public.stay_bookings;
CREATE TRIGGER stay_bookings_protect_immutable
  BEFORE UPDATE ON public.stay_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_stay_bookings_immutable();


-- ---------------------------------------------------------------------------
-- 6. marketplace-photos bucket — add file size + MIME type limits
--    (mirrors stay-photos pattern from 20260824000000_stays.sql)
--    8 MB limit, JPEG/PNG/WebP only.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
  VALUES ('marketplace-photos', 'marketplace-photos', true)
  ON CONFLICT (id) DO UPDATE
    SET file_size_limit    = 8388608,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];


-- ---------------------------------------------------------------------------
-- 7. increment_marketplace_view RPC (audit M5)
--    Atomic server-side view counter increment — prevents client-side spoofing.
--    Caller passes listing id; function increments view_count bypassing the
--    immutable-field trigger via SECURITY DEFINER (runs as owner, not caller).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_marketplace_view(p_listing_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $market_view$
BEGIN
  UPDATE public.marketplace_listings
    SET view_count = view_count + 1
    WHERE id = p_listing_id
      AND status = 'active';
END;
$market_view$;

-- Grant to authenticated + anon so the client JS can call it via RPC
GRANT EXECUTE ON FUNCTION public.increment_marketplace_view(uuid) TO anon, authenticated;
