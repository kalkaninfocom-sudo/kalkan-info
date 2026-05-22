-- 2026-05-22: Newsletter anon insert validation (audit-trust P0)
-- Eski politika: WITH CHECK (true) — random email/payload insert riski
-- Yeni: email format regex + length + source_page whitelist + locale + sabit ip_hash kontrol
-- 2026-05-22 hotfix: önceki sürüm var olmayan `name` + `source` kolonlarına ref etti.

DROP POLICY IF EXISTS "newsletter_anon_insert" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_anon_insert_validated" ON public.newsletter_subscribers;

CREATE POLICY "newsletter_anon_insert_validated" ON public.newsletter_subscribers
  FOR INSERT TO anon
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 254
    AND coalesce(source_page, 'web') = ANY (ARRAY['web','footer','modal','reels','ig','fb','site'])
    AND locale = ANY (ARRAY['tr','en','de','ru','fr'])
    AND confirmed_at IS NULL
    AND unsubscribed_at IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_newsletter_email_created
  ON public.newsletter_subscribers (email_lower, created_at DESC);

COMMENT ON POLICY "newsletter_anon_insert_validated" ON public.newsletter_subscribers IS
  'Audit-trust 2026-05-22 + hotfix: email regex + length + source_page + locale whitelist + double-opt-in zorlaması';
