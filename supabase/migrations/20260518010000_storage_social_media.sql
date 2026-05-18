-- ============================================================================
-- Storage: social-media bucket (Faz 2B)
-- Public read, service_role full write, 50MB limit, image/* + video/*
-- ============================================================================

-- Bucket oluştur (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  true,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Eski policy'leri temizle (idempotent)
DROP POLICY IF EXISTS "social_media_anon_read"    ON storage.objects;
DROP POLICY IF EXISTS "social_media_service_all"  ON storage.objects;

-- anon: public read
CREATE POLICY "social_media_anon_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'social-media');

-- service_role: full CRUD
CREATE POLICY "social_media_service_all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'social-media')
  WITH CHECK (bucket_id = 'social-media');
