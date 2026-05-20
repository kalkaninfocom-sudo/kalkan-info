-- Partner başvuruları (Pricing page'den gelen Basic/Premium/Featured başvurular)
-- Faz 3.A — Public anon insert, admin all read/update.

CREATE TABLE IF NOT EXISTS public.partner_applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan          text NOT NULL CHECK (plan IN ('basic','premium','featured')),
  business_name text NOT NULL,
  contact_name  text NOT NULL,
  email         text NOT NULL,
  phone         text,
  category      text,
  website       text,
  instagram     text,
  message       text,
  source        text DEFAULT 'pricing-page',
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','approved','rejected')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_apps_status ON public.partner_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_apps_plan   ON public.partner_applications (plan, created_at DESC);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application
DROP POLICY IF EXISTS "partner_apps_anon_insert" ON public.partner_applications;
CREATE POLICY "partner_apps_anon_insert" ON public.partner_applications
  FOR INSERT TO anon
  WITH CHECK (
    char_length(business_name) BETWEEN 2 AND 200
    AND char_length(contact_name) BETWEEN 2 AND 100
    AND email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  );

-- Authenticated users can submit too (logged-in business owners)
DROP POLICY IF EXISTS "partner_apps_auth_insert" ON public.partner_applications;
CREATE POLICY "partner_apps_auth_insert" ON public.partner_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    char_length(business_name) BETWEEN 2 AND 200
    AND char_length(contact_name) BETWEEN 2 AND 100
    AND email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  );

-- Admin can read/update/delete all
DROP POLICY IF EXISTS "partner_apps_admin_all" ON public.partner_applications;
CREATE POLICY "partner_apps_admin_all" ON public.partner_applications
  FOR ALL TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.partner_apps_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_apps_updated_at ON public.partner_applications;
CREATE TRIGGER partner_apps_updated_at
  BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.partner_apps_set_updated_at();

COMMENT ON TABLE public.partner_applications IS 'Pricing page işletme paketleri başvuruları — Basic/Premium/Featured';
