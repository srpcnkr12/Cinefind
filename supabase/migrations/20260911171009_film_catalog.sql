-- Faz 1: Film kataloğu ve veri katmanı (PRD bölüm 9.2, 19).
-- Kapsam notları için bkz. docs/adr/0004-film-stats-scope.md.

create extension if not exists pg_net with schema extensions;

-- ============================================================================
-- Türkçe-duyarlı arama normalizasyonu
-- ============================================================================
-- packages/i18n/src/slugify.ts'teki TURKISH_MAP ile birebir aynı harita
-- (ç/Ç→c, ğ/Ğ→g, ı/I/İ→i, ö/Ö→o, ş/Ş→s, ü/Ü→u), üç ayrı ortamda (tarayıcı/RN,
-- Deno edge function, Postgres) tutarlı sonuç versin diye bilinçli olarak
-- tekrarlanmıştır.
create or replace function normalize_tr(input text)
returns text
language sql
immutable
as $$
  select lower(translate(input, 'çÇğĞıIİöÖşŞüÜ', 'ccggiiiooSSuu'));
$$;

-- ============================================================================
-- Türler
-- ============================================================================
create table genres (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer unique,
  slug text not null unique
);

create table genre_translations (
  genre_id uuid not null references genres (id) on delete cascade,
  locale text not null check (locale in ('tr', 'en')),
  name text not null,
  primary key (genre_id, locale)
);

