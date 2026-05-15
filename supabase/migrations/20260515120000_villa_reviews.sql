-- ============================================================================
-- Villa Reviews — villa_id TEXT (villa slugları uuid değil, metin)
-- 2026-05-15
-- ============================================================================

CREATE TABLE public.villa_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id       text NOT NULL,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name  text NOT NULL,
  rating         int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title          text,
  body           text NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  approved_at    timestamptz
);

ALTER TABLE public.villa_reviews ENABLE ROW LEVEL SECURITY;

-- Anonim okuma: sadece onaylanmış yorumlar
CREATE POLICY "villa_reviews_anon_read"
  ON public.villa_reviews
  FOR SELECT
  TO anon
  USING (status = 'approved');

-- Authenticated okuma: kendi yorumlarını da görebilir (pending dahil)
CREATE POLICY "villa_reviews_auth_read"
  ON public.villa_reviews
  FOR SELECT
  TO authenticated
  USING (status = 'approved' OR auth.uid() = user_id);

-- Authenticated insert: sadece kendi adına
CREATE POLICY "villa_reviews_auth_insert"
  ON public.villa_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin tam erişim (app_metadata.role = 'admin')
CREATE POLICY "villa_reviews_admin_all"
  ON public.villa_reviews
  FOR ALL
  TO authenticated
  USING (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  )
  WITH CHECK (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

CREATE INDEX villa_reviews_villa_idx
  ON public.villa_reviews (villa_id, status, created_at DESC);

CREATE INDEX villa_reviews_user_idx
  ON public.villa_reviews (user_id, created_at DESC);
