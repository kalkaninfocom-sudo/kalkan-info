-- 2026-05-22: Newsletter anon insert validation (audit-trust P0)
-- Eski politika: WITH CHECK (true) — random email/payload insert riski
-- Yeni: email format regex + length + source whitelist

DROP POLICY IF EXISTS "newsletter_anon_insert" ON public.newsletter_subscribers;

CREATE POLICY "newsletter_anon_insert_validated" ON public.newsletter_subscribers
  FOR INSERT TO anon
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 254
    AND length(coalesce(name, '')) <= 80
    AND coalesce(source, 'web') = ANY (ARRAY['web','footer','modal','reels','ig','fb'])
  );

CREATE INDEX IF NOT EXISTS idx_newsletter_email_created
  ON public.newsletter_subscribers (email, created_at DESC);

COMMENT ON POLICY "newsletter_anon_insert_validated" ON public.newsletter_subscribers IS
  'Audit-trust 2026-05-22: email regex + length + source whitelist';
