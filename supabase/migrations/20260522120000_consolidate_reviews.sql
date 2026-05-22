-- Consolidate reviews into a single universal table.
-- Before: 13 May initial schema had `reviews(target_kind, target_id, ...)` keyed
-- to ENUM('listing','provider','vacation'); 15 May added a separate
-- `villa_reviews`. Both tables are EMPTY in production (count check 22 May 2026).
-- After: a single `reviews(entity_type, entity_id, ...)` table supports
-- villa / restaurant / beach / tour / service / ancient_city / event reviews.
-- Provider rating cache columns are left in place but no longer auto-updated
-- by trigger; recompute via the `reviews_aggregate` view if needed.

BEGIN;

-- 1. Drop the old reviews trigger & helper function (cascade to old reviews).
DROP FUNCTION IF EXISTS public.refresh_provider_rating() CASCADE;

-- 2. Drop the old reviews tables (already empty, safe).
DROP TABLE IF EXISTS public.villa_reviews CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;

-- 3. Drop the now-orphan ENUM types.
DROP TYPE IF EXISTS public.review_target_kind;
DROP TYPE IF EXISTS public.review_status;

-- 4. Re-create the universal reviews table (same as 20260520010000 migration).
CREATE TABLE public.reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL CHECK (entity_type IN ('villa','restaurant','beach','tour','service','ancient_city','event')),
  entity_id     text NOT NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name   text,
  author_email  text,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         text,
  body          text,
  language      text DEFAULT 'tr' CHECK (language IN ('tr','en','de','ru','fr')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','spam')),
  ip_hash       text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_entity ON public.reviews (entity_type, entity_id, status, created_at DESC);
CREATE INDEX idx_reviews_user   ON public.reviews (user_id, created_at DESC);
CREATE INDEX idx_reviews_status ON public.reviews (status, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anon can read approved reviews
CREATE POLICY "reviews_anon_read_approved" ON public.reviews
  FOR SELECT TO anon
  USING (status = 'approved');

-- Authenticated users can read approved + their own (any status)
CREATE POLICY "reviews_auth_read" ON public.reviews
  FOR SELECT TO authenticated
  USING (status = 'approved' OR user_id = auth.uid());

-- Anon can submit pending reviews (rate-limited by IP via edge function)
CREATE POLICY "reviews_anon_insert" ON public.reviews
  FOR INSERT TO anon
  WITH CHECK (
    status = 'pending'
    AND rating BETWEEN 1 AND 5
    AND (body IS NULL OR char_length(body) BETWEEN 5 AND 2000)
    AND (title IS NULL OR char_length(title) <= 200)
  );

-- Authenticated users can submit pending reviews (better trust)
CREATE POLICY "reviews_auth_insert" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND rating BETWEEN 1 AND 5
  );

-- Authenticated users can update their own pending reviews
CREATE POLICY "reviews_auth_update_own" ON public.reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Admin all (RLS via app_metadata.role)
CREATE POLICY "reviews_admin_all" ON public.reviews
  FOR ALL TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.reviews_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_set_updated_at();

-- Aggregate rating view (for AggregateRating JSON-LD)
CREATE OR REPLACE VIEW public.reviews_aggregate AS
SELECT
  entity_type,
  entity_id,
  COUNT(*)                       AS review_count,
  ROUND(AVG(rating)::numeric, 2) AS rating_avg
FROM public.reviews
WHERE status = 'approved'
GROUP BY entity_type, entity_id;

GRANT SELECT ON public.reviews_aggregate TO anon, authenticated;

COMMENT ON TABLE public.reviews IS 'Universal review storage for villa/restaurant/beach/tour/service/ancient_city/event';
COMMENT ON VIEW public.reviews_aggregate IS 'Approved review aggregates — used by AggregateRating JSON-LD on detail pages';

COMMIT;
