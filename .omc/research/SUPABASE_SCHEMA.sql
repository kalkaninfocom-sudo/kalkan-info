-- ============================================================================
-- Kalkan Info — Supabase Postgres Schema
-- Hedef: Free tier (500MB DB, 1GB storage), tek geliştirici, basit ve okunabilir
-- Tarih: 2026-05-13
--
-- Kurulum:
--   1. Supabase projesi açın (free tier)
--   2. SQL Editor'da bu dosyanın TAMAMINI yapıştırın ve çalıştırın
--   3. .env içine SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY ekleyin
--   4. Storage'ta 'profiles' ve 'reviews' bucket'larını oluşturun (public read)
--   5. SQL Editor'da en alttaki SEED bölümünü ayrı çalıştırın (istege bağlı demo veri)
--
-- Karar özeti:
--   • i18n: JSONB jsonb_lang (yagsız, az tablo). Yapı: {"tr":"...","en":"...","ru":"...","ja":"...","ar":"..."}
--     tek dilli alanlar düz TEXT; çok dilli alanlar JSONB. Ayrı _translations tablosu YOK
--     (1.500 villa × 5 dil = 7.500 satır gereksiz; JSONB tek satır).
--   • PostGIS: KULLANMIYORUZ. 1.500 villa için lat/lng + index yeter. Kullanılan tek
--     coğrafi sorgu "yakındakiler" — bunu da Haversine SQL fonksiyonu ile çözüyoruz.
--     PostGIS 50+ MB yer kaplar, free tier'a yazık.
--   • Türkçe FTS: pg_trgm GIN index'i (Türkçe stop word düzeltmesi opsiyonel).
--   • Auth: Supabase Auth'a güveniyoruz; users tablosu profil + KVKK için PUBLIC
--     şemada, FK auth.users(id) ile bağlı.
--   • Statik veri (villalar/restoranlar/plajlar/...) Firestore tek koleksiyon
--     `profiles` taklit edilmiyor. İki ayrılık var:
--       - `listings` tablosu: site içeriği (villa, restoran, plaj, tur, antik kent,
--         aktivite, haber, hizmet). Polymorphic; tip alanıyla ayrılır. Tüm JSON'lar
--         buraya seed edilir.
--       - `providers` tablosu: KULLANICI tarafından eklenmiş hizmet sağlayıcılar
--         (Firestore'daki profiles/{id} ownerUid='pending' akışı). Onboarding akışı.
--     Bu ayrım gerekli çünkü listings tarihi/topluluk verisi, providers yaşayan
--     kullanıcı verisidir; lifecycle ve RLS farklıdır.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";   -- email için case-insensitive text

-- ---------------------------------------------------------------------------
-- ENUMS (sade tut — Firestore'da string olanları ENUM yapmıyoruz, esnekliği koruyoruz)
-- Yalnızca kritik state ENUM'lar
-- ---------------------------------------------------------------------------
CREATE TYPE listing_kind AS ENUM (
  'villa','restoran','plaj','tur','antik_kent','aktivite','hizmet','likya_etap','haber','eczane'
);
CREATE TYPE moderation_status AS ENUM ('pending','active','rejected','archived');
CREATE TYPE review_target_kind AS ENUM ('listing','provider','vacation');
CREATE TYPE review_status AS ENUM ('visible','hidden','reported');
CREATE TYPE job_category AS ENUM ('restoran','villa','otel','tur','hizmet','ofis','diger');
CREATE TYPE job_type AS ENUM ('full','part','seasonal','freelance');
CREATE TYPE job_status AS ENUM ('pending','active','closed','expired');
CREATE TYPE application_status AS ENUM ('pending','reviewed','accepted','rejected');
CREATE TYPE vacation_status AS ENUM ('draft','submitted','confirmed','cancelled');
CREATE TYPE mail_status AS ENUM ('queued','sent','failed');

-- ---------------------------------------------------------------------------
-- HELPER: is_admin()
-- Admin claim'i auth.jwt() üzerinden alıyoruz. Supabase tarafında kullanıcının
-- raw_app_meta_data'sına {"role":"admin"} eklenince çalışır.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Email doğrulanmış mı?
CREATE OR REPLACE FUNCTION public.is_email_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email_verified')::boolean;
$$;

-- Haversine: lat1,lng1 ve lat2,lng2 arası km (PostGIS olmadan)
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians(($3 - $1) / 2))^2 +
    cos(radians($1)) * cos(radians($3)) *
    sin(radians(($4 - $2) / 2))^2
  ));
