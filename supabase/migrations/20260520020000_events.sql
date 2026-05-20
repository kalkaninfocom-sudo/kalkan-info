-- Etkinlik takvimi — festival, konser, pazar, spor, kültür
-- Faz 3.F — 5 dilde i18n (jsonb), anon read published, admin all.

CREATE TABLE IF NOT EXISTS public.events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  title         jsonb NOT NULL,           -- {tr, en, de, ru, fr}
  description   jsonb NOT NULL,           -- {tr, en, de, ru, fr}
  start_at      timestamptz NOT NULL,
  end_at        timestamptz,
  location      text,
  location_url  text,
  image         text,
  category      text CHECK (category IN ('festival','concert','market','sport','culture','food','other')),
  organizer     text,
  ticket_url    text,
  is_free       boolean DEFAULT false,
  status        text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_start_status ON public.events (status, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_category     ON public.events (category, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug         ON public.events (slug);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anon read published events
DROP POLICY IF EXISTS "events_anon_read_published" ON public.events;
CREATE POLICY "events_anon_read_published" ON public.events
  FOR SELECT TO anon
  USING (status = 'published');

DROP POLICY IF EXISTS "events_auth_read_published" ON public.events;
CREATE POLICY "events_auth_read_published" ON public.events
  FOR SELECT TO authenticated
  USING (status = 'published');

-- Admin all
DROP POLICY IF EXISTS "events_admin_all" ON public.events;
CREATE POLICY "events_admin_all" ON public.events
  FOR ALL TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.events_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_set_updated_at();

COMMENT ON TABLE public.events IS 'Kalkan/Kaş etkinlik takvimi — festival/konser/pazar/spor/kültür, 5 dil';
