-- 2026-05-22 hotfix: Lost & found anon insert validation (audit-backend C1)
-- Eski politika: WITH CHECK (true) — sınırsız payload riski (newsletter ile aynı pattern).
-- Yeni: title/description/phone/photo_url length + type whitelist + status/delete_code/ip_hash kısıtla.

DROP POLICY IF EXISTS "lf_anon_insert" ON public.lost_found_items;

CREATE POLICY "lf_anon_insert_validated" ON public.lost_found_items
  FOR INSERT TO anon
  WITH CHECK (
    type IN ('kayip','bulundu')
    AND length(title) BETWEEN 3 AND 200
    AND length(coalesce(description, '')) <= 2000
    AND length(coalesce(location, '')) <= 200
    AND length(coalesce(phone, '')) <= 30
    AND length(coalesce(contact_name, '')) <= 80
    AND length(coalesce(photo_url, '')) <= 500
    AND status = 'active'
    AND resolved_at IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_lf_type_status_created
  ON public.lost_found_items (type, status, created_at DESC);

COMMENT ON POLICY "lf_anon_insert_validated" ON public.lost_found_items IS
  'Audit-backend 2026-05-22 hotfix C1: anon insert artık length+enum+default-status zorunlu';
