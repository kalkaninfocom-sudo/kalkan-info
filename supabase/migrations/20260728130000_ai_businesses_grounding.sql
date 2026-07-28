-- KalkanInfo AI — Faz 1: ai_businesses grounding kolonları
-- Amaç: Lyra'nın SADECE gerçek Kalkan mekanlarını önermesi için zengin retrieval alanları.
-- Kaynak: data/restoranlar.json (177), oteller.json (16), plajlar.json (16), villalar.json (3), turlar.json.

create extension if not exists pg_trgm;

alter table public.ai_businesses
  add column if not exists area         text,
  add column if not exists address      text,
  add column if not exists cuisine      text,
  add column if not exists price        text,        -- "₺", "₺₺", "₺₺₺" veya "₺18.000/gece"
  add column if not exists rating        numeric(2,1),
  add column if not exists review_count  int,
  add column if not exists tags          text[] default '{}',
  add column if not exists summary       text,
  add column if not exists instagram     text,
  add column if not exists image         text,
  add column if not exists featured      boolean default false,
  add column if not exists source        text;        -- 'restoranlar.json' vb (yeniden-seed izlenebilirlik)

-- Upsert için venue_slug unique (seeder idempotent olsun)
create unique index if not exists uq_ai_biz_slug on public.ai_businesses (venue_slug);

-- Retrieval indeksleri
create index if not exists idx_ai_biz_type_rating on public.ai_businesses (type, featured desc nulls last, rating desc nulls last);
create index if not exists idx_ai_biz_name_trgm   on public.ai_businesses using gin (name gin_trgm_ops);
create index if not exists idx_ai_biz_tags_gin     on public.ai_businesses using gin (tags);