-- ============================================================================
-- Filmler
-- ============================================================================
create table films (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer unique,
  imdb_id text,
  media_type text not null default 'movie' check (media_type in ('movie')),
  original_title text not null,
  original_language text not null,
  release_date date,
  runtime integer,
  countries text[] not null default '{}',
  poster_path text,
  backdrop_path text,
  tmdb_popularity numeric,
  adult boolean not null default false,
  slug text not null unique,
  tmdb_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table film_translations (
  film_id uuid not null references films (id) on delete cascade,
  locale text not null check (locale in ('tr', 'en')),
  title text not null,
  tagline text,
  -- Kaynaktan (TMDB veya fixture) gelen atıflı özet. Editoryal, insan onaylı
  -- özet (editorial_overview) bu fazda doldurulmaz — bkz. PRD 11.2.
  overview_source text,
  editorial_overview text,
  seo_description text,
  primary key (film_id, locale)
);

create table film_genres (
  film_id uuid not null references films (id) on delete cascade,
  genre_id uuid not null references genres (id) on delete cascade,
  primary key (film_id, genre_id)
);

-- ============================================================================
-- Kişiler (yönetmen, oyuncu, ekip)
-- ============================================================================
create table people (
  id uuid primary key default gen_random_uuid(),
  tmdb_id integer unique,
  name text not null,
  slug text not null unique,
  profile_path text,
  known_for_department text,
  birthday date,
  deathday date,
  place_of_birth text,
  tmdb_popularity numeric,
  created_at timestamptz not null default now()
);

-- Editoryal biyografi (PRD 11.2 — ilk 200 kişi için insan onaylı). Bu fazda
-- sync tarafından doldurulmaz; tablo yalnızca şema tamlığı için açılır.
create table person_translations (
  person_id uuid not null references people (id) on delete cascade,
  locale text not null check (locale in ('tr', 'en')),
  editorial_bio text,
  primary key (person_id, locale)
);

create table film_credits (
  id uuid primary key default gen_random_uuid(),
  film_id uuid not null references films (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  role text not null check (
    role in ('director', 'writer', 'cast', 'cinematographer', 'composer', 'editor')
  ),
  character text,
  billing_order integer
);

create index film_credits_film_id_idx on film_credits (film_id);
create index film_genres_genre_id_idx on film_genres (genre_id);

-- ============================================================================
-- Film istatistikleri
-- ============================================================================
-- Faz 1'de yalnızca iskelet: watched_count/avg_rating/idf gibi alanlar
-- user_films (Faz 4) ve aktif kullanıcı sayısına (Faz 5, PRD 7.2) bağlı —
-- gerçek hesaplama o fazlarda eklenecek. Bkz. docs/adr/0004-film-stats-scope.md.
create table film_stats (
  film_id uuid primary key references films (id) on delete cascade,
  watched_count integer not null default 0,
  watchlist_count integer not null default 0,
  avg_rating numeric,
  rating_count integer not null default 0,
  weekly_adds integer not null default 0,
  idf numeric,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Koleksiyonlar
-- ============================================================================
create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('curated', 'genre', 'mood')),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  cover_film_ids uuid[] not null default '{}'
);

create table collection_translations (
  collection_id uuid not null references collections (id) on delete cascade,
  locale text not null check (locale in ('tr', 'en')),
  title text not null,
  intro text,
  seo_description text,
  primary key (collection_id, locale)
);

create table collection_films (
  collection_id uuid not null references collections (id) on delete cascade,
  film_id uuid not null references films (id) on delete cascade,
  position integer not null default 0,
  note text,
  primary key (collection_id, film_id)
);

create index collection_films_collection_id_idx on collection_films (collection_id, position);

-- ============================================================================
-- Nerede izlenir (JustWatch) — şema açılır, doldurma mantığı sonraki bir fazda
-- ============================================================================
create table watch_providers_cache (
  film_id uuid not null references films (id) on delete cascade,
  region text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (film_id, region)
);

-- ============================================================================
-- Arama indeksleri (PRD 9.7)
-- ============================================================================
create index film_translations_title_trgm_idx
  on film_translations using gin (normalize_tr(title) gin_trgm_ops);

create index films_original_title_trgm_idx
  on films using gin (normalize_tr(original_title) gin_trgm_ops);

-- ============================================================================
-- RLS — herkese okuma, yalnızca service_role yazma (PRD 8.3)
-- ============================================================================
alter table genres enable row level security;
alter table genre_translations enable row level security;
alter table films enable row level security;
alter table film_translations enable row level security;
alter table film_genres enable row level security;
alter table people enable row level security;
alter table person_translations enable row level security;
alter table film_credits enable row level security;
alter table film_stats enable row level security;
alter table collections enable row level security;
alter table collection_translations enable row level security;
alter table collection_films enable row level security;
alter table watch_providers_cache enable row level security;

create policy "genres_public_read" on genres for select using (true);
create policy "genre_translations_public_read" on genre_translations for select using (true);
create policy "films_public_read" on films for select using (true);
create policy "film_translations_public_read" on film_translations for select using (true);
create policy "film_genres_public_read" on film_genres for select using (true);
create policy "people_public_read" on people for select using (true);
create policy "person_translations_public_read" on person_translations for select using (true);
create policy "film_credits_public_read" on film_credits for select using (true);
create policy "film_stats_public_read" on film_stats for select using (true);
create policy "watch_providers_cache_public_read" on watch_providers_cache for select using (true);

-- Koleksiyonlar: yalnızca yayınlanmış olanlar herkese açık (taslaklar editoryal).
create policy "collections_public_read" on collections for select using (is_published);
create policy "collection_translations_public_read" on collection_translations for select using (
  exists (
    select 1 from collections c
    where c.id = collection_translations.collection_id and c.is_published
  )
);
create policy "collection_films_public_read" on collection_films for select using (
  exists (
    select 1 from collections c
    where c.id = collection_films.collection_id and c.is_published
  )
);

-- ============================================================================
-- Arama RPC'si (PRD 10.1: search_films)
-- ============================================================================
create or replace function search_films(query text, result_limit int default 20)
returns table (
  film_id uuid,
  slug text,
  title text,
  original_title text,
  release_year int,
  poster_path text,
  similarity_score real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with normalized as (
    select normalize_tr(query) as q
  ),
  ranked as (
    select
      f.id as film_id,
      f.slug,
      ft.title,
      f.original_title,
      extract(year from f.release_date)::int as release_year,
      f.poster_path,
      greatest(
        similarity(normalize_tr(ft.title), normalized.q),
        similarity(normalize_tr(f.original_title), normalized.q)
      ) as score
    from films f
    join film_translations ft on ft.film_id = f.id
    cross join normalized
    where f.adult = false
      and f.tmdb_synced_at is not null
  ),
  best_per_film as (
    select distinct on (film_id) *
    from ranked
    order by film_id, score desc
  )
  select film_id, slug, title, original_title, release_year, poster_path, score
  from best_per_film
  order by score desc
  limit result_limit;
$$;

grant execute on function search_films(text, int) to anon, authenticated;

-- ============================================================================
-- film_stats iskelet cron'u (gece, her filme sıfırlanmış bir satır garanti eder)
-- ============================================================================
select cron.schedule(
  'film_stats_bootstrap',
  '0 3 * * *',
  $$
    insert into public.film_stats (film_id)
    select f.id from public.films f
    left join public.film_stats fs on fs.film_id = f.id
    where fs.film_id is null;
  $$
);

-- ============================================================================
-- tmdb-sync günlük cron'u (PRD 10.2)
-- ============================================================================
-- ÖNEMLİ: Bu iş yalnızca hedef ortamda (staging/production) Supabase Vault'a
-- 'project_url' ve 'service_role_key' secret'ları tanımlandıktan SONRA fiilen
-- çalışır (bkz. supabase.com/docs/guides/functions/schedule-functions). Yerel
-- geliştirmede vault secret'ları olmadığı için bu iş kayıtlıdır ama tetiklendiğinde
-- başarısız olur — yerelde senkron `supabase functions serve` + doğrudan HTTP
-- çağrısıyla yapılır (bkz. docs Faz 1 doğrulama notları).
select cron.schedule(
  'tmdb_sync_daily',
  '0 4 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/tmdb-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