$$;

-- updated_at otomatik tutucu
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. USERS — profil + KVKK (auth.users FK)
-- ============================================================================
CREATE TABLE public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           citext NOT NULL,
  display_name    text,
  photo_url       text,
  provider        text,                                 -- 'google'|'facebook'|'email'
  preferred_lang  text NOT NULL DEFAULT 'tr',           -- tr/en/ru/ja/ar
  marketing_opt_in boolean NOT NULL DEFAULT false,
  kvkk_consent    jsonb NOT NULL,                       -- {version,timestamp,ip}
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz,
  deleted_at      timestamptz                            -- KVKK madde 7 soft delete; null=aktif
);
CREATE INDEX users_email_idx ON public.users (email);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Yeni auth.users insert olunca otomatik public.users satırı oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, photo_url, provider, kvkk_consent)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    coalesce(NEW.raw_app_meta_data->>'provider','email'),
    jsonb_build_object('version','1.0','timestamp', now(), 'ip', null)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. LISTINGS — Sitenin TÜM statik içeriği (admin tarafindan yönetilir)
--   villalar.json, restoranlar.json, plajlar.json, turlar.json, antik-kentler.json,
--   aktiviteler.json, hizmetler.json, likya-yolu.json (stages), haberler.json
--   tek tabloda toplanır. Tipe özel alanlar `data` JSONB içinde tutulur.
--   Niye? Tip başına 8 tablo bakım yükü; veriler benzer şekilde gösteriliyor (kart+detay).
-- ============================================================================
CREATE TABLE public.listings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind            listing_kind NOT NULL,
  slug            text NOT NULL,                          -- url'de kullanılır
  external_id     text,                                   -- JSON'daki "id" alani (seed key)
  status          moderation_status NOT NULL DEFAULT 'active',
  -- i18n metin alanları
  name            text NOT NULL,                          -- TR default
  name_i18n       jsonb NOT NULL DEFAULT '{}'::jsonb,     -- {en,ru,ja,ar}
  summary         text,                                   -- TR default
  summary_i18n    jsonb NOT NULL DEFAULT '{}'::jsonb,
  description     text,
  description_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ortak metadata
  category        text,                                   -- "Fine Dining", "5+1" vs.
  tags            text[] NOT NULL DEFAULT '{}',
  -- konum
  lat             double precision,
  lng             double precision,
  address         text,
  location_label  text,                                   -- "Kalamar Koyu" gibi serbest
  distance_km     double precision,                       -- merkeze uzaklık (opsiyonel cache)
  -- görsel
  cover_image     text,
  gallery         text[] NOT NULL DEFAULT '{}',
  -- agregat
  rating          numeric(2,1),                           -- editoryal/önceden hesaplanmış (0..5)
  review_count    int NOT NULL DEFAULT 0,
  featured        boolean NOT NULL DEFAULT false,
  display_order   int NOT NULL DEFAULT 100,
  -- tipe özel
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- timestamps
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slug)
);
CREATE INDEX listings_kind_status_idx ON public.listings (kind, status, featured DESC, display_order, name);
CREATE INDEX listings_slug_idx        ON public.listings (slug);
CREATE INDEX listings_lat_lng_idx     ON public.listings (lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX listings_tags_gin        ON public.listings USING gin (tags);
CREATE INDEX listings_name_trgm       ON public.listings USING gin (name gin_trgm_ops);
CREATE INDEX listings_data_gin        ON public.listings USING gin (data jsonb_path_ops);
CREATE TRIGGER listings_set_updated_at BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. PROVIDERS — Kullanıcının eklediği hizmet sağlayıcılar (onboarding sonucu)
--   Firestore'daki `profiles/{id}` koleksiyonunun karşılığıdır.
--   listings'den ayrı çünkü: sahibi var, lifecycle pending→active→reject,
--   provider RLS'i daha sıkı.
-- ============================================================================
CREATE TABLE public.providers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            text NOT NULL,                           -- 'restoran'|'villa'|'asci'|'transfer'|'tur'|'hizmet'
  status          moderation_status NOT NULL DEFAULT 'pending',
  slug            text NOT NULL,
  -- temel bilgiler
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  category        text,
  summary         text CHECK (summary IS NULL OR length(summary) <= 280),
  description_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_range     text,                                    -- '$'|'$$'|'$$$'|'$$$$'
  -- konum
  lat             double precision,
  lng             double precision,
  address         text,
  -- iletişim
  phone           text,
  whatsapp        text,
  email           citext,
  website         text,
  -- görsel
  cover_image     text,
  gallery         text[] NOT NULL DEFAULT '{}',
  -- restoran menüsü vs. tipe özel
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- agregat
  rating_avg      numeric(2,1) NOT NULL DEFAULT 0,
  rating_count    int NOT NULL DEFAULT 0,
  verified        boolean NOT NULL DEFAULT false,
  featured        boolean NOT NULL DEFAULT false,
  -- timestamps
  approved_at     timestamptz,
  approved_by     uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug)
);
CREATE INDEX providers_type_status_idx   ON public.providers (type, status, rating_avg DESC);
CREATE INDEX providers_owner_idx         ON public.providers (owner_id, status);
CREATE INDEX providers_status_created_idx ON public.providers (status, created_at DESC);
CREATE INDEX providers_lat_lng_idx       ON public.providers (lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX providers_name_trgm         ON public.providers USING gin (name gin_trgm_ops);
CREATE TRIGGER providers_set_updated_at BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. PROVIDER_SERVICES — bir provider birden fazla hizmet kategorisi sunabilir
--   (örn. bir aşçı: 'Türk Mutfağı' + 'Vegan' + 'Catering')
-- ============================================================================
CREATE TABLE public.provider_services (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id     uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  category        text NOT NULL,                         -- 'Akdeniz mutfağı','Vegan'...
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,    -- fiyat, süre vs.
  UNIQUE (provider_id, category)
);
CREATE INDEX provider_services_category_idx ON public.provider_services (category);

-- ============================================================================
-- 5. REVIEWS — listings, providers veya vacations'a yorum
-- ============================================================================
CREATE TABLE public.reviews (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_kind     review_target_kind NOT NULL,
  target_id       uuid NOT NULL,                          -- polymorphic; FK yok bilerek
  author_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text            text NOT NULL CHECK (length(text) BETWEEN 10 AND 2000),
  photos          text[] NOT NULL DEFAULT '{}' CHECK (array_length(photos,1) IS NULL OR array_length(photos,1) <= 5),
  status          review_status NOT NULL DEFAULT 'visible',
  helpful         int NOT NULL DEFAULT 0,
  reply           jsonb,                                  -- {text, replied_at, replied_by}
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_target_idx ON public.reviews (target_kind, target_id, status, created_at DESC);
CREATE INDEX reviews_author_idx ON public.reviews (author_id, created_at DESC);
CREATE INDEX reviews_status_idx ON public.reviews (status, created_at DESC);
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Provider rating cache trigger
CREATE OR REPLACE FUNCTION public.refresh_provider_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_target uuid := coalesce(NEW.target_id, OLD.target_id);
  v_kind   review_target_kind := coalesce(NEW.target_kind, OLD.target_kind);
BEGIN
  IF v_kind = 'provider' THEN
    UPDATE public.providers p SET
      rating_avg   = coalesce((SELECT round(avg(r.rating)::numeric,1) FROM public.reviews r
                               WHERE r.target_kind='provider' AND r.target_id=p.id AND r.status='visible'),0),
      rating_count = (SELECT count(*) FROM public.reviews r
                      WHERE r.target_kind='provider' AND r.target_id=p.id AND r.status='visible')
    WHERE p.id = v_target;
  ELSIF v_kind = 'listing' THEN
    UPDATE public.listings l SET
      review_count = (SELECT count(*) FROM public.reviews r
                      WHERE r.target_kind='listing' AND r.target_id=l.id AND r.status='visible')
    WHERE l.id = v_target;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER reviews_refresh_rating
  AFTER INSERT OR UPDATE OF status, rating OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_provider_rating();

-- ============================================================================
-- 6. JOBS — iş ilanları
-- ============================================================================
CREATE TABLE public.jobs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  category        job_category NOT NULL,
  type            job_type NOT NULL,
  location        text NOT NULL CHECK (length(location) BETWEEN 1 AND 100),
  employer_name   text NOT NULL CHECK (length(employer_name) BETWEEN 1 AND 100),
  contact_email   citext NOT NULL,
  description_html text CHECK (description_html IS NULL OR length(description_html) <= 10000),
  requirements    text[] NOT NULL DEFAULT '{}' CHECK (array_length(requirements,1) IS NULL OR array_length(requirements,1) <= 20),
  languages       text[] NOT NULL DEFAULT '{}',
  experience      text,
  salary_min      int,
  salary_max      int,
  currency        text NOT NULL DEFAULT 'TRY',
  status          job_status NOT NULL DEFAULT 'pending',
  view_count      int NOT NULL DEFAULT 0,
  application_count int NOT NULL DEFAULT 0,
  published_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_active_idx        ON public.jobs (status, published_at DESC) WHERE status='active';
CREATE INDEX jobs_owner_idx         ON public.jobs (owner_id, created_at DESC);
CREATE INDEX jobs_cat_type_idx      ON public.jobs (category, type, status);
CREATE INDEX jobs_title_trgm        ON public.jobs USING gin (title gin_trgm_ops);
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. JOB_APPLICATIONS — başvurular
-- ============================================================================
CREATE TABLE public.job_applications (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_owner_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  applicant_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  applicant_name  text NOT NULL CHECK (length(applicant_name) BETWEEN 1 AND 100),
  applicant_phone text NOT NULL CHECK (length(applicant_phone) BETWEEN 1 AND 30),
  applicant_email citext NOT NULL CHECK (length(applicant_email) <= 200),
  cover_note      text CHECK (cover_note IS NULL OR length(cover_note) <= 2000),
  cv_url          text,
  status          application_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)                         -- aynı işe 2x başvuru yok
);
CREATE INDEX japps_job_idx        ON public.job_applications (job_id, created_at DESC);
CREATE INDEX japps_owner_idx      ON public.job_applications (job_owner_id, status);
CREATE INDEX japps_applicant_idx  ON public.job_applications (applicant_id, created_at DESC);
CREATE TRIGGER japps_set_updated_at BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Application count maintain
CREATE OR REPLACE FUNCTION public.bump_job_application_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.jobs SET application_count = application_count + 1 WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.jobs SET application_count = greatest(application_count - 1, 0) WHERE id = OLD.job_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER japps_bump_count
  AFTER INSERT OR DELETE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.bump_job_application_count();

-- ============================================================================
-- 8. VACATION_REQUESTS — Tatil Asistanı planları
-- ============================================================================
CREATE TABLE public.vacation_requests (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,  -- anonim plan da olabilir
  date_start         date NOT NULL,
  date_end           date NOT NULL,
  adults             smallint NOT NULL DEFAULT 2,
  children           smallint NOT NULL DEFAULT 0,
  budget             numeric(12,2),
  currency           text NOT NULL DEFAULT 'TRY',
  departure_airport  text,
  accommodation_type text,
  rooms              smallint,
  preferences        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- airlines, food, cuisine, activities, special
  ai_plan            jsonb,                               -- Claude/Local output: days/items/rationale
  claude_request_id  text,
  total_price        numeric(12,2),
  status             vacation_status NOT NULL DEFAULT 'draft',
  contacted_concierge boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (date_end >= date_start)
);
CREATE INDEX vacations_owner_idx  ON public.vacation_requests (owner_id, created_at DESC);
CREATE INDEX vacations_dates_idx  ON public.vacation_requests (date_start, date_end);
CREATE INDEX vacations_status_idx ON public.vacation_requests (status, created_at DESC);
CREATE TRIGGER vacations_set_updated_at BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 9. MAIL_QUEUE — Trigger Email Extension yerine kendi kuyruğumuz
--   Edge Function veya pg_cron + Resend/Postmark API ile boşaltılır.
-- ============================================================================
CREATE TABLE public.mail_queue (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email        citext NOT NULL,
  subject         text NOT NULL,
  body_html       text NOT NULL,
  body_text       text,
  template        text,                                   -- 'welcome','vacation_plan' vb.
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          mail_status NOT NULL DEFAULT 'queued',
  attempts        smallint NOT NULL DEFAULT 0,
  last_error      text,
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_queue_status_idx ON public.mail_queue (status, scheduled_at);

-- ============================================================================
-- 10. AUDIT_LOG — KVKK izlenebilirlik (export, delete, admin işlemleri)
-- ============================================================================
CREATE TABLE public.audit_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email     citext,
  action          text NOT NULL,                          -- 'export','delete','approve_provider'...
  target_kind     text,
  target_id       uuid,
  ip              inet,
  user_agent      text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_actor_idx  ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX audit_action_idx ON public.audit_log (action, created_at DESC);

-- ============================================================================
-- 11. NEWS_ITEMS — haber otomasyonu (Instagram harvester + WhatsApp)
--   haberler.json içeriği listings(kind='haber') olabilirdi ama otomasyon
--   workflow (pending→verified→published) için ayrı tablo daha temiz.
-- ============================================================================
CREATE TABLE public.news_items (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          text NOT NULL DEFAULT 'manual',         -- 'instagram','whatsapp','manual'
  source_ref      text,                                   -- ig post id, msg id
  title           text NOT NULL,
  summary         text,
  content         text,
  category        text,
  tags            text[] NOT NULL DEFAULT '{}',
  cover_image     text,
  status          moderation_status NOT NULL DEFAULT 'pending',
  verified_at     timestamptz,
  verified_by     uuid REFERENCES public.users(id),
  published_at    timestamptz,
  social_status   jsonb NOT NULL DEFAULT '{}'::jsonb,     -- {instagram: 'posted', x: 'queued'}
  featured        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX news_status_pub_idx ON public.news_items (status, published_at DESC);
CREATE INDEX news_cat_idx        ON public.news_items (status, category, published_at DESC);
CREATE INDEX news_source_ref_idx ON public.news_items (source, source_ref);
CREATE TRIGGER news_set_updated_at BEFORE UPDATE ON public.news_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 12. AUTOMATIONS — Cloud Function config + allowlist + state
-- ============================================================================
CREATE TABLE public.automations (
  key             text PRIMARY KEY,                       -- 'whatsapp-allowlist','instagram-profiles','nobetci-eczane'
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.users(id)
);
CREATE TRIGGER automations_set_updated_at BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 13. RATE_LIMITS — vacationPlanner spam koruması
-- ============================================================================
CREATE TABLE public.rate_limits (
  key             text PRIMARY KEY,                       -- 'plan_2026-05-13_<uid|ip>'
  count           int NOT NULL DEFAULT 0,
  resets_at       timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limits_resets_idx ON public.rate_limits (resets_at);

-- ============================================================================
-- ROW LEVEL SECURITY — POLICIES
-- Genel kural: tüm tablolarda RLS açık. Service role bypass eder.
-- ============================================================================

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_queue          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits         ENABLE ROW LEVEL SECURITY;

-- ---- USERS ----
CREATE POLICY users_self_read ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY users_self_insert ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- email değiştirmeyi engelle (trigger)
CREATE OR REPLACE FUNCTION public.protect_users_immutable_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'email is immutable; use auth.users to change email';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'id is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;
  IF NEW.provider IS DISTINCT FROM OLD.provider THEN
    NEW.provider := OLD.provider;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_protect_immutable BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_users_immutable_fields();

-- Delete: sadece servis rolü/admin (KVKK soft delete tercih edilir)
CREATE POLICY users_admin_delete ON public.users
  FOR DELETE USING (public.is_admin());

-- ---- LISTINGS — public read, sadece admin write ----
CREATE POLICY listings_public_read ON public.listings
  FOR SELECT USING (status = 'active' OR public.is_admin());
CREATE POLICY listings_admin_write ON public.listings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- PROVIDERS ----
CREATE POLICY providers_public_read ON public.providers
  FOR SELECT USING (
    status = 'active'
    OR auth.uid() = owner_id
    OR public.is_admin()
  );
CREATE POLICY providers_owner_insert ON public.providers
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    AND public.is_email_verified()
    AND status = 'pending'
  );
CREATE POLICY providers_owner_update ON public.providers
  FOR UPDATE USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());
-- Owner için immutable alanları trigger ile koru
CREATE OR REPLACE FUNCTION public.protect_providers_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'owner_id is immutable';
  END IF;
  -- owner status'u kendi değiştiremez; rating cache trigger kontrolünde
  NEW.status       := OLD.status;
  NEW.rating_avg   := OLD.rating_avg;
  NEW.rating_count := OLD.rating_count;
  NEW.approved_at  := OLD.approved_at;
  NEW.approved_by  := OLD.approved_by;
  NEW.verified     := OLD.verified;
  NEW.created_at   := OLD.created_at;
  RETURN NEW;
END;
$$;
CREATE TRIGGER providers_protect_immutable BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.protect_providers_immutable();
CREATE POLICY providers_admin_delete ON public.providers
  FOR DELETE USING (public.is_admin());

-- ---- PROVIDER_SERVICES ----
CREATE POLICY provider_services_public_read ON public.provider_services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND (p.status='active' OR p.owner_id=auth.uid() OR public.is_admin()))
  );
