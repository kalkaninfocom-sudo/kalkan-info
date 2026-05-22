-- 2026-05-22: Booking inquiry tablosu — villa/tur/event ön rezervasyon
-- iyzico onayı + ödeme entegrasyonu sonrası genişletilecek
-- Push manuel: supabase db push (Berkay)

CREATE TABLE IF NOT EXISTS public.booking_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL CHECK (entity_type IN ('villa','tour','restaurant','transfer','event')),
  entity_id       text NOT NULL,
  guest_name      text NOT NULL,
  guest_email     text NOT NULL,
  guest_phone     text,
  party_size      smallint CHECK (party_size BETWEEN 1 AND 50),
  check_in        date,
  check_out       date,
  message         text,
  source          text DEFAULT 'web' CHECK (source IN ('web','whatsapp','concierge','ig','referral')),
  utm_campaign    text,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','confirmed','cancelled','expired')),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_id      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_status_created
  ON public.booking_inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_entity
  ON public.booking_inquiries (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_booking_email
  ON public.booking_inquiries (guest_email);

ALTER TABLE public.booking_inquiries ENABLE ROW LEVEL SECURITY;

-- Anon insert (validated)
CREATE POLICY "booking_anon_insert" ON public.booking_inquiries
  FOR INSERT TO anon
  WITH CHECK (
    guest_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(guest_email) <= 254
    AND length(guest_name) BETWEEN 1 AND 80
    AND length(coalesce(message, '')) <= 2000
    AND coalesce(party_size, 1) <= 50
  );

-- Auth user kendi inquiry'lerini görür
CREATE POLICY "booking_auth_own_select" ON public.booking_inquiries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Auth user kendi inquiry'lerini günceller (sadece message/check_in/check_out)
CREATE POLICY "booking_auth_own_update" ON public.booking_inquiries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('new','cancelled'));

-- Admin tüm yetkiler
CREATE POLICY "booking_admin_all" ON public.booking_inquiries
  FOR ALL TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

-- Partner kendi entity_id'sine ait inquiry'leri görür (partner_id eşleşmesi)
CREATE POLICY "booking_partner_own_select" ON public.booking_inquiries
  FOR SELECT TO authenticated
  USING (
    partner_id = auth.uid()
    AND coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'partner', false)
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_booking_inquiries_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_inquiries_updated_at ON public.booking_inquiries;
CREATE TRIGGER trg_booking_inquiries_updated_at
  BEFORE UPDATE ON public.booking_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_booking_inquiries_updated_at();

COMMENT ON TABLE public.booking_inquiries IS
  '2026-05-22 booking ön rezervasyon. iyzico merchant onayı sonrası ödeme akışı eklenecek.';