CREATE POLICY provider_services_owner_write ON public.provider_services
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.owner_id = auth.uid())
    OR public.is_admin()
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.owner_id = auth.uid())
    OR public.is_admin()
  );

-- ---- REVIEWS ----
CREATE POLICY reviews_public_read ON public.reviews
  FOR SELECT USING (
    status = 'visible'
    OR auth.uid() = author_id
    OR public.is_admin()
  );
CREATE POLICY reviews_author_insert ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND public.is_email_verified()
    AND status = 'visible'
  );
CREATE POLICY reviews_author_update ON public.reviews
  FOR UPDATE USING (auth.uid() = author_id OR public.is_admin())
  WITH CHECK (auth.uid() = author_id OR public.is_admin());
CREATE POLICY reviews_author_delete ON public.reviews
  FOR DELETE USING (auth.uid() = author_id OR public.is_admin());

-- ---- JOBS ----
CREATE POLICY jobs_public_read ON public.jobs
  FOR SELECT USING (
    (status = 'active' AND (expires_at IS NULL OR expires_at > now()))
    OR auth.uid() = owner_id
    OR public.is_admin()
  );
CREATE POLICY jobs_owner_insert ON public.jobs
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    AND public.is_email_verified()
    AND status = 'pending'
  );
CREATE POLICY jobs_owner_update ON public.jobs
  FOR UPDATE USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY jobs_owner_delete ON public.jobs
  FOR DELETE USING (auth.uid() = owner_id OR public.is_admin());

-- ---- JOB_APPLICATIONS ----
CREATE POLICY japps_party_read ON public.job_applications
  FOR SELECT USING (
    auth.uid() = applicant_id
    OR auth.uid() = job_owner_id
    OR public.is_admin()
  );
CREATE POLICY japps_applicant_insert ON public.job_applications
  FOR INSERT WITH CHECK (
    auth.uid() = applicant_id
    AND status = 'pending'
  );
CREATE POLICY japps_owner_status_update ON public.job_applications
  FOR UPDATE USING (auth.uid() = job_owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = job_owner_id OR public.is_admin());
CREATE POLICY japps_applicant_delete ON public.job_applications
  FOR DELETE USING (auth.uid() = applicant_id OR public.is_admin());

-- ---- VACATION_REQUESTS ----
CREATE POLICY vacations_owner_read ON public.vacation_requests
  FOR SELECT USING (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY vacations_anyone_insert ON public.vacation_requests
  FOR INSERT WITH CHECK (
    owner_id IS NULL OR auth.uid() = owner_id     -- anonim plan: owner null
  );
CREATE POLICY vacations_owner_update ON public.vacation_requests
  FOR UPDATE USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY vacations_owner_delete ON public.vacation_requests
  FOR DELETE USING (auth.uid() = owner_id OR public.is_admin());

-- ---- MAIL_QUEUE — sadece servis/admin ----
CREATE POLICY mail_admin_only ON public.mail_queue
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- AUDIT_LOG — kullanıcı kendi log'larını okur ----
CREATE POLICY audit_self_read ON public.audit_log
  FOR SELECT USING (auth.uid() = actor_id OR public.is_admin());
-- Yazma yalnızca service_role / admin
CREATE POLICY audit_admin_write ON public.audit_log
  FOR INSERT WITH CHECK (public.is_admin());

-- ---- NEWS_ITEMS ----
CREATE POLICY news_public_read ON public.news_items
  FOR SELECT USING (status = 'active' OR public.is_admin());
CREATE POLICY news_admin_write ON public.news_items
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- AUTOMATIONS — sadece admin ----
CREATE POLICY automations_admin ON public.automations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---- RATE_LIMITS — sadece service role; client'a kapalı ----
-- (Policy yok = RLS açık + her şey deny except service role)

-- ============================================================================
-- VIEWS — Frontend kolaylık (opsiyonel)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_active_jobs AS
SELECT * FROM public.jobs
WHERE status='active' AND (expires_at IS NULL OR expires_at > now());

CREATE OR REPLACE VIEW public.v_listings_villa AS
SELECT * FROM public.listings WHERE kind='villa' AND status='active';
CREATE OR REPLACE VIEW public.v_listings_restoran AS
SELECT * FROM public.listings WHERE kind='restoran' AND status='active';
CREATE OR REPLACE VIEW public.v_listings_plaj AS
SELECT * FROM public.listings WHERE kind='plaj' AND status='active';
CREATE OR REPLACE VIEW public.v_listings_tur AS
SELECT * FROM public.listings WHERE kind='tur' AND status='active';
CREATE OR REPLACE VIEW public.v_listings_antik AS
SELECT * FROM public.listings WHERE kind='antik_kent' AND status='active';
CREATE OR REPLACE VIEW public.v_listings_aktivite AS
SELECT * FROM public.listings WHERE kind='aktivite' AND status='active';

-- Yakındakiler RPC
CREATE OR REPLACE FUNCTION public.listings_near(
  p_lat double precision,
  p_lng double precision,
  p_kind listing_kind DEFAULT NULL,
  p_radius_km double precision DEFAULT 25,
  p_limit int DEFAULT 20
) RETURNS SETOF public.listings
LANGUAGE sql STABLE AS $$
  SELECT l.* FROM public.listings l
  WHERE l.status='active'
    AND (p_kind IS NULL OR l.kind = p_kind)
    AND l.lat IS NOT NULL AND l.lng IS NOT NULL
    AND public.haversine_km(p_lat, p_lng, l.lat, l.lng) <= p_radius_km
  ORDER BY public.haversine_km(p_lat, p_lng, l.lat, l.lng) ASC
  LIMIT p_limit;
$$;

-- Full text search RPC
CREATE OR REPLACE FUNCTION public.listings_search(
  p_query text,
  p_kind listing_kind DEFAULT NULL,
  p_limit int DEFAULT 30
) RETURNS SETOF public.listings
LANGUAGE sql STABLE AS $$
  SELECT l.* FROM public.listings l
  WHERE l.status='active'
    AND (p_kind IS NULL OR l.kind = p_kind)
    AND (
      l.name ILIKE '%' || p_query || '%'
      OR l.summary ILIKE '%' || p_query || '%'
      OR l.name % p_query                                  -- trigram
    )
  ORDER BY similarity(l.name, p_query) DESC, l.featured DESC
  LIMIT p_limit;
$$;

-- ============================================================================
-- SEED — Statik JSON içeriği seed_listings tablosuna insert için template
-- Aşağıdaki INSERT şablonları, her bir data/*.json için çalıştırılacak loader
-- scriptinin nasıl üreteceği örneğidir. Loader Node.js'te yazılacak (bkz. plan).
-- Manuel seed gerekmez; sadece NÖBETÇİ ECZANE (eczane.json) ve config örnek:
-- ============================================================================

-- Otomasyon konfigleri (Cloud Functions için)
INSERT INTO public.automations (key, data) VALUES
  ('whatsapp-allowlist', '{"phones":[]}'::jsonb),
  ('instagram-profiles', '{"profiles":["kalkanbelediyesi","kalkanofficial"]}'::jsonb),
  ('site-config', jsonb_build_object(
    'tagline','Yerel bilgi, seçili tavsiyeler, kurumsal hizmet',
    'primaryColor','#1a5e93',
    'accentColor','#f4b53d',
    'whatsapp','+90 530 665 07 94',
    'email','info@kalkaninfo.com'
  ))
ON CONFLICT (key) DO NOTHING;

-- Nöbetçi eczane (özel "tekil" listing; otomasyon günlük güncelliyor)
INSERT INTO public.listings (kind, slug, name, summary, address, data, status, featured)
VALUES (
  'eczane',
  'nobetci-eczane-bugun',
  'Doğa Eczanesi',
  'Kalkan bölgesinde bugün hizmet veren nöbetçi eczane.',
  'Kalkan, Şehitler Cd. No:35/C, 07580 Kaş/Antalya',
  jsonb_build_object(
    'phone','+90 242 844 31 12',
    'phoneRaw','02428443112',
    'mapUrl','https://maps.google.com/?q=Doğa+Eczanesi+Kalkan',
    'hours','09:00 (kapanış sonrası 24 saat nöbetçi)',
    'date','2026-05-02'
  ),
  'active', true
) ON CONFLICT (kind, slug) DO NOTHING;

-- ============================================================================
-- NOTLAR — Migration sonrası yapılacaklar
-- ----------------------------------------------------------------------------
-- 1. Storage bucket'lar:
--    - profiles    (public, 5 MB/file)  → onboarding görselleri
--    - reviews     (public, 3 MB/file)  → yorum fotoğrafları
--    - news        (public, 2 MB/file)  → otomasyon haber görselleri
--    Storage policy: yalnızca authenticated upload; public read.
--
-- 2. Edge Functions (Cloud Functions migration hedefi):
--    - vacation-planner       (callable)
--    - verify-news-item       (webhook)
--    - publish-to-social      (callable)
--    - whatsapp-webhook       (http)
--    - send-welcome-email     (auth.users insert trigger → mail_queue)
--    - instagram-harvester    (pg_cron, hourly)
--    - nobetci-eczane-sync    (pg_cron, daily 06:00 Europe/Istanbul)
--    - flush-mail-queue       (pg_cron, every 60 sec)
--
-- 3. Admin claim atama (Berkay için):
--    UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
--    WHERE email='berkayelmastas@gmail.com';
--
-- 4. Free tier mantığı:
--    - 13 tablo × ortalama 1-3 KB satır × max 50k satır ≈ <100 MB → bol bol yer var
--    - 1.500 villa + 30 restoran + 17 antik + ... = ~1.700 listing satırı, ~3 MB
--    - reviews / jobs / vacation_requests organik büyür; alarm 400 MB'ta
-- ============================================================================
